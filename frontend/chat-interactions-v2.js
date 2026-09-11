import { hasActiveGeneration, stopActiveGenerations } from './lib/api.js';

let lastSendActionAt = 0;

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
  document.querySelector('.prism-interaction-toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'prism-interaction-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  window.setTimeout(() => { toast.classList.remove('show'); window.setTimeout(() => toast.remove(), 160); }, 1300);
}

function addMessageActions() {
  const messages = document.querySelectorAll('.chat-app .message.user, .chat-app .message.assistant, .pcx-root .pcx-message.user, .pcx-root .pcx-message.assistant');
  messages.forEach((message) => {
    const body = message.querySelector('.message-content, .pcx-message-text, .markdown-message');
    if (!body || message.dataset.prismActions === '1') return;
    const actions = document.createElement('div');
    actions.className = 'prism-message-actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copiar';
    copy.addEventListener('click', async () => { try { await copyText(body.innerText || body.textContent || ''); addToast('Mensagem copiada'); } catch { addToast('Não foi possível copiar'); } });
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

function installStopButton(host) {
  if (!host || host.querySelector('.prism-stop-overlay')) return;
  host.classList.add('prism-stop-host');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'prism-stop-overlay';
  button.textContent = 'Parar';
  button.setAttribute('aria-label', 'Parar resposta');
  button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); stopActiveGenerations(); });
  host.appendChild(button);
}

function removeStopButtons() {
  document.querySelectorAll('.prism-stop-overlay').forEach((button) => button.remove());
  document.querySelectorAll('.prism-stop-host').forEach((host) => host.classList.remove('prism-stop-host'));
}

function keepSendButtonUsable() {
  const button = document.querySelector('.chat-app .send-button');
  const input = document.querySelector('.chat-app .composer textarea');
  if (!button || !input || button.textContent.trim() !== 'Enviar') return;
  if (input.value.trim()) button.removeAttribute('disabled');
}

function suppressDuplicateSendActions(event) {
  const now = performance.now();
  const isTextInput = event.target?.matches?.('.chat-app .composer textarea');
  const isSendButton = event.target?.closest?.('.chat-app .send-button');
  const validEnter = isTextInput && event.type === 'keydown' && event.key === 'Enter' && !event.shiftKey;
  const validClick = isSendButton && event.type === 'click';
  if (!validEnter && !validClick) return;
  if (!document.querySelector('.chat-app .composer textarea')?.value.trim()) return;
  if (now - lastSendActionAt < 450) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return;
  }
  lastSendActionAt = now;
}

document.addEventListener('click', suppressDuplicateSendActions, true);
document.addEventListener('keydown', suppressDuplicateSendActions, true);

function refresh() {
  addMessageActions();
  keepSendButtonUsable();
  const active = hasActiveGeneration();
  if (active) {
    const chatSend = document.querySelector('.chat-app .send-button');
    if (chatSend) installStopButton(chatSend.parentElement);
    const codexSend = document.querySelector('.pcx-root .pcx-send');
    if (codexSend) installStopButton(codexSend.parentElement);
  } else removeStopButtons();
}

const observer = new MutationObserver(refresh);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.setInterval(refresh, 180);
refresh();
