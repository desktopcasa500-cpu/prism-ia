import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePersistentCodex } from '../lib/usePersistentCodex.js';
import { api } from '../lib/api.js';
import '../prism-codex-refined.css';

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude', model: 'claude-fable-5-1', enabled: true },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', enabled: true },
  { id: 'gemini', label: 'Gemini', model: 'gemini-3.8-flash', enabled: true },
];
const MODELS = [
  ['prism-nano-1.0', 'Prism Nano 1.0'],
  ['prism-mini-1.0', 'Prism Mini 1.0'],
  ['prism-tex-1.5', 'Prism Tex 1.5'],
  ['prism-taff-1.0', 'Prism Taff 1.0'],
  ['prism-taff-2.0', 'Prism Taff 2.0'],
];
const EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];
const VIBE_PATTERN = /\b(site|website|webapp|web app|jogo|game|app|aplicativo|api|sistema|script|scripts|c[oó]digo|code|componente|p[aá]gina|landing|projeto|arquivo|arquivos|npm|react|python|godot|unity|html|css|javascript|criar|construir|implementar|programar)\b/i;
const PHASES = [
  ['received', 'Pedido recebido'],
  ['analyzing', 'Analisando o projeto'],
  ['planning', 'Planejando'],
  ['writing', 'Escrevendo arquivos'],
  ['reviewing', 'Revisando'],
  ['updating', 'Atualizando o workspace'],
  ['completed', 'Concluído'],
];
const STARTER = [
  { path: 'src/App.jsx', kind: 'file', content: 'export default function App() {\n  return <main>Comece a construir.</main>;\n}\n' },
  { path: 'src/index.css', kind: 'file', content: '' },
  { path: 'package.json', kind: 'file', content: '{"name":"prism-project"}\n' },
];
const PLANS = [
  ['Grátis', 'R$0', 'Mini/Nano HIGH', '5 créditos/dia'],
  ['Base', 'R$8', 'Mini/Nano/Edge X-HIGH', '30 créditos/dia'],
  ['Medium', 'R$30', 'Mini/Nano/Edge MAX', '700 créditos/dia'],
  ['Pro', 'R$90', 'Tex/Taff HIGH', '2000 créditos/dia'],
  ['Empresarial', 'R$140', 'Todos MAX', '6000 créditos/dia'],
];

