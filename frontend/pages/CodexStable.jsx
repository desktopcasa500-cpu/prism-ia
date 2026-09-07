import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { usePersistentCodex } from '../lib/usePersistentCodex.js';
import PrismCodexIntro, { INTRO_KEY } from '../components/PrismCodexIntro.jsx';
import CodexSidebar from '../components/codex/CodexSidebar.jsx';
import McpContextBar from '../components/codex/McpContextBar.jsx';
import CodeArtifactsPanel from '../components/CodeArtifactsPanel.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import TaffPresentation from '../components/TaffPresentation.jsx';
import './codex-stable-taff.css';

const MODELS = [
  ['prism-nano-1.0', 'Prism Nano 1.0A'],
  ['prism-mini-1.0', 'Prism Mini 1.0A'],
  ['prism-edge-1.0', 'Prism Edge 1.0A'],
  ['prism-tex-1.5', 'Prism Tex 1.5B'],
  ['prism-taff-1.0', 'Prism Taff 1.0A'],
  ['prism-taff-2.0', 'Prism Taff 2.0'],
];
const EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];
const PLAN_RANK = { Grátis: 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const MODEL_RANK = { 'prism-nano-1.0': 0, 'prism-mini-1.0': 0, 'prism-edge-1.0': 2, 'prism-tex-1.5': 2, 'prism-taff-1.0': 3, 'prism-taff-2.0': 3 };
const PHASES = [['received', 'Pedido recebido'], ['analyzing', 'Analisando'], ['planning', 'Planejando'], ['writing', 'Escrevendo arquivos'], ['reviewing', 'Revisando'], ['updating', 'Atualizando workspace'], ['completed', 'Concluído']];
const STARTER = [
  { path: 'src/App.jsx', kind: 'file', content: 'export default function App() {\n  return <main>Comece a construir.</main>;\n}\n' },
  { path: 'src/index.css', kind: 'file', content: '' },
  { path: 'package.json', kind: 'file', content: '{"name":"prism-project"}\n' },
];

function normalizeMessage(message) {
  let metadata = {};
  try { metadata = typeof message?.metadata === 'string' ? JSON.parse(message.metadata) : (message?.metadata || {}); } catch {}
  return { id: message?.id, role: message?.role, text: message?.content || '', model: message?.model_id || '', tools: Array.isArray(metadata.tools_used) ? metadata.tools_used : [] };
}

function extensionOf(path) { return String(path || '').split('.').pop()?.toLowerCase() || 'txt'; }
function fileArtifact(file) {
  const extension = extensionOf(file.path);
  const language = { html: 'markup', htm: 'markup', css: 'css', js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', json: 'json', md: 'markdown', py: 'python' }[extension] || 'text';
  return { id: `workspace:${file.path}`, filename: file.path, language, languageLabel: extension.toUpperCase(), code: String(file.content || ''), info: extension };
}

function extractCode(text, messageId) {
  const source = String(text || '').replace(/\r\n?/g, '\n');
  const regex = /(^|\n)\s*(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\s*\2\s*(?=\n|$)/g;
  const blocks = [];
  let match;
  let index = 0;
  while ((match = regex.exec(source))) {
    const info = match[3].trim();
    const language = (info.split(/\s+/)[0] || 'text').toLowerCase();
    const filenameMatch = /(?:file|filename|path)\s*=\s*(?:"([^"]+)"|'([^']+)'|(\S+))/i.exec(info);
    const filename = filenameMatch?.[1] || filenameMatch?.[2] || filenameMatch?.[3] || (language === 'html' ? `index-${index + 1}.html` : `codigo-${index + 1}.${language}`);
    blocks.push({ id: `${messageId}:code:${index}`, filename, language: language === 'html' ? 'markup' : language, languageLabel: language.toUpperCase(), code: match[4], info });
    index += 1;
  }
  return blocks;
}

function previewFor(files) {
  const real = files.filter((file) => file.kind !== 'folder');
  const html = real.find((file) => /(^|\/)index\.html$/i.test(file.path)) || real.find((file) => /\.html?$/i.test(file.path));
  if (!html) return '';
  const css = real.filter((file) => /\.css$/i.test(file.path)).map((file) => file.content || '').join('\n');
  const js = real.filter((file) => /\.js$/i.test(file.path)).map((file) => file.content || '').join('\n');
  let doc = String(html.content || '');
  if (!/<html\b/i.test(doc)) doc = `<!doctype html><html><head></head><body>${doc}</body></html>`;
  if (css) doc = doc.replace(/<\/head>/i, `<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>`);
  if (js) doc = doc.replace(/<\/body>/i, `<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body>`);
  return doc;
}

function groupOrder(sessions) {
  const order = ['Hoje', 'Ontem', 'Últimos 7 dias', 'Este mês', 'Mais antigas'];
  const now = new Date();
  const start = (value) => { const date = new Date(value || now); return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); };
  const groups = new Map(order.map((label) => [label, []]));
  for (const session of sessions) {
    const diff = Math.floor((start(now) - start(session.updated_at || session.created_at)) / 86400000);
    const label = diff === 0 ? 'Hoje' : diff === 1 ? 'Ontem' : diff < 7 ? 'Últimos 7 dias' : diff < 30 ? 'Este mês' : 'Mais antigas';
    groups.get(label).push(session);
  }
  return order.map((label) => ({ label, items: groups.get(label) })).filter((item) => item.items.length);
}

export default function CodexStable() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreference, cacheSession, cachedSession } = usePersistentCodex();
  const [showIntro, setShowIntro] = useState(() => { try { return localStorage.getItem(INTRO_KEY) !== '1'; } catch { return false; } });
  const [showTaffPresentation, setShowTaffPresentation] = useState(false);
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState(preferences.model || 'prism-mini-1.0');
  const [effort, setEffort] = useState(preferences.effort || 'medium');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState(STARTER);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [phase, setPhase] = useState('');
  const [steps, setSteps] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpActive, setMcpActive] = useState([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('');
  const [commandOpen, setCommandOpen] = useState(false);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [activeArtifactId, setActiveArtifactId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const requestIdRef = useRef(0);
  const sendLockRef = useRef(false);
  const controllerRef = useRef(null);
  const startedAtRef = useRef(0);

  const planRank = PLAN_RANK[user?.plan] ?? 0;
  const activeModelLabel = MODELS.find(([id]) => id === model)?.[1] || model;
  const canSend = prompt.trim().length > 0 && !running;
  const groups = useMemo(() => groupOrder(sessions.filter((item) => !query || String(item.title || '').toLowerCase().includes(query.trim().toLowerCase()))), [sessions, query]);
  const context = useMemo(() => messages.slice(-12).map((item) => `${item.role}: ${item.text}`).join('\n'), [messages]);
  const preview = useMemo(() => previewFor(files), [files]);

  const loadProject = useCallback(async () => {
    const result = await api.get('/projects');
    let project = result.projects?.[0];
    if (!project) {
      const created = await api.post('/projects', { name: 'Novo projeto' });
      project = created.project;
      await Promise.all(STARTER.map((file) => api.post('/files', { projectId: project.id, path: file.path, content: file.content, kind: 'file' })));
    }
    const detail = await api.get(`/projects/${project.id}`);
    const nextFiles = detail.files?.length ? detail.files.map((file) => ({ ...file, kind: file.kind || 'file' })) : STARTER;
    setProjectId(project.id); setProjectName(project.name || 'Novo projeto'); setFiles(nextFiles);
    setArtifacts((current) => { const loaded = nextFiles.filter((file) => file.kind !== 'folder').map(fileArtifact); const map = new Map(current.map((item) => [item.id, item])); loaded.forEach((item) => map.set(item.id, item)); return [...map.values()]; });
  }, []);

  const openSession = useCallback(async (id) => {
    if (!id) return;
    const requestId = ++requestIdRef.current;
    setSessionId(id); setMobileOpen(false); setError(''); setArtifactPanelOpen(false); setActiveArtifactId(null); setArtifacts([]);
    const cached = await cachedSession(id).catch(() => null);
    if (requestId !== requestIdRef.current) return;
    if (cached) setMessages(cached);
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      if (requestId !== requestIdRef.current) return;
      const next = (result.messages || []).map(normalizeMessage);
      setMessages(next); cacheSession(id, next).catch(() => {});
      const generated = next.flatMap((item) => item.role === 'assistant' ? extractCode(item.text, String(item.id)) : []);
      if (generated.length) { setArtifacts(generated); setActiveArtifactId(generated[0].id); }
    } catch (cause) { if (requestId === requestIdRef.current && !cached) setError(cause.message || 'Não foi possível carregar a conversa.'); }
  }, [cacheSession, cachedSession]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [sessionResult] = await Promise.all([
          api.get('/chat/sessions'),
          loadProject(),
          api.get('/mcp').then((result) => alive && setMcpServers(result.servers || [])).catch(() => {}),
        ]);
        if (!alive) return;
        const list = Array.isArray(sessionResult.sessions) ? sessionResult.sessions : [];
        setSessions(list);
        if (list[0]) setSessionId((current) => current || list[0].id);
      } catch (cause) { if (alive) setError(cause.message || 'Não foi possível carregar o Codex.'); }
    })();
    return () => { alive = false; controllerRef.current?.abort(); };
  }, [loadProject]);

  useEffect(() => { if (sessionId) openSession(sessionId).catch(() => {}); }, [sessionId, openSession]);
  useEffect(() => { updatePreference('model', model); updatePreference('effort', effort); }, [model, effort, updatePreference]);
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setElapsed(Date.now() - startedAtRef.current), 100); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => { const handler = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); } if (event.key === 'Escape') { setCommandOpen(false); setModelOpen(false); setPlansOpen(false); setMobileOpen(false); setShowTaffPresentation(false); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);

  const resetConversation = () => { setMessages([]); setArtifacts([]); setArtifactPanelOpen(false); setActiveArtifactId(null); setError(''); };

  async function newSession() {
    if (running) return;
    try {
      const result = await api.post('/chat/sessions', { title: 'Nova conversa' });
      setSessions((current) => [result.session, ...current]); setSessionId(result.session.id); setMode('chat'); resetConversation(); setPrompt(''); setMobileOpen(false);
    } catch (cause) { setError(cause.message || 'Não foi possível criar a conversa.'); }
  }

  async function renameSession(session) {
    const nextTitle = window.prompt('Nome da conversa', session.title || 'Nova conversa')?.trim();
    if (!nextTitle || nextTitle === session.title) return;
    try { const result = await api.patch(`/chat/sessions/${encodeURIComponent(session.id)}`, { title: nextTitle }); setSessions((current) => current.map((item) => item.id === session.id ? result.session : item)); }
    catch (cause) { setError(cause.message || 'Não foi possível renomear a conversa.'); }
  }

  async function deleteSession(session) {
    if (!window.confirm(`Excluir “${session.title || 'Nova conversa'}”?`)) return;
    try {
      await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`);
      const next = sessions.filter((item) => item.id !== session.id); setSessions(next);
      if (session.id === sessionId) { setSessionId(next[0]?.id || null); resetConversation(); }
    } catch (cause) { setError(cause.message || 'Não foi possível excluir a conversa.'); }
  }

  function chooseModel(id) {
    const rank = MODEL_RANK[id] ?? 0;
    const item = MODELS.find(([modelId]) => modelId === id);
    if (!item) return;
    if (rank > planRank) { setRequestedModel(item[1]); setPlansOpen(true); return; }
    setModel(id); setModelOpen(false);
  }

  function stopGeneration() { controllerRef.current?.abort(); }

  async function sendChat(value) {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    let sid = sessionId;
    const localId = `local-${Date.now()}`;
    const localMessage = { id: localId, role: 'user', text: value, tools: [] };
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      if (!sid) { const created = await api.post('/chat/sessions', { title: value.slice(0, 64) }); sid = created.session.id; setSessionId(sid); setSessions((current) => [created.session, ...current]); }
      const nextMessages = [...messages, localMessage]; setMessages(nextMessages); setPrompt(''); setRunning(true); setError('');
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content: value, model, effort }, { timeout: 180000, signal: controller.signal });
      if (!result?.message) throw new Error('O servidor não retornou uma resposta válida.');
      const answer = normalizeMessage(result.message); const finalMessages = [...nextMessages, answer]; setMessages(finalMessages); cacheSession(sid, finalMessages).catch(() => {});
      const generated = extractCode(answer.text, String(answer.id));
      if (generated.length) { setArtifacts((current) => { const merged = new Map(current.map((item) => [item.id, item])); generated.forEach((item) => merged.set(item.id, item)); return [...merged.values()]; }); setActiveArtifactId(generated[0].id); setArtifactPanelOpen(true); }
      setSessions((current) => current.map((item) => item.id === sid ? { ...item, title: item.title === 'Nova conversa' ? value.slice(0, 64) : item.title, updated_at: new Date().toISOString() } : item));
    } catch (cause) {
      if (cause?.name !== 'AbortError') { setMessages((current) => current.filter((item) => item.id !== localId)); setError(cause.message || 'Não foi possível concluir a resposta.'); }
    } finally { setRunning(false); controllerRef.current = null; sendLockRef.current = false; }
  }

  async function sendVibe(value) {
    if (sendLockRef.current || !projectId) return;
    sendLockRef.current = true;
    const controller = new AbortController(); controllerRef.current = controller;
    const localMessage = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] };
    setMessages((current) => [...current, localMessage]); setPrompt(''); setRunning(true); setError(''); setPhase('received'); setSteps([]); startedAtRef.current = Date.now(); setElapsed(0); setMode('vibe');
    try {
      const result = await api.streamPost('/ai/generate/stream', { model, thinking: 'ultracode', prompt: value, context, projectId }, (event) => {
        if (event.type === 'phase') { setPhase(event.phase); setSteps((current) => [...current.filter((item) => item.phase !== event.phase), event]); }
        if (event.type === 'artifact' && event.path) {
          const file = { path: event.path, kind: 'file', content: String(event.content || '') }; const artifact = fileArtifact(file);
          setFiles((current) => current.some((item) => item.path === file.path) ? current.map((item) => item.path === file.path ? file : item) : [...current, file]);
          setArtifacts((current) => { const merged = new Map(current.map((item) => [item.id, item])); merged.set(artifact.id, artifact); return [...merged.values()]; });
          setActiveArtifactId(artifact.id); setArtifactPanelOpen(true);
        }
      }, { timeout: 180000, signal: controller.signal });
      const assistant = { id: `assistant-${Date.now()}`, role: 'assistant', text: result?.text || 'Projeto atualizado.', tools: [] };
      setMessages((current) => [...current, assistant]); setPhase('completed');
      if (sessionId) cacheSession(sessionId, [...messages, localMessage, assistant]).catch(() => {});
      await loadProject();
    } catch (cause) { if (cause?.name !== 'AbortError') setError(cause.message || 'O agente não conseguiu concluir a tarefa.'); }
    finally { setRunning(false); controllerRef.current = null; sendLockRef.current = false; }
  }

  async function send() {
    const value = prompt.trim(); if (!value || running || sendLockRef.current) return;
    if (mode === 'vibe') await sendVibe(value); else await sendChat(value);
  }

  function setCodexMode(next) { setMode(next); setError(''); }
  function replayIntro() { setShowTaffPresentation(true); setMobileOpen(false); }
  function openArtifacts() { if (!artifacts.length) return; setActiveArtifactId((current) => current || artifacts[0].id); setArtifactPanelOpen(true); }

  return <div className={`codex-rebuild ${mode === 'vibe' ? 'vibe-mode' : 'chat-mode'} ${mobileOpen ? 'mobile-sidebar-open' : ''}`}>
    {showIntro && <PrismCodexIntro userName={user?.name || 'você'} onComplete={() => setShowIntro(false)} />}
    {showTaffPresentation && <div className="codex-taff-overlay" role="dialog" aria-modal="true" aria-label="Apresentação TAFF 2.0"><button type="button" className="codex-taff-close" onClick={() => setShowTaffPresentation(false)} aria-label="Fechar apresentação">Fechar</button><div className="codex-taff-shell"><TaffPresentation /></div></div>}
    <button type="button" className="codex-mobile-toggle" onClick={() => setMobileOpen((current) => !current)} aria-label="Abrir navegação">☰</button>
    {mobileOpen && <button type="button" className="codex-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação" />}
    <CodexSidebar sessions={sessions} activeId={sessionId} query={query} onQuery={setQuery} onNew={newSession} onOpen={openSession} onRename={renameSession} onDelete={deleteSession} onReplay={replayIntro} onMode={setCodexMode} onPlans={() => setPlansOpen(true)} onHome={() => navigate('/chat')} onArtifacts={openArtifacts} onSettings={() => navigate('/configuracoes')} onProjects={() => navigate('/studio')} mode={mode} />
    <main className="codex-main-rebuild">
      <header className="codex-header-rebuild">
        <div className="codex-header-title"><span>PRISM IA</span><strong>{mode === 'vibe' ? 'Código' : 'Codex'}</strong></div>
        <div className="codex-header-actions">
          <div className="codex-model-wrap"><button type="button" onClick={() => setModelOpen((current) => !current)}>{activeModelLabel}<span>⌄</span></button>
            {modelOpen && <div className="codex-model-popover">{MODELS.map(([id, label]) => <button type="button" key={id} className={id === model ? 'active' : ''} onClick={() => chooseModel(id)}>{label}{(MODEL_RANK[id] ?? 0) > planRank && <small>Upgrade</small>}{id === model && <small>Atual</small>}</button>)}</div>}
          </div>
          <button type="button" onClick={() => setEffort(EFFORTS[(EFFORTS.indexOf(effort) + 1) % EFFORTS.length])}>{effort}</button>
          <button type="button" className="codex-command-trigger" onClick={() => setCommandOpen(true)}>⌘K</button>
        </div>
      </header>
      <McpContextBar servers={mcpServers} activeIds={mcpActive} onToggle={(id) => setMcpActive((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
      <section className="codex-body-rebuild">
        <section className="codex-conversation-rebuild">
          <div className="codex-scroll-rebuild">
            {!messages.length && <div className="codex-welcome-rebuild"><span>PRISM CODEX</span><h1>Construa sem sair do fluxo.</h1><p>Converse, planeje e programe em um espaço único. O código fica em uma superfície dedicada, sem poluir a conversa.</p><div><button type="button" onClick={() => { setMode('vibe'); setPrompt('Crie um site institucional moderno em HTML, CSS e JavaScript.'); }}>Criar um site</button><button type="button" onClick={() => { setMode('vibe'); setPrompt('Revise meu projeto e aponte os problemas mais importantes.'); }}>Revisar projeto</button></div></div>}
            {messages.map((message) => <article className={`codex-message-rebuild ${message.role}`} key={String(message.id)}><div className="codex-message-meta"><span>{message.role === 'user' ? (user?.name || 'Você') : 'Prism IA'}</span></div><div className="codex-message-content">{message.role === 'assistant' ? <MarkdownMessage content={message.text} messageId={String(message.id)} onOpenCode={(id, block) => { setArtifacts((current) => mergeArtifacts(current, [block])); setActiveArtifactId(id); setArtifactPanelOpen(true); }} /> : <p>{message.text}</p>}</div>{message.tools?.length ? <small className="codex-tools">Ferramentas · {message.tools.map((item) => item.tool).filter(Boolean).join(', ')}</small> : null}</article>)}
            {running && <div className="codex-running-rebuild"><span />{mode === 'vibe' ? 'Trabalhando no projeto…' : 'Prism está pensando…'}</div>}
            {mode === 'vibe' && phase && <div className="codex-progress-rebuild"><header><strong>{PHASES.find(([id]) => id === phase)?.[1] || 'Trabalhando'}</strong><span>{(elapsed / 1000).toFixed(1)}s</span></header><div className="codex-steps">{PHASES.map(([id, label], index) => <div className={`codex-step ${index < PHASES.findIndex(([item]) => item === phase) ? 'done' : ''} ${id === phase ? 'active' : ''}`} key={id}><span>{index < PHASES.findIndex(([item]) => item === phase) ? '✓' : id === phase ? '·' : ''}</span><div><strong>{label}</strong><small>{steps.find((item) => item.phase === id)?.detail || ''}</small></div></div>)}</div></div>}
          </div>
          {error && <div className="codex-error-rebuild"><span>{error}</span><button type="button" onClick={() => setError('')}>Fechar</button></div>}
          <footer className="codex-composer-rebuild"><div className="codex-composer-box"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} disabled={running} rows={1} placeholder={mode === 'vibe' ? 'Descreva o que você quer construir…' : 'Escreva uma mensagem'} /><div><span>{mode === 'vibe' ? 'Código' : 'Enter envia · Shift + Enter quebra a linha'}</span>{running ? <button type="button" onClick={stopGeneration}>Parar</button> : <button type="button" className={canSend ? 'ready' : ''} onClick={send} disabled={!canSend}>Enviar</button>}</div></div><small>Revise informações importantes antes de usá-las.</small></footer>
        </section>
        {mode === 'vibe' && <section className="codex-live-workspace"><header><div><span>PROJETO</span><strong>{projectName}</strong></div><button type="button" onClick={openArtifacts}>Abrir arquivos</button></header><div>{preview ? <iframe title="Preview do projeto" srcDoc={preview} sandbox="allow-scripts" /> : <div className="codex-no-preview">Gere um arquivo HTML para abrir o preview.</div>}</div></section>}
      </section>
    </main>
    <CodeArtifactsPanel open={artifactPanelOpen && artifacts.length > 0} artifacts={artifacts} activeId={activeArtifactId} onSelect={setActiveArtifactId} onClose={() => setArtifactPanelOpen(false)} onUpdateArtifact={(id, patch) => setArtifacts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))} />
    <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
    {commandOpen && <div className="codex-modal-rebuild" onMouseDown={() => setCommandOpen(false)}><section className="codex-command-rebuild" onMouseDown={(event) => event.stopPropagation()}><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversas…"/><button type="button" onClick={newSession}>Nova conversa</button><button type="button" onClick={() => setMode('chat')}>Conversa</button><button type="button" onClick={() => setMode('vibe')}>Código</button><button type="button" onClick={replayIntro}>Reabrir apresentação</button></section></div>}
  </div>;
}

function mergeArtifacts(current, incoming) {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => map.set(item.id, item));
  return [...map.values()];
}
