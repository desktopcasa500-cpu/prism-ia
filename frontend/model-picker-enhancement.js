const MODEL_CONFIG = {
  nano: { label: 'Prism Nano 1.0A', short: 'Nano 1.0A', description: 'Rápido para tarefas do dia a dia', rank: 0 },
  mini: { label: 'Prism Mini 1.0A', short: 'Mini 1.0A', description: 'Conversa, escrita e programação', rank: 0 },
  edge: { label: 'Prism Edge 1.0A', short: 'Edge 1.0A', description: 'Mais profundidade para decisões complexas', rank: 2 },
  tex15: { label: 'Prism Tex 1.5B', short: 'Tex 1.5B', description: 'Código, documentação e arquitetura', rank: 2 },
  taff2: { label: 'Prism Taff 2.0', short: 'Taff 2.0', description: 'O modelo mais forte da linha Prism', rank: 3 },
  taff1: { label: 'Prism Taff 1.0A', short: 'Taff 1.0A', description: 'Projetos complexos e debugging', rank: 3 },
  tex10: { label: 'Prism Tex 1.0A', short: 'Tex 1.0A', description: 'Base técnica para desenvolvimento', rank: 2 },
};
const RANKS = { free: 0, 'grátis': 0, base: 1, medium: 2, pro: 3, empresarial: 4, enterprise: 4 };
const state = { custom: null, observer: null, timer: null };

function normalize(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getRank() {
  const plan = normalize(document.querySelector('.chat-app .profile-text small')?.textContent);
  return RANKS[plan] ?? 0;
}

function nativeButtons(picker) {
  return [...picker.querySelectorAll('.picker-model')];
}

function findNativeButton(picker, token) {
  return nativeButtons(picker).find((button) => normalize(button.textContent).includes(normalize(token)));
}

function requestNativeModel(picker, token) {
  const button = findNativeButton(picker, token);
  if (!button) return;
  button.click();
  window.setTimeout(sync, 0);
}

function buildRow(config, picker, locked, selected, nativeToken) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `prism-model-row${selected ? ' selected' : ''}${locked ? ' locked' : ''}`;
  button.disabled = false;
  button.innerHTML = `<span class="prism-model-copy"><strong>${config.label}</strong><small>${config.description}</small></span><b>${locked ? 'Fazer upgrade' : selected ? 'Atual' : ''}</b>`;
  button.addEventListener('click', () => {
    if (locked) requestNativeModel(picker, nativeToken);
    else requestNativeModel(picker, nativeToken);
  });
  return button;
}

function getCurrentModel(picker) {
  const nativeSelected = nativeButtons(picker).find((button) => button.classList.contains('selected'));
  const text = normalize(nativeSelected?.textContent || document.querySelector('.chat-app .topbar-model span')?.textContent);
  if (text.includes('nano')) return 'nano';
  if (text.includes('mini')) return 'mini';
  if (text.includes('edge')) return 'edge';
  if (text.includes('tex')) return 'tex15';
  if (text.includes('taff 2')) return 'taff2';
  return 'mini';
}

function createCustomPicker(picker) {
  const rank = getRank();
  const current = getCurrentModel(picker);
  const shell = document.createElement('div');
  shell.className = 'prism-model-picker-custom';

  const head = document.createElement('div');
  head.className = 'prism-model-head';
  head.innerHTML = '<span>MODELO</span><strong>Escolha o modelo</strong>';
  shell.appendChild(head);

  const main = document.createElement('div');
  main.className = 'prism-model-main';
  const mainModels = [
    ['nano', 'Nano'],
    ['mini', 'Mini'],
    ...(rank >= MODEL_CONFIG.edge.rank ? [['edge', 'Edge']] : []),
    ['tex15', 'Tex'],
    ['taff2', 'Taff'],
  ];
  const nativeToken = { nano: 'Nano', mini: 'Mini', edge: 'Edge', tex15: 'Tex', taff2: 'Taff 2' };
  mainModels.forEach(([key]) => {
    const config = MODEL_CONFIG[key];
    main.appendChild(buildRow(config, picker, rank < config.rank, current === key, nativeToken[key]));
  });
  shell.appendChild(main);

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'prism-model-more-trigger';
  more.innerHTML = '<span><strong>Mais modelos</strong><small>Taff 1.0A · Tex 1.0A</small></span><b>›</b>';
  const moreList = document.createElement('div');
  moreList.className = 'prism-model-more-list';
  moreList.hidden = true;
  moreList.appendChild(buildRow(MODEL_CONFIG.taff1, picker, rank < MODEL_CONFIG.taff1.rank, current === 'taff1', 'Taff 1'));
  moreList.appendChild(buildRow(MODEL_CONFIG.tex10, picker, rank < MODEL_CONFIG.tex10.rank, false, 'Tex 1.5'));
  more.addEventListener('click', () => {
    moreList.hidden = !moreList.hidden;
    more.classList.toggle('open', !moreList.hidden);
  });
  shell.appendChild(more);
  shell.appendChild(moreList);

  const foot = document.createElement('div');
  foot.className = 'prism-model-foot';
  foot.textContent = 'Os modelos bloqueados ficam disponíveis após o upgrade do plano.';
  shell.appendChild(foot);
  return shell;
}

function sync() {
  const app = document.querySelector('.chat-app');
  if (!app) return;
  const picker = app.querySelector('.model-picker');
  if (!picker) {
    state.custom?.remove();
    state.custom = null;
    return;
  }
  if (getComputedStyle(picker).display === 'none') {
    state.custom?.remove();
    state.custom = null;
    return;
  }
  if (!state.custom || !picker.parentElement?.contains(state.custom)) {
    state.custom?.remove();
    state.custom = createCustomPicker(picker);
    picker.parentElement.appendChild(state.custom);
  }
  picker.style.display = 'none';
}

function start() {
  if (state.observer) return;
  state.observer = new MutationObserver(() => {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(sync, 0);
  });
  state.observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.topbar-model')) window.setTimeout(sync, 0);
    if (!event.target.closest('.prism-model-picker-custom') && !event.target.closest('.topbar-model')) {
      state.custom?.remove();
      state.custom = null;
    }
  }, true);
  sync();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
