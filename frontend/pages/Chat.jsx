import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import '../prism-chat-refined.css';

const MODELS = [
  { id: 'prism-nano-1.0', name: 'Prism Nano 1.0', detail: 'Rápido e econômico' },
  { id: 'prism-mini-1.0', name: 'Prism Mini 1.0', detail: 'Conversa, escrita e tarefas gerais' },
  { id: 'prism-tex-1.5', name: 'Prism Tex 1.5', detail: 'Código, documentação e arquitetura' },
  { id: 'prism-taff-1.0', name: 'Prism Taff 1.0', detail: 'Projetos complexos e debugging' },
  { id: 'prism-taff-2.0', name: 'Prism Taff 2.0', detail: 'Maior profundidade e orquestração' },
];
const EFFORTS = [
  { id: 'low', name: 'Low', detail: 'Respostas rápidas para tarefas simples' },
  { id: 'medium', name: 'Médio', detail: 'Equilíbrio entre velocidade e profundidade' },
  { id: 'high', name: 'High', detail: 'Mais análise para problemas difíceis' },
  { id: 'max', name: 'Max', detail: 'Prioriza profundidade e revisão' },
  { id: 'ultracode', name: 'Ultra Code', detail: 'Máximo esforço para engenharia' },
];
const SUGGESTIONS = [
  'Transforme esta ideia em um plano de projeto completo.',
  'Revise meu código e encontre os problemas mais importantes.',
  'Explique este conceito de forma simples e prática.',
];