function mapMessage(message) {
  let metadata = {};
  try { metadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {}); } catch {}
  return {
    id: message.id,
    role: message.role,
    text: message.content || '',
    provider: message.provider || '',
    model: message.model_id || '',
    tools: Array.isArray(metadata.tools_used) ? metadata.tools_used : [],
    files: Array.isArray(message.files) ? message.files : [],
  };
}
function readProviders() {
  try {
    const raw = JSON.parse(localStorage.getItem('prism_codex_providers') || 'null');
    if (!Array.isArray(raw)) return PROVIDERS;
    return PROVIDERS.map((base) => ({ ...base, ...(raw.find((item) => item.id === base.id) || {}) }));
  } catch { return PROVIDERS; }
}
function previewFor(files) {
  const real = files.filter((file) => file.kind !== 'folder');
  const html = real.find((file) => /(^|\/)index\.html$/i.test(file.path)) || real.find((file) => /\.html$/i.test(file.path));
  const css = real.filter((file) => /\.css$/i.test(file.path)).map((file) => file.content || '').join('\n');
  if (html) {
    let output = html.content || '';
    if (css && !/<style/i.test(output)) output = output.replace('</head>', `<style>${css}</style></head>`);
    return output;
  }
  const jsx = real.find((file) => /\.(jsx|tsx)$/i.test(file.path));
  if (!jsx) return '';
  const safe = (jsx.content || '').replace(/import[\s\S]*?;\s*/g, '').replace(/export default /g, '').replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>${css}</style></head><body><div id="root"></div><script type="text/babel">${safe}\nReactDOM.createRoot(document.getElementById('root')).render(typeof App !== 'undefined' ? React.createElement(App) : React.createElement('div',null,'Preview indisponível'));</script></body></html>`;
}
function sessionDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}
function StepList({ phase, steps }) {
  const active = PHASES.findIndex(([id]) => id === phase);
  return <div className="cd-steps">{PHASES.map(([id, label], index) => {
    const step = steps.find((item) => item.phase === id);
    return <div className={`cd-step ${index < active ? 'done' : ''} ${id === phase ? 'active' : ''}`} key={id}>
      <span className="cd-step-mark">{index < active ? '1' : id === phase ? '2' : ''}</span>
      <div><strong>{label}</strong>{step?.detail && <small>{step.detail}</small>}</div>
    </div>;
  })}</div>;
}

export default function Codex() {
  const { preferences, updatePreference, cacheSession, cachedSession } = usePersistentCodex();
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState('prism-taff-2.0');
  const [effort, setEffort] = useState(preferences.effort || 'medium');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState({});
  const [compareMode, setCompareMode] = useState(false);
  const [providers, setProviders] = useState(readProviders);
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpActive, setMcpActive] = useState([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [files, setFiles] = useState(STARTER);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [activeFile, setActiveFile] = useState(STARTER[0].path);
  const [code, setCode] = useState(STARTER[0].content);
  const [tab, setTab] = useState('preview');
  const [phase, setPhase] = useState('');
  const [steps, setSteps] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const controllerRef = useRef(null);
  const timersRef = useRef(new Set());

  const activeModelLabel = MODELS.find(([id]) => id === model)?.[1] || model;
  const visibleSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((item) => (item.title || 'Nova conversa').toLowerCase().includes(q));
  }, [search, sessions]);
  const visibleFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => !q || file.path.toLowerCase().includes(q));
  }, [files, search]);
  const context = useMemo(() => messages.slice(-16).map((item) => `${item.role}: ${item.text}`).join('\n'), [messages]);

  useEffect(() => localStorage.setItem('prism_codex_providers', JSON.stringify(providers)), [providers]);
  useEffect(() => updatePreference('effort', effort), [effort, updatePreference]);
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 100); return () => clearInterval(timer); }, [running]);
  useEffect(() => () => timersRef.current.forEach((timer) => clearInterval(timer)), []);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); }
      if (event.key === 'Escape') { setCommandOpen(false); setModelOpen(false); setEffortOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadProject = useCallback(async () => {
    const data = await api.get('/projects');
    let project = data.projects?.[0];
    if (!project) {
      const created = await api.post('/projects', { name: 'Novo projeto' });
      project = created.project;
      await Promise.all(STARTER.map((file) => api.post('/files', { projectId: project.id, path: file.path, content: file.content, kind: 'file' })));
    }
    const detail = await api.get(`/projects/${project.id}`);
    const loaded = detail.files?.length ? detail.files.map((file) => ({ ...file, kind: file.kind || 'file' })) : STARTER;
    const first = loaded.find((file) => file.kind !== 'folder') || STARTER[0];
    setProjectId(project.id); setProjectName(project.name || 'Novo projeto'); setFiles(loaded); setActiveFile(first.path); setCode(first.content || '');
  }, []);
  const loadSessions = useCallback(async () => {
    const data = await api.get('/chat/sessions');
    const next = data.sessions || [];
    setSessions(next);
    if (!sessionId && next[0]) setSessionId(next[0].id);
  }, [sessionId]);
  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setSessionId(id); setRuns({}); setError('');
    const cached = await cachedSession(id).catch(() => null);
    if (cached) setMessages(cached);
    try {
      const data = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      const next = (data.messages || []).map(mapMessage);
      setMessages(next); cacheSession(id, next).catch(() => {});
    } catch (cause) { if (!cached) setError(cause.message || 'Não foi possível carregar a conversa.'); }
  }, [cacheSession, cachedSession]);
  const loadMcp = useCallback(async () => {
    try {
      const data = await api.get('/mcp'); const next = data.servers || []; setMcpServers(next);
      const saved = Array.isArray(preferences.mcpServerIds) ? preferences.mcpServerIds : next.map((server) => server.id);
      setMcpActive(saved.filter((id) => next.some((server) => server.id === id)));
    } catch { setMcpServers([]); setMcpActive([]); }
  }, [preferences.mcpServerIds]);
  useEffect(() => { Promise.all([loadProject(), loadSessions(), loadMcp()]).catch((cause) => setError(cause.message || 'Não foi possível carregar o Codex.')); }, [loadProject, loadSessions, loadMcp]);
  useEffect(() => { if (sessionId) loadSession(sessionId).catch(() => {}); }, [sessionId, loadSession]);

  async function newSession() {
    if (running) return;
    try {
      const data = await api.post('/chat/sessions', { title: 'Nova conversa' });
      setSessions((items) => [data.session, ...items]); setSessionId(data.session.id); setMessages([]); setRuns({}); setPrompt(''); setMode('chat');
    } catch (cause) { setError(cause.message || 'Não foi possível iniciar uma conversa.'); }
  }
  async function renameSession(session) {
    const title = window.prompt('Nome da conversa', session.title || 'Nova conversa');
    if (!title?.trim()) return;
    try { const data = await api.patch(`/chat/sessions/${encodeURIComponent(session.id)}`, { title: title.trim() }); setSessions((items) => items.map((item) => item.id === session.id ? data.session : item)); }
    catch (cause) { setError(cause.message || 'Não foi possível renomear a conversa.'); }
  }
  async function deleteSession(session) {
    if (!window.confirm(`Excluir “${session.title || 'Nova conversa'}”?`)) return;
    try {
      await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`);
      const next = sessions.filter((item) => item.id !== session.id); setSessions(next);
      if (session.id === sessionId) { setSessionId(next[0]?.id || null); setMessages([]); setRuns({}); }
    } catch (cause) { setError(cause.message || 'Não foi possível excluir a conversa.'); }
  }
  function toggleProvider(id) { setProviders((items) => items.map((item) => item.id === id ? { ...item, enabled: item.enabled === false } : item)); }
  function toggleMcp(id) { setMcpActive((items) => { const next = items.includes(id) ? items.filter((value) => value !== id) : [...items, id]; updatePreference('mcpServerIds', next); return next; }); }
  function selectFile(file) { if (!file || file.kind === 'folder') return; setActiveFile(file.path); setCode(file.content || ''); setTab('code'); }

  async function sendChat(value) {
    let sid = sessionId;
    if (!sid) { const created = await api.post('/chat/sessions', { title: value.slice(0, 64) }); sid = created.session.id; setSessionId(sid); setSessions((items) => [created.session, ...items]); }
    const userMessage = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] };
    const nextMessages = [...messages, userMessage]; setMessages(nextMessages); setPrompt(''); setRunning(true); setError('');
    try {
      if (compareMode) {
        const selected = providers.filter((item) => item.enabled !== false).map(({ id, model: providerModel }) => ({ provider: id, model: providerModel }));
        if (!selected.length) throw new Error('Ative pelo menos um modelo para comparar.');
        const initial = Object.fromEntries(selected.map((item) => [item.provider, { provider: item.provider, model: item.model, status: 'running', text: '', thinking_summary: '', elapsed_ms: 0, tools_used: [] }]));
        setRuns(initial);
        const result = await api.post('/chat/parallel', { sessionId: sid, content: value, context, effort, models: selected, mcpServerIds: mcpActive }, { timeout: 180000 });
        setRuns(Object.fromEntries((result.results || []).map((item) => [item.provider, item])));
        const persisted = (result.saved || []).map(mapMessage); const finalMessages = [...nextMessages, ...persisted]; setMessages(finalMessages); cacheSession(sid, finalMessages).catch(() => {});
      } else {
        const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content: value, model, effort }, { timeout: 120000 });
        const message = mapMessage(result.message || {}); setMessages((items) => [...items, message]); cacheSession(sid, [...nextMessages, message]).catch(() => {});
      }
      await loadSessions();
    } catch (cause) { setError(cause.message || 'Não foi possível concluir a resposta.'); }
    finally { setRunning(false); }
  }

  async function sendVibe(value) {
    if (!projectId) { setError('O projeto ainda está carregando.'); return; }
    const userMessage = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] };
    setMessages((items) => [...items, userMessage]); setPrompt(''); setMode('vibe'); setRunning(true); setError(''); setPhase('received'); setSteps([]); startedAt.current = Date.now(); setElapsed(0);
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      const result = await api.streamPost('/ai/generate/stream', { model, thinking: 'ultracode', prompt: value, context, projectId }, (event) => {
        if (event.type === 'phase') { setPhase(event.phase); setSteps((current) => [...current.filter((item) => item.phase !== event.phase), event]); }
        if (event.type === 'artifact') {
          setTab('code'); setActiveFile(event.path); const full = String(event.content || '');
          setFiles((current) => current.some((file) => file.path === event.path) ? current.map((file) => file.path === event.path ? { ...file, content: full, kind: 'file' } : file) : [...current, { path: event.path, content: full, kind: 'file' }]);
          let cursor = 0;
          const timer = window.setInterval(() => { cursor = Math.min(full.length, cursor + Math.max(24, Math.ceil(full.length / 70))); setCode(full.slice(0, cursor)); if (cursor >= full.length) { clearInterval(timer); timersRef.current.delete(timer); } }, 18);
          timersRef.current.add(timer);
        }
      }, { timeout: 180000, signal: controller.signal });
      await loadProject();
      setMessages((items) => [...items, { id: `assistant-${Date.now()}`, role: 'assistant', text: result.text || 'Alterações aplicadas ao projeto.', tools: (result.tools_used || []).filter((item) => item?.tool), files: [...(result.files_created || []), ...(result.files_changed || [])] }]);
    } catch (cause) { if (cause.name !== 'AbortError') setError(cause.message || 'O agente não conseguiu concluir a tarefa.'); }
    finally { setRunning(false); controllerRef.current = null; }
  }
  async function send() { const value = prompt.trim(); if (!value || running) return; if (mode === 'vibe' || VIBE_PATTERN.test(value)) await sendVibe(value); else await sendChat(value); }
  function stop() { controllerRef.current?.abort(); }
  function setCodexMode(next) { setMode(next); setRuns({}); if (next === 'vibe') setTab('preview'); }

  return <div className="prism-codex">
    <aside className="cd-sidebar">
      <div className="cd-sidebar-head">
        <button className="cd-brand" onClick={() => setCodexMode('chat')}><span className="cd-brand-mark">P</span><span><strong>Prism Codex</strong><small>Workspace</small></span></button>
        <button className="cd-new" onClick={newSession} disabled={running}>Nova conversa</button>
        <div className="cd-mode-nav"><button className={mode === 'chat' ? 'active' : ''} onClick={() => setCodexMode('chat')}>Conversa</button><button className={mode === 'vibe' ? 'active' : ''} onClick={() => setCodexMode('vibe')}>Vibe Code</button></div>
      </div>
      <label className="cd-sidebar-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={mode === 'vibe' ? 'Filtrar arquivos ou conversas' : 'Buscar conversas'} /></label>
      <div className="cd-history-label"><span>{mode === 'vibe' ? 'Projeto' : 'Conversas'}</span><span>{mode === 'vibe' ? files.filter((item) => item.kind !== 'folder').length : visibleSessions.length}</span></div>
      <div className="cd-sessions">
        {mode === 'vibe' ? visibleFiles.map((file) => <button className="cd-session-open" key={file.path} onClick={() => selectFile(file)}><strong>{file.path}</strong><small>arquivo</small></button>) : visibleSessions.map((session) => <div className={`cd-session ${session.id === sessionId ? 'active' : ''}`} key={session.id}><button className="cd-session-open" onClick={() => loadSession(session.id)}><strong>{session.title || 'Nova conversa'}</strong><small>{sessionDate(session.updated_at || session.created_at)}</small></button><div className="cd-session-actions"><button onClick={() => renameSession(session)}>Renomear</button><button onClick={() => deleteSession(session)}>Excluir</button></div></div>)}
        {!visibleSessions.length && mode === 'chat' && <div className="cd-sidebar-foot"><button onClick={newSession}>Criar a primeira conversa</button></div>}
      </div>
      <div className="cd-sidebar-foot"><button onClick={() => setPlansOpen(true)}>Plano e limites</button><button onClick={() => setCommandOpen(true)}>Abrir comandos</button></div>
    </aside>

    <main className="cd-main">
      <header className="cd-header">
        <div className="cd-title"><span>PRISM CODEX</span><strong>{mode === 'vibe' ? projectName : (sessions.find((item) => item.id === sessionId)?.title || 'Nova conversa')}</strong></div>
        <div className="cd-header-controls">
          <div className="cd-menu-wrap"><button className="cd-control" onClick={() => { setModelOpen((open) => !open); setEffortOpen(false); }}>{activeModelLabel}</button>{modelOpen && <div className="cd-menu"><div className="cd-menu-head"><strong>Modelo</strong><span>Escolha o motor da tarefa.</span></div>{MODELS.map(([id, label]) => <button className={id === model ? 'selected' : ''} key={id} onClick={() => { setModel(id); setModelOpen(false); }}><span><strong>{label}</strong><small>{id}</small></span><b>{id === model ? 'Selecionado' : ''}</b></button>)}<div className="cd-menu-divider"/><button className={compareMode ? 'selected' : ''} onClick={() => setCompareMode((value) => !value)}><span><strong>Comparar modelos</strong><small>Executar provedores em paralelo</small></span><b>{compareMode ? 'Ativo' : 'Desligado'}</b></button>{compareMode && providers.map((item) => <button className="cd-provider" key={item.id} onClick={() => toggleProvider(item.id)}><span><strong>{item.label}</strong><small>{item.model}</small></span><b>{item.enabled !== false ? 'Ativo' : 'Off'}</b></button>)}</div>}</div>
          <div className="cd-menu-wrap"><button className="cd-control" onClick={() => { setEffortOpen((open) => !open); setModelOpen(false); }}>Pensamento: {effort}</button>{effortOpen && <div className="cd-menu"><div className="cd-menu-head"><strong>Nível de pensamento</strong><span>Quanto esforço aplicar.</span></div>{EFFORTS.map((value) => <button className={value === effort ? 'selected' : ''} key={value} onClick={() => { setEffort(value); setEffortOpen(false); }}><span><strong>{value}</strong><small>{value === 'ultracode' ? 'Engenharia e código' : value === 'max' ? 'Profundidade máxima' : value === 'high' ? 'Problemas difíceis' : value === 'medium' ? 'Equilibrado' : 'Tarefas rápidas'}</small></span><b>{value === effort ? 'Selecionado' : ''}</b></button>)}</div>}</div>
          {mode === 'vibe' && <button className="cd-control" onClick={() => setCodexMode('chat')}>Voltar</button>}
          <button className="cd-control" onClick={() => setCommandOpen(true)}>Comandos</button>
        </div>
      </header>

      {mode === 'vibe' && <div className="cd-context"><span>Integrações</span>{mcpServers.length ? mcpServers.map((server) => <button key={server.id} className={mcpActive.includes(server.id) ? 'active' : ''} onClick={() => toggleMcp(server.id)}><i/>{server.name || server.id}</button>) : <span>Nenhuma disponível</span>}</div>}

      <section className={`cd-content ${mode === 'vibe' ? 'vibe' : ''}`}>
        <section className="cd-chat"><div className="cd-chat-scroll"><div className="cd-thread">
          {mode === 'chat' && !messages.length && !Object.keys(runs).length && <div className="cd-welcome"><div className="cd-welcome-mark">P</div><p className="cd-kicker">Prism Codex</p><h1>Comece pelo que precisa ser resolvido.</h1><p>Conversa comum para perguntas e trabalho intelectual; Vibe Code quando a tarefa precisa entrar no projeto e modificar arquivos.</p><div className="cd-actions"><button onClick={() => setPrompt('Revise esta arquitetura e identifique os riscos mais importantes.')}>Revisar arquitetura</button><button onClick={() => { setMode('vibe'); setTab('preview'); setPrompt('Construa a primeira versão desta aplicação.') }}>Construir no workspace</button><button onClick={() => setPrompt('Compare abordagens para este problema e recomende uma delas.')}>Comparar abordagens</button></div></div>}
          {messages.map((message) => <article className={`cd-message ${message.role}`} key={message.id}><div className="cd-message-label">{message.role === 'user' ? 'Você' : (message.provider || 'Prism')}</div><div><div className="cd-message-text">{message.text}</div>{message.files?.length > 0 && <div className="cd-message-files">{message.files.map((file) => <button key={file} onClick={() => selectFile(files.find((item) => item.path === file))}>{file}</button>)}</div>}{message.tools?.length > 0 && <div className="cd-message-meta">Ferramentas: {message.tools.map((item) => item.tool).filter(Boolean).join(', ')}</div>}</div></article>)}
          {Object.keys(runs).length > 0 && <div className="cd-runs">{providers.filter((item) => runs[item.id]).map((provider) => { const run = runs[provider.id]; return <article className="cd-run" key={provider.id}><div className="cd-run-head"><span className="cd-run-status">{run.status || 'concluído'}</span><strong>{provider.label}</strong><small>{run.model}</small></div><div className="cd-run-body">{run.error || run.text || 'Executando...'}</div><div className="cd-run-footer">{run.elapsed_ms ? `${(run.elapsed_ms / 1000).toFixed(1)}s` : 'Em processamento'}</div></article>; })}</div>}
          {mode === 'vibe' && running && <div className="cd-live"><div className="cd-live-head"><strong>{PHASES.find(([id]) => id === phase)?.[1] || 'Trabalhando'}</strong><span>{(elapsed / 1000).toFixed(1)}s</span></div><StepList phase={phase} steps={steps}/></div>}
        </div></div>
          {error && <div className="cd-error"><strong>Não foi possível concluir.</strong> {error}</div>}
          <footer className="cd-composer-wrap"><div className="cd-composer"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} disabled={running} placeholder={mode === 'vibe' ? 'Descreva o que você quer construir' : 'Escreva uma mensagem'} /><div className="cd-composer-bar"><span>{running ? (mode === 'vibe' ? 'Executando no workspace' : 'Processando resposta') : 'Enter envia · Shift + Enter quebra a linha'}</span><div className="cd-composer-actions">{running ? <button className="cd-stop" onClick={stop}>Parar</button> : <button className="cd-send" onClick={send} disabled={!prompt.trim()}>Enviar</button>}</div></div></div><small className="cd-note">Revise informações importantes antes de usá-las.</small></footer>
        </section>

        {mode === 'vibe' && <section className="cd-workspace"><div className="cd-workspace-head"><div className="cd-project"><strong>{projectName}</strong><span>Workspace do projeto</span></div><nav className="cd-workspace-tabs"><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>Código</button></nav></div>{tab === 'preview' ? <iframe className="cd-preview" title="Preview do projeto" srcDoc={previewFor(files)} sandbox="allow-scripts"/> : <div className="cd-editor"><aside className="cd-tree"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar arquivos"/>{visibleFiles.map((file) => <button className={file.path === activeFile ? 'active' : ''} key={file.path} onClick={() => selectFile(file)}>{file.path}</button>)}</aside><main className="cd-code"><div className="cd-code-head"><strong>{activeFile}</strong><small>{code.length} caracteres</small></div><pre>{code.split('\n').map((line, index) => <div className="cd-code-line" key={index}><span className="ln">{index + 1}</span><code>{line || ' '}</code></div>)}</pre></main></div>}</section>}
      </section>
    </main>

    {plansOpen && <div className="cd-modal" onMouseDown={() => setPlansOpen(false)}><div className="cd-panel" onMouseDown={(event) => event.stopPropagation()}><header className="cd-panel-head"><strong>Planos</strong><button onClick={() => setPlansOpen(false)}>Fechar</button></header><div className="cd-plan-grid">{PLANS.map(([name, price, access, limits]) => <article className={`cd-plan ${name === 'Grátis' ? 'current' : ''}`} key={name}><strong>{name}</strong><span>{price}</span><p>{access}</p><small>{limits}</small></article>)}</div></div></div>}
    {commandOpen && <div className="cd-modal" onMouseDown={() => setCommandOpen(false)}><div className="cd-command-panel" onMouseDown={(event) => event.stopPropagation()}><div className="cd-command-search"><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conversas, arquivos ou ações" /></div><div className="cd-command-actions"><button onClick={newSession}>Nova conversa</button><button onClick={() => { setCodexMode('vibe'); setCommandOpen(false); }}>Abrir Vibe Code</button><button onClick={() => { setCompareMode((value) => !value); setCommandOpen(false); }}>Alternar comparação de modelos</button><button onClick={() => { setPlansOpen(true); setCommandOpen(false); }}>Abrir planos</button></div></div></div>}
  </div>;
}
