import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { usePersistentCodex } from '../lib/usePersistentCodex.js';
import PrismCodexIntro, { INTRO_KEY } from '../components/PrismCodexIntro.jsx';
import CodexSidebar from '../components/codex/CodexSidebar.jsx';
import McpContextBar from '../components/codex/McpContextBar.jsx';
import CodeArtifactsPanel from '../components/CodeArtifactsPanel.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import './codex-rebuild.css';

const MODELS = [
  ['prism-nano-1.0', 'Prism Nano 1.0A'], ['prism-mini-1.0', 'Prism Mini 1.0A'], ['prism-edge-1.0', 'Prism Edge 1.0A'],
  ['prism-tex-1.5', 'Prism Tex 1.5B'], ['prism-taff-1.0', 'Prism Taff 1.0A'], ['prism-taff-2.0', 'Prism Taff 2.0'],
];
const EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];
const VIBE_PATTERN = /\b(site|website|webapp|web app|jogo|game|app|aplicativo|api|sistema|script|scripts|c[oó]digo|code|componente|p[aá]gina|landing|projeto|arquivo|arquivos|npm|react|python|godot|unity|html|css|javascript|criar|construir|implementar|programar)\b/i;
const PHASES = [['received','Pedido recebido'],['analyzing','Analisando'],['planning','Planejando'],['writing','Escrevendo arquivos'],['reviewing','Revisando'],['updating','Atualizando workspace'],['completed','Concluído']];
const STARTER = [
  { path: 'src/App.jsx', kind: 'file', content: 'export default function App() {\n  return <main>Comece a construir.</main>;\n}\n' },
  { path: 'src/index.css', kind: 'file', content: '' },
  { path: 'package.json', kind: 'file', content: '{"name":"prism-project"}\n' },
];

function mapMessage(message) {
  let metadata = {};
  try { metadata = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : (message.metadata || {}); } catch {}
  return { id: message.id, role: message.role, text: message.content || '', model: message.model_id || '', tools: Array.isArray(metadata.tools_used) ? metadata.tools_used : [] };
}

