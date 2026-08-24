import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Chat() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]), [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]), [input, setInput] = useState(''), [effort, setEffort] = useState('medium'), [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  async function loadSessions() { const res = await api.get('/chat/sessions'); setSessions(res.sessions); if (res.sessions.length) openSession(res.sessions[0].id); }
  async function openSession(id) { setActiveSession(id); const res = await api.get(`/chat/sessions/${id}/messages`); setMessages(res.messages); }
  async function newSession() { const res = await api.post('/chat/sessions', {}); setSessions(s => [res.session, ...s]); setActiveSession(res.session.id); setMessages([]); }
  async function send() {
    if (!input.trim() || sending) return;
    let sessionId = activeSession;
    if (!sessionId) { const res = await api.post('/chat/sessions', {}); sessionId = res.session.id; setSessions(s => [res.session, ...s]); setActiveSession(sessionId); }
    const content = input; setMessages(m => [...m, { id: `tmp-${Date.now()}`, role: 'user', content, effort }]); setInput(''); setSending(true);
    try { const res = await api.post(`/chat/sessions/${sessionId}/messages`, { content, effort }); setMessages(m => [...m, res.message]); }
    catch (err) { setMessages(m => [...m, { id: `err-${Date.now()}`, role: 'assistant', content: `Erro: ${err.message}` }]); }
    finally { setSending(false); }
  }
  return <div style={{ display: 'flex', height: '100vh' }}>
    <aside className="glass" style={{ width: 260, borderRadius: 0, padding: 16, display: 'flex', flexDirection: 'column' }}>
      <strong style={{ fontSize: 20 }}>Prism IA</strong>
      <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={newSession}>+ Nova conversa</button>
      <div style={{ marginTop: 16, flex: 1, overflowY: 'auto' }}>{sessions.map(s => <div key={s.id} onClick={() => openSession(s.id)} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 4, background: s.id === activeSession ? 'rgba(139,92,246,.15)' : 'transparent' }}>{s.title}</div>)}</div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}><p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{user?.name} · {user?.plan}</p><button className="btn btn-ghost" onClick={logout} style={{ width: '100%' }}>Sair</button></div>
    </aside>
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {messages.map(m => <div key={m.id} style={{ maxWidth: 760, margin: m.role === 'user' ? '0 0 16px auto' : '0 auto 16px 0', background: m.role === 'user' ? 'rgba(139,92,246,.15)' : 'rgba(255,255,255,.04)', padding: '12px 16px', borderRadius: 12, whiteSpace: 'pre-wrap' }}>{m.content}</div>)}
        <div ref={bottomRef} />
      </div>
      <div className="container" style={{ padding: 16, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <select value={effort} onChange={e => setEffort(e.target.value)} style={{ background: '#131420', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: 10 }}><option value="medium">Medium</option><option value="ultracode">Ultracode</option></select>
        <textarea rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Descreva o que você quer construir..." />
        <button className="btn btn-primary" onClick={send} disabled={sending}>{sending ? 'Orquestrando...' : 'Enviar'}</button>
      </div>
    </main>
  </div>;
}
