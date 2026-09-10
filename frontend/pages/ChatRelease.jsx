import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import PrismReleaseSidebar from '../components/PrismReleaseSidebar.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import { extractCodeBlocks } from '../lib/codeBlocks.js';
import './release-hardened.css';

const MODELS = [
  { id: 'prism-nano-1.0', label: 'Nano 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-mini-1.0', label: 'Mini 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-edge-1.0', label: 'Edge 1.0A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-tex-1.5', label: 'Tex 1.5A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-taff-1.0', label: 'Taff 1.0A', rank: 3, maturity: 'Alfa' },
  { id: 'prism-tex-1.5B', label: 'Tex 1.5B', rank: 2, maturity: 'Em breve', disabled: true },
  { id: 'prism-taff-2.0', label: 'Taff 2.0', rank: 3, maturity: 'Release' },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };

function rankOf(plan) { return PLAN_RANK[plan] ?? 0; }
function requestId() { try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random()}`; } }
function metaOf(message) { let meta = message?.metadata; if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } } return meta || {}; }

function Artifacts({ items, selectedId, onSelect }) {
  if (!items.length) return <div className="prism-status">Nenhum artefato gerado nesta conversa.</div>;
  return <div className="prism-artifacts"><div className="prism-artifacts__head"><strong>Artefatos</strong><span>{items.length}</span></div><div className="prism-artifacts__list">{items.map((item) => <div className="prism-artifact-row" key={item.id}><button style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left' }} onClick={() => onSelect(item.id)}><span className="prism-artifact-row__name">{item.filename}</span><span className="prism-artifact-row__meta">{item.language || 'arquivo'} · {item.code.split('\n').length} linhas</span></button><button onClick={() => { const blob = new Blob([item.code], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = item.filename.split('/').pop() || 'artifact.txt'; a.click(); URL.revokeObjectURL(url); }}>Baixar</button></div>)}</div></div>;
}

export default function ChatRelease() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [usage, setUsage] = useState(null);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('prism-mini-1.0');
  const [effort, setEffort] = useState('medium');
  const [openModel, setOpenModel] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plansOpen, setPlansOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('');
  const [artifacts, setArtifacts] = useState([]);
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [controller, setController] = useState(null);
  const lockRef = useRef(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const rank = rankOf(user?.plan);

  const selected = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const canSend = Boolean(input.trim()) && !sending;

  const authFail = useCallback((e) => {
    if (e?.status !== 401) return false;
    logout();
    navigate('/login', { replace: true });
    return true;
  }, [logout, navigate]);

  const refreshUsage = useCallback(async () => {
    try { setUsage(await api.get('/chat/usage')); } catch (e) { if (!authFail(e)) console.warn(e); }
  }, [authFail]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setActiveSession(id); setError(''); setLoading(true);
    try { const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages?surface=home`); setMessages(result.messages || []); }
    catch (e) { if (!authFail(e)) setError(e.message || 'Não foi possível carregar a conversa.'); }
    finally { setLoading(false); }
  }, [authFail]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await api.get('/chat/sessions?surface=home');
        setSessions(result.sessions || []);
        if (result.sessions?.[0]) await loadSession(result.sessions[0].id);
      } catch (e) { if (!authFail(e)) setError(e.message || 'Não foi possível carregar o chat.'); }
      finally { setLoading(false); }
    })();
    refreshUsage();
  }, [authFail, loadSession, refreshUsage]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(200, textareaRef.current.scrollHeight)}px`; } }, [input]);
  useEffect(() => {
    const found = [];
    for (const message of messages) if (message.role === 'assistant') found.push(...extractCodeBlocks(message.content, String(message.id)));
    setArtifacts((current) => { const map = new Map(current.map((item) => [item.id, item])); for (const item of found) map.set(item.id, item); return [...map.values()]; });
  }, [messages]);

  async function newSession() {
    if (sending) return;
    try { const result = await api.post('/chat/sessions', { surface: 'home' }); setSessions((list) => [result.session, ...list]); setActiveSession(result.session.id); setMessages([]); setInput(''); setArtifacts([]); }
    catch (e) { if (!authFail(e)) setError(e.message || 'Não foi possível criar uma conversa.'); }
  }

  async function send() {
    const content = input.trim();
    if (!content || sending || lockRef.current) return;
    lockRef.current = true; setSending(true); setError('');
    const abort = new AbortController(); setController(abort);
    let sessionId = activeSession;
    const rid = requestId();
    const localId = `local-${rid}`;
    try {
      if (!sessionId) { const created = await api.post('/chat/sessions', { surface: 'home', title: content.slice(0, 64) }); sessionId = created.session.id; setActiveSession(sessionId); setSessions((list) => [created.session, ...list]); }
      const optimistic = { id: localId, role: 'user', content, model_id: model, effort, metadata: { local: true }, created_at: new Date().toISOString() };
      setMessages((list) => [...list, optimistic]); setInput('');
      const response = await api.post(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { content, model, effort, clientRequestId: rid, attachmentIds: [] }, { timeout: 180000, signal: abort.signal });
      if (response.duplicate) {
        const history = await api.get(`/chat/sessions/${encodeURIComponent(sessionId)}/messages?surface=home`);
        setMessages(history.messages || []);
      } else if (response.message) {
        setMessages((list) => [...list.filter((item) => item.id !== localId), response.userMessage || optimistic, response.message]);
      }
      if (response.usage) setUsage(response.usage);
    } catch (e) {
      if (e?.name !== 'AbortError') {
        if (e?.status === 403 || e?.status === 429) { setRequestedModel(e.payload?.requiredPlan ? `Plano ${e.payload.requiredPlan}` : selected.label); setPlansOpen(true); }
        else if (!authFail(e)) setError(e.message || 'Não foi possível concluir a resposta.');
      }
      setMessages((list) => list.filter((item) => item.id !== localId));
    } finally { setSending(false); setController(null); lockRef.current = false; refreshUsage(); requestAnimationFrame(() => textareaRef.current?.focus()); }
  }

  function chooseModel(id) {
    const item = MODELS.find((entry) => entry.id === id);
    if (!item || item.disabled) return;
    if (rank < item.rank) { setRequestedModel(item.label); setPlansOpen(true); setOpenModel(false); return; }
    setModel(id); setOpenModel(false);
  }

  return <div className={`prism-release-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <PrismReleaseSidebar mode="home" sessions={sessions} activeId={activeSession} onNew={newSession} onOpen={loadSession} onMode={(next) => next === 'codex' ? navigate('/codex') : navigate('/chat')} onHome={() => navigate('/chat')} onCodex={() => navigate('/codex')} onProjects={() => navigate('/studio')} onArtifacts={() => setArtifactOpen(true)} onSettings={() => navigate('/configuracoes')} onProfile={() => navigate('/configuracoes')} usage={usage} user={user} collapsed={collapsed} onCollapse={setCollapsed} mobileOpen={mobileOpen} onMobileOpen={setMobileOpen} />
    <main className="prism-chat-main">
      <header className="prism-chat-topbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><button className="prism-sidebar-mobile-toggle" style={{ display: 'inline-grid' }} onClick={() => setMobileOpen(true)}>☰</button><h1>{sessions.find((item) => item.id === activeSession)?.title || 'Nova conversa'}</h1></div><div className="prism-model-menu-wrap"><button className="prism-model-trigger" onClick={() => setOpenModel((value) => !value)}>{selected.label} · {selected.maturity}⌄</button>{openModel && <div className="prism-model-menu" role="menu"><strong style={{ display: 'block', padding: 9, color: '#867d74', fontSize: 11 }}>MODELOS</strong>{MODELS.map((item) => <button key={item.id} className={item.id === model ? 'active' : ''} onClick={() => chooseModel(item.id)} disabled={item.disabled}><span><strong>Prism {item.label}</strong><small>{item.maturity}{item.disabled ? ' · não disponível' : ''}</small></span><b>{item.disabled ? 'Em breve' : rank < item.rank ? 'Upgrade' : item.id === model ? 'Atual' : ''}</b></button>)}</div>}</div></header>
      <section className="prism-chat-scroll">
        {loading && <div className="prism-status">Carregando conversa…</div>}
        {error && <div className="prism-status error" role="alert">{error}</div>}
        {!loading && !messages.length && <div className="prism-message"><div className="prism-message__author"><strong>Prism IA</strong></div><div className="prism-message__body"><h2>Olá, {String(user?.name || 'você').split(/\s+/)[0]}.</h2><p>O que vamos fazer hoje?</p></div></div>}
        {messages.map((message) => <article className={`prism-message ${message.role}`} key={message.id}><div className="prism-message__author"><strong>{message.role === 'user' ? user?.name || 'Você' : 'Prism IA'}</strong>{message.role === 'assistant' && message.model_id ? <span>{MODELS.find((item) => item.id === message.model_id)?.label || message.model_id}</span> : null}</div><div className="prism-message__body">{message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} onOpenCode={(id) => { setActiveArtifact(id); setArtifactOpen(true); }} /> : <p>{message.content}</p>}</div>{message.role === 'assistant' && metaOf(message).usage_after_percent !== undefined ? <div className="prism-message__actions"><span>Uso após resposta: {metaOf(message).usage_after_percent}%</span></div> : null}</article>)}
        {sending && <><div className="prism-progress"><div className="prism-progress__track"><div className="prism-progress__fill" style={{ width: '78%' }} /></div><div className="prism-progress__label">Prism IA está preparando a resposta…</div></div><div className="prism-message assistant"><div className="prism-message__author"><strong>Prism IA</strong></div><div className="prism-message__body"><p>Processando…</p></div></div></>}
        <div ref={endRef} />
      </section>
      {artifactOpen && <aside style={{ position: 'fixed', top: 56, right: 0, bottom: 0, width: 'min(430px, 92vw)', background: '#100e0c', borderLeft: '1px solid var(--prism-border)', zIndex: 60, display: 'grid', gridTemplateRows: 'auto auto minmax(0,1fr)' }}><div style={{ padding: 12, borderBottom: '1px solid var(--prism-border)', display: 'flex', justifyContent: 'space-between' }}><strong>Artefatos</strong><button onClick={() => setArtifactOpen(false)}>Fechar</button></div><Artifacts items={artifacts} selectedId={activeArtifact} onSelect={setActiveArtifact} />{activeArtifact && (() => { const item = artifacts.find((entry) => entry.id === activeArtifact); if (!item) return null; return <div className="prism-editor"><div style={{ padding: 10, color: '#9f968d', fontSize: 12 }}>{item.filename}</div><pre>{item.code}</pre></div>; })()}</aside>}
      <footer className="prism-composer-wrap"><div className="prism-composer"><textarea ref={textareaRef} rows={1} value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Escreva uma mensagem" /><div className="prism-composer__row"><span className="prism-composer__hint">Enter envia · Shift+Enter quebra linha</span>{sending ? <button className="prism-cancel" onClick={() => controller?.abort()}>Cancelar</button> : <button className="prism-send" onClick={send} disabled={!canSend}>Enviar</button>}</div></div></footer>
    </main>
    <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
  </div>;
}
