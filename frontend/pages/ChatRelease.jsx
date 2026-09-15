import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import PrismReleaseSidebar from '../components/PrismReleaseSidebar.jsx';
import FileAttachments from '../components/FileAttachments.jsx';
import ThinkingSelector from '../components/ThinkingSelector.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import '../release-hardened.css';

const MODELS = [
  { id: 'prism-nano-1.0', label: 'Prism Nano 1.0A', short: 'Prism Nano 1.0A', rank: 0 },
  { id: 'prism-mini-1.0', label: 'Prism Mini 1.0A', short: 'Prism Mini 1.0A', rank: 0 },
  { id: 'prism-edge-1.0', label: 'Prism Edge 1.0A', short: 'Prism Edge 1.0A', rank: 2 },
  { id: 'prism-tex-1.5', label: 'Prism Tex 1.5A', short: 'Prism Tex 1.5A', rank: 2 },
  { id: 'prism-taff-1.0', label: 'Prism Taff 1.0A', short: 'Prism Taff 1.0A', rank: 3 },
  { id: 'prism-taff-2.0', label: 'Prism Taff 2.0', short: 'Prism Taff 2.0', rank: 3 },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const MODEL_STORAGE = 'prism.home.model';

const REFERENCE_CHAT_CSS = `
.prism-chat-reference,
.prism-chat-reference * { box-sizing:border-box; }
.prism-chat-reference { position:fixed; inset:0; width:100%; height:100dvh; overflow:hidden; background:#fff; color:#171717; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.prism-chat-reference .prism-release-shell { position:fixed; inset:0; display:grid; grid-template-columns:248px minmax(0,1fr); min-width:0; min-height:0; background:#fff; color:#171717; }
.prism-chat-reference .prism-release-shell.sidebar-collapsed { grid-template-columns:72px minmax(0,1fr); }
.prism-chat-reference .prism-release-sidebar { width:auto; height:100dvh; min-height:0; overflow:hidden; background:#fff; border-right:1px solid #ececec; color:#202020; }
.prism-chat-reference .prism-release-sidebar__top { height:58px; padding:0 10px; display:flex; align-items:center; gap:7px; }
.prism-chat-reference .prism-release-brand { color:#171717; background:transparent; border:0; display:flex; align-items:center; gap:9px; font-size:13px; font-weight:650; }
.prism-chat-reference .prism-logo { width:27px; height:27px; }
.prism-chat-reference .prism-sidebar-toggle { width:28px; height:28px; border:1px solid #e5e5e5; border-radius:7px; background:#fff; color:#777; }
.prism-chat-reference .prism-sidebar-mode { display:grid; grid-template-columns:1fr 1fr; gap:3px; padding:0 8px 9px; }
.prism-chat-reference .prism-sidebar-mode button { min-height:31px; border:0; border-radius:7px; background:#fff; color:#777; font-size:11px; }
.prism-chat-reference .prism-sidebar-mode button.active { background:#f1f1f1; color:#222; font-weight:600; }
.prism-chat-reference .prism-sidebar-new { width:calc(100% - 16px); min-height:35px; margin:0 8px 10px; display:flex; align-items:center; gap:8px; border:1px solid #e2e2e2; border-radius:8px; background:#fff; color:#222; font-size:11px; font-weight:500; }
.prism-chat-reference .prism-sidebar-new:hover { background:#fafafa; }
.prism-chat-reference .prism-sidebar-new__plus { color:#222; font-size:17px; line-height:1; }
.prism-chat-reference .prism-sidebar-nav { display:grid; gap:1px; padding:0 7px 10px; }
.prism-chat-reference .prism-sidebar-nav button { min-height:32px; border:0; border-radius:7px; background:#fff; color:#666; padding:0 10px; font-size:11px; }
.prism-chat-reference .prism-sidebar-nav button:hover { background:#f5f5f5; color:#222; }
.prism-chat-reference .prism-sidebar-history { padding:2px 7px 10px; overflow:auto; scrollbar-width:thin; scrollbar-color:#d9d9d9 transparent; }
.prism-chat-reference .prism-sidebar-history section + section { margin-top:11px; }
.prism-chat-reference .prism-sidebar-history h4 { margin:0 9px 5px; color:#a0a0a0; font-size:9px; font-weight:600; text-transform:none; letter-spacing:0; }
.prism-chat-reference .prism-sidebar-history__items { display:grid; gap:1px; }
.prism-chat-reference .prism-sidebar-history button { width:100%; min-height:28px; border:0; border-radius:7px; padding:0 9px; background:#fff; color:#666; font-size:11px; text-align:left; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.prism-chat-reference .prism-sidebar-history button:hover { background:#f7f7f7; color:#222; }
.prism-chat-reference .prism-sidebar-history button.active { background:#ededed; color:#222; font-weight:600; }
.prism-chat-reference .prism-sidebar-bottom { padding:9px 8px 10px; border-top:1px solid #eeeeee; }
.prism-chat-reference .prism-usage-mini { color:#8b8b8b; font-size:9px; }
.prism-chat-reference .prism-usage-mini__bar { height:3px; background:#eeeeee; }
.prism-chat-reference .prism-usage-mini__bar b { background:#222; }
.prism-chat-reference .prism-profile-mini { width:100%; border:0; background:#fff; color:#222; border-radius:7px; padding:6px 2px; }
.prism-chat-reference .prism-profile-mini:hover { background:#f6f6f6; }
.prism-chat-reference .prism-profile-avatar { width:27px; height:27px; background:#222; color:#fff; font-size:10px; }
.prism-chat-reference .prism-profile-mini__meta strong { font-size:10px; font-weight:600; }
.prism-chat-reference .prism-profile-mini__meta span { font-size:9px; color:#929292; }
.prism-chat-reference .prism-chat-reference__main { min-width:0; min-height:0; height:100dvh; display:grid; grid-template-rows:auto minmax(0,1fr) auto; background:#fff; }
.prism-chat-reference .prism-chat-reference__header { height:50px; display:flex; align-items:center; gap:9px; padding:0 24px; border-bottom:1px solid #f0f0f0; background:#fff; color:#555; font-size:11px; }
.prism-chat-reference .prism-chat-reference__mobile { display:none; border:0; background:#fff; color:#555; }
.prism-chat-reference .prism-chat-reference__conversation { min-height:0; overflow:auto; background:#fff; scrollbar-width:thin; scrollbar-color:#dcdcdc transparent; }
.prism-chat-reference .prism-chat-reference__conversation.is-empty { display:flex; align-items:flex-start; justify-content:center; }
.prism-chat-reference .prism-chat-reference__welcome { width:min(690px,calc(100% - 48px)); padding-top:14.5vh; text-align:left; }
.prism-chat-reference .prism-chat-reference__welcome h1 { margin:0; color:#111; font-size:38px; line-height:1.08; letter-spacing:-.045em; font-weight:650; }
.prism-chat-reference .prism-chat-reference__messages { width:min(760px,calc(100% - 48px)); margin:0 auto; padding:46px 0 28px; }
.prism-chat-reference .prism-chat-reference__message { margin:0 0 30px; color:#202020; font-size:14px; line-height:1.7; }
.prism-chat-reference .prism-chat-reference__author { margin-bottom:7px; color:#151515; font-size:11px; font-weight:600; }
.prism-chat-reference .prism-chat-reference__message.user { text-align:right; }
.prism-chat-reference .prism-chat-reference__message.user p { display:inline-block; max-width:78%; margin:0; padding:9px 12px; border:1px solid #ededed; border-radius:14px 14px 4px 14px; background:#f7f7f7; color:#171717; text-align:left; }
.prism-chat-reference .prism-chat-reference__message.assistant { max-width:100%; }
.prism-chat-reference .prism-chat-reference__message p { margin:0; }
.prism-chat-reference .prism-chat-reference__attachments { display:flex; gap:6px; justify-content:flex-end; flex-wrap:wrap; margin-bottom:7px; }
.prism-chat-reference .prism-chat-reference__attachments span { padding:5px 8px; border:1px solid #e5e5e5; border-radius:7px; background:#fff; color:#666; font-size:10px; }
.prism-chat-reference .prism-chat-reference__working { color:#8a8a8a; font-size:11px; padding:5px 0; }
.prism-chat-reference .prism-chat-reference__status { width:min(760px,calc(100% - 48px)); margin:34px auto; padding:9px 11px; border:1px solid #e6e6e6; border-radius:9px; background:#fff; color:#777; font-size:11px; }
.prism-chat-reference .prism-chat-reference__status.is-error { color:#9a3b31; border-color:#ead4d0; background:#fffafa; }
.prism-chat-reference .prism-chat-reference__composer-area { width:100%; padding:0 20px 20px; background:#fff; }
.prism-chat-reference .prism-chat-reference__composer { position:relative; width:min(690px,100%); margin:0 auto; padding:8px 9px 8px; border:1px solid #d8d8d8; border-radius:14px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.03); }
.prism-chat-reference .prism-chat-reference__composer:focus-within { border-color:#c8c8c8; box-shadow:0 2px 8px rgba(0,0,0,.045); }
.prism-chat-reference .prism-chat-reference__composer textarea { display:block; width:100%; min-height:52px; max-height:190px; margin:0; padding:3px 4px 7px; border:0; outline:0; resize:none; background:#fff; color:#181818; font:400 13px/1.5 Inter,ui-sans-serif,system-ui,sans-serif; }
.prism-chat-reference .prism-chat-reference__composer textarea::placeholder { color:#777; opacity:1; }
.prism-chat-reference .prism-chat-reference__composer-row { min-height:31px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.prism-chat-reference .prism-chat-reference__left-controls { display:flex; align-items:center; gap:6px; min-width:0; }
.prism-chat-reference .prism-chat-reference__right-controls { display:flex; align-items:center; gap:9px; }
.prism-chat-reference .prism-chat-reference__project { color:#606060; font-size:10px; white-space:nowrap; }
.prism-chat-reference .file-attachments { display:flex !important; align-items:center; min-width:30px; }
.prism-chat-reference .attach-trigger { width:30px; height:30px; border:0; border-radius:7px; background:#fff; color:#555; font-size:20px; line-height:1; padding:0; }
.prism-chat-reference .attach-trigger:hover { background:#f5f5f5; }
.prism-chat-reference .attachment-chip,.prism-chat-reference .attachment-image-card { border-color:#e6e6e6; background:#fff; }
.prism-chat-reference .prism-chat-reference__model-wrap { position:relative; }
.prism-chat-reference .prism-chat-reference__model { height:30px; display:inline-flex; align-items:center; gap:6px; border:0; border-radius:7px; padding:0 7px; background:#fff; color:#414141; font-size:10px; cursor:pointer; }
.prism-chat-reference .prism-chat-reference__model:hover { background:#f5f5f5; }
.prism-chat-reference .prism-chat-reference__model-dot { width:16px; height:16px; display:block; border:1.5px solid #7b7b7b; border-radius:4px; box-shadow:inset 0 0 0 3px #fff; background:#d9d9d9; }
.prism-chat-reference .prism-chat-reference__chevron { color:#777; font-size:11px; margin-top:-2px; }
.prism-chat-reference .prism-chat-reference__model-menu { position:absolute; left:0; bottom:38px; z-index:100; width:210px; padding:5px; border:1px solid #dfdfdf; border-radius:10px; background:#fff; box-shadow:0 12px 30px rgba(0,0,0,.1); }
.prism-chat-reference .prism-chat-reference__model-menu button { width:100%; min-height:38px; display:flex; align-items:center; justify-content:space-between; border:0; border-radius:7px; padding:0 9px; background:#fff; color:#222; font-size:11px; text-align:left; cursor:pointer; }
.prism-chat-reference .prism-chat-reference__model-menu button:hover,.prism-chat-reference .prism-chat-reference__model-menu button.active { background:#f3f3f3; }
.prism-chat-reference .prism-chat-reference__model-menu button > span:last-child { color:#777; font-size:10px; }
.prism-chat-reference .prism-chat-reference__effort { display:block; }
.prism-chat-reference .prism-chat-reference__effort .prism-thinking-trigger { height:30px; border:0; background:#fff; padding:0 6px; color:#5a5a5a; font-size:10px; }
.prism-chat-reference .prism-chat-reference__effort .prism-thinking-trigger:hover { background:#f5f5f5; }
.prism-chat-reference .prism-chat-reference__effort .prism-thinking-menu { bottom:38px; }
.prism-chat-reference .prism-chat-reference__send { width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:7px; background:#202020; color:#fff; font-size:16px; line-height:1; cursor:pointer; }
.prism-chat-reference .prism-chat-reference__send:hover:not(:disabled) { background:#000; }
.prism-chat-reference .prism-chat-reference__send:disabled { background:#eee; color:#aaa; cursor:not-allowed; }
.prism-chat-reference .prism-chat-reference__send.stop { font-size:10px; }
.prism-chat-reference .prism-sidebar-mobile-toggle { display:none; }
.prism-chat-reference .prism-collapsed-only { display:none; }
.prism-chat-reference .sidebar-collapsed .prism-brand-text,.prism-chat-reference .sidebar-collapsed .prism-sidebar-mode,.prism-chat-reference .sidebar-collapsed .prism-sidebar-new,.prism-chat-reference .sidebar-collapsed .prism-sidebar-nav span,.prism-chat-reference .sidebar-collapsed .prism-sidebar-history,.prism-chat-reference .sidebar-collapsed .prism-profile-mini__meta,.prism-chat-reference .sidebar-collapsed .prism-usage-mini { display:none; }
.prism-chat-reference .sidebar-collapsed .prism-collapsed-only { display:inline; }
.prism-chat-reference .prism-chat-reference__message .markdown-body,.prism-chat-reference .prism-chat-reference__message code { color:#202020; }
.prism-chat-reference .prism-chat-reference__message pre { margin:12px 0; padding:12px; border:1px solid #e4e4e4; border-radius:9px; background:#fafafa; overflow:auto; }
@media (max-width:900px) {
  .prism-chat-reference .prism-release-shell { grid-template-columns:72px minmax(0,1fr); }
  .prism-chat-reference .prism-release-sidebar { position:absolute; left:0; top:0; bottom:0; z-index:120; width:248px; transform:translateX(-100%); transition:transform .18s ease; box-shadow:10px 0 30px rgba(0,0,0,.08); }
  .prism-chat-reference .prism-release-sidebar.mobile-open { transform:translateX(0); }
  .prism-chat-reference .prism-sidebar-mobile-toggle { display:inline-flex; }
  .prism-chat-reference .prism-chat-reference__mobile { display:inline-flex; }
  .prism-chat-reference .prism-chat-reference__welcome { width:min(690px,calc(100% - 32px)); padding-top:10vh; }
  .prism-chat-reference .prism-chat-reference__welcome h1 { font-size:32px; }
  .prism-chat-reference .prism-chat-reference__messages { width:calc(100% - 32px); }
}
@media (max-width:620px) {
  .prism-chat-reference .prism-release-shell { grid-template-columns:1fr; }
  .prism-chat-reference .prism-chat-reference__main { width:100%; }
  .prism-chat-reference .prism-chat-reference__welcome { padding-top:9vh; }
  .prism-chat-reference .prism-chat-reference__welcome h1 { font-size:29px; }
  .prism-chat-reference .prism-chat-reference__composer-area { padding:0 10px 10px; }
  .prism-chat-reference .prism-chat-reference__project,.prism-chat-reference .prism-chat-reference__effort { display:none; }
}
`;

function rankOf(plan) { return PLAN_RANK[plan] ?? 0; }
function metadataOf(message) {
  if (!message?.metadata) return {};
  if (typeof message.metadata === 'object') return message.metadata;
  try { return JSON.parse(message.metadata); } catch { return {}; }
}
function requestId() {
  try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random()}`; }
}

export default function ChatRelease() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const rank = rankOf(user?.plan);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [usage, setUsage] = useState(null);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) || 'prism-mini-1.0');
  const [effort, setEffort] = useState('medium');
  const [modelOpen, setModelOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plansOpen, setPlansOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const controllerRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const selected = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const hasMessages = messages.length > 0;
  const canSend = Boolean(input.trim() || attachments.length) && !sending && !uploading;

  useEffect(() => { localStorage.setItem(MODEL_STORAGE, model); }, [model]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(220, textareaRef.current.scrollHeight)}px`;
  }, [input]);

  const authFail = useCallback((cause) => {
    if (cause?.status !== 401) return false;
    logout(); navigate('/login', { replace: true }); return true;
  }, [logout, navigate]);

  const refreshUsage = useCallback(async () => {
    try { setUsage(await api.get('/chat/usage')); } catch (cause) { if (!authFail(cause)) console.warn(cause); }
  }, [authFail]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setSessionId(id); setLoading(true); setError(''); setAttachments([]);
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages?surface=home`);
      setMessages(result.messages || []);
    } catch (cause) {
      if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar a conversa.');
    } finally { setLoading(false); }
  }, [authFail]);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.get('/chat/sessions?surface=home');
        setSessions(result.sessions || []);
        if (result.sessions?.[0]) await loadSession(result.sessions[0].id);
      } catch (cause) {
        if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar o Chat.');
      } finally { setLoading(false); }
    })();
    refreshUsage();
  }, [authFail, loadSession, refreshUsage]);

  async function newSession() {
    if (sending) return;
    try {
      const result = await api.post('/chat/sessions', { surface: 'home' });
      setSessions((list) => [result.session, ...list]); setSessionId(result.session.id); setMessages([]); setInput(''); setAttachments([]); setError('');
    } catch (cause) { if (!authFail(cause)) setError(cause.message || 'Não foi possível criar a conversa.'); }
  }

  function chooseModel(id) {
    const next = MODELS.find((item) => item.id === id);
    if (!next) return;
    if (rank < next.rank) { setRequestedModel(next.label); setPlansOpen(true); setModelOpen(false); return; }
    setModel(next.id); setModelOpen(false);
  }

  async function send() {
    const content = input.trim();
    if ((!content && !attachments.length) || sending || uploading) return;
    setSending(true); setError('');
    const controller = new AbortController(); controllerRef.current = controller;
    const rid = requestId(); const selectedAttachments = [...attachments];
    let currentSession = sessionId; const localId = `local-${rid}`;
    try {
      if (!currentSession) {
        const created = await api.post('/chat/sessions', { surface: 'home', title: content.slice(0, 64) || 'Arquivos anexados' });
        currentSession = created.session.id; setSessionId(currentSession); setSessions((list) => [created.session, ...list]);
      }
      const optimistic = { id: localId, role: 'user', content, model_id: model, effort, metadata: { attachments: selectedAttachments } };
      setMessages((list) => [...list, optimistic]); setInput(''); setAttachments([]);
      const result = await api.post(`/chat/sessions/${encodeURIComponent(currentSession)}/messages`, { content, model, effort, clientRequestId: rid, attachmentIds: selectedAttachments.map((item) => item.id).filter(Boolean) }, { timeout: 180000, signal: controller.signal });
      if (result.duplicate) {
        const history = await api.get(`/chat/sessions/${encodeURIComponent(currentSession)}/messages?surface=home`); setMessages(history.messages || []);
      } else if (result.message) {
        setMessages((list) => [...list.filter((item) => item.id !== localId), result.userMessage || optimistic, result.message]);
      }
      if (result.usage) setUsage(result.usage);
    } catch (cause) {
      if (cause?.name !== 'AbortError') {
        if (cause?.payload?.code === 'PLAN_UPGRADE_REQUIRED' || cause?.status === 403) { setRequestedModel(cause.payload?.requiredPlan || selected.label); setPlansOpen(true); }
        else if (!authFail(cause)) setError(cause.message || 'Não foi possível concluir a resposta.');
      }
      setMessages((list) => list.filter((item) => item.id !== localId));
    } finally {
      setSending(false); controllerRef.current = null; setUploading(false); refreshUsage(); requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  return (
    <div className="prism-chat-reference">
      <style>{REFERENCE_CHAT_CSS}</style>
      <div className={`prism-release-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <PrismReleaseSidebar
          mode="home" sessions={sessions} activeId={sessionId} onNew={newSession} onOpen={loadSession}
          onMode={(next) => navigate(next === 'codex' ? '/codex' : '/chat')} onHome={() => navigate('/chat')}
          onCodex={() => navigate('/codex')} onProjects={() => navigate('/studio')} onArtifacts={() => {}}
          onSettings={() => navigate('/configuracoes')} onProfile={() => navigate('/configuracoes')}
          usage={usage} user={user} collapsed={collapsed} onCollapse={setCollapsed}
          mobileOpen={mobileOpen} onMobileOpen={setMobileOpen}
        />
        <main className="prism-chat-reference__main">
          {hasMessages && <header className="prism-chat-reference__header"><button type="button" className="prism-chat-reference__mobile" onClick={() => setMobileOpen(true)}>☰</button><span>{sessions.find((item) => item.id === sessionId)?.title || 'Conversa'}</span></header>}
          <section className={`prism-chat-reference__conversation ${hasMessages ? 'is-active' : 'is-empty'}`}>
            {!hasMessages && !loading && !error && <div className="prism-chat-reference__welcome"><h1>O que você quer criar?</h1></div>}
            {loading && <div className="prism-chat-reference__status">Carregando conversa...</div>}
            {error && <div className="prism-chat-reference__status is-error" role="alert">{error}</div>}
            {hasMessages && <div className="prism-chat-reference__messages">
              {messages.map((message) => {
                const meta = metadataOf(message); const files = Array.isArray(meta.attachments) ? meta.attachments : [];
                return <article className={`prism-chat-reference__message ${message.role}`} key={message.id}>
                  <div className="prism-chat-reference__author">{message.role === 'user' ? user?.name || 'Você' : 'Prism IA'}</div>
                  {files.length > 0 && <div className="prism-chat-reference__attachments">{files.map((file) => <span key={file.id || file.name}>{file.name}</span>)}</div>}
                  {message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} /> : <p>{message.content}</p>}
                </article>;
              })}
              {sending && <div className="prism-chat-reference__working">Prism IA está trabalhando...</div>}
              <div ref={endRef} />
            </div>}
          </section>
          <footer className="prism-chat-reference__composer-area">
            <div className="prism-chat-reference__composer">
              <textarea ref={textareaRef} rows={1} value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Peça ao Prism para construir..." />
              {attachments.length > 0 && <div className="prism-chat-reference__attachment-row">{attachments.map((file) => <span key={file.id || file.name}>{file.name}</span>)}</div>}
              <div className="prism-chat-reference__composer-row">
                <div className="prism-chat-reference__left-controls">
                  <FileAttachments value={attachments} onChange={setAttachments} disabled={sending} onUploadingChange={setUploading} label="Adicionar arquivo" />
                  <div className="prism-chat-reference__model-wrap">
                    <button type="button" className="prism-chat-reference__model" onClick={() => setModelOpen((value) => !value)} aria-expanded={modelOpen}><span className="prism-chat-reference__model-dot" /><span>{selected.short}</span><span className="prism-chat-reference__chevron">⌄</span></button>
                    {modelOpen && <div className="prism-chat-reference__model-menu">{MODELS.map((item) => <button type="button" key={item.id} className={item.id === model ? 'active' : ''} onClick={() => chooseModel(item.id)}><span>{item.label}</span><span>{rank < item.rank ? 'Upgrade' : item.id === model ? '✓' : ''}</span></button>)}</div>}
                  </div>
                  <div className="prism-chat-reference__effort"><ThinkingSelector value={effort} onChange={setEffort} rank={rank} disabled={sending} /></div>
                </div>
                <div className="prism-chat-reference__right-controls"><span className="prism-chat-reference__project">Project⌄</span>{sending ? <button type="button" className="prism-chat-reference__send stop" onClick={() => controllerRef.current?.abort()}>■</button> : <button type="button" className="prism-chat-reference__send" disabled={!canSend} onClick={send} aria-label="Enviar">↑</button>}</div>
              </div>
            </div>
          </footer>
        </main>
      </div>
      <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
    </div>
  );
}
