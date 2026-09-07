import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import CodeArtifactsPanel from '../components/CodeArtifactsPanel.jsx';
import { extractCodeBlocks } from '../lib/codeBlocks.js';

const MODELS = [
  { id: 'prism-nano-1.0', name: 'Prism Nano 1.0A', short: 'Nano 1.0A', detail: 'Rápido para tarefas do dia a dia', tier: 'nano' },
  { id: 'prism-mini-1.0', name: 'Prism Mini 1.0A', short: 'Mini 1.0A', detail: 'Conversa, escrita e programação', tier: 'mini' },
  { id: 'prism-edge-1.0', name: 'Prism Edge 1.0A', short: 'Edge 1.0A', detail: 'Análise mais profunda', tier: 'edge' },
  { id: 'prism-tex-1.5', name: 'Prism Tex 1.5B', short: 'Tex 1.5B', detail: 'Código, documentação e arquitetura', tier: 'tex' },
  { id: 'prism-taff-1.0', name: 'Prism Taff 1.0A', short: 'Taff 1.0A', detail: 'Projetos complexos e debugging', tier: 'taff' },
  { id: 'prism-taff-2.0', name: 'Prism Taff 2.0', short: 'Taff 2.0', detail: 'O modelo mais forte da linha Prism', tier: 'taff2' },
];
const EFFORTS = [
  { id: 'low', name: 'Baixo', note: 'mais rápido' },
  { id: 'medium', name: 'Médio', note: 'equilibrado' },
  { id: 'high', name: 'Alto', note: 'mais profundidade' },
  { id: 'max', name: 'Máximo', note: 'qualidade acima de velocidade' },
  { id: 'ultracode', name: 'Ultra Code', note: 'engenharia e código' },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const ALLOWED_BY_PLAN = {
  0: new Set(['nano', 'mini']),
  1: new Set(['nano', 'mini']),
  2: new Set(['nano', 'mini', 'edge', 'tex']),
  3: new Set(['nano', 'mini', 'edge', 'tex', 'taff', 'taff2']),
  4: new Set(['nano', 'mini', 'edge', 'tex', 'taff', 'taff2']),
};
const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade nos servidores. Tente novamente mais tarde.';

function firstName(name = '') { return String(name).trim().split(/\s+/)[0] || 'você'; }
function initial(name = '') { return firstName(name).slice(0, 1).toUpperCase() || 'P'; }
function planRank(plan) { return PLAN_RANK[plan] ?? 0; }
function readStorage(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function startOfDay(value) { const date = new Date(value); return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function daysBetween(a, b) { return Math.floor((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000); }
function groupLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Outras';
  const diff = daysBetween(new Date(), date);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff > 1 && diff < 7) return 'Últimos 7 dias';
  if (diff >= 7 && diff < 30) return 'Este mês';
  return 'Mais antigas';
}
function formatConversationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return daysBetween(new Date(), date) === 0
    ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}
function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}
function groupSessions(sessions) {
  const groups = [];
  const index = new Map();
  for (const session of sessions) {
    const label = groupLabel(session.updated_at || session.created_at);
    if (!index.has(label)) { index.set(label, groups.length); groups.push({ label, items: [] }); }
    groups[index.get(label)].items.push(session);
  }
  return groups;
}

