import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import FileAttachments from '../components/FileAttachments.jsx';
import ThinkingSelector from '../components/ThinkingSelector.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import PrismIcon from '../components/PrismIcon.jsx';
import { useWorkspaceTheme } from '../lib/workspaceTheme.js';

const MODELS = [
  { id: 'prism-nano-1.0', label: 'Prism Nano 1.0A', rank: 0 },
  { id: 'prism-mini-1.0', label: 'Prism Mini 1.0A', rank: 0 },
  { id: 'prism-edge-1.0', label: 'Prism Edge 1.0A', rank: 2 },
  { id: 'prism-tex-1.5', label: 'Prism Tex 1.5A', rank: 2 },
  { id: 'prism-taff-1.0', label: 'Prism Taff 1.0A', rank: 3 },
  { id: 'prism-taff-2.0', label: 'Prism Taff 2.0', rank: 3 },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const STARTERS = [
  ['Escrever', 'Escreva algo claro e pronto para usar.'],
  ['Criar', 'Tire uma ideia do papel e monte a estrutura.'],
  ['Código', 'Implemente, revise ou depure código.'],
  ['Aprender', 'Explique um assunto com exemplos.'],
  ['Analisar', 'Encontre padrões, riscos e próximos passos.'],
];

function rankOf(plan) { return PLAN_RANK[plan] ?? 0; }
function requestId() { try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random()}`; } }
function metadataOf(message) { if (!message?.metadata) return {}; if (typeof message.metadata === 'object') return message.metadata; try { return JSON.parse(message.metadata); } catch { return {}; } }
function eventLabel(event) {
  const map = { start: 'Preparando', quota_reserved: 'Cota reservada', workspace_start: 'Abrindo projeto', workspace_ready: 'Projeto pronto', mcp_start: 'Conectando MCP', mcp_ready: 'MCP pronto', mcp_error: 'MCP indisponível', tools_ready: 'Ferramentas prontas', providers_ready: 'Provedores disponíveis', provider_start: 'Executando modelo', provider_round: 'Modelo pensando', provider_complete: 'Modelo concluiu', provider_error: 'Tentando outro provedor', tool_start: 'Executando ferramenta', command_output: 'Executando comando', artifact: 'Artefato criado', finalizing: 'Revisando resposta', megabrain_start: 'MegaBrain ativado', megabrain_provider_start: 'Consultando modelo do MegaBrain', megabrain_provider_complete: 'Conselheiro respondeu', megabrain_provider_error: 'Conselheiro falhou', megabrain_synthesis_start: 'Consolidando o MegaBrain', megabrain_done: 'MegaBrain concluído', done: 'Concluído', error: 'Falha' };
  return map[event?.type] || event?.message || event?.type || 'Executando';
}

export default function ChatRelease() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const rank = rankOf(user?.plan);
  const [sessions, setSessions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(() => localStorage.getItem('prism.home.model') || 'prism-mini-1.0');
  const [effort, setEffort] = useState(() => localStorage.getItem('prism-default-effort') || 'medium');
  const [projectId, setProjectId] = useState(() => localStorage.getItem('prism.chat.project') || '');
  const [attachments, setAttachments] = useState([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('');
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('prism-compact-sidebar') === 'true');
  const { theme, mode: themeMode, cycleMode } = useWorkspaceTheme();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [traceOpen, setTraceOpen] = useState(true);
  const [events, setEvents] = useState([]);
  const [commandOutput, setCommandOutput] = useState('');
  const [artifact, setArtifact] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const controllerRef = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const selected = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const filteredSessions = useMemo(() => { const q = search.trim().toLowerCase(); return q ? sessions.filter((item) => String(item.title || '').toLowerCase().includes(q)) : sessions; }, [search, sessions]);
  const canSend = Boolean(input.trim() || attachments.length) && !sending;

  useEffect(() => { const current = MODELS.find((item) => item.id === model); const allowed = MODELS.find((item) => rank >= item.rank); if (allowed && current && rank < current.rank) setModel(allowed.id); }, [rank, model]);
  useEffect(() => { localStorage.setItem('prism.home.model', model); }, [model]);
  useEffect(() => { localStorage.setItem('prism-default-effort', effort); }, [effort]);
  useEffect(() => { localStorage.setItem('prism.chat.project', projectId); }, [projectId]);
  useEffect(() => { localStorage.setItem('prism-compact-sidebar', String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending, events.length]);
  useEffect(() => { const timer = setTimeout(() => inputRef.current?.focus(), 80); return () => clearTimeout(timer); }, [sessionId]);

  const authFail = useCallback((cause) => { if (cause?.status !== 401) return false; logout(); navigate('/login', { replace: true }); return true; }, [logout, navigate]);

  const loadSession = useCallback(async (id) => {
    setSessionId(id); setLoading(true); setMobileOpen(false); setAttachments([]); setEvents([]); setCommandOutput(''); setArtifact(null); setError('');
    try { const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages?surface=home`); setMessages(result.messages || []); }
    catch (cause) { if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar a conversa.'); }
    finally { setLoading(false); }
  }, [authFail]);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/chat/sessions?surface=home'), api.get('/projects')])
      .then(async ([sessionResult, projectResult]) => {
        if (!active) return;
        setSessions(sessionResult.sessions || []);
        setProjects(projectResult.projects || []);
        if (sessionResult.sessions?.[0]) await loadSession(sessionResult.sessions[0].id);
      })
      .catch((cause) => { if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar o Chat.'); })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [authFail, loadSession]);

  async function newSession() {
    if (sending) return;
    try {
      const result = await api.post('/chat/sessions', { surface: 'home' });
      setSessions((items) => [result.session, ...items]); setSessionId(result.session.id); setMessages([]); setEvents([]); setCommandOutput(''); setArtifact(null); setInput(''); setError(''); setMobileOpen(false);
    } catch (cause) { if (!authFail(cause)) setError(cause.message || 'Não foi possível criar a conversa.'); }
  }

  function chooseModel(id) {
    const next = MODELS.find((item) => item.id === id); if (!next) return;
    if (rank < next.rank) { setRequestedModel(next.label); setPlansOpen(true); setModelOpen(false); return; }
    setModel(next.id); setModelOpen(false);
  }

  async function send() {
    if (!canSend) return;
    setSending(true); setError(''); setEvents([]); setCommandOutput(''); setArtifact(null); setStreamingText(''); setTraceOpen(true);
    const controller = new AbortController(); controllerRef.current = controller;
    const rid = requestId(); const content = input.trim(); const selectedAttachments = [...attachments];
    let currentSession = sessionId;
    const localId = `local-${rid}`;
    try {
      if (!currentSession) {
        const created = await api.post('/chat/sessions', { surface: 'home', title: content.slice(0, 64) || 'Arquivos anexados' });
        currentSession = created.session.id; setSessionId(currentSession); setSessions((items) => [created.session, ...items]);
      }
      const optimistic = { id: localId, role: 'user', content, model_id: model, effort, metadata: { attachments: selectedAttachments } };
      setMessages((items) => [...items, optimistic]); setInput(''); setAttachments([]);
      const result = await api.streamPost(`/chat/sessions/${encodeURIComponent(currentSession)}/messages/stream`, {
        content, model, effort, clientRequestId: rid, attachmentIds: selectedAttachments.map((file) => file.id).filter(Boolean), projectId: projectId || null,
      }, (event) => {
        if (event.type === 'provider_start') setStreamingText('');
        if (event.type === 'text_delta') setStreamingText((value) => `${value}${event.delta || ''}`);
        if (event.type === 'result') setStreamingText('');
        if (event.type === 'command_output') setCommandOutput((value) => `${value}${event.text || ''}`.slice(-12_000));
        setEvents((items) => [...items.slice(-30), event]);
        if (event.type === 'artifact' && event.filename) setArtifact(event);
        if (event.type === 'error') setError(event.message || 'A execução falhou.');
      }, { timeout: 300_000, signal: controller.signal });
      const payload = result || {};
      if (payload.duplicate) {
        const history = await api.get(`/chat/sessions/${encodeURIComponent(currentSession)}/messages?surface=home`);
        setMessages(history.messages || []);
      } else if (payload.message) {
        setMessages((items) => [...items.filter((item) => item.id !== localId), payload.userMessage || optimistic, payload.message]);
      }
      if (payload.usage) setSessions((items) => items);
    } catch (cause) {
      if (cause?.name !== 'AbortError') {
        if (cause?.payload?.code === 'PLAN_UPGRADE_REQUIRED' || cause?.status === 403) { setRequestedModel(cause.payload?.requiredPlan || selected.label); setPlansOpen(true); }
        else if (!authFail(cause)) setError(cause.message || 'Não foi possível concluir a execução.');
      }
      setStreamingText('');
      setMessages((items) => items.filter((item) => item.id !== localId));
    } finally {
      setSending(false); setStreamingText(''); controllerRef.current = null;
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  const initial = String(user?.name || 'P').slice(0, 1).toUpperCase();
  const hasMessages = messages.length > 0;
  const workingEvent = [...events].reverse().find((event) => !['done', 'provider_complete'].includes(event.type));

  return <div className={`prism-agent-chat prism-workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}`} data-theme={theme}>
    <aside className={`prism-agent-sidebar${mobileOpen ? " open" : ""}`}>
      <div className="prism-agent-sidebar__header"><button className="prism-agent-brand" onClick={() => navigate('/chat')} aria-label="Prism IA"><img src="/prism-logo.svg" alt=""/><span>Prism IA</span></button><button className="prism-agent-sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"} title={sidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}><PrismIcon name={sidebarCollapsed ? "chevronRight" : "chevronLeft"} size={15}/></button></div>
      <button className="prism-agent-sidebar__new" onClick={newSession}><PrismIcon name="plus" size={15}/><span>Nova conversa</span></button>
      <div className="prism-agent-sidebar__nav">
        <button className="active"><PrismIcon name="home" size={15}/><span>Início</span></button>
        <button onClick={() => setSearch(search ? '' : ' ')}><PrismIcon name="search" size={15}/><span>Conversas</span></button>
        <button onClick={() => navigate('/studio')}><PrismIcon name="folder" size={15}/><span>Projetos</span></button>
        <button onClick={() => navigate('/modelos')}><PrismIcon name="model" size={15}/><span>Modelos</span></button>
        <button onClick={() => navigate('/configuracoes')}><PrismIcon name="settings" size={15}/><span>Configurações</span></button>
      </div>
      <div className="prism-agent-sidebar__projects">
        <div className="prism-agent-section-title">Projetos</div>
        {projects.map((project) => <button key={project.id} className={`prism-agent-project ${project.id === projectId ? 'active' : ''}`} onClick={() => setProjectId(project.id)}><PrismIcon name="folder" size={13}/><span>{project.name}</span></button>)}
        <div className="prism-agent-section-title">Conversas</div>
        <input className="prism-agent-conversation-search" value={search.trim() === ' ' ? '' : search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas" />
        {filteredSessions.map((session) => <button key={session.id} className={`prism-agent-project ${session.id === sessionId ? 'active' : ''}`} onClick={() => loadSession(session.id)}><PrismIcon name="layers" size={12}/><span>{session.title || 'Nova conversa'}</span></button>)}
      </div>
      <div className="prism-agent-sidebar__bottom"><button className="prism-agent-profile" onClick={() => navigate('/configuracoes')}><span className="prism-agent-avatar">{initial}</span><span className="prism-agent-profile-copy"><strong>{user?.name || 'Você'}</strong><span>{user?.plan || 'Grátis'}</span></span></button></div>
    </aside>

    <main className="prism-agent-main">
      {mobileOpen && <button className="prism-agent-mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <header className="prism-agent-topbar">
        <button className="prism-agent-mobile-toggle" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><PrismIcon name="menu" size={15}/></button>
        <div className="prism-agent-topbar-title">{hasMessages ? (sessions.find((item) => item.id === sessionId)?.title || 'Conversa') : 'O que você quer criar?'}</div>
        <div className="prism-agent-topbar-right">
          <select className="prism-agent-project-select" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Projeto"><option value="">Sem projeto</option>{projects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select>
          <div className="prism-agent-model-picker-wrap"><button className="prism-agent-model-select" onClick={() => setModelOpen((value) => !value)} aria-haspopup="menu" aria-expanded={modelOpen}>{selected.label}<span aria-hidden="true">⌄</span></button>{modelOpen && <div className="prism-agent-model-picker" role="menu">{MODELS.map((item) => <button type="button" role="menuitem" aria-current={item.id === model ? "true" : undefined} key={item.id} onClick={() => chooseModel(item.id)}><span>{item.label}</span><small>{rank < item.rank ? 'Upgrade' : item.id===model ? 'Selecionado' : ''}</small></button>)}</div>}</div>
        </div>
      </header>

      <section className="prism-agent-main-scroll">
        <div className="prism-agent-content">
          {!loading && !hasMessages && !error && <div className="prism-agent-empty"><div><h1>O que você quer criar?</h1><p>Converse, execute tarefas, use ferramentas, valide resultados e gere artefatos no mesmo fluxo.</p><div className="prism-agent-starters">{STARTERS.map(([label, prompt]) => <button className="prism-agent-starter" key={label} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}><PrismIcon name={label === 'Código' ? 'code' : 'layers'} size={14}/>{label}</button>)}</div></div></div>}
          {error && <div className="prism-agent-error" role="alert">{error}</div>}
          {hasMessages && <div className="prism-agent-messages">
            {messages.map((message) => { const meta = metadataOf(message); const files = Array.isArray(meta.attachments) ? meta.attachments : []; return <article key={message.id} className={`prism-agent-message ${message.role}`}><div className="prism-agent-author">{message.role === 'user' ? (user?.name || 'Você') : 'Prism IA'}</div>{files.length > 0 && <div className="prism-agent-attachments">{files.map((file) => <span className="prism-agent-chip" key={file.id || file.name}>{file.name}</span>)}</div>}<div className="message-bubble">{message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} /> : <p style={{margin:0}}>{message.content}</p>}</div></article>; })}
            {sending && streamingText && <article className="prism-agent-message assistant prism-agent-streaming"><div className="prism-agent-author">Prism IA</div><div className="message-bubble"><MarkdownMessage content={streamingText} messageId="streaming-response" /></div></article>}
            {sending && <div className="prism-agent-working"><span className="prism-agent-working-dot"/><span className="prism-agent-working-label">{eventLabel(workingEvent || { type: 'start' })}</span><span className="prism-agent-working-mode">{workingEvent?.provider ? `· ${workingEvent.provider}` : ''}</span></div>}
            {sending && commandOutput && <pre className="prism-agent-command-output">{commandOutput}</pre>}
            {events.length > 0 && <section className="prism-agent-trace"><button className="prism-agent-trace-toggle" onClick={() => setTraceOpen((value) => !value)}><PrismIcon name="tool" size={13}/><strong>{sending ? 'O que a Prism está fazendo' : 'Execução concluída'}</strong><span className="prism-agent-trace-count">{events.length} etapas</span></button>{traceOpen && <div className="prism-agent-trace-list">{events.slice(-20).map((event, index) => <div key={`${event.timestamp}-${index}`} className={`prism-agent-trace-item ${event.type === 'error' || event.ok === false ? 'error' : event.type === 'done' || event.type === 'provider_complete' || event.type === 'tool_complete' && event.ok ? 'ok' : ''}`}><span className="prism-agent-trace-dot"/><span>{eventLabel(event)}{event.provider ? ` · ${event.provider}` : ''}{event.tool ? ` · ${event.tool}` : ''}</span><span className="prism-agent-trace-time">{event.timestamp ? new Date(event.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) : ''}</span></div>)}</div>}</section>}
            {artifact?.downloadPath && <div className="prism-agent-artifact"><div className="prism-agent-artifact-copy"><strong>{artifact.filename}</strong><span>Artefato gerado pela execução</span></div><a href={artifact.downloadPath} target="_blank" rel="noreferrer">Abrir</a></div>}
            <div ref={endRef}/>
          </div>}
        </div>
      </section>

      <footer className="prism-agent-composer-wrap"><div className="prism-agent-composer">
        {attachments.length > 0 && <div className="prism-agent-attachments">{attachments.map((file) => <span className="prism-agent-chip" key={file.id || file.name}>{file.name}</span>)}</div>}
        <textarea ref={inputRef} rows={1} value={input} disabled={sending} onChange={(event) => { setInput(event.target.value); event.target.style.height='auto'; event.target.style.height=`${Math.min(190,event.target.scrollHeight)}px`; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Peça à Prism para construir, executar ou revisar..." aria-label="Mensagem" />
        <div className="prism-agent-composer-tools"><FileAttachments value={attachments} onChange={setAttachments} disabled={sending} label="Adicionar arquivo"/><div className="prism-agent-thinking"><ThinkingSelector value={effort} onChange={setEffort} rank={rank} disabled={sending}/></div><span className="prism-agent-composer-spacer"/>{sending ? <button className="prism-agent-send" onClick={() => controllerRef.current?.abort()} aria-label="Parar"><PrismIcon name="stop" size={13}/></button> : <button className="prism-agent-send" disabled={!canSend} onClick={send} aria-label="Enviar"><PrismIcon name="send" size={14}/></button>}</div>
      </div></footer>
    </main>
    <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel}/>
  </div>;
}
