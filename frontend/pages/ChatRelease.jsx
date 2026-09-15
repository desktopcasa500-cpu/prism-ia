import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import FileAttachments from '../components/FileAttachments.jsx';
import ThinkingSelector from '../components/ThinkingSelector.jsx';
import PlanPanel from '../components/PlanPanel.jsx';

const MODELS = [
  { id: 'prism-nano-1.0', label: 'Prism Nano 1.0A', rank: 0 },
  { id: 'prism-mini-1.0', label: 'Prism Mini 1.0A', rank: 0 },
  { id: 'prism-edge-1.0', label: 'Prism Edge 1.0A', rank: 2 },
  { id: 'prism-tex-1.5', label: 'Prism Tex 1.5A', rank: 2 },
  { id: 'prism-taff-1.0', label: 'Prism Taff 1.0A', rank: 3 },
  { id: 'prism-taff-2.0', label: 'Prism Taff 2.0', rank: 3 },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const MODEL_STORAGE = 'prism.home.model';

const CHAT_CSS = `
* { box-sizing: border-box; }
html, body, #root { width: 100%; min-width: 0; min-height: 100%; }
body:has(.prism-reference-chat) { margin: 0; background: #fff; overflow: hidden; color: #161616; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input, textarea, select { font: inherit; }

.prism-reference-chat { position: fixed; inset: 0; width: 100%; height: 100dvh; display: grid; grid-template-columns: 248px minmax(0,1fr); background: #fff; color: #161616; overflow: hidden; }
.prism-reference-sidebar { min-width: 0; height: 100dvh; border-right: 1px solid #ededed; background: #fff; display: flex; flex-direction: column; }
.prism-reference-sidebar__top { height: 52px; padding: 0 8px; display: flex; align-items: center; gap: 6px; }
.prism-reference-sidebar__account { min-width: 0; flex: 1; border: 0; background: #fff; display: flex; align-items: center; gap: 8px; padding: 6px; color: #161616; cursor: pointer; border-radius: 7px; }
.prism-reference-sidebar__account:hover { background: #f7f7f7; }
.prism-reference-sidebar__account .avatar { width: 26px; height: 26px; border-radius: 50%; background: #7bbf69; display: grid; place-items: center; color: #143214; font-size: 10px; font-weight: 700; overflow: hidden; }
.prism-reference-sidebar__account .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #222; font-size: 11px; }
.prism-reference-sidebar__account .chevron { color: #777; font-size: 11px; }
.prism-reference-sidebar__toggle { width: 27px; height: 27px; border: 1px solid #e4e4e4; border-radius: 7px; background: #fff; color: #666; cursor: pointer; }
.prism-reference-sidebar__toggle:hover { background: #f6f6f6; }
.prism-reference-new { margin: 0 8px 10px; height: 34px; width: calc(100% - 16px); border: 1px solid #dfdfdf; border-radius: 7px; background: #fff; color: #222; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; cursor: pointer; font-size: 11px; }
.prism-reference-new:hover { background: #f6f6f6; }
.prism-reference-new .arrow { color: #777; font-size: 11px; }
.prism-reference-search { margin: 0 8px 7px; height: 30px; display: flex; align-items: center; gap: 7px; color: #888; padding: 0 9px; font-size: 10px; }
.prism-reference-search .icon { font-size: 15px; line-height: 1; color: #777; }
.prism-reference-nav { padding: 0 8px 8px; display: grid; gap: 1px; }
.prism-reference-nav button { min-height: 31px; border: 0; border-radius: 6px; background: #fff; color: #5f5f5f; text-align: left; padding: 0 9px; cursor: pointer; font-size: 11px; }
.prism-reference-nav button:hover { background: #f6f6f6; color: #222; }
.prism-reference-nav button.active { background: #ededed; color: #222; font-weight: 600; }
.prism-reference-section { padding: 0 8px 8px; }
.prism-reference-section__label { padding: 7px 9px 5px; color: #989898; font-size: 9px; font-weight: 600; }
.prism-reference-drafts { border: 1px dashed #e8e8e8; border-radius: 8px; min-height: 42px; display: grid; place-items: center; color: #9a9a9a; font-size: 9px; }
.prism-reference-projects { display: grid; gap: 1px; }
.prism-reference-project { min-height: 28px; display: flex; align-items: center; gap: 7px; padding: 0 9px; border-radius: 6px; color: #555; font-size: 10px; }
.prism-reference-project:hover { background: #f6f6f6; }
.prism-reference-project .dot { width: 13px; height: 13px; border-radius: 4px; border: 1px solid #ddd; display: grid; place-items: center; font-size: 8px; color: #777; }
.prism-reference-history { min-height: 0; flex: 1; overflow: auto; padding: 2px 8px 10px; }
.prism-reference-history__title { padding: 8px 9px 5px; color: #999; font-size: 9px; font-weight: 600; }
.prism-reference-history__item { width: 100%; min-height: 28px; border: 0; border-radius: 6px; background: #fff; color: #606060; text-align: left; padding: 0 9px; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.prism-reference-history__item:hover { background: #f6f6f6; color: #222; }
.prism-reference-history__item.active { background: #ededed; color: #222; font-weight: 600; }
.prism-reference-sidebar__bottom { border-top: 1px solid #ededed; padding: 9px 8px 10px; }
.prism-reference-team { border: 1px solid #e9e9e9; border-radius: 9px; padding: 9px; margin-bottom: 7px; background: #fff; }
.prism-reference-team__icons { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.prism-reference-team__icon { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; border: 1px solid #e1e1e1; background: #f7f7f7; font-size: 9px; color: #555; }
.prism-reference-team__line { width: 30px; height: 1px; background: #d8d8d8; }
.prism-reference-team strong { display: block; color: #222; font-size: 9px; margin-bottom: 7px; }
.prism-reference-team button { width: 100%; height: 26px; border: 1px solid #e3e3e3; border-radius: 6px; background: #fff; color: #333; font-size: 9px; cursor: pointer; }
.prism-reference-sidebar__profile { width: 100%; border: 0; background: #fff; display: flex; align-items: center; gap: 8px; text-align: left; padding: 5px 2px; border-radius: 7px; cursor: pointer; }
.prism-reference-sidebar__profile:hover { background: #f6f6f6; }
.prism-reference-sidebar__profile .avatar { width: 27px; height: 27px; border-radius: 50%; background: #232323; color: #fff; display: grid; place-items: center; font-size: 9px; font-weight: 700; }
.prism-reference-sidebar__profile strong { display: block; font-size: 10px; color: #222; }
.prism-reference-sidebar__profile span { display: block; font-size: 9px; color: #8a8a8a; margin-top: 1px; }

.prism-reference-main { min-width: 0; min-height: 0; height: 100dvh; display: grid; grid-template-rows: minmax(0,1fr) auto; background: #fff; overflow: hidden; }
.prism-reference-conversation { min-height: 0; overflow: auto; background: #fff; }
.prism-reference-empty { min-height: 100%; display: flex; align-items: flex-start; justify-content: center; }
.prism-reference-empty__inner { width: min(690px, calc(100% - 40px)); padding-top: 28vh; }
.prism-reference-empty h1 { margin: 0 0 36px; text-align: center; color: #111; font-size: 34px; line-height: 1.08; letter-spacing: -.045em; font-weight: 650; }
.prism-reference-messages { width: min(760px, calc(100% - 40px)); margin: 0 auto; padding: 44px 0 30px; }
.prism-reference-message { margin: 0 0 30px; color: #202020; font-size: 14px; line-height: 1.68; }
.prism-reference-message__author { margin-bottom: 7px; font-size: 11px; font-weight: 600; color: #171717; }
.prism-reference-message.user { text-align: right; }
.prism-reference-message.user .message-copy { display: inline-block; max-width: 78%; padding: 9px 12px; border: 1px solid #ededed; border-radius: 14px 14px 4px 14px; background: #f7f7f7; color: #171717; text-align: left; }
.prism-reference-message.assistant .message-copy { color: #202020; }
.prism-reference-message p { margin: 0; }
.prism-reference-working { color: #8a8a8a; font-size: 11px; padding: 4px 0; }
.prism-reference-status { width: min(760px, calc(100% - 40px)); margin: 35px auto; padding: 9px 11px; border: 1px solid #e4e4e4; border-radius: 8px; background: #fff; color: #777; font-size: 10px; }
.prism-reference-status.error { color: #9a3b31; border-color: #ead5d1; background: #fffafa; }

.prism-reference-composer-wrap { background: #fff; padding: 0 20px 19px; }
.prism-reference-composer { width: min(690px,100%); margin: 0 auto; position: relative; border: 1px solid #d8d8d8; border-radius: 14px; background: #fff; padding: 8px 9px 8px; box-shadow: 0 1px 3px rgba(0,0,0,.03); }
.prism-reference-composer:focus-within { border-color: #c7c7c7; box-shadow: 0 2px 8px rgba(0,0,0,.045); }
.prism-reference-composer textarea { width: 100%; min-height: 49px; max-height: 190px; display: block; border: 0; outline: 0; resize: none; background: transparent; color: #181818; padding: 2px 3px 7px; font-size: 13px; line-height: 1.5; }
.prism-reference-composer textarea::placeholder { color: #777; opacity: 1; }
.prism-reference-composer__attachments { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 2px 5px; }
.prism-reference-composer__attachment { max-width: 240px; min-height: 25px; display: flex; align-items: center; padding: 0 8px; border: 1px solid #e4e4e4; border-radius: 6px; background: #fff; color: #666; font-size: 9px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.prism-reference-composer__row { min-height: 30px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.prism-reference-composer__left { display: flex; align-items: center; gap: 4px; min-width: 0; }
.prism-reference-composer__right { display: flex; align-items: center; gap: 8px; }
.prism-reference-project-select { height: 30px; border: 0; border-radius: 7px; background: #fff; color: #555; padding: 0 6px; font-size: 10px; }
.prism-reference-project-select:hover { background: #f5f5f5; }
.prism-reference-model { position: relative; }
.prism-reference-model > button { height: 30px; border: 0; border-radius: 7px; background: #fff; color: #404040; padding: 0 7px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: 10px; }
.prism-reference-model > button:hover { background: #f5f5f5; }
.prism-reference-model .model-dot { width: 15px; height: 15px; border: 1.5px solid #7c7c7c; border-radius: 4px; background: #ddd; box-shadow: inset 0 0 0 3px #fff; }
.prism-reference-model .chevron { color: #777; font-size: 10px; }
.prism-reference-model__menu { position: absolute; left: 0; bottom: 36px; z-index: 50; width: 225px; padding: 5px; border: 1px solid #dfdfdf; border-radius: 9px; background: #fff; box-shadow: 0 12px 30px rgba(0,0,0,.1); }
.prism-reference-model__menu button { width: 100%; min-height: 37px; border: 0; border-radius: 7px; background: #fff; color: #222; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 9px; text-align: left; cursor: pointer; font-size: 10px; }
.prism-reference-model__menu button:hover, .prism-reference-model__menu button.active { background: #f3f3f3; }
.prism-reference-model__menu small { color: #8a8a8a; font-size: 9px; }
.prism-reference-composer .file-attachments { min-width: 30px; display: flex !important; align-items: center; }
.prism-reference-composer .attach-trigger { width: 30px; height: 30px; border: 0; border-radius: 7px; background: #fff; color: #555; font-size: 20px; line-height: 1; padding: 0; }
.prism-reference-composer .attach-trigger:hover { background: #f5f5f5; }
.prism-reference-thinking .prism-thinking-trigger { height: 30px; border: 0; border-radius: 7px; background: #fff; color: #666; padding: 0 5px; font-size: 10px; }
.prism-reference-thinking .prism-thinking-trigger:hover { background: #f5f5f5; }
.prism-reference-thinking .prism-thinking-menu { bottom: 36px; }
.prism-reference-send { width: 31px; height: 31px; border: 0; border-radius: 7px; background: #202020; color: #fff; display: grid; place-items: center; cursor: pointer; font-size: 16px; line-height: 1; }
.prism-reference-send:disabled { background: #ededed; color: #aaa; cursor: not-allowed; }
.prism-reference-send:hover:not(:disabled) { background: #000; }
.prism-reference-send.stop { font-size: 10px; }

@media (max-width: 820px) {
  .prism-reference-chat { grid-template-columns: 1fr; }
  .prism-reference-sidebar { position: fixed; z-index: 100; left: 0; top: 0; bottom: 0; width: 248px; transform: translateX(-102%); transition: transform .18s ease; box-shadow: 12px 0 30px rgba(0,0,0,.08); }
  .prism-reference-sidebar.mobile-open { transform: translateX(0); }
  .prism-reference-empty__inner { padding-top: 21vh; }
  .prism-reference-empty h1 { font-size: 30px; }
  .prism-reference-composer-wrap { padding: 0 10px 10px; }
  .prism-reference-message.user .message-copy { max-width: 88%; }
}
@media (max-width: 520px) {
  .prism-reference-empty__inner { width: calc(100% - 24px); padding-top: 19vh; }
  .prism-reference-empty h1 { font-size: 28px; margin-bottom: 26px; }
  .prism-reference-model__menu { width: min(225px, calc(100vw - 34px)); }
  .prism-reference-composer textarea { min-height: 46px; }
  .prism-reference-project-select { display: none; }
}
`;

function rankOf(plan) { return PLAN_RANK[plan] ?? 0; }
function metadataOf(message) { if (!message?.metadata) return {}; if (typeof message.metadata === 'object') return message.metadata; try { return JSON.parse(message.metadata); } catch { return {}; } }
function requestId() { try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random()}`; } }

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
  const controllerRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const selected = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const hasMessages = messages.length > 0;
  const canSend = Boolean(input.trim() || attachments.length) && !sending && !uploading;

  useEffect(() => { localStorage.setItem(MODEL_STORAGE, model); }, [model]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);
  useEffect(() => { if (!textareaRef.current) return; textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(190, textareaRef.current.scrollHeight)}px`; }, [input]);

  const authFail = useCallback((cause) => {
    if (cause?.status !== 401) return false;
    logout();
    navigate('/login', { replace: true });
    return true;
  }, [logout, navigate]);

  const refreshUsage = useCallback(async () => {
    try { setUsage(await api.get('/chat/usage')); } catch (cause) { if (!authFail(cause)) console.warn(cause); }
  }, [authFail]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setSessionId(id); setLoading(true); setError(''); setAttachments([]); setMobileOpen(false);
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
      setSessions((list) => [result.session, ...list]); setSessionId(result.session.id);
      setMessages([]); setInput(''); setAttachments([]); setError(''); setMobileOpen(false);
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
    let currentSession = sessionId;
    const localId = `local-${rid}`;
    try {
      if (!currentSession) {
        const created = await api.post('/chat/sessions', { surface: 'home', title: content.slice(0, 64) || 'Arquivos anexados' });
        currentSession = created.session.id; setSessionId(currentSession); setSessions((list) => [created.session, ...list]);
      }
      const optimistic = { id: localId, role: 'user', content, model_id: model, effort, metadata: { attachments: selectedAttachments } };
      setMessages((list) => [...list, optimistic]); setInput(''); setAttachments([]);
      const result = await api.post(`/chat/sessions/${encodeURIComponent(currentSession)}/messages`, {
        content, model, effort, clientRequestId: rid, attachmentIds: selectedAttachments.map((item) => item.id).filter(Boolean),
      }, { timeout: 180000, signal: controller.signal });
      if (result.duplicate) {
        const history = await api.get(`/chat/sessions/${encodeURIComponent(currentSession)}/messages?surface=home`);
        setMessages(history.messages || []);
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

  const initial = String(user?.name || 'P').slice(0,1).toUpperCase();
  const recentProjects = sessions.slice(0, 1);

  return (
    <div className={`prism-reference-chat ${mobileOpen ? 'menu-open' : ''}`}>
      <style>{CHAT_CSS}</style>
      <aside className={`prism-reference-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="prism-reference-sidebar__top">
          <button className="prism-reference-sidebar__account" type="button" onClick={() => navigate('/configuracoes')}>
            <span className="avatar">{initial}</span><span className="name">{user?.name || 'Prism'}</span><span className="chevron">⌄</span>
          </button>
          <button className="prism-reference-sidebar__toggle" type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}>◧</button>
        </div>
        <button className="prism-reference-new" type="button" onClick={newSession}><span>Nova Conversa</span><span className="arrow">⌄</span></button>
        <div className="prism-reference-search"><span className="icon">⌕</span><span>Buscar</span></div>
        <nav className="prism-reference-nav">
          <button className="active" type="button" onClick={() => navigate('/chat')}>Início</button>
          <button type="button" onClick={() => navigate('/studio')}>Projetos</button>
          <button type="button" onClick={() => {}}>Conversas</button>
          <button type="button" onClick={() => navigate('/studio')}>Design Systems</button>
          <button type="button" onClick={() => navigate('/modelos')}>Modelos</button>
        </nav>
        <section className="prism-reference-section">
          <div className="prism-reference-section__label">Drafts</div>
          <div className="prism-reference-drafts">No drafts yet</div>
        </section>
        <section className="prism-reference-section">
          <div className="prism-reference-section__label">Projects</div>
          <div className="prism-reference-projects">{recentProjects.length ? recentProjects.map((item) => <button className="prism-reference-project" key={item.id} type="button" onClick={() => loadSession(item.id)}><span className="dot">⌁</span><span>{item.title || 'Novo projeto'}</span></button>) : <div className="prism-reference-project"><span className="dot">⌁</span><span>Sem projetos</span></div>}</div>
        </section>
        <div className="prism-reference-history">
          {sessions.length > 0 && <div className="prism-reference-history__title">Conversas recentes</div>}
          {sessions.map((item) => <button key={item.id} type="button" className={`prism-reference-history__item ${item.id === sessionId ? 'active' : ''}`} onClick={() => loadSession(item.id)}>{item.title || 'Nova conversa'}</button>)}
        </div>
        <div className="prism-reference-sidebar__bottom">
          <div className="prism-reference-team"><div className="prism-reference-team__icons"><span className="prism-reference-team__icon">✦</span><span className="prism-reference-team__line"/><span className="prism-reference-team__icon">P</span></div><strong>Your new team is ready</strong><button type="button" onClick={() => navigate('/configuracoes')}>View details</button></div>
          <button type="button" className="prism-reference-sidebar__profile" onClick={() => navigate('/configuracoes')}><span className="avatar">{initial}</span><span><strong>{user?.name || 'Você'}</strong><span>{user?.plan || 'Grátis'}</span></span></button>
        </div>
      </aside>

      <main className="prism-reference-main">
        <section className="prism-reference-conversation">
          {loading && <div className="prism-reference-status">Carregando conversa...</div>}
          {error && <div className="prism-reference-status error" role="alert">{error}</div>}
          {!hasMessages && !loading && !error && <div className="prism-reference-empty"><div className="prism-reference-empty__inner"><h1>O que você quer criar?</h1></div></div>}
          {hasMessages && <div className="prism-reference-messages">
            {messages.map((message) => {
              const meta = metadataOf(message); const files = Array.isArray(meta.attachments) ? meta.attachments : [];
              return <article className={`prism-reference-message ${message.role}`} key={message.id}>
                <div className="prism-reference-message__author">{message.role === 'user' ? user?.name || 'Você' : 'Prism IA'}</div>
                {files.length > 0 && <div className="prism-reference-composer__attachments">{files.map((file) => <span className="prism-reference-composer__attachment" key={file.id || file.name}>{file.name}</span>)}</div>}
                <div className="message-copy">{message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} /> : <p>{message.content}</p>}</div>
              </article>;
            })}
            {sending && <div className="prism-reference-working">Prism está trabalhando...</div>}
            <div ref={endRef} />
          </div>}
        </section>

        <footer className="prism-reference-composer-wrap">
          <div className="prism-reference-composer">
            <textarea ref={textareaRef} rows={1} value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Peça ao Prism para construir..." aria-label="Mensagem" />
            {attachments.length > 0 && <div className="prism-reference-composer__attachments">{attachments.map((file) => <span className="prism-reference-composer__attachment" key={file.id || file.name}>{file.name}</span>)}</div>}
            <div className="prism-reference-composer__row">
              <div className="prism-reference-composer__left">
                <FileAttachments value={attachments} onChange={setAttachments} disabled={sending} onUploadingChange={setUploading} label="Adicionar arquivo" />
                <div className="prism-reference-model">
                  <button type="button" onClick={() => setModelOpen((value) => !value)} aria-expanded={modelOpen}><span className="model-dot"/><span>{selected.label}</span><span className="chevron">⌄</span></button>
                  {modelOpen && <div className="prism-reference-model__menu" role="menu">{MODELS.map((item) => <button key={item.id} type="button" className={item.id === selected.id ? 'active' : ''} onClick={() => chooseModel(item.id)}><span>{item.label}</span><small>{rank < item.rank ? 'Upgrade' : item.id === selected.id ? 'Selecionado' : ''}</small></button>)}</div>}
                </div>
                <div className="prism-reference-thinking"><ThinkingSelector value={effort} onChange={setEffort} rank={rank} disabled={sending} /></div>
              </div>
              <div className="prism-reference-composer__right">
                <select className="prism-reference-project-select" aria-label="Projeto" defaultValue="project"><option value="project">Project⌄</option></select>
                {sending ? <button className="prism-reference-send stop" type="button" onClick={() => controllerRef.current?.abort()} aria-label="Parar">■</button> : <button className="prism-reference-send" type="button" disabled={!canSend} onClick={send} aria-label="Enviar">{canSend ? '↑' : '◉'}</button>}
              </div>
            </div>
          </div>
        </footer>
      </main>

      <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
    </div>
  );
}
