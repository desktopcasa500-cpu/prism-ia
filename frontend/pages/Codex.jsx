import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { usePersistentCodex } from '../lib/usePersistentCodex.js';
import PrismCodexIntro, { INTRO_KEY } from '../components/PrismCodexIntro.jsx';
import CodexSidebar from '../components/codex/CodexSidebar.jsx';
import McpContextBar from '../components/codex/McpContextBar.jsx';
import ParallelResponseGrid from '../components/codex/ParallelResponseGrid.jsx';
import './prism-codex-final.css';

const PROVIDERS = [
  { id: 'anthropic', label: 'Claude', model: 'claude-fable-5-1', enabled: true },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4.1', enabled: true },
  { id: 'gemini', label: 'Gemini', model: 'gemini-3.8-flash', enabled: true },
];
const PRISM_MODELS = [
  ['prism-nano-1.0', 'Prism Nano 1.0'],
  ['prism-mini-1.0', 'Prism Mini 1.0'],
  ['prism-tex-1.5', 'Prism Tex 1.5'],
  ['prism-taff-1.0', 'Prism Taff 1.0'],
  ['prism-taff-2.0', 'Prism Taff 2.0'],
];
const PLAN_DATA = [
  ['Grátis', 'R$0', 'Mini/Nano HIGH · Edge MEDIUM', '5 créditos/dia · máximo 30'],
  ['Base', 'R$8', 'Mini/Nano/Edge X-HIGH', '30 créditos/dia · máximo 120'],
  ['Medium', 'R$30', 'Mini/Nano/Edge MAX · Tex MEDIUM', '700 créditos/dia · máximo 1000'],
  ['Pro', 'R$90', 'Mini/Nano/Edge MAX · Tex/Taff HIGH', '2000 créditos/dia · máximo 3000'],
  ['Empresarial', 'R$140', 'Todos MAX · Edge EXTRA MAX', '6000 créditos/dia · máximo 9000 · 30 subcontas'],
];
const EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];
const VIBE_PATTERN = /\b(site|website|webapp|web app|jogo|game|app|aplicativo|api|sistema|script|scripts|c[oó]digo|code|componente|p[aá]gina|landing|projeto|arquivo|arquivos|npm|react|python|godot|unity|html|css|javascript|criar|construir|implementar|programar)\b/i;
const PHASES = [['received', 'Pedido recebido'], ['analyzing', 'Analisando o projeto'], ['planning', 'Planejando'], ['writing', 'Escrevendo arquivos'], ['reviewing', 'Revisando'], ['updating', 'Atualizando o workspace'], ['completed', 'Concluído']];
const STARTER = [
  { path: 'src/App.jsx', kind: 'file', content: 'export default function App() {\n  return <main>Comece a construir.</main>;\n}\n' },
  { path: 'src/index.css', kind: 'file', content: '' },
  { path: 'package.json', kind: 'file', content: '{"name":"prism-project"}\n' },
];

function mapMessage(message) {
  let metadata = {};
  try { metadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {}); } catch {}
  return { id: message.id, role: message.role, text: message.content || '', provider: message.provider || '', model: message.model_id || '', thinking: message.thinking_summary || '', tools: Array.isArray(metadata.tools_used) ? metadata.tools_used : [] };
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

function StepList({ phase, steps }) {
  const active = PHASES.findIndex(([id]) => id === phase);
  return <div className="pcx-steps">{PHASES.map(([id, label], index) => <div key={id} className={`pcx-step ${index < active ? 'done' : ''} ${id === phase ? 'active' : ''}`}><span className="pcx-step-mark">{index < active ? '✓' : id === phase ? '·' : ''}</span><div><strong>{label}</strong>{steps.find((item) => item.phase === id)?.detail && <small>{steps.find((item) => item.phase === id).detail}</small>}</div></div>)}</div>;
}

