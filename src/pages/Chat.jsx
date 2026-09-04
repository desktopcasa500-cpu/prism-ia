import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const models = [
  { id: 'prism-nano-1.0', name: 'Prism Nano 1.0', detail: 'Rápido e econômico' },
  { id: 'prism-mini-1.0', name: 'Prism Mini 1.0', detail: 'Geral, conversa e programação' },
  { id: 'prism-tex-1.5', name: 'Prism Tex 1.5', detail: 'Código, documentação e arquitetura' },
  { id: 'prism-taff-1.0', name: 'Prism Taff 1.0', detail: 'Projetos complexos e debugging' },
  { id: 'prism-taff-2.0', name: 'Prism Taff 2.0', detail: 'Orquestração máxima' },
];

const efforts = [
  { id: 'low', name: 'Low', label: 'Rápido', detail: 'Menor esforço para tarefas simples.', tone: '1' },
  { id: 'medium', name: 'Médio', label: 'Equilibrado', detail: 'Boa profundidade sem exagerar no custo.', tone: '2' },
  { id: 'high', name: 'High', label: 'Profundo', detail: 'Mais raciocínio para problemas complexos.', tone: '3' },
  { id: 'max', name: 'Max', label: 'Máximo', detail: 'Prioriza qualidade e análise detalhada.', tone: '4' },
  { id: 'ultracode', name: 'Ultra Code', label: 'Orquestrado', detail: 'Máximo esforço para engenharia e código.', tone: '5' },
];

