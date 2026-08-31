const AUTOSTART_KEY = 'prism_codex_intro_autostarted';
const PROMPT = 'Create a website for selling my clothes.';
const MODEL = 'prism-taff-2.0';
const THINKING = 'ultracode';

function authHeaders() {
  const token = localStorage.getItem('prism_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: 'application/json', ...authHeaders(), ...(options.headers || {}) },
    credentials: 'same-origin',
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw }; }
  if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  return data;
}

async function readStream(response) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((item) => item.startsWith('data:'));
      if (!line) continue;
      try {
        const event = JSON.parse(line.slice(5).trim());
        window.dispatchEvent(new CustomEvent('prism:codex-agent-state', { detail: { state: event.type === 'error' ? 'failed' : event.type === 'result' ? 'completed' : event.type === 'phase' ? 'streaming' : 'started', event } }));
      } catch {}
    }
    if (done) break;
  }
}

async function startRealAgent(detail) {
  if (sessionStorage.getItem(AUTOSTART_KEY) === '1' || !localStorage.getItem('prism_token')) return;
  sessionStorage.setItem(AUTOSTART_KEY, '1');
  window.dispatchEvent(new CustomEvent('prism:codex-agent-state', { detail: { state: 'started' } }));
  try {
    const list = await jsonRequest('/api/projects');
    let project = Array.isArray(list.projects) ? list.projects[0] : null;
    if (!project) {
      const created = await jsonRequest('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Prism Codex — Demo' }) });
      project = created.project;
    }
    if (!project?.id) throw new Error('O workspace não retornou um projeto válido.');
    const response = await fetch('/api/ai/generate/stream', {
      method: 'POST',
      headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', ...authHeaders() },
      credentials: 'same-origin',
      body: JSON.stringify({ model: detail?.model || MODEL, thinking: THINKING, prompt: detail?.prompt || PROMPT, projectId: project.id, context: '' }),
    });
    if (!response.ok) throw new Error(`Agente retornou HTTP ${response.status}`);
    await readStream(response);
  } catch (error) {
    window.dispatchEvent(new CustomEvent('prism:codex-agent-state', { detail: { state: 'failed', error: error?.message || 'Falha ao iniciar o agente' } }));
  }
}

window.addEventListener('prism:codex-autostart', (event) => {
  void startRealAgent(event.detail);
});
