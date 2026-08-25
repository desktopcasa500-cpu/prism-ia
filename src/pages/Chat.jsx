import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

function getInitial(name) {
  return (name || 'P').trim().slice(0, 1).toUpperCase();
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
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);

  const handleAuthError = useCallback((error) => {
    if (error.status === 401 || error.status === 403) {
      logout();
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  }, [logout, navigate]);

  const openSession = useCallback(async (id) => {
    if (!id) return;
    setActiveSession(id);
    setLoadingMessages(true);
    setError('');
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (error) {
      if (!handleAuthError(error)) setError(error.message || 'Não foi possível carregar a conversa.');
    } finally {
      setLoadingMessages(false);
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
    } catch (error) {
      if (!handleAuthError(error)) setError(error.message || 'Não foi possível carregar suas conversas.');
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
      textareaRef.current?.focus();
    } catch (error) {
      if (!handleAuthError(error)) setError(error.message || 'Não foi possível criar a conversa.');
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
      if (result.message) setMessages((items) => [...items, result.message]);
      else throw new Error('O servidor não retornou uma resposta válida.');
    } catch (error) {
      if (!handleAuthError(error)) setError(error.message || 'Não foi possível concluir a solicitação.');
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

  return (
    <div className="chat-app">
      <aside className="chat-sidebar">
        <div className="sidebar-top">
          <button className="brand brand-button" onClick={() => navigate('/chat')} aria-label="Ir para o início do Prism">
            <span className="brand-mark">P</span><span>Prism IA</span>
          </button>
          <button className="new-chat" onClick={newSession} disabled={sending}>Nova conversa <span>⌘ N</span></button>
        </div>

        <div className="session-heading">Conversas</div>
        <div className="session-list" aria-live="polite">
          {loadingSessions && <div className="sidebar-placeholder">Carregando conversas</div>}
          {!loadingSessions && !sessions.length && <div className="sidebar-placeholder">Suas conversas aparecerão aqui.</div>}
          {!loadingSessions && sessions.map((session) => (
            <button key={session.id} className={`session-item ${session.id === activeSession ? 'active' : ''}`} onClick={() => openSession(session.id)}>
              <span>{session.title || 'Nova conversa'}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="profile-button" onClick={() => navigate('/studio')}>
            <span className="avatar">{getInitial(user?.name)}</span>
            <span className="profile-text"><strong>{user?.name || 'Usuário'}</strong><small>Prism {user?.plan || 'free'}</small></span>
            <span className="profile-arrow">Abrir</span>
          </button>
          <button className="logout-button" onClick={() => { logout(); navigate('/login', { replace: true }); }}>Sair da conta</button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-topbar">
          <div><span className="topbar-kicker">Prism</span><span className="topbar-title">{activeSession ? 'Conversa' : 'Nova conversa'}</span></div>
          <button className="topbar-model" onClick={() => setEffort((value) => value === 'medium' ? 'ultracode' : 'medium')}>
            <span>Prism Taff 2.0</span><small>{effort === 'ultracode' ? 'Ultra' : 'Equilibrado'}</small>
          </button>
        </header>

        <section className="messages" aria-live="polite">
          {!messages.length && !loadingMessages ? (
            <div className="empty-chat">
              <div className="empty-rule" />
              <span className="eyebrow">Prism IA</span>
              <h1>O que vamos construir?</h1>
              <p>Comece com uma pergunta, uma ideia ou um projeto. O resto acontece na conversa.</p>
              <div className="prompt-suggestions">
                <button onClick={() => setInput('Quero transformar uma ideia em um projeto completo.')}>Transformar uma ideia em projeto</button>
                <button onClick={() => setInput('Revise meu código e encontre os problemas mais importantes.')}>Revisar um código</button>
                <button onClick={() => setInput('Me ajude a planejar um jogo do zero.')}>Planejar um jogo</button>
              </div>
            </div>
          ) : loadingMessages ? (
            <div className="message-loading"><span /> <span /> <span /></div>
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
            <textarea ref={textareaRef} rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Escreva para o Prism" disabled={sending} aria-label="Mensagem" />
            <div className="composer-footer">
              <span>Enter envia · Shift + Enter quebra a linha</span>
              <div className="composer-actions">
                <select value={effort} onChange={(event) => setEffort(event.target.value)} aria-label="Nível de pensamento">
                  <option value="medium">Equilibrado</option>
                  <option value="ultracode">Ultra</option>
                </select>
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