function initial(name) { return (name || 'P').trim().slice(0, 1).toUpperCase(); }
function dateLabel(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(() => localStorage.getItem('prism-model') || 'prism-mini-1.0');
  const [effort, setEffort] = useState(() => localStorage.getItem('prism-effort') || 'medium');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [search, setSearch] = useState('');
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const menuRef = useRef(null);
  const requestRef = useRef(0);

  const selectedModel = MODELS.find((item) => item.id === model) || MODELS[1];
  const selectedEffort = EFFORTS.find((item) => item.id === effort) || EFFORTS[1];
  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) => (session.title || 'Nova conversa').toLowerCase().includes(q));
  }, [search, sessions]);

  const handleAuthError = useCallback((cause) => {
    if (cause.status === 401 || cause.status === 403) {
      logout();
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  }, [logout, navigate]);

  const openSession = useCallback(async (id) => {
    if (!id) return;
    const rid = ++requestRef.current;
    setActiveSession(id);
    setLoadingMessages(true);
    setError('');
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      if (rid !== requestRef.current) return;
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (cause) {
      if (rid === requestRef.current && !handleAuthError(cause)) setError(cause.message || 'Não foi possível carregar a conversa.');
    } finally {
      if (rid === requestRef.current) setLoadingMessages(false);
    }
  }, [handleAuthError]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError('');
    try {
      const result = await api.get('/chat/sessions');
      const next = Array.isArray(result.sessions) ? result.sessions : [];
      setSessions(next);
      if (next.length) await openSession(next[0].id);
      else { setActiveSession(null); setMessages([]); }
    } catch (cause) {
      if (!handleAuthError(cause)) setError(cause.message || 'Não foi possível carregar suas conversas.');
    } finally { setLoadingSessions(false); }
  }, [handleAuthError, openSession]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { localStorage.setItem('prism-model', model); }, [model]);
  useEffect(() => { localStorage.setItem('prism-effort', effort); }, [effort]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto', block: 'end' }); }, [messages, sending]);
  useEffect(() => {
    const onPointerDown = (event) => { if (menuRef.current && !menuRef.current.contains(event.target)) setMenu(null); };
    const onKeyDown = (event) => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('mousedown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, []);
  useEffect(() => { textareaRef.current?.focus(); }, [activeSession]);

  async function newSession() {
    if (sending) return;
    setError('');
    try {
      const result = await api.post('/chat/sessions', { title: 'Nova conversa' });
      if (!result.session?.id) throw new Error('Não foi possível iniciar uma conversa.');
      setSessions((items) => [result.session, ...items.filter((item) => item.id !== result.session.id)]);
      setActiveSession(result.session.id);
      setMessages([]);
      setInput('');
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (cause) { if (!handleAuthError(cause)) setError(cause.message || 'Não foi possível criar a conversa.'); }
  }

  async function deleteSession(session, event) {
    event?.stopPropagation();
    if (sending) return;
    const title = session.title || 'Nova conversa';
    if (!window.confirm(`Excluir “${title}”? Esta ação remove a conversa permanentemente.`)) return;
    try {
      await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`);
      const next = sessions.filter((item) => item.id !== session.id);
      setSessions(next);
      if (activeSession === session.id) {
        if (next[0]) await openSession(next[0].id);
        else { setActiveSession(null); setMessages([]); }
      }
    } catch (cause) { if (!handleAuthError(cause)) setError(cause.message || 'Não foi possível excluir a conversa.'); }
  }

  async function send(value) {
    const content = (value ?? input).trim();
    if (!content || sending) return;
    setSending(true); setError(''); setInput('');
    let sessionId = activeSession;
    try {
      if (!sessionId) {
        const created = await api.post('/chat/sessions', { title: content.slice(0, 64) });
        sessionId = created.session?.id;
        if (!sessionId) throw new Error('Não foi possível iniciar uma conversa.');
        setActiveSession(sessionId);
        setSessions((items) => [created.session, ...items.filter((item) => item.id !== sessionId)]);
      }
      const localMessage = { id: `local-${Date.now()}`, role: 'user', content, model, effort };
      setMessages((items) => [...items, localMessage]);
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { content, model, effort }, { timeout: 180000 });
      if (!result.message) throw new Error('O servidor não retornou uma resposta válida.');
      const assistant = { ...result.message, tools_used: Array.isArray(result.tools_used) ? result.tools_used : [] };
      setMessages((items) => [...items, assistant]);
      setSessions((items) => items.map((item) => item.id === sessionId && item.title === 'Nova conversa' ? { ...item, title: content.replace(/\s+/g, ' ').slice(0, 64) } : item));
    } catch (cause) {
      if (!handleAuthError(cause)) setError(cause.message || 'Não foi possível concluir a solicitação.');
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); }
  }
  async function copyMessage(content) {
    try { await navigator.clipboard.writeText(content); } catch { setError('Não foi possível copiar a resposta.'); }
  }

  return <div className="prism-chat">
    <aside className="pr-chat-sidebar">
      <div className="pr-chat-sidebar-head">
        <button className="pr-chat-brand" onClick={() => navigate('/chat')} aria-label="Prism IA">
          <span className="pr-chat-brand-mark">P</span><span><strong>Prism IA</strong><small>Conversa</small></span>
        </button>
        <button className="pr-chat-new" onClick={newSession} disabled={sending}><span>Nova conversa</span></button>
        <nav className="pr-chat-nav">
          <button className="active" onClick={() => navigate('/chat')}><span>Conversas</span><small>{sessions.length || ''}</small></button>
          <button onClick={() => navigate('/codex')}><span>Prism Codex</span><small>Workspace</small></button>
          <button onClick={() => setPlansOpen(true)}><span>Plano</span><small>{user?.plan || 'Grátis'}</small></button>
        </nav>
      </div>
      <div className="pr-chat-history">
        <label className="pr-chat-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conversas" aria-label="Buscar conversas" /></label>
        <div className="pr-chat-history-head"><span>Recentes</span><span>{filteredSessions.length || ''}</span></div>
        <div className="pr-chat-session-list" aria-live="polite">
          {loadingSessions && <div className="pr-chat-empty">Carregando conversas</div>}
          {!loadingSessions && !filteredSessions.length && <div className="pr-chat-empty">Nenhuma conversa encontrada.</div>}
          {!loadingSessions && filteredSessions.map((session) => <div className={`pr-chat-session ${session.id === activeSession ? 'active' : ''}`} key={session.id}>
            <button className="pr-chat-session-open" onClick={() => openSession(session.id)} disabled={sending}>
              <span className="pr-chat-session-title">{session.title || 'Nova conversa'}</span>
              <small className="pr-chat-session-date">{dateLabel(session.updated_at || session.created_at)}</small>
            </button>
            <div className="pr-chat-session-actions"><button onClick={(event) => deleteSession(session, event)} aria-label={`Excluir ${session.title || 'conversa'}`}>Excluir</button></div>
          </div>)}
        </div>
      </div>
      <div className="pr-chat-sidebar-foot"><button className="pr-chat-profile" onClick={() => navigate('/studio')}>
        <span className="pr-chat-avatar">{initial(user?.name)}</span><span className="pr-chat-profile-copy"><strong>{user?.name || 'Usuário'}</strong><small>Plano {user?.plan || 'Grátis'}</small></span>
      </button></div>
    </aside>

    <main className="pr-chat-main">
      <header className="pr-chat-header">
        <div className="pr-chat-header-left"><span>Prism</span><strong>{sessions.find((item) => item.id === activeSession)?.title || 'Nova conversa'}</strong></div>
        <div className="pr-chat-header-actions" ref={menuRef}>
          <div className="pr-chat-menu-wrap">
            <button className="pr-chat-control" onClick={() => setMenu(menu === 'model' ? null : 'model')}>{selectedModel.name}</button>
            {menu === 'model' && <div className="pr-chat-menu">
              <div className="pr-chat-menu-head"><strong>Modelo</strong><span>Escolha o modelo desta conversa.</span></div>
              {MODELS.map((item) => <button className={item.id === model ? 'selected' : ''} key={item.id} onClick={() => { setModel(item.id); setMenu(null); }}><span><strong>{item.name}</strong><small>{item.detail}</small></span><b>{item.id === model ? 'Selecionado' : ''}</b></button>)}
            </div>}
          </div>
          <button className="pr-chat-control" onClick={() => setMenu(menu === 'effort' ? null : 'effort')}><span className="pr-effort-dot" />{selectedEffort.name}</button>
          {menu === 'effort' && <div className="pr-chat-menu" style={{ right: 86, top: 38 }}>
            <div className="pr-chat-menu-head"><strong>Nível de pensamento</strong><span>Defina quanto esforço aplicar.</span></div>
            {EFFORTS.map((item) => <button className={item.id === effort ? 'selected' : ''} key={item.id} onClick={() => { setEffort(item.id); setMenu(null); }}><span><strong>{item.name}</strong><small>{item.detail}</small></span><b>{item.id === effort ? 'Selecionado' : ''}</b></button>)}
          </div>}
        </div>
      </header>

      <section className="pr-chat-messages" aria-live="polite">
        <div className="pr-chat-thread">
          {!messages.length && !loadingMessages && <div className="pr-chat-welcome">
            <div className="pr-chat-welcome-mark">P</div><p className="pr-chat-welcome-kicker">Prism IA</p><h1>O que vamos fazer?</h1><p>Converse, escreva, analise, programe ou organize uma ideia. O contexto desta conversa fica com você.</p>
            <div className="pr-chat-prompts">{SUGGESTIONS.map((item) => <button key={item} onClick={() => setInput(item)}>{item}</button>)}</div>
          </div>}
          {loadingMessages && <div className="pr-chat-empty">Carregando conversa</div>}
          {!loadingMessages && messages.map((message) => <article className={`pr-chat-message ${message.role === 'user' ? 'user' : 'assistant'}`} key={message.id}>
            <div className="pr-chat-message-label">{message.role === 'user' ? 'Você' : 'Prism'}</div>
            <div>
              <div className="pr-chat-message-body">{message.content || ''}</div>
              {message.role !== 'user' && Array.isArray(message.tools_used) && message.tools_used.length > 0 && <div className="pr-chat-message-tools"><span>Ferramentas</span>{message.tools_used.map((tool, index) => <b key={`${tool.server || tool.kind || 'tool'}-${tool.tool || index}`}>{tool.tool || tool.server || tool.kind}</b>)}</div>}
              {message.role !== 'user' && <div className="pr-chat-message-footer"><button onClick={() => copyMessage(message.content || '')}>Copiar</button></div>}
            </div>
          </article>)}
          {sending && <article className="pr-chat-message assistant"><div className="pr-chat-message-label">Prism</div><div className="pr-chat-thinking"><i/><i/><i/></div></article>}
          <div ref={bottomRef}/>
        </div>
      </section>

      {error && <div className="pr-chat-error"><span>{error}</span><button onClick={() => setError('')}>Fechar</button></div>}
      <footer className="pr-chat-composer-wrap">
        <div className="pr-chat-composer">
          <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Escreva uma mensagem" disabled={sending} aria-label="Mensagem" />
          <div className="pr-chat-composer-bottom"><span>Enter envia · Shift + Enter quebra a linha</span><div className="pr-chat-composer-actions"><button className="pr-chat-control" onClick={() => setMenu(menu === 'effort' ? null : 'effort')}><span className="pr-effort-dot" />{selectedEffort.name}</button><button className="pr-chat-send" onClick={() => send()} disabled={sending || !input.trim()}>{sending ? 'Respondendo' : 'Enviar'}</button></div></div>
        </div>
        <p className="pr-chat-note">As respostas podem conter erros. Revise informações importantes antes de tomar decisões.</p>
      </footer>
      <PlanPanel open={plansOpen} onClose={() => setPlansOpen(false)} currentPlan={user?.plan || 'Grátis'} />
    </main>
  </div>;
}