export default function Codex() {
  const { preferences, updatePreference, cacheSession, cachedSession } = usePersistentCodex();
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem(INTRO_KEY) !== '1');
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState('prism-taff-2.0');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [runs, setRuns] = useState({});
  const [compareMode, setCompareMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState('');
  const [effort, setEffort] = useState(preferences.effort || 'medium');
  const [providers, setProviders] = useState(readProviders);
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpActive, setMcpActive] = useState([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [files, setFiles] = useState(STARTER);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [activeFile, setActiveFile] = useState(STARTER[0].path);
  const [tab, setTab] = useState('preview');
  const [phase, setPhase] = useState('');
  const [steps, setSteps] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const startedAt = useRef(0);
  const controllerRef = useRef(null);
  const timersRef = useRef(new Set());

  useEffect(() => localStorage.setItem('prism_codex_providers', JSON.stringify(providers)), [providers]);
  useEffect(() => updatePreference('effort', effort), [effort, updatePreference]);

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

  const [code, setCode] = useState(STARTER[0].content);
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
    try { const data = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`); const next = (data.messages || []).map(mapMessage); setMessages(next); cacheSession(id, next).catch(() => {}); }
    catch (cause) { if (!cached) setError(cause.message || 'Não foi possível carregar a conversa.'); }
  }, [cacheSession, cachedSession]);
  const loadMcp = useCallback(async () => {
    try { const data = await api.get('/mcp'); const next = data.servers || []; setMcpServers(next); const saved = Array.isArray(preferences.mcpServerIds) ? preferences.mcpServerIds : next.map((server) => server.id); setMcpActive(saved.filter((id) => next.some((server) => server.id === id))); }
    catch { setMcpServers([]); setMcpActive([]); }
  }, [preferences.mcpServerIds]);
  useEffect(() => { Promise.all([loadProject(), loadSessions(), loadMcp()]).catch((cause) => setError(cause.message || 'Não foi possível carregar o Codex.')); }, [loadProject, loadSessions, loadMcp]);
  useEffect(() => { if (sessionId) loadSession(sessionId).catch(() => {}); }, [sessionId, loadSession]);
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 100); return () => clearInterval(timer); }, [running]);
  useEffect(() => () => timersRef.current.forEach((timer) => clearInterval(timer)), []);
  useEffect(() => { const onKey = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); } if (event.key === 'Escape') { setCommandOpen(false); setModelOpen(false); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  const context = useMemo(() => messages.slice(-16).map((item) => `${item.role}: ${item.text}`).join('\n'), [messages]);
  const activeModelLabel = PRISM_MODELS.find(([id]) => id === model)?.[1] || model;

  async function newSession() { if (running) return; const data = await api.post('/chat/sessions', { title: 'Nova conversa' }); setSessions((current) => [data.session, ...current]); setSessionId(data.session.id); setMessages([]); setRuns({}); setMode('chat'); setPrompt(''); setCommandOpen(false); }
  async function renameSession(session) { const title = window.prompt('Nome da conversa', session.title || 'Nova conversa'); if (!title?.trim()) return; const data = await api.patch(`/chat/sessions/${encodeURIComponent(session.id)}`, { title }); setSessions((current) => current.map((item) => item.id === session.id ? data.session : item)); }
  async function deleteSession(session) { if (!window.confirm(`Excluir “${session.title || 'Nova conversa'}”?`)) return; await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`); const next = sessions.filter((item) => item.id !== session.id); setSessions(next); if (session.id === sessionId) { setSessionId(next[0]?.id || null); setMessages([]); setRuns({}); } }
  function toggleProvider(id) { setProviders((current) => current.map((item) => item.id === id ? { ...item, enabled: item.enabled === false } : item)); }
  function toggleMcp(id) { setMcpActive((current) => { const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id]; updatePreference('mcpServerIds', next); return next; }); }

  async function sendChat(value) {
    let sid = sessionId;
    if (!sid) { const created = await api.post('/chat/sessions', { title: value.slice(0, 64) }); sid = created.session.id; setSessionId(sid); setSessions((current) => [created.session, ...current]); }
    const userMessage = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] };
    const nextMessages = [...messages, userMessage]; setMessages(nextMessages); setPrompt(''); setRunning(true); setError('');
    try {
      if (compareMode) {
        const selected = providers.filter((item) => item.enabled !== false).map(({ id, model: providerModel }) => ({ provider: id, model: providerModel }));
        setRuns(Object.fromEntries(selected.map((item) => [item.provider, { provider: item.provider, model: item.model, status: 'running', text: '', thinking_summary: '', elapsed_ms: 0, tools_used: [] }])));
        const result = await api.post('/chat/parallel', { sessionId: sid, content: value, context, effort, models: selected, mcpServerIds: mcpActive }, { timeout: 180000 });
        setRuns(Object.fromEntries((result.results || []).map((item) => [item.provider, item])));
        const persisted = (result.saved || []).map(mapMessage); const finalMessages = [...nextMessages, ...persisted]; setMessages(finalMessages); cacheSession(sid, finalMessages).catch(() => {});
      } else {
        const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content: value, model, effort }, { timeout: 120000 });
        const message = mapMessage(result.message || {}); setMessages((current) => [...current, message]); cacheSession(sid, [...nextMessages, message]).catch(() => {});
      }
      await loadSessions();
    } catch (cause) { setError(cause.message || 'Não foi possível concluir a resposta.'); }
    finally { setRunning(false); }
  }

  async function sendVibe(value) {
    if (!projectId) { setError('O projeto ainda está carregando.'); return; }
    const userMessage = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] }; setMessages((current) => [...current, userMessage]); setPrompt(''); setMode('vibe'); setRunning(true); setError(''); setPhase('received'); setSteps([]); startedAt.current = Date.now(); setElapsed(0);
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      const result = await api.streamPost('/ai/generate/stream', { model, thinking: 'ultracode', prompt: value, context, projectId }, (event) => {
        if (event.type === 'phase') { setPhase(event.phase); setSteps((current) => [...current.filter((item) => item.phase !== event.phase), event]); }
        if (event.type === 'artifact') {
          setTab('code'); setActiveFile(event.path); const full = String(event.content || '');
          setFiles((current) => current.some((file) => file.path === event.path) ? current.map((file) => file.path === event.path ? { ...file, content: full, kind: 'file' } : file) : [...current, { path: event.path, content: full, kind: 'file' }]);
          let cursor = 0; const timer = window.setInterval(() => { cursor = Math.min(full.length, cursor + Math.max(24, Math.ceil(full.length / 70))); setCode(full.slice(0, cursor)); if (cursor >= full.length) { clearInterval(timer); timersRef.current.delete(timer); } }, 18); timersRef.current.add(timer);
        }
      }, { timeout: 180000, signal: controller.signal });
      await loadProject();
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: result.text || 'Alterações aplicadas ao projeto.', tools: (result.tools_used || []).filter((item) => item?.tool), files: [...(result.files_created || []), ...(result.files_changed || [])] }]);
    } catch (cause) { if (cause.name !== 'AbortError') setError(cause.message || 'O agente não conseguiu concluir a tarefa.'); }
    finally { setRunning(false); controllerRef.current = null; }
  }

  async function send() { const value = prompt.trim(); if (!value || running) return; if (mode === 'vibe' || VIBE_PATTERN.test(value)) await sendVibe(value); else await sendChat(value); }
  function selectFile(file) { if (!file || file.kind === 'folder') return; setActiveFile(file.path); setCode(file.content || ''); setTab('code'); }
  function stop() { controllerRef.current?.abort(); }
  function replayIntro() { localStorage.removeItem(INTRO_KEY); setShowIntro(true); }
  function setCodexMode(next) { setMode(next); if (next === 'vibe') setTab('preview'); }

  return <div className={`pcx-root pcx-mode-${mode}`}>
    {showIntro && <PrismCodexIntro onComplete={() => setShowIntro(false)} />}
    <CodexSidebar sessions={sessions} activeId={sessionId} query={query} onQuery={setQuery} onNew={newSession} onOpen={loadSession} onRename={renameSession} onDelete={deleteSession} onReplay={replayIntro} onMode={setCodexMode} onPlans={() => setPlansOpen(true)} mode={mode} />
    <main className="pcx-main">
      <header className="pcx-header"><div className="pcx-header-title"><span>PRISM</span><strong>{mode === 'vibe' ? 'Vibe Code' : 'Conversa'}</strong></div><div className="pcx-header-controls">{mode === 'vibe' && <button className="pcx-view-button" onClick={() => setCodexMode('chat')}>Voltar</button>}<div className="pcx-model-menu"><button className="pcx-model-trigger" onClick={() => setModelOpen((open) => !open)} aria-expanded={modelOpen}><span>{activeModelLabel}</span><i>⌄</i></button>{modelOpen && <div className="pcx-model-dropdown">{PRISM_MODELS.map(([id, label]) => <button key={id} className={model === id ? 'on' : ''} onClick={() => { setModel(id); setModelOpen(false); }}><span>{label}</span><b>{model === id ? 'ATIVO' : ''}</b></button>)}<div className="pcx-model-divider"/><button className={compareMode ? 'on' : ''} onClick={() => { setCompareMode((value) => !value); setModelOpen(false); }}><span>Comparar modelos</span><b>{compareMode ? '3 ATIVOS' : 'OFF'}</b></button>{compareMode && providers.map((item) => <button key={item.id} className={`pcx-provider-row ${item.enabled !== false ? 'on' : ''}`} onClick={() => toggleProvider(item.id)}><span>{item.label}</span><small>{item.model}</small><b>{item.enabled !== false ? 'ON' : 'OFF'}</b></button>)}</div>}</div><button className="pcx-effort" onClick={() => setEffort(EFFORTS[(EFFORTS.indexOf(effort) + 1) % EFFORTS.length])}>{effort}</button><button className="pcx-command" onClick={() => setCommandOpen(true)}>⌘K</button></div></header>
      <McpContextBar servers={mcpServers} activeIds={mcpActive} onToggle={toggleMcp}/>
      <section className={`pcx-content ${mode === 'vibe' ? 'with-workspace' : ''}`}>
        <section className="pcx-chat-panel"><div className="pcx-chat-scroll">{messages.length === 0 && !Object.keys(runs).length && mode === 'chat' && <div className="pcx-welcome"><div className="pcx-welcome-mark">P</div><p>PRISM CODEX</p><h1>O que você quer fazer?</h1><span>Comece com uma pergunta, uma ideia ou um problema.</span></div>}{messages.map((message) => <article className={`pcx-message ${message.role}`} key={message.id}><div className="pcx-message-label">{message.role === 'user' ? 'Você' : (message.provider || 'Prism')}</div><div className="pcx-message-text">{message.text}</div>{message.files?.length > 0 && <div className="pcx-message-files">{message.files.map((file) => <button key={file} onClick={() => selectFile(files.find((item) => item.path === file))}>{file}</button>)}</div>}{message.tools?.length > 0 && <div className="pcx-message-meta">Ferramentas · {message.tools.map((item) => item.tool).filter(Boolean).join(', ')}</div>}</article>)}{Object.keys(runs).length > 0 && <ParallelResponseGrid models={providers} runs={runs}/>} {mode === 'vibe' && running && <article className="pcx-live-message"><div className="pcx-live-head"><strong>{PHASES.find(([id]) => id === phase)?.[1] || 'Trabalhando'}</strong><span>{(elapsed / 1000).toFixed(1)}s</span></div><StepList phase={phase} steps={steps}/></article>}</div>{error && <div className="pcx-error"><strong>Não foi possível concluir</strong><span>{error}</span></div>}<footer className="pcx-composer-wrap"><div className="pcx-composer"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={mode === 'vibe' ? 'Descreva o que você quer construir…' : 'Como posso ajudar você hoje?'} rows={1} disabled={running}/><div className="pcx-composer-bar"><span>{running ? (mode === 'vibe' ? 'Executando no workspace…' : 'Aguardando respostas…') : 'Enter envia · Shift + Enter quebra a linha'}</span><div>{running ? <button className="pcx-stop" onClick={stop}>Parar</button> : <button className="pcx-send" onClick={send} disabled={!prompt.trim()}>Enviar</button>}</div></div></div><small className="pcx-composer-note">As respostas podem conter erros. Revise informações importantes.</small></footer></section>
        {mode === 'vibe' && <section className="pcx-workspace"><div className="pcx-workspace-top"><div><span>PROJETO</span><strong>{projectName}</strong></div><nav><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>Código</button></nav></div>{tab === 'preview' ? <iframe className="pcx-preview" title="Preview do projeto" srcDoc={previewFor(files)} sandbox="allow-scripts"/> : <div className="pcx-editor"><aside className="pcx-tree"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar arquivos"/>{visibleFiles.map((file) => <button className={file.path === activeFile ? 'active' : ''} key={file.path} onClick={() => selectFile(file)}>{file.path}</button>)}</aside><main className="pcx-code"><div className="pcx-code-head"><span>{activeFile}</span><small>{code.length} caracteres</small></div><pre>{code.split('\n').map((line, index) => <div key={index}><span>{index + 1}</span><code>{line || ' '}</code></div>)}</pre></main></div>}</section>}
      </section>
    </main>
    {plansOpen && <div className="pcx-modal-backdrop" onMouseDown={() => setPlansOpen(false)}><div className="pcx-plans" onMouseDown={(event) => event.stopPropagation()}><header><div><span>PRISM IA</span><h2>Planos</h2></div><button onClick={() => setPlansOpen(false)}>Fechar</button></header><div className="pcx-plan-grid">{PLAN_DATA.map(([name, price, access, limits]) => <article key={name} className={name === 'Grátis' ? 'current' : ''}><div><strong>{name}</strong><span>{price}</span></div><p>{access}</p><small>{limits}</small></article>)}</div></div></div>}
    {commandOpen && <div className="pcx-modal-backdrop" onMouseDown={() => setCommandOpen(false)}><div className="pcx-command-palette" onMouseDown={(event) => event.stopPropagation()}><div><span>BUSCAR CONVERSAS</span><kbd>ESC</kbd></div><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite para filtrar…"/><button onClick={newSession}>+ Nova conversa</button><button onClick={replayIntro}>Reabrir apresentação</button><button onClick={() => { setPlansOpen(true); setCommandOpen(false); }}>Planos</button></div></div>}
  </div>;
}
