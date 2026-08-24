import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [effort, setEffort] = useState('medium');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadSessions().catch(handleError);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadSessions() {
    const result = await api.get('/chat/sessions');
    setSessions(result.sessions || []);
    if (result.sessions?.length) await openSession(result.sessions[0].id);
  }

  async function openSession(id) {
    setActiveSession(id);
    const result = await api.get(`/chat/sessions/${id}/messages`);
    setMessages(result.messages || []);
  }

  async function newSession() {
    const result = await api.post('/chat/sessions', {});
    setSessions((items) => [result.session, ...items]);
    setActiveSession(result.session.id);
    setMessages([]);
  }

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    let sessionId = activeSession;

    if (!sessionId) {
      const result = await api.post('/chat/sessions', {});
      sessionId = result.session.id;
      setSessions((items) => [result.session, ...items]);
      setActiveSession(sessionId);
    }

    setMessages((items) => [...items, { id: `local-${Date.now()}`, role: 'user', content, effort }]);
    setInput('');
    setSending(true);

    try {
      const result = await api.post(`/chat/sessions/${sessionId}/messages`, { content, effort });
      setMessages((items) => [...items, result.message]);
    } catch (error) {
      setMessages((items) => [...items, { id: `error-${Date.now()}`, role: 'assistant', content: `Não consegui concluir agora. ${error.message}` }]);
    } finally {
      setSending(false);
    }
  }

  function handleError(error) {
    if (error.status === 401 || error.status === 403) {
      logout();
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="chat-app">
      <aside className="chat-sidebar">
        <div className="chat-brand"><div className="brand"><span className="brand-mark">P</span><span>Prism IA</span></div></div>
        <button className="button button-subtle new-chat" onClick={newSession}>+ Nova conversa</button>
        <div className="session-list">
          {sessions.length === 0 && <div style={{padding:'15px 12px',color:'var(--muted-2)',fontSize:12}}>Suas conversas aparecerão aqui.</div>}
          {sessions.map((session) => <button key={session.id} className={`session-item ${session.id === activeSession ? 'active' : ''}`} onClick={() => openSession(session.id)}>{session.title}</button>)}
        </div>
        <div className="profile">
          <div className="avatar">{(user?.name || 'P').slice(0,1).toUpperCase()}</div>
          <div className="profile-text"><p className="profile-name">{user?.name || 'Usuário'}</p><p className="profile-plan">Prism {user?.plan || 'free'}</p></div>
          <button className="button" style={{minWidth:34,padding:0}} onClick={()=>{logout(); navigate('/login');}} aria-label="Sair">↪</button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-top"><div className="chat-top-title">{activeSession ? 'Conversa' : 'Prism'}</div><div className="mode">Pensamento · {effort === 'ultracode' ? 'Ultra' : 'Equilibrado'}</div></header>
        <section className="messages">
          {!messages.length ? <div className="empty-chat"><div><h2>O que vamos criar?</h2><p>Uma pergunta, um projeto, um jogo, uma ideia. Comece escrevendo.</p></div></div> : messages.map((message) => <article className={`message ${message.role === 'user' ? 'user' : ''}`} key={message.id}><div className="message-bubble">{message.content}</div></article>)}
          <div ref={bottomRef} />
        </section>
        <div className="composer-wrap">
          <div className="composer">
            <textarea rows={2} value={input} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send();}}} placeholder="Escreva uma ideia ou peça para o Prism construir algo…" disabled={sending} />
            <div className="composer-row"><div className="composer-hint">Enter para enviar · Shift + Enter para quebrar linha</div><div style={{display:'flex',gap:8}}><select className="select" value={effort} onChange={(event)=>setEffort(event.target.value)}><option value="medium">Equilibrado</option><option value="ultracode">Ultra · código</option></select><button className="button button-warm" onClick={send} disabled={sending || !input.trim()}>{sending ? 'Pensando…' : 'Enviar'}</button></div></div>
          </div>
        </div>
      </main>
    </div>
  );
}