function fileArtifact(file, index = 0) {
  const extension = String(file.path || '').split('.').pop()?.toLowerCase() || 'txt';
  const language = { html: 'markup', htm: 'markup', css: 'css', js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', json: 'json', md: 'markdown', py: 'python' }[extension] || 'text';
  return { id: `workspace:${file.path}:${index}`, filename: file.path, language, languageLabel: extension.toUpperCase(), code: String(file.content || ''), info: extension };
}

function previewFor(files) {
  const real = files.filter((file) => file.kind !== 'folder');
  const html = real.find((file) => /(^|\/)index\.html$/i.test(file.path)) || real.find((file) => /\.html?$/i.test(file.path));
  if (!html) return '';
  const css = real.filter((file) => /\.css$/i.test(file.path)).map((file) => file.content || '').join('\n');
  const js = real.filter((file) => /\.js$/i.test(file.path)).map((file) => file.content || '').join('\n');
  let doc = html.content || '';
  if (!/<html\b/i.test(doc)) doc = `<!doctype html><html><head></head><body>${doc}</body></html>`;
  if (css) doc = doc.replace(/<\/head>/i, `<style>${css}</style></head>`);
  if (js) doc = doc.replace(/<\/body>/i, `<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body>`);
  return doc;
}

function StepList({ phase, steps }) {
  const active = PHASES.findIndex(([id]) => id === phase);
  return <div className="codex-steps">{PHASES.map(([id, label], index) => <div key={id} className={`codex-step ${index < active ? 'done' : ''} ${id === phase ? 'active' : ''}`}><span>{index < active ? '✓' : id === phase ? '·' : ''}</span><div><strong>{label}</strong><small>{steps.find((item) => item.phase === id)?.detail || ''}</small></div></div>)}</div>;
}

export default function Codex() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { preferences, updatePreference, cacheSession, cachedSession } = usePersistentCodex();
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem(INTRO_KEY) !== '1');
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState('prism-taff-2.0');
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [artifacts, setArtifacts] = useState([]);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState(null);
  const startedAt = useRef(0);
  const controllerRef = useRef(null);
  const sendLockRef = useRef(false);

  const context = useMemo(() => messages.slice(-12).map((item) => `${item.role}: ${item.text}`).join('\n'), [messages]);
  const activeModelLabel = MODELS.find(([id]) => id === model)?.[1] || model;
  const canSend = prompt.trim().length > 0 && !running;

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
    setProjectId(project.id); setProjectName(project.name || 'Novo projeto'); setFiles(loaded);
    setArtifacts(loaded.filter((file) => file.kind !== 'folder').map(fileArtifact));
  }, []);

  const loadSessions = useCallback(async () => {
    const data = await api.get('/chat/sessions');
    const next = Array.isArray(data.sessions) ? data.sessions : [];
    setSessions(next);
    if (!sessionId && next[0]) setSessionId(next[0].id);
  }, [sessionId]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setSessionId(id); setError('');
    const cached = await cachedSession(id).catch(() => null);
    if (cached) setMessages(cached);
    try {
      const data = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      const next = (data.messages || []).map(mapMessage);
      setMessages(next); cacheSession(id, next).catch(() => {});
      const messageArtifacts = next.flatMap((message) => message.role === 'assistant' ? extractCode(message.text, String(message.id)) : []);
      if (messageArtifacts.length) setArtifacts((current) => mergeArtifacts(current, messageArtifacts));
    } catch (cause) { if (!cached) setError(cause.message || 'Não foi possível carregar a conversa.'); }
  }, [cacheSession, cachedSession]);

  function extractCode(text, messageId) {
    const source = String(text || '').replace(/\r\n?/g, '\n');
    const regex = /(^|\n)\s*(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\s*\2\s*(?=\n|$)/g;
    const blocks = []; let match; let index = 0;
    while ((match = regex.exec(source))) {
      const info = match[3].trim(); const language = (info.split(/\s+/)[0] || 'text').toLowerCase();
      const filenameMatch = /(?:file|filename|path)\s*=\s*(?:"([^"]+)"|'([^']+)'|(\S+))/i.exec(info);
      const filename = filenameMatch?.[1] || filenameMatch?.[2] || filenameMatch?.[3] || (language === 'html' ? `index-${index + 1}.html` : `codigo-${index + 1}.${language}`);
      blocks.push({ id: `${messageId}:code:${index}`, filename, language: language === 'html' ? 'markup' : language, languageLabel: language.toUpperCase(), code: match[4], info }); index += 1;
    }
    return blocks;
  }

  function mergeArtifacts(current, incoming) {
    const byId = new Map(current.map((item) => [item.id, item]));
    incoming.forEach((item) => byId.set(item.id, item));
    return [...byId.values()];
  }

  useEffect(() => { Promise.all([loadProject(), loadSessions(), api.get('/mcp').then((data) => setMcpServers(data.servers || [])).catch(() => setMcpServers([]))]).catch((cause) => setError(cause.message || 'Não foi possível carregar o Codex.')); }, [loadProject, loadSessions]);
  useEffect(() => { if (sessionId) loadSession(sessionId).catch(() => {}); }, [sessionId, loadSession]);
  useEffect(() => { updatePreference('effort', effort); }, [effort, updatePreference]);
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 100); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => { const onKey = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true); } if (event.key === 'Escape') { setCommandOpen(false); setModelOpen(false); setPlansOpen(false); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);

  async function newSession() {
    if (running) return;
    const data = await api.post('/chat/sessions', { title: 'Nova conversa' });
    setSessions((current) => [data.session, ...current.filter((item) => item.id !== data.session.id)]); setSessionId(data.session.id); setMessages([]); setMode('chat'); setPrompt(''); setError('');
  }

  async function renameSession(session) {
    const title = window.prompt('Nome da conversa', session.title || 'Nova conversa');
    if (!title?.trim()) return;
    const data = await api.patch(`/chat/sessions/${encodeURIComponent(session.id)}`, { title });
    setSessions((current) => current.map((item) => item.id === session.id ? data.session : item));
  }

  async function deleteSession(session) {
    if (!window.confirm(`Excluir “${session.title || 'Nova conversa'}”?`)) return;
    await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`);
    const next = sessions.filter((item) => item.id !== session.id); setSessions(next);
    if (session.id === sessionId) { setSessionId(next[0]?.id || null); setMessages([]); }
  }

  async function sendChat(value) {
    if (sendLockRef.current) return;
    sendLockRef.current = true;
    let sid = sessionId;
    const userMessage = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] };
    try {
      if (!sid) { const created = await api.post('/chat/sessions', { title: value.slice(0, 64) }); sid = created.session.id; setSessionId(sid); setSessions((current) => [created.session, ...current]); }
      const base = [...messages, userMessage]; setMessages(base); setPrompt(''); setRunning(true); setError('');
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content: value, model, effort }, { timeout: 180000 });
      if (result?.status === 'unavailable') throw new Error('Estamos com instabilidade nos servidores. Tente novamente mais tarde.');
      const answer = mapMessage(result.message || {}); const next = [...base, answer]; setMessages(next); cacheSession(sid, next).catch(() => {});
      const generated = extractCode(answer.text, String(answer.id));
      if (generated.length) { setArtifacts((current) => mergeArtifacts(current, generated)); setActiveArtifactId(generated[0].id); setArtifactPanelOpen(true); }
      await loadSessions();
    } catch (cause) { setMessages((current) => current.filter((item) => item.id !== userMessage.id)); setError(cause.message || 'Não foi possível concluir a resposta.'); }
    finally { setRunning(false); window.setTimeout(() => { sendLockRef.current = false; }, 200); }
  }

  async function sendVibe(value) {
    if (sendLockRef.current || !projectId) return;
    sendLockRef.current = true;
    const local = { id: `local-${Date.now()}`, role: 'user', text: value, tools: [] };
    setMessages((current) => [...current, local]); setPrompt(''); setMode('vibe'); setRunning(true); setError(''); setPhase('received'); setSteps([]); startedAt.current = Date.now(); setElapsed(0);
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      const result = await api.streamPost('/ai/generate/stream', { model, thinking: 'ultracode', prompt: value, context, projectId }, (event) => {
        if (event.type === 'phase') { setPhase(event.phase); setSteps((current) => [...current.filter((item) => item.phase !== event.phase), event]); }
        if (event.type === 'artifact') {
          const file = { path: event.path, kind: 'file', content: String(event.content || '') };
          setFiles((current) => current.some((item) => item.path === file.path) ? current.map((item) => item.path === file.path ? file : item) : [...current, file]);
          const artifact = fileArtifact(file);
          setArtifacts((current) => mergeArtifacts(current, [artifact])); setActiveArtifactId(artifact.id); setArtifactPanelOpen(true);
        }
      }, { timeout: 180000, signal: controller.signal });
      await loadProject();
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: result.text || 'Projeto atualizado.', tools: [] }]);
      setPhase('completed');
    } catch (cause) { if (cause?.name !== 'AbortError') setError(cause.message || 'O agente não conseguiu concluir a tarefa.'); }
    finally { setRunning(false); controllerRef.current = null; sendLockRef.current = false; }
  }

  async function send() {
    const value = prompt.trim();
    if (!value || running || sendLockRef.current) return;
    if (mode === 'vibe' || VIBE_PATTERN.test(value)) await sendVibe(value); else await sendChat(value);
  }

  const sidebarArtifacts = () => { if (!artifacts.length) return; setActiveArtifactId((current) => current || artifacts[0].id); setArtifactPanelOpen(true); };
  function stop() { controllerRef.current?.abort(); }
  function setCodexMode(next) { setMode(next); if (next === 'vibe') setError(''); }
  function replayIntro() { localStorage.removeItem(INTRO_KEY); setShowIntro(true); }

  return <div className={`codex-rebuild ${mode === 'vibe' ? 'vibe-mode' : 'chat-mode'} ${artifactPanelOpen ? 'artifact-open' : ''}`}>
    {showIntro && <PrismCodexIntro userName={user?.name || 'você'} onComplete={() => setShowIntro(false)} />}
    <CodexSidebar sessions={sessions} activeId={sessionId} query={query} onQuery={setQuery} onNew={newSession} onOpen={loadSession} onRename={renameSession} onDelete={deleteSession} onReplay={replayIntro} onMode={setCodexMode} onPlans={() => setPlansOpen(true)} onHome={() => navigate('/chat')} onArtifacts={sidebarArtifacts} onSettings={() => navigate('/configuracoes')} mode={mode} />

    <main className="codex-main-rebuild">
      <header className="codex-header-rebuild"><div className="codex-header-title"><span>PRISM IA</span><strong>{mode === 'vibe' ? 'Código' : 'Codex'}</strong></div><div className="codex-header-actions"><div className="codex-model-wrap"><button onClick={() => setModelOpen((current) => !current)}>{activeModelLabel}<span>⌄</span></button>{modelOpen && <div className="codex-model-popover">{MODELS.map(([id, label]) => <button key={id} className={id === model ? 'active' : ''} onClick={() => { setModel(id); setModelOpen(false); }}>{label}{id === model && <small>Atual</small>}</button>)}</div>}</div><button onClick={() => setEffort(EFFORTS[(EFFORTS.indexOf(effort) + 1) % EFFORTS.length])}>{effort}</button><button onClick={() => setCommandOpen(true)}>⌘K</button></div></header>
      <McpContextBar servers={mcpServers} activeIds={mcpActive} onToggle={(id) => setMcpActive((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />

      <section className="codex-body-rebuild">
        <section className="codex-conversation-rebuild">
          <div className="codex-scroll-rebuild">
            {!messages.length && <div className="codex-welcome-rebuild"><span>PRISM CODEX</span><h1>Construa sem sair do fluxo.</h1><p>Uma conversa limpa para planejar, escrever e revisar. Quando houver código, ele abre na superfície dedicada.</p><div><button onClick={() => setPrompt('Crie um site institucional moderno em HTML, CSS e JavaScript.')}>Criar um site</button><button onClick={() => setPrompt('Revise meu projeto e aponte os problemas mais importantes.')}>Revisar projeto</button></div></div>}
            {messages.map((message) => <article className={`codex-message-rebuild ${message.role}`} key={message.id}><div className="codex-message-meta"><span>{message.role === 'user' ? (user?.name || 'Você') : 'Prism IA'}</span></div><div className="codex-message-content">{message.role === 'assistant' ? <MarkdownMessage content={message.text} messageId={String(message.id)} onOpenCode={(id, block) => { setArtifacts((current) => mergeArtifacts(current, [block])); setActiveArtifactId(id); setArtifactPanelOpen(true); }} /> : <p>{message.text}</p>}</div>{message.tools?.length > 0 && <small className="codex-tools">Ferramentas · {message.tools.map((item) => item.tool).filter(Boolean).join(', ')}</small>}</article>)}
            {running && <div className="codex-running-rebuild"><span />{mode === 'vibe' ? 'Trabalhando no projeto…' : 'Prism está pensando…'}</div>}
            {mode === 'vibe' && phase && <div className="codex-progress-rebuild"><header><strong>{PHASES.find(([id]) => id === phase)?.[1] || 'Trabalhando'}</strong><span>{(elapsed / 1000).toFixed(1)}s</span></header><StepList phase={phase} steps={steps} /></div>}
          </div>

          {error && <div className="codex-error-rebuild"><span>{error}</span><button onClick={() => setError('')}>Fechar</button></div>}
          <footer className="codex-composer-rebuild"><div className="codex-composer-box"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} disabled={running} rows={1} placeholder={mode === 'vibe' ? 'Descreva o que você quer construir…' : 'Escreva uma mensagem'} /><div><span>{mode === 'vibe' ? 'Vibe Code' : 'Enter envia · Shift + Enter quebra a linha'}</span>{running ? <button onClick={stop}>Parar</button> : <button className={canSend ? 'ready' : ''} onClick={send} disabled={!canSend}>Enviar</button>}</div></div><small>Revise informações importantes antes de usá-las.</small></footer>
        </section>

        {mode === 'vibe' && <section className="codex-live-workspace"><header><div><span>PROJETO</span><strong>{projectName}</strong></div><button onClick={sidebarArtifacts}>Abrir arquivos</button></header><div>{previewFor(files) ? <iframe title="Preview do projeto" srcDoc={previewFor(files)} sandbox="allow-scripts" /> : <div className="codex-no-preview">Gere um arquivo HTML para abrir o preview.</div>}</div></section>}
      </section>
    </main>

    <CodeArtifactsPanel open={artifactPanelOpen && artifacts.length > 0} artifacts={artifacts} activeId={activeArtifactId} onSelect={setActiveArtifactId} onClose={() => setArtifactPanelOpen(false)} onUpdateArtifact={(id, patch) => setArtifacts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item))} />

    {plansOpen && <div className="codex-modal-rebuild" onMouseDown={() => setPlansOpen(false)}><section onMouseDown={(event) => event.stopPropagation()}><header><strong>Planos</strong><button onClick={() => setPlansOpen(false)}>Fechar</button></header><p>Escolha o plano que melhor atende ao seu uso.</p></section></div>}
    {commandOpen && <div className="codex-modal-rebuild" onMouseDown={() => setCommandOpen(false)}><section className="codex-command-rebuild" onMouseDown={(event) => event.stopPropagation()}><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversas…"/><button onClick={newSession}>+ Nova conversa</button><button onClick={replayIntro}>Reabrir apresentação</button></section></div>}
  </div>;
}
