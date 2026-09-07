const generationControllers = new Set();
let generationId = 0;

function registerGenerationController(controller) {
  generationControllers.add(controller);
  generationId += 1;
  return generationId;
}

function unregisterGenerationController(controller) {
  generationControllers.delete(controller);
}

window.__prismGenerationState = {
  active() { return generationControllers.size > 0; },
  stop() {
    for (const controller of [...generationControllers]) controller.abort();
  },
  register(controller) { return registerGenerationController(controller); },
  unregister(controller) { unregisterGenerationController(controller); },
};

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
  return Promise.resolve();
}

function setReactValue(element, value) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function addToast(text) {
  const existing = document.querySelector('.prism-interaction-toast');
  existing?.remove();
  const toast = document.createElement('div');
  toast.className = 'prism-interaction-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  window.setTimeout(() => {
    toast.classList.remove('show');
    window.setTimeout(() => toast.remove(), 160);
  }, 1300);
}

function addMessageActions() {
  const messages = document.querySelectorAll('.chat-app .message.user, .chat-app .message.assistant, .pcx-root .pcx-message.user, .pcx-root .pcx-message.assistant');
  messages.forEach((message) => {
    if (message.dataset.prismActions === '1') return;
    const body = message.querySelector('.message-content, .pcx-message-text');
    if (!body) return;

    const actions = document.createElement('div');
    actions.className = 'prism-message-actions';

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copiar';
    copy.addEventListener('click', async () => {
      try {
        await copyText(body.innerText || body.textContent || '');
        addToast('Mensagem copiada');
      } catch {
        addToast('Não foi possível copiar');
      }
    });
    actions.appendChild(copy);

    if (message.classList.contains('user')) {
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => {
        const textarea = document.querySelector('.chat-app .composer textarea, .pcx-root .pcx-composer textarea');
        if (!textarea) return;
        setReactValue(textarea, body.innerText || body.textContent || '');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        addToast('Mensagem pronta para editar');
      });
      actions.appendChild(edit);
    }

    message.appendChild(actions);
    message.dataset.prismActions = '1';
  });
}

function installStopButton(host, trigger) {
  if (!host || host.querySelector('.prism-stop-overlay')) return;
  host.classList.add('prism-stop-host');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'prism-stop-overlay';
  button.textContent = 'Parar';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.__prismGenerationState.stop();
  });
  host.appendChild(button);
  trigger?.();
}

function removeStopButtons() {
  document.querySelectorAll('.prism-stop-overlay').forEach((button) => button.remove());
  document.querySelectorAll('.prism-stop-host').forEach((host) => host.classList.remove('prism-stop-host'));
}

function enhanceModelPicker(root) {
  if (!root || root.dataset.prismModels === '1') return;
  const items = [...root.querySelectorAll('.picker-model')];
  if (items.length) {
    const moreItem = items.find((item) => /Taff 1\.0|Taff 1\.0A/i.test(item.textContent));
    const list = root.querySelector('.picker-list');
    if (moreItem && list) {
      moreItem.remove();
      const more = document.createElement('div');
      more.className = 'prism-more-models';
      more.innerHTML = '<div class="prism-more-title">Mais modelos</div>';
      const clone = moreItem.cloneNode(true);
      clone.addEventListener('click', () => moreItem.click());
      more.appendChild(clone);
      list.insertAdjacentElement('afterend', more);
    }
  }
  const codexButtons = [...root.querySelectorAll('.pcx-model-dropdown > button')];
  if (codexButtons.length) {
    const moreButton = codexButtons.find((item) => /Taff 1\.0|Taff 1\.0A/i.test(item.textContent));
    if (moreButton && !root.querySelector('.prism-more-models')) {
      moreButton.style.display = 'none';
      const more = document.createElement('div');
      more.className = 'prism-more-models codex-more-models';
      more.innerHTML = '<div class="prism-more-title">Mais modelos</div>';
      const clone = moreButton.cloneNode(true);
      clone.style.display = '';
      clone.addEventListener('click', () => moreButton.click());
      more.appendChild(clone);
      moreButton.parentElement.appendChild(more);
    }
  }
  root.dataset.prismModels = '1';
}

function refresh() {
  addMessageActions();
  const active = window.__prismGenerationState.active();
  if (active) {
    const chatSend = document.querySelector('.chat-app .send-button');
    if (chatSend) installStopButton(chatSend.parentElement, () => { chatSend.setAttribute('aria-label', 'Parar resposta'); });
    const codexSend = document.querySelector('.pcx-root .pcx-send');
    if (codexSend) installStopButton(codexSend.parentElement, () => { codexSend.setAttribute('aria-label', 'Parar resposta'); });
  } else {
    removeStopButtons();
  }

  document.querySelectorAll('.chat-app .model-picker, .pcx-root .pcx-model-dropdown').forEach(enhanceModelPicker);
}

const observer = new MutationObserver(refresh);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.setInterval(refresh, 180);
refresh();