function CodeReference({ block, onOpen }) {
  return <div className="code-reference"><button type="button" onClick={() => onOpen(block.id)} aria-label={`Abrir ${block.filename}`}><span className="code-reference-main"><span className="code-reference-file"><span>{block.filename}</span></span><span className="code-reference-meta">{block.languageLabel || block.language} · {block.code.split('\n').length} {block.code.split('\n').length === 1 ? 'linha' : 'linhas'}</span></span><span className="code-reference-action">Ver código</span></button></div>;
}
function MessageBody({ message, onOpenCode }) {
  if (message.role !== 'assistant') return <span className="message-text">{message.content}</span>;
  const blocks = extractCodeBlocks(message.content, String(message.id));
  if (!blocks.length) return <span className="message-text">{message.content}</span>;
  return <div className="artifact-message-summary"><p>{blocks.length === 1 ? 'Criei este arquivo:' : `Criei ${blocks.length} arquivos:`}</p><div className="message-code-list">{blocks.map((block) => <CodeReference block={block} onOpen={onOpenCode} key={block.id} />)}</div></div>;
}

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(() => readStorage('prism-model', 'prism-mini-1.0'));
  const [effort, setEffort] = useState(() => readStorage('prism-effort', 'medium'));
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null);
  const [pickerMode, setPickerMode] = useState('closed');
  const [plansOpen, setPlansOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStorage('prism-chat-sidebar', 'open') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => readStorage('prism-chat-theme', 'light') === 'dark');
  const [artifacts, setArtifacts] = useState([]);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);
  const [activeArtifactId, setActiveArtifactId] = useState(null);
  const pickerRef = useRef(null);
  const renameRef = useRef(null);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const requestRef = useRef(0);

  const rank = planRank(user?.plan);
  const selectedModel = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const selectedEffort = useMemo(() => EFFORTS.find((item) => item.id === effort) || EFFORTS[1], [effort]);
  const groupedSessions = useMemo(() => groupSessions(sessions), [sessions]);
  const usagePct = Math.max(0, Math.min(100, Number(usage?.percentage || 0)));
  const usageLabel = `${usagePct}% usado`;
  const canSend = input.trim().length > 0 && !sending;
  const isLocked = (item) => !ALLOWED_BY_PLAN[rank]?.has(item.tier);

  const handleAuthError = useCallback((err) => {
    if (err?.status !== 401) return false;
    logout();
    navigate('/login', { replace: true });
    return true;
  }, [logout, navigate]);

  const refreshUsage = useCallback(async () => {
    try { setUsage(await api.get('/chat/usage')); }
    catch (err) { if (!handleAuthError(err) && err?.status !== 404) console.warn('Prism usage refresh failed:', err); }
  }, [handleAuthError]);

  const openSession = useCallback(async (id) => {
    if (!id) return;
    const requestId = ++requestRef.current;
    setActiveSession(id); setLoadingMessages(true); setError(''); setPickerMode('closed'); setMobileOpen(false); setArtifactPanelOpen(false); setActiveArtifactId(null); setArtifacts([]);
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      if (requestId === requestRef.current) setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (err) {
      if (requestId === requestRef.current && !handleAuthError(err)) setError(err.message || 'Não foi possível carregar a conversa.');
    } finally { if (requestId === requestRef.current) setLoadingMessages(false); }
  }, [handleAuthError]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true); setError('');
    try {
      const result = await api.get('/chat/sessions');
      const next = Array.isArray(result.sessions) ? result.sessions : [];
      setSessions(next);
      if (next.length) await openSession(next[0].id); else { setActiveSession(null); setMessages([]); setArtifacts([]); }
    } catch (err) { if (!handleAuthError(err)) setError(err.message || 'Não foi possível carregar suas conversas.'); }
    finally { setLoadingSessions(false); }
  }, [handleAuthError, openSession]);

  useEffect(() => { loadSessions(); refreshUsage(); }, [loadSessions, refreshUsage]);
  useEffect(() => { const timer = setInterval(refreshUsage, 30000); return () => clearInterval(timer); }, [refreshUsage]);
  useEffect(() => { try { localStorage.setItem('prism-model', model); localStorage.setItem('prism-effort', effort); localStorage.setItem('prism-chat-sidebar', sidebarCollapsed ? 'collapsed' : 'open'); localStorage.setItem('prism-chat-theme', dark ? 'dark' : 'light'); } catch {} }, [model, effort, sidebarCollapsed, dark]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto' }); }, [messages, sending]);
  useEffect(() => {
    if (!messages.length) return;
    setArtifacts((current) => {
      const next = [...current]; const known = new Set(next.map((item) => item.id));
      for (const message of messages) {
        if (message.role !== 'assistant') continue;
        for (const block of extractCodeBlocks(message.content, String(message.id))) if (!known.has(block.id)) { next.push(block); known.add(block.id); }
      }
      return next;
    });
  }, [messages]);
  useEffect(() => {
    const close = (event) => { if (pickerRef.current && !pickerRef.current.contains(event.target)) setPickerMode('closed'); if (renameRef.current && !renameRef.current.contains(event.target)) setEditingId(null); };
    const escape = (event) => { if (event.key !== 'Escape') return; setPickerMode('closed'); setPlansOpen(false); setMobileOpen(false); setEditingId(null); if (artifactPanelOpen) setArtifactPanelOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [artifactPanelOpen]);
  useEffect(() => { const el = textareaRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 190)}px`; }, [input]);

  async function newSession() {
    if (sending) return; setError('');
    try { const result = await api.post('/chat/sessions', {}); setSessions((current) => [result.session, ...current.filter((item) => item.id !== result.session.id)]); setActiveSession(result.session.id); setMessages([]); setArtifacts([]); setArtifactPanelOpen(false); setActiveArtifactId(null); setMobileOpen(false); requestAnimationFrame(() => textareaRef.current?.focus()); }
    catch (err) { if (!handleAuthError(err)) setError(err.message || 'Não foi possível criar a conversa.'); }
  }
  async function renameSession(session) {
    const title = editingTitle.trim(); if (!title || title === session.title) { setEditingId(null); return; }
    try { const result = await api.patch(`/chat/sessions/${encodeURIComponent(session.id)}`, { title }); setSessions((current) => current.map((item) => item.id === session.id ? result.session : item)); setEditingId(null); }
    catch (err) { if (!handleAuthError(err)) setError(err.message || 'Não foi possível renomear a conversa.'); }
  }
  async function deleteSession(session, event) {
    event?.stopPropagation(); if (sending) return; if (!window.confirm(`Excluir “${session.title || 'Nova conversa'}”?`)) return;
    try {
      await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`); const next = sessions.filter((item) => item.id !== session.id); setSessions(next);
      if (activeSession === session.id) { if (next[0]) await openSession(next[0].id); else { setActiveSession(null); setMessages([]); setArtifacts([]); setArtifactPanelOpen(false); setActiveArtifactId(null); } }
    } catch (err) { if (!handleAuthError(err)) setError(err.message || 'Não foi possível excluir a conversa.'); }
  }
  function chooseModel(id) { const item = MODELS.find((entry) => entry.id === id); if (!item) return; if (isLocked(item)) { setRequestedModel(item.name); setPlansOpen(true); return; } setModel(id); setPickerMode('closed'); }
  function chooseEffort(id) { if (id === 'ultracode' && rank < 4) { setRequestedModel('Ultra Code'); setPlansOpen(true); return; } setEffort(id); setPickerMode('closed'); }

  async function send() {
    const content = input.trim(); if (!content || sending) return; setError(''); setSending(true); let sid = activeSession; const localId = `local-${Date.now()}`;
    try {
      if (!sid) { const created = await api.post('/chat/sessions', {}); sid = created.session.id; setActiveSession(sid); setSessions((current) => [created.session, ...current]); }
      setMessages((current) => [...current, { id: localId, role: 'user', content, model_id: model, effort }]); setInput('');
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content, model, effort }, { timeout: 180000 });
      if (result?.status === 'unavailable') { setMessages((current) => [...current, { id: `unavailable-${Date.now()}`, role: 'system', content: UNAVAILABLE_MESSAGE, status: 'unavailable', created_at: new Date().toISOString() }]); return; }
      if (!result?.message) throw new Error('O servidor não retornou uma resposta válida.');
      setMessages((current) => [...current, { ...result.message, tools_used: Array.isArray(result.tools_used) ? result.tools_used : [] }]);
      if (result.usage) setUsage(result.usage);
      setSessions((current) => current.map((item) => item.id === sid ? { ...item, title: item.title === 'Nova conversa' ? content.replace(/\s+/g, ' ').slice(0, 64) : item.title, updated_at: new Date().toISOString() } : item).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
    } catch (err) {
      if (err?.payload?.status === 'unavailable' || err?.code === 'PROVIDERS_UNAVAILABLE' || err?.payload?.code === 'PROVIDERS_UNAVAILABLE') setMessages((current) => [...current, { id: `unavailable-${Date.now()}`, role: 'system', content: UNAVAILABLE_MESSAGE, status: 'unavailable', created_at: new Date().toISOString() }]);
      else if (err?.code === 'USAGE_LIMIT_REACHED' || err?.payload?.code === 'USAGE_LIMIT_REACHED' || err?.status === 429) { if (err.payload?.usage) setUsage(err.payload.usage); setError(err.message || 'Você atingiu o limite de uso desta janela.'); setMessages((current) => current.filter((message) => message.id !== localId)); }
      else if (err?.code === 'PLAN_UPGRADE_REQUIRED' || err?.payload?.code === 'PLAN_UPGRADE_REQUIRED' || err?.status === 403) { const requested = err.payload?.model ? MODELS.find((item) => item.id === err.payload.model)?.name || err.payload.model : selectedModel.name; setRequestedModel(err.payload?.requiredPlan ? `Plano ${err.payload.requiredPlan}` : requested); setPlansOpen(true); setMessages((current) => current.filter((message) => message.id !== localId)); }
      else if (!handleAuthError(err)) { setMessages((current) => current.filter((message) => message.id !== localId)); setError(err.message || 'Não foi possível concluir a solicitação.'); }
    } finally { setSending(false); requestAnimationFrame(() => textareaRef.current?.focus()); }
  }

  function suggestion(text) { setInput(text); requestAnimationFrame(() => textareaRef.current?.focus()); }
  function openArtifact(id) { setActiveArtifactId(id); setArtifactPanelOpen(true); setPickerMode('closed'); }
  function updateArtifact(id, patch) { setArtifacts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  const first = firstName(user?.name);

  const sidebar = (
    <aside className={`chat-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-top">
        <div className="sidebar-brand-row"><button className="brand" onClick={() => navigate('/chat')} aria-label="Ir para Home"><span className="brand-mark" /><span className="brand-copy">Prism IA</span></button><button className="sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}>{sidebarCollapsed ? '→' : '←'}</button></div>
        <div className="app-switcher" role="navigation" aria-label="Alternar aplicativo"><button className="app-switch active" onClick={() => navigate('/chat')}>Home</button><button className="app-switch" onClick={() => navigate('/codex')}>Codex</button></div>
        <button className="new-chat" onClick={newSession} disabled={sending}><span>+</span><span className="nav-label">Novo</span></button>
        <nav className="home-section-nav" aria-label="Prism Home"><button onClick={() => navigate('/studio')}><span className="nav-glyph">▱</span><span className="nav-label">Projetos</span></button><button onClick={() => { setArtifactPanelOpen(true); if (artifacts[0]) setActiveArtifactId(artifacts[0].id); }}><span className="nav-glyph">▤</span><span className="nav-label">Artefatos</span></button><button onClick={() => navigate('/codex')}><span className="nav-glyph">&lt;/&gt;</span><span className="nav-label">Código</span><b>Upgrade</b></button><button onClick={() => navigate('/configuracoes')}><span className="nav-glyph">□</span><span className="nav-label">Personalizar</span></button></nav>
      </div>
      <div className="home-project-block"><div className="home-project-head"><span className="nav-label">Projetos</span><button onClick={() => navigate('/studio')} aria-label="Novo projeto">+</button></div><button className="home-project" onClick={() => navigate('/studio')}><span className="project-glyph">▱</span><span className="nav-label">prism ia</span></button></div>
      <div className="session-heading"><span className="nav-label">Conversas</span><span>{sessions.length || ''}</span></div>
      <div className="session-list">
        {loadingSessions && <div className="sidebar-loading"><span /><span /><span /></div>}
        {!loadingSessions && !sessions.length && <div className="sidebar-empty nav-label">Suas conversas aparecem aqui.</div>}
        {!loadingSessions && groupedSessions.map((group) => <div className="session-group" key={group.label}><div className="session-group-label nav-label">{group.label}</div>{group.items.map((session) => <div key={session.id} className={`session-item ${session.id === activeSession ? 'active' : ''}`}>{editingId === session.id ? <div className="session-rename" ref={renameRef}><input value={editingTitle} maxLength={120} autoFocus onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') renameSession(session); if (event.key === 'Escape') setEditingId(null); }} aria-label="Novo nome da conversa" /><button onClick={() => renameSession(session)} aria-label="Salvar nome">OK</button></div> : <><button className="session-open" onClick={() => openSession(session.id)} disabled={sending}><span className="session-title">{session.title || 'Nova conversa'}</span><small>{formatConversationDate(session.updated_at || session.created_at)}</small></button><div className="session-actions"><button onClick={(event) => { event.stopPropagation(); setEditingId(session.id); setEditingTitle(session.title || ''); }} aria-label="Renomear conversa">Editar</button><button onClick={(event) => deleteSession(session, event)} aria-label="Excluir conversa">Excluir</button></div></>}</div>)}</div>)}
      </div>
      <div className="sidebar-bottom"><div className="sidebar-usage" title={`${usageLabel} · janela de ${usage?.windowHours || 24} horas`}><div className="sidebar-usage-head"><span className="nav-label">Uso</span><strong>{usageLabel}</strong></div><div className="usage-track" aria-label={usageLabel}><span style={{ width: `${usagePct}%` }} /></div><small className="usage-reset nav-label">{usage?.resetsAt ? `Renova às ${formatTime(usage.resetsAt)}` : 'Janela diária'}</small></div><button className="profile-button" onClick={() => navigate('/configuracoes')}><span className="avatar">{initial(user?.name)}</span><span className="profile-text nav-label"><strong>{user?.name || 'Usuário'}</strong><small>{user?.plan || 'Grátis'}</small></span></button></div>
    </aside>
  );

  return <div className={`chat-app chat-theme-${dark ? 'dark' : 'light'} ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${artifactPanelOpen ? 'code-panel-open' : ''}`}>
    <button className="mobile-menu-button" onClick={() => setMobileOpen((value) => !value)} aria-label="Abrir navegação">Menu</button>{sidebar}{mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação" />}
    <main className="chat-main">
      <header className="chat-topbar"><div className="chat-context">{activeSession && <small>{sessions.find((item) => item.id === activeSession)?.title || 'Nova conversa'}</small>}</div><div className="model-control" ref={pickerRef}><button className="topbar-model" onClick={() => setPickerMode((current) => current === 'closed' ? 'models' : 'closed')} aria-expanded={pickerMode !== 'closed'}><span>{selectedModel.name}</span><small>{selectedEffort.name}</small><b>⌄</b></button>{pickerMode !== 'closed' && <div className="model-picker">{pickerMode === 'models' ? <><div className="picker-head"><span>MODELO</span><strong>Escolha o modelo</strong></div><div className="picker-list">{MODELS.map((item) => { const locked = isLocked(item); return <button key={item.id} className={`picker-model ${model === item.id ? 'selected' : ''} ${locked ? 'locked' : ''}`} onClick={() => chooseModel(item.id)} aria-disabled={locked}><span><strong>{item.name}{item.badge && <em>{item.badge}</em>}</strong><small>{item.detail}</small></span><b>{locked ? 'Fazer Upgrade' : model === item.id ? 'Atual' : ''}</b></button>; })}</div><button className="picker-submenu" onClick={() => setPickerMode('thinking')}><span><strong>Nível de pensamento</strong><small>{selectedEffort.name} · {selectedEffort.note}</small></span><b>→</b></button></> : <><div className="picker-head back"><button onClick={() => setPickerMode('models')} aria-label="Voltar">←</button><div><span>PENSAMENTO</span><strong>Quanto esforço aplicar</strong></div></div><div className="thinking-list">{EFFORTS.map((item) => <button key={item.id} className={effort === item.id ? 'selected' : ''} onClick={() => chooseEffort(item.id)}><span><strong>{item.name}</strong><small>{item.note}</small></span><b>{effort === item.id ? 'Atual' : item.id === 'ultracode' && rank < 4 ? 'Upgrade' : ''}</b></button>)}</div></>}</div>}</div></header>
      <section className="messages" aria-live="polite">{loadingMessages ? <div className="message-loading"><span /><span /><span /></div> : !messages.length ? <div className="empty-chat"><span className="empty-kicker">PRISM IA</span><h1>Olá, {first}.</h1><p>O que vamos fazer hoje?</p><div className="prompt-suggestions"><button onClick={() => suggestion('Organize essa ideia em um plano claro.')}><strong>Organizar uma ideia</strong><span>Transforme um rascunho em próximos passos.</span></button><button onClick={() => suggestion('Revise este código e aponte os problemas importantes.')}><strong>Revisar código</strong><span>Encontre riscos e melhorias antes de alterar.</span></button><button onClick={() => suggestion('Explique isso de um jeito simples.')}><strong>Explicar algo</strong><span>Deixe um assunto técnico fácil de entender.</span></button></div></div> : <>{messages.map((message) => { const isUnavailable = message.role === 'system' && message.status === 'unavailable'; if (isUnavailable) return <article key={message.id} className="message system-message" role="status"><div className="system-message-inner"><span className="system-message-icon" aria-hidden="true">!</span><span>{message.content}</span></div></article>; return <article key={message.id} className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}><div className="message-head"><span className="message-author">{message.role === 'user' ? first : 'Prism IA'}</span>{message.role === 'assistant' && message.model_id && <span className="message-model">{MODELS.find((item) => item.id === message.model_id)?.short || message.model_id}</span>}</div><div className={`message-content ${message.role === 'assistant' && extractCodeBlocks(message.content, String(message.id)).length ? 'message-with-artifacts' : ''}`}><MessageBody message={message} onOpenCode={openArtifact} /></div></article>; })}{sending && <article className="message assistant"><div className="message-head"><span className="message-author">Prism IA</span><span className="message-model">{selectedModel.short}</span></div><div className="message-thinking"><span /><span /><span /><span className="typing-label">digitando...</span></div></article>}<div ref={bottomRef} /></>}</section>
      <div className="composer-area">{error && <div className="chat-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Fechar</button></div>}<div className="composer"><textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Escreva uma mensagem" disabled={sending} aria-label="Mensagem" /><div className="composer-footer"><button className="composer-model" onClick={() => setPickerMode('models')}>{selectedModel.short}<span>·</span>{selectedEffort.name}</button><button className="send-button" onClick={send} disabled={!canSend} aria-disabled={!canSend}>{sending ? 'Enviando' : 'Enviar'}</button></div></div><p className="composer-note">Revise informações importantes antes de usá-las</p><p className="composer-shortcuts">Enter envia · Shift + Enter quebra a linha</p></div>
    </main>
    <CodeArtifactsPanel open={artifactPanelOpen} artifacts={artifacts} activeId={activeArtifactId} onSelect={setActiveArtifactId} onClose={() => setArtifactPanelOpen(false)} onUpdateArtifact={updateArtifact} />
    <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
  </div>;
}