function getInitial(name) { return (name || 'U').trim().slice(0, 1).toUpperCase(); }

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerView, setPickerView] = useState('models');
  const [deletingSession, setDeletingSession] = useState(null);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const pickerRef = useRef(null);
  const sessionRequestRef = useRef(0);
  const selectedModel = models.find((item) => item.id === model) || models[1];
  const selectedEffort = efforts.find((item) => item.id === effort) || efforts[1];

  const handleAuthError = useCallback((requestError) => {
    if (requestError.status === 401 || requestError.status === 403) { logout(); navigate('/login', { replace: true }); return true; }
    return false;
  }, [logout, navigate]);

  const openSession = useCallback(async (id) => {
    if (!id) return;
    const requestId = ++sessionRequestRef.current;
    setActiveSession(id); setLoadingMessages(true); setError('');
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      if (requestId !== sessionRequestRef.current) return;
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (e) {
      if (requestId === sessionRequestRef.current && !handleAuthError(e)) setError(e.message || 'Não foi possível carregar a conversa.');
    } finally { if (requestId === sessionRequestRef.current) setLoadingMessages(false); }
  }, [handleAuthError]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true); setError('');
    try {
      const result = await api.get('/chat/sessions');
      const next = Array.isArray(result.sessions) ? result.sessions : [];
      setSessions(next);
      if (next.length) await openSession(next[0].id); else { setActiveSession(null); setMessages([]); }
    } catch (e) { if (!handleAuthError(e)) setError(e.message || 'Não foi possível carregar suas conversas.'); }
    finally { setLoadingSessions(false); }
  }, [handleAuthError, openSession]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto', block: 'end' }); }, [messages, sending]);
  useEffect(() => { localStorage.setItem('prism-effort', effort); }, [effort]);
  useEffect(() => { localStorage.setItem('prism-model', model); }, [model]);

  useEffect(() => {
    function closePicker(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setPickerOpen(false);
        setPickerView('models');
      }
    }
    function closeOnEscape(event) {
      if (event.key === 'Escape') { setPickerOpen(false); setPickerView('models'); }
    }
    document.addEventListener('mousedown', closePicker);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closePicker); document.removeEventListener('keydown', closeOnEscape); };
  }, []);

  async function newSession() {
    if (sending) return;
    setError('');
    try {
      const result = await api.post('/chat/sessions', {});
      if (!result.session?.id) throw new Error('O servidor não retornou uma conversa válida.');
      setSessions((items) => [result.session, ...items.filter((item) => item.id !== result.session.id)]);
      setActiveSession(result.session.id); setMessages([]);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (e) { if (!handleAuthError(e)) setError(e.message || 'Não foi possível criar a conversa.'); }
  }

  async function deleteSession(session, event) {
    event?.stopPropagation();
    if (sending || deletingSession) return;
    if (!window.confirm(`Excluir "${session.title || 'Nova conversa'}"?`)) return;
    setDeletingSession(session.id); setError('');
    try {
      await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`);
      const remaining = sessions.filter((item) => item.id !== session.id);
      setSessions(remaining);
      if (activeSession === session.id) {
        if (remaining.length) await openSession(remaining[0].id);
        else { setActiveSession(null); setMessages([]); }
      }
    } catch (e) { if (!handleAuthError(e)) setError(e.message || 'Não foi possível excluir a conversa.'); }
    finally { setDeletingSession(null); }
  }

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setError(''); setSending(true);
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
      setMessages((items) => [...items, { id: localId, role: 'user', content, effort, model }]);
      setInput('');
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, { content, effort, model }, { timeout: 180000 });
      if (!result.message) throw new Error('O servidor não retornou uma resposta válida.');
      setMessages((items) => [...items, result.message]);
      setSessions((items) => items.map((item) => item.id === sessionId && item.title === 'Nova conversa' ? { ...item, title: content.replace(/\s+/g, ' ').slice(0, 64) } : item));
    } catch (e) { if (!handleAuthError(e)) setError(e.message || 'Não foi possível concluir a solicitação.'); }
    finally { setSending(false); requestAnimationFrame(() => textareaRef.current?.focus()); }
  }

  function handleKeyDown(event) { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }
  function openPicker(view = 'models') { setPickerView(view); setPickerOpen(true); }
  function chooseModel(value) { setModel(value); setPickerView('models'); setPickerOpen(false); }
  function chooseEffort(value) { setEffort(value); setPickerView('models'); setPickerOpen(false); }

  const suggestions = [
    { icon: '📋', text: 'Planejar um projeto', prompt: 'Transforme esta ideia em um plano de projeto completo.' },
    { icon: '🔍', text: 'Revisar código', prompt: 'Revise meu código e encontre os problemas mais importantes.' },
    { icon: '💡', text: 'Explicar algo', prompt: 'Explique este conceito de forma simples.' },
    { icon: '⚛️', text: 'Criar aplicação', prompt: 'Me ajude a estruturar uma aplicação React do zero.' },
  ];

  return <div className="chat-app">
    <aside className="chat-sidebar">
      <div className="sidebar-top">
        <button className="brand brand-button" onClick={() => navigate('/chat')}>
          <span className="brand-mark" aria-hidden="true" />
          <span>Prism</span>
        </button>
        <button className="new-chat" onClick={newSession} disabled={sending}>
          Novo chat
        </button>
      </div>
      <div className="sessions-section">
        <div className="section-label">Hoje</div>
        <div className="session-list" aria-live="polite">
          {loadingSessions && <div className="sidebar-placeholder"><i /><i /><i /></div>}
          {!loadingSessions && !sessions.length && <div className="sidebar-empty">Suas conversas aparecerão aqui.</div>}
          {!loadingSessions && sessions.map((session) => (
            <div key={session.id} className={`session-item ${session.id === activeSession ? 'active' : ''}`}>
              <button className="session-open" onClick={() => openSession(session.id)} disabled={deletingSession === session.id}>
                <span className="session-icon">💬</span>
                <span className="session-title">{session.title || 'Nova conversa'}</span>
              </button>
              <button className="session-delete" onClick={(event) => deleteSession(session, event)} disabled={deletingSession === session.id} aria-label={`Excluir ${session.title || 'conversa'}`} title="Excluir conversa">
                {deletingSession === session.id ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="sidebar-bottom">
        <button className="codex-nav-button" onClick={() => navigate('/codex')}>
          <span className="codex-icon">▣</span>
          Codex <small>Workspace</small>
        </button>
        <button className="profile-button" onClick={() => navigate('/studio')}>
          <span className="avatar">{getInitial(user?.name)}</span>
          <span className="profile-text">
            <strong>{user?.name || 'Usuário'}</strong>
            <small>Plano {user?.plan || 'Grátis'}</small>
          </span>
          <span className="profile-arrow">↗</span>
        </button>
      </div>
    </aside>

    <main className="chat-main">
      <header className="chat-topbar">
        <div className="topbar-center">
          <button className="model-select" onClick={() => openPicker('models')} aria-expanded={pickerOpen} aria-haspopup="menu">
            <span className="model-name">{selectedModel.name}</span>
            <span className="model-separator">·</span>
            <span className="effort-name">{selectedEffort.label}</span>
            <span className="dropdown-arrow">⌄</span>
          </button>
          {pickerOpen && (
            <div className="model-picker" ref={pickerRef} role="menu">
              {pickerView === 'models' ? (
                <>
                  <div className="picker-section">
                    <strong>Modelo</strong>
                    <span>Escolha o motor para esta conversa.</span>
                  </div>
                  <div className="picker-model-list">
                    {models.map((item) => (
                      <button key={item.id} className={`picker-model ${model === item.id ? 'selected' : ''}`} onClick={() => chooseModel(item.id)} role="menuitem">
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.detail}</small>
                        </span>
                        {model === item.id && <span className="checkmark">✓</span>}
                      </button>
                    ))}
                  </div>
                  <button className="picker-thinking-link" onClick={() => setPickerView('thinking')}>
                    <span>
                      <strong>Nível de pensamento</strong>
                      <small>{selectedEffort.label}</small>
                    </span>
                    <b>→</b>
                  </button>
                </>
              ) : (
                <>
                  <div className="picker-section picker-section-back">
                    <button onClick={() => setPickerView('models')}>←</button>
                    <div>
                      <strong>Nível de pensamento</strong>
                      <span>Quanto esforço aplicar nesta conversa.</span>
                    </div>
                  </div>
                  <div className="picker-thinking-list">
                    {efforts.map((item) => (
                      <button key={item.id} className={`picker-thinking ${effort === item.id ? 'selected' : ''}`} onClick={() => chooseEffort(item.id)}>
                        <span>
                          <strong>{item.name}<em>{item.label}</em></strong>
                          <small>{item.detail}</small>
                        </span>
                        {effort === item.id && <span className="checkmark">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="messages" aria-live="polite">
        {!messages.length && !loadingMessages ? (
          <div className="empty-state">
            <h1>Como posso ajudar?</h1>
            <div className="suggestion-grid">
              {suggestions.map((suggestion, index) => (
                <button key={index} className="suggestion-card" onClick={() => setInput(suggestion.prompt)}>
                  <span className="suggestion-icon">{suggestion.icon}</span>
                  <span className="suggestion-text">{suggestion.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : loadingMessages ? (
          <div className="message-loading" aria-label="Carregando conversa">
            <span /><span /><span />
          </div>
        ) : (
          messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-avatar">
                {message.role === 'user' ? getInitial(user?.name) : 'P'}
              </div>
              <div className="message-content">{message.content}</div>
            </article>
          ))
        )}
        {sending && (
          <article className="message assistant">
            <div className="message-avatar">P</div>
            <div className="thinking"><span /><span /><span /></div>
          </article>
        )}
        <div ref={bottomRef} />
      </section>

      <div className="composer-area">
        {error && (
          <div className="chat-error" role="alert">
            <span>{error}</span>
            <button onClick={() => setError('')}>Fechar</button>
          </div>
        )}
        <div className="composer">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Envie uma mensagem para Prism..."
            disabled={sending}
            aria-label="Mensagem"
          />
          <div className="composer-actions">
            <button className="send-button" onClick={send} disabled={sending || !input.trim()} aria-label="Enviar mensagem">
              <span className="send-icon">↑</span>
            </button>
          </div>
        </div>
        <p className="composer-disclaimer">Prism pode cometer erros. Verifique informações importantes.</p>
      </div>
    </main>
  </div>;
}
