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
  { id: 'prism-nano-1.0', label: 'Nano 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-mini-1.0', label: 'Mini 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-edge-1.0', label: 'Edge 1.0A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-tex-1.5', label: 'Tex 1.5A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-taff-1.0', label: 'Taff 1.0A', rank: 3, maturity: 'Alfa' },
  { id: 'prism-taff-2.0', label: 'Taff 2.0', rank: 3, maturity: 'Release' },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const MODEL_STORAGE = 'prism.home.model';

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
  const [collapsed, setCollapsed] = useState(false);
  const controllerRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const selected = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const activeTitle = sessions.find((item) => item.id === sessionId)?.title || 'Nova conversa';
  const canSend = Boolean(input.trim() || attachments.length) && !sending && !uploading;

  useEffect(() => { localStorage.setItem(MODEL_STORAGE, model); }, [model]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);
  useEffect(() => { if (!textareaRef.current) return; textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(210, textareaRef.current.scrollHeight)}px`; }, [input]);

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
      setSessions((list) => [result.session, ...list]); setSessionId(result.session.id);
      setMessages([]); setInput(''); setAttachments([]); setError('');
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
      setSending(false); controllerRef.current = null; setUploading(false); refreshUsage();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  return (
    <div className={`prism-release-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <PrismReleaseSidebar mode="home" sessions={sessions} activeId={sessionId} onNew={newSession} onOpen={loadSession} onMode={(next) => navigate(next === 'codex' ? '/codex' : '/chat')} onHome={() => navigate('/chat')} onCodex={() => navigate('/codex')} onProjects={() => navigate('/studio')} onArtifacts={() => {}} onSettings={() => navigate('/configuracoes')} onProfile={() => navigate('/configuracoes')} usage={usage} user={user} collapsed={collapsed} onCollapse={setCollapsed} mobileOpen={mobileOpen} onMobileOpen={setMobileOpen} />
      <main className="prism-chat-main">
        <header className="prism-chat-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><button className="prism-sidebar-mobile-toggle" type="button" onClick={() => setMobileOpen(true)}>☰</button><h1>{activeTitle}</h1></div>
          <div className="prism-model-menu-wrap">
            <button className="prism-model-trigger" type="button" onClick={() => setModelOpen((value) => !value)}>Prism {selected.label} · {selected.maturity}</button>
            {modelOpen && <div className="prism-model-menu" role="menu"><strong>MODELOS</strong>{MODELS.map((item) => <button key={item.id} type="button" className={item.id === model ? 'active' : ''} onClick={() => chooseModel(item.id)}><span><strong>Prism {item.label}</strong><small>{item.maturity}</small></span><b>{rank < item.rank ? 'Upgrade' : item.id === model ? 'Atual' : ''}</b></button>)}</div>}
          </div>
        </header>
        <section className="prism-chat-scroll">
          {loading && <div className="prism-status">Carregando conversa…</div>}
          {error && <div className="prism-status error" role="alert">{error}</div>}
          {!loading && !messages.length && <div className="prism-message prism-message--welcome"><div className="prism-message__author"><strong>Prism IA</strong></div><div className="prism-message__body"><h2>Como posso ajudar?</h2><p>Conversa, escrita, código, arquivos e pesquisa quando necessário.</p></div></div>}
          {messages.map((message) => {
            const meta = metadataOf(message); const files = Array.isArray(meta.attachments) ? meta.attachments : [];
            return <article className={`prism-message ${message.role}`} key={message.id}>
              <div className="prism-message__author"><strong>{message.role === 'user' ? user?.name || 'Você' : 'Prism IA'}</strong>{message.role === 'assistant' && message.model_id ? <span>{MODELS.find((item) => item.id === message.model_id)?.label || message.model_id}</span> : null}</div>
              <div className="prism-message__body">
                {files.length > 0 && <div className="prism-message__attachments">{files.map((file) => <div className="prism-message__attachment" key={file.id || file.name}><span className="prism-message__attachment-icon">{String(file.mime_type || '').startsWith('image/') ? '▧' : '□'}</span><span title={file.name}>{file.name}</span><small>anexo</small></div>)}</div>}
                {message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} /> : <p>{message.content}</p>}
              </div>
            </article>;
          })}
          {sending && <div className="prism-progress"><div className="prism-progress__track"><div className="prism-progress__fill" style={{ width: '62%' }} /></div><div className="prism-progress__label">Prism IA está trabalhando…</div></div>}
          <div ref={endRef} />
        </section>
        <footer className="prism-composer-wrap"><div className="prism-composer">
          <textarea ref={textareaRef} rows={1} value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Escreva uma mensagem" />
          <div className="prism-composer__row"><div className="prism-composer__tools"><FileAttachments value={attachments} onChange={setAttachments} disabled={sending} onUploadingChange={setUploading} label="Adicionar arquivos" /><ThinkingSelector value={effort} onChange={setEffort} rank={rank} disabled={sending} /></div><span className="prism-composer__hint">Enter envia · Shift+Enter quebra linha</span>{sending ? <button className="prism-cancel" type="button" onClick={() => controllerRef.current?.abort()}>Parar</button> : <button className="prism-send" type="button" disabled={!canSend} onClick={send}>Enviar</button>}</div>
        </div></footer>
      </main>
      <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
    </div>
  );
}
