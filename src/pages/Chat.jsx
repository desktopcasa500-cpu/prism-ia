import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

function getInitial(name) {
  return (name || 'P').trim().slice(0, 1).toUpperCase();
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [effort, setEffort] = useState('medium');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [modelOpen, setModelOpen] = useState(false);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const sessionRequestRef = useRef(0);

  const handleAuthError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) {
      logout();
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  }, [logout, navigate]);

  const openSession = useCallback(async (id) => {
    if (!id) return;
    const requestId = ++sessionRequestRef.current;
    setActiveSession(id);
    setLoadingMessages(true);
    setError('');
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      if (requestId !== sessionRequestRef.current) return;
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (requestError) {
      if (requestId === sessionRequestRef.current && !handleAuthError(requestError)) {
        setError(requestError.message || 'Não foi possível carregar a conversa.');
      }
    } finally {
      if (requestId === sessionRequestRef.current) setLoadingMessages(false);
    }
  }, [handleAuthError]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setError('');
    try {
      const result = await api.get('/chat/sessions');
      const nextSessions = Array.isArray(result.sessions) ? result.sessions : [];
      setSessions(nextSessions);
      if (nextSessions.length) await openSession(nextSessions[0].id);
      else {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (requestError) {
      if (!handleAuthError(requestError)) setError(requestError.message || 'Não foi possível carregar suas conversas.');
    } finally {
      setLoadingSessions(false);
    }
  }, [handleAuthError, openSession]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto', block: 'end' });
  }, [messages, sending]);

  async function newSession() {
    if (sending) return;
    setError('');
    try {
      const result = await api.post('/chat/sessions', {});
      if (!result.session?.id) throw new Error('O servidor não retornou uma conversa válida.');
      setSessions((items) => [result.session, ...items.filter((item) => item.id !== result.session.id)]);
      setActiveSession(result.session.id);
      setMessages([]);
      setModelOpen(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (requestError) {
      if (!handleAuthError(requestError)) setError(requestError.message || 'Não foi possível criar a conversa.');
    }
  }

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setError('');
    setSending(true);
    let sessionId = activeSession;
    try {
      if (!sessionId) {
        const created = await api.post('/chat/sessions', {});
        sessionId = created.session?.id;
        if (!sessionId) throw new Error('Não foi possível iniciar uma conversa.');
        setActiveSession(sessionId);
        setSessions((items) => [created.session, ...items.filter((item) => item.id !== sessionId)]);
      }

      const localId = `local-${Date.now()}`;
      setMessages((items) => [...items, { id: localId, role: 'user', content, effort }]);
      setInput('');
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { content, effort });
      if (!result.message) throw new Error('O servidor não retornou uma resposta válida.');
      setMessages((items) => [...items, result.message]);
      setSessions((items) => items.map((item) => item.id === sessionId && item.title === 'Nova conversa' ? { ...item, title: content.replace(/\s+/g, ' ').slice(0, 64) } : item));
    } catch (requestError) {
      if (!handleAuthError(requestError)) setError(requestError.message || 'Não foi possível concluir a solicitação.');
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function chooseEffort(value) {
    setEffort(value);
    setModelOpen(false);
  }

  return (
    <div className="chat-app">
      <aside className="chat-sidebar">
        <div className="sidebar-top">
          <button className="brand brand-button" onClick={() => navigate('/chat')} aria-label="Ir para o início do Prism">
            <span className="brand-mark" aria-hidden="true" /><span>Prism IA</span>
          </button>
          <button className="new-chat" onClick={newSession} disabled={sending}>+ Novo</button>
        </div>

        <div className="session-heading"><span>Conversas</span><span>{sessions.length || ''}</span></div>
        <div className="session-list" aria-live="polite">
          {loadingSessions && <div className="sidebar-placeholder"><i /><i /><i /></div>}
          {!loadingSessions && !sessions.length && <div className="sidebar-empty">Suas conversas aparecerão aqui.</div>}
          {!loadingSessions && sessions.map((session) => (
            <button key={session.id} className={`session-item ${session.id === activeSession ? 'active' : ''}`} onClick={() => openSession(session.id)}>
              <span className="session-title">{session.title || 'Nova conversa'}</span>
              <small>{formatDate(session.created_at)}</small>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="profile-button" onClick={() => navigate('/studio')} aria-label="Abrir workspace e configurações">
            <span className="avatar">{getInitial(user?.name)}</span>
            <span className="profile-text"><strong>{user?.name || 'Usuário'}</strong><small>Plano {user?.plan || 'Grátis'}</small></span>
            <span className="profile-arrow">↗</span>
          </button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-topbar">
          <div className="chat-context">
            <span className="topbar-kicker">Prism</span>
            <span className="topbar-title">{activeSession ? 'Conversa' : 'Novo espaço'}</span>
          </div>
          <div className="model-control">
            <button className="topbar-model" onClick={() => setModelOpen((value) => !value)} aria-expanded={modelOpen} aria-haspopup="menu">
              <span>Prism Mini 1.0</span><small>{effort === 'ultracode' ? 'Ultra' : 'Médio'} <b>⌄</b></small>
            </button>
            {modelOpen && <div className="model-menu" role="menu">
              <button className={effort === 'medium' ? 'selected' : ''} onClick={() => chooseEffort('medium')} role="menuitem"><strong>Prism Mini 1.0</strong><span>Médio · equilíbrio</span></button>
              <button className={effort === 'ultracode' ? 'selected' : ''} onClick={() => chooseEffort('ultracode')} role="menuitem"><strong>Prism Taff 2.0</strong><span>Ultra · máximo esforço</span></button>
            </div>}
          </div>
        </header>

        <section className="messages" aria-live="polite">
          {!messages.length && !loadingMessages ? (
            <div className="empty-chat">
              <div className="empty-mark" aria-hidden="true"><span /><span /><span /><span /></div>
              <p className="empty-kicker">PRISM IA</p>
              <h1>O que vamos construir?</h1>
              <p>Comece com uma ideia, uma dúvida ou um projeto. O contexto permanece com você.</p>
              <div className="prompt-suggestions">
                <button onClick={() => setInput('Transforme esta ideia em um plano de projeto completo.')}>Planejar um projeto</button>
                <button onClick={() => setInput('Revise meu código e encontre os problemas mais importantes.')}>Revisar código</button>
                <button onClick={() => setInput('Crie a arquitetura de um jogo 3D do zero.')}>Arquitetar um jogo</button>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="message-loading" aria-label="Carregando conversa"><span /> <span /> <span /></div>
          ) : (
            messages.map((message) => (
              <article className={`message ${message.role === 'user' ? 'user' : 'assistant'}`} key={message.id}>
                <div className="message-meta">{message.role === 'user' ? 'Você' : 'Prism'}</div>
                <div className="message-content">{message.content}</div>
              </article>
            ))
          )}
          {sending && <div className="message assistant"><div className="message-meta">Prism</div><div className="thinking"><span /> <span /> <span /></div></div>}
          <div ref={bottomRef} />
        </section>

        <div className="composer-area">
          {error && <div className="chat-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Fechar</button></div>}
          <div className="composer">
            <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Como posso ajudar você hoje?" disabled={sending} aria-label="Mensagem" />
            <div className="composer-footer">
              <span>Enter envia · Shift + Enter quebra a linha</span>
              <div className="composer-actions">
                <span className="effort-label">{effort === 'ultracode' ? 'Ultra' : 'Médio'}</span>
                <button className="send-button" onClick={send} disabled={sending || !input.trim()}>{sending ? 'Processando' : 'Enviar'}</button>
              </div>
            </div>
          </div>
          <p className="composer-disclaimer">As respostas podem conter erros. Revise informações importantes antes de usá-las.</p>
        </div>
      </main>
    </div>
  );
}
