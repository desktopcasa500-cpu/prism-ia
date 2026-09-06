import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import PlanPanel from '../components/PlanPanel.jsx';

const MODELS = [
  { id: 'prism-nano-1.0', name: 'Prism Nano 1.0', short: 'Nano 1.0', detail: 'Rápido para tarefas do dia a dia', tier: 'nano' },
  { id: 'prism-mini-1.0', name: 'Prism Mini 1.0', short: 'Mini 1.0', detail: 'Conversa, escrita e programação', tier: 'mini' },
  { id: 'prism-edge-1.0', name: 'Prism Edge 1.0', short: 'Edge 1.0', detail: 'Análise mais profunda', tier: 'edge' },
  { id: 'prism-tex-1.5', name: 'Prism Tex 1.5', short: 'Tex 1.5', detail: 'Código, documentação e arquitetura', tier: 'tex' },
  { id: 'prism-taff-1.0', name: 'Prism Taff 1.0', short: 'Taff 1.0', detail: 'Projetos complexos e debugging', tier: 'taff' },
  { id: 'prism-taff-2.0', name: 'Prism Taff 2.0', short: 'Taff 2.0', detail: 'O modelo mais forte da linha Prism', tier: 'taff2', badge: 'Novo' },
];

const EFFORTS = [
  { id: 'low', name: 'Baixo', note: 'mais rápido' },
  { id: 'medium', name: 'Médio', note: 'equilibrado' },
  { id: 'high', name: 'Alto', note: 'mais profundidade' },
  { id: 'max', name: 'Máximo', note: 'qualidade acima de velocidade' },
  { id: 'ultracode', name: 'Ultra Code', note: 'engenharia e código' },
];

const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const ALLOWED_BY_PLAN = {
  0: new Set(['nano', 'mini']),
  1: new Set(['nano', 'mini']),
  2: new Set(['nano', 'mini', 'edge', 'tex']),
  3: new Set(['nano', 'mini', 'edge', 'tex', 'taff', 'taff2']),
  4: new Set(['nano', 'mini', 'edge', 'tex', 'taff', 'taff2']),
};

function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || 'você';
}

function initial(name = '') {
  return firstName(name).slice(0, 1).toUpperCase() || 'P';
}

function planRank(plan) {
  return PLAN_RANK[plan] ?? 0;
}

function readStorage(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function startOfDay(date) {
  const value = new Date(date);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysBetween(later, earlier) {
  const ms = startOfDay(later).getTime() - startOfDay(earlier).getTime();
  return Math.floor(ms / 86_400_000);
}

function groupLabel(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Outras';
  const diff = daysBetween(new Date(), date);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff >= 0 && diff < 7) return 'Últimos 7 dias';
  if (diff >= 7 && diff < 30) return 'Este mês';
  return 'Mais antigas';
}

function formatConversationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = daysBetween(new Date(), date);
  if (diff === 0) return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function groupSessions(sessions) {
  const groups = [];
  const index = new Map();
  for (const session of sessions) {
    const key = groupLabel(session.updated_at || session.created_at);
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ label: key, items: [] });
    }
    groups[index.get(key)].items.push(session);
  }
  return groups;
}

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState(() => readStorage('prism-model', 'prism-mini-1.0'));
  const [effort, setEffort] = useState(() => readStorage('prism-effort', 'medium'));
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [usage, setUsage] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStorage('prism-chat-sidebar', 'open') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => readStorage('prism-chat-theme', 'light') === 'dark');
  const pickerRef = useRef(null);
  const renameRef = useRef(null);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const requestRef = useRef(0);

  const rank = planRank(user?.plan);
  const selectedModel = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const selectedEffort = useMemo(() => EFFORTS.find((item) => item.id === effort) || EFFORTS[1], [effort]);
  const groupedSessions = useMemo(() => groupSessions(sessions), [sessions]);
  const usagePct = Math.max(0, Math.min(100, Number(usage?.percentage || 0)));
  const usageLabel = `${usagePct}% usado`;

  const isLocked = (item) => !ALLOWED_BY_PLAN[rank]?.has(item.tier);

  const handleAuthError = useCallback((err) => {
    if (err?.status === 401) {
      logout();
      navigate('/login', { replace: true });
      return true;
    }
    return false;
  }, [logout, navigate]);

  const refreshUsage = useCallback(async () => {
    try {
      const next = await api.get('/chat/usage');
      setUsage(next || null);
    } catch (err) {
      if (!handleAuthError(err) && err?.status !== 404) console.warn('Prism usage refresh failed:', err);
    }
  }, [handleAuthError]);

  const openSession = useCallback(async (id) => {
    if (!id) return;
    const requestId = ++requestRef.current;
    setActiveSession(id);
    setLoadingMessages(true);
    setError('');
    setMobileOpen(false);
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages`);
      if (requestId !== requestRef.current) return;
      setMessages(Array.isArray(result.messages) ? result.messages : []);
    } catch (err) {
      if (requestId === requestRef.current && !handleAuthError(err)) setError(err.message || 'Não foi possível carregar a conversa.');
    } finally {
      if (requestId === requestRef.current) setLoadingMessages(false);
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
      else {
        setActiveSession(null);
        setMessages([]);
      }
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Não foi possível carregar suas conversas.');
    } finally {
      setLoadingSessions(false);
    }
  }, [handleAuthError, openSession]);

  useEffect(() => {
    loadSessions();
    refreshUsage();
  }, [loadSessions, refreshUsage]);

  useEffect(() => {
    const timer = setInterval(refreshUsage, 30_000);
    return () => clearInterval(timer);
  }, [refreshUsage]);

  useEffect(() => {
    try {
      localStorage.setItem('prism-model', model);
      localStorage.setItem('prism-effort', effort);
      localStorage.setItem('prism-chat-sidebar', sidebarCollapsed ? 'collapsed' : 'open');
      localStorage.setItem('prism-chat-theme', dark ? 'dark' : 'light');
    } catch {}
  }, [model, effort, sidebarCollapsed, dark]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? 'smooth' : 'auto' });
  }, [messages, sending]);

  useEffect(() => {
    const close = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) setPickerOpen(false);
      if (renameRef.current && !renameRef.current.contains(event.target)) setEditingId(null);
    };
    const escape = (event) => {
      if (event.key !== 'Escape') return;
      setPickerOpen(false);
      setPlansOpen(false);
      setMobileOpen(false);
      setEditingId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 190)}px`;
  }, [input]);

  async function newSession() {
    if (sending) return;
    setError('');
    try {
      const result = await api.post('/chat/sessions', {});
      setSessions((current) => [result.session, ...current.filter((item) => item.id !== result.session.id)]);
      setActiveSession(result.session.id);
      setMessages([]);
      setMobileOpen(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Não foi possível criar a conversa.');
    }
  }

  async function renameSession(session) {
    const title = editingTitle.trim();
    if (!title || title === session.title) {
      setEditingId(null);
      return;
    }
    try {
      const result = await api.patch(`/chat/sessions/${encodeURIComponent(session.id)}`, { title });
      setSessions((current) => current.map((item) => item.id === session.id ? result.session : item));
      setEditingId(null);
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Não foi possível renomear a conversa.');
    }
  }

  async function deleteSession(session, event) {
    event?.stopPropagation();
    if (sending) return;
    if (!window.confirm(`Excluir “${session.title || 'Nova conversa'}”?`)) return;
    try {
      await api.delete(`/chat/sessions/${encodeURIComponent(session.id)}`);
      const next = sessions.filter((item) => item.id !== session.id);
      setSessions(next);
      if (activeSession === session.id) {
        if (next[0]) await openSession(next[0].id);
        else {
          setActiveSession(null);
          setMessages([]);
        }
      }
    } catch (err) {
      if (!handleAuthError(err)) setError(err.message || 'Não foi possível excluir a conversa.');
    }
  }

  function chooseModel(id) {
    const item = MODELS.find((entry) => entry.id === id);
    if (!item) return;
    if (isLocked(item)) {
      setRequestedModel(item.name);
      setPlansOpen(true);
      return;
    }
    setModel(id);
    setPickerOpen(false);
  }

  function chooseEffort(id) {
    if (id === 'ultracode' && rank < 4) {
      setRequestedModel('Ultra Code');
      setPlansOpen(true);
      return;
    }
    setEffort(id);
    setPickerOpen(false);
  }

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setError('');
    setSending(true);
    let sid = activeSession;
    const localId = `local-${Date.now()}`;
    try {
      if (!sid) {
        const created = await api.post('/chat/sessions', {});
        sid = created.session.id;
        setActiveSession(sid);
        setSessions((current) => [created.session, ...current]);
      }
      setMessages((current) => [...current, { id: localId, role: 'user', content, model_id: model, effort }]);
      setInput('');
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content, model, effort }, { timeout: 180000 });
      if (!result?.message) throw new Error('O servidor não retornou uma resposta válida.');
      setMessages((current) => [...current, { ...result.message, tools_used: Array.isArray(result.tools_used) ? result.tools_used : [] }]);
      if (result.usage) setUsage(result.usage);
      setSessions((current) => current
        .map((item) => item.id === sid ? { ...item, title: item.title === 'Nova conversa' ? content.replace(/\s+/g, ' ').slice(0, 64) : item.title, updated_at: new Date().toISOString() } : item)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
    } catch (err) {
      if (err?.code === 'USAGE_LIMIT_REACHED' || err?.payload?.code === 'USAGE_LIMIT_REACHED' || err?.status === 429) {
        if (err.payload?.usage) setUsage(err.payload.usage);
        setError(err.message || 'Você atingiu o limite de uso desta janela.');
      } else if (err?.code === 'PLAN_UPGRADE_REQUIRED' || err?.payload?.code === 'PLAN_UPGRADE_REQUIRED' || err?.status === 403) {
        const requested = err.payload?.model ? MODELS.find((item) => item.id === err.payload.model)?.name || err.payload.model : selectedModel.name;
        setRequestedModel(err.payload?.requiredPlan ? `Plano ${err.payload.requiredPlan}` : requested);
        setPlansOpen(true);
        setMessages((current) => current.filter((message) => message.id !== localId));
      } else if (!handleAuthError(err)) {
        setMessages((current) => current.filter((message) => message.id !== localId));
        setError(err.message || 'Não foi possível concluir a solicitação.');
      }
    } finally {
      setSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function suggestion(text) {
    setInput(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const first = firstName(user?.name);

  const sidebar = (
    <aside className={`chat-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-top">
        <div className="sidebar-brand-row">
          <button className="brand" onClick={() => navigate('/chat')} aria-label="Ir para Home">
            <span className="brand-mark" />
            <span className="brand-copy">Prism IA</span>
          </button>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        <div className="app-switcher" role="navigation" aria-label="Alternar aplicativo">
          <button className="app-switch active" onClick={() => navigate('/chat')}>Home</button>
          <button className="app-switch" onClick={() => navigate('/codex')}>Codex</button>
        </div>

        <button className="new-chat" onClick={newSession} disabled={sending}>
          <span>+</span><span className="nav-label">Novo chat</span>
        </button>
      </div>

      <div className="session-heading">
        <span className="nav-label">Conversas</span>
        <span>{sessions.length || ''}</span>
      </div>

      <div className="session-list">
        {loadingSessions && <div className="sidebar-loading"><span /><span /><span /></div>}
        {!loadingSessions && !sessions.length && <div className="sidebar-empty nav-label">Suas conversas aparecem aqui.</div>}
        {!loadingSessions && groupedSessions.map((group) => (
          <div className="session-group" key={group.label}>
            <div className="session-group-label nav-label">{group.label}</div>
            {group.items.map((session) => (
              <div key={session.id} className={`session-item ${session.id === activeSession ? 'active' : ''}`}>
                {editingId === session.id ? (
                  <div className="session-rename" ref={renameRef}>
                    <input
                      value={editingTitle}
                      maxLength={120}
                      autoFocus
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') renameSession(session);
                        if (event.key === 'Escape') setEditingId(null);
                      }}
                      aria-label="Novo nome da conversa"
                    />
                    <button onClick={() => renameSession(session)} aria-label="Salvar nome">OK</button>
                  </div>
                ) : (
                  <>
                    <button className="session-open" onClick={() => openSession(session.id)} disabled={sending}>
                      <span className="session-title">{session.title || 'Nova conversa'}</span>
                      <small>{formatConversationDate(session.updated_at || session.created_at)}</small>
                    </button>
                    <div className="session-actions">
                      <button onClick={(event) => { event.stopPropagation(); setEditingId(session.id); setEditingTitle(session.title || ''); }} aria-label="Renomear conversa" title="Renomear">Editar</button>
                      <button onClick={(event) => deleteSession(session, event)} aria-label="Excluir conversa" title="Excluir">Excluir</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar-bottom">
        <div className="sidebar-usage" title={`${usageLabel} · janela de ${usage?.windowHours || 5} horas`}>
          <div className="sidebar-usage-head"><span className="nav-label">Uso</span><strong>{usageLabel}</strong></div>
          <div className="usage-track" aria-label={usageLabel}><span style={{ width: `${usagePct}%` }} /></div>
          <small className="usage-reset nav-label">{usage?.resetsAt ? `Renova às ${formatTime(usage.resetsAt)}` : 'Janela de 5 horas'}</small>
        </div>
        <button className="theme-button" onClick={() => setDark((value) => !value)}>
          <span className="theme-glyph">{dark ? 'Sol' : 'Lua'}</span>
          <span className="nav-label">{dark ? 'Modo claro' : 'Modo escuro'}</span>
        </button>
        <button className="profile-button" onClick={() => navigate('/configuracoes')}>
          <span className="avatar">{initial(user?.name)}</span>
          <span className="profile-text nav-label"><strong>{user?.name || 'Usuário'}</strong><small>{user?.plan || 'Grátis'}</small></span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`chat-app chat-theme-${dark ? 'dark' : 'light'} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button className="mobile-menu-button" onClick={() => setMobileOpen((value) => !value)} aria-label="Abrir navegação">Menu</button>
      {sidebar}
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Fechar navegação" />}

      <main className="chat-main">
        <header className="chat-topbar">
          <div className="chat-context">
            <span>PRISM IA</span>
            {activeSession && <small>{sessions.find((item) => item.id === activeSession)?.title || 'Nova conversa'}</small>}
          </div>
          <div className="model-control" ref={pickerRef}>
            <button className="topbar-model" onClick={() => setPickerOpen((value) => !value)} aria-expanded={pickerOpen}>
              <span>{selectedModel.name}</span><small>{selectedEffort.name}</small><b>⌄</b>
            </button>
            {pickerOpen && (
              <div className="model-picker">
                <div className="picker-head"><span>MODELO</span><strong>Escolha o modelo</strong></div>
                <div className="picker-list">
                  {MODELS.map((item) => {
                    const locked = isLocked(item);
                    return (
                      <button key={item.id} className={`picker-model ${model === item.id ? 'selected' : ''} ${locked ? 'locked' : ''}`} onClick={() => chooseModel(item.id)} aria-disabled={locked}>
                        <span><strong>{item.name}{item.badge && <em>{item.badge}</em>}</strong><small>{item.detail}</small></span>
                        <b>{locked ? 'Fazer Upgrade' : model === item.id ? 'Atual' : ''}</b>
                      </button>
                    );
                  })}
                </div>
                <button className="picker-submenu" onClick={() => setPickerOpen('thinking')}>
                  <span><strong>Nível de pensamento</strong><small>{selectedEffort.name} · {selectedEffort.note}</small></span><b>→</b>
                </button>
              </div>
            )}
            {pickerOpen === 'thinking' && (
              <div className="model-picker thinking-picker">
                <div className="picker-head"><span>PENSAMENTO</span><strong>Quanto esforço aplicar</strong></div>
                <div className="thinking-list">
                  {EFFORTS.map((item) => (
                    <button key={item.id} className={effort === item.id ? 'selected' : ''} onClick={() => chooseEffort(item.id)}>
                      <span><strong>{item.name}</strong><small>{item.note}</small></span>
                      <b>{effort === item.id ? 'Atual' : item.id === 'ultracode' && rank < 4 ? 'Upgrade' : ''}</b>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="messages" aria-live="polite">
          {loadingMessages ? (
            <div className="message-loading"><span /><span /><span /></div>
          ) : !messages.length ? (
            <div className="empty-chat">
              <span className="empty-kicker">PRISM IA</span>
              <h1>Olá, {first}.</h1>
              <p>O que vamos fazer hoje?</p>
              <div className="prompt-suggestions">
                <button onClick={() => suggestion('Organize essa ideia em um plano claro.')}><strong>Organizar uma ideia</strong><span>Transforme um rascunho em próximos passos.</span></button>
                <button onClick={() => suggestion('Revise este código e aponte os problemas importantes.')}><strong>Revisar código</strong><span>Encontre riscos e melhorias antes de alterar.</span></button>
                <button onClick={() => suggestion('Explique isso de um jeito simples.')}><strong>Explicar algo</strong><span>Deixe um assunto técnico fácil de entender.</span></button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                  <div className="message-head">
                    <span className="message-author">{message.role === 'user' ? first : 'Prism IA'}</span>
                    {message.role === 'assistant' && message.model_id && <span className="message-model">{MODELS.find((item) => item.id === message.model_id)?.short || message.model_id}</span>}
                  </div>
                  <div className="message-content">{message.content}</div>
                  {message.role === 'assistant' && (Number(message.tokens_used || 0) > 0 || (Array.isArray(message.tools_used) && message.tools_used.length > 0)) && (
                    <div className="message-meta">
                      {Number(message.tokens_used || 0) > 0 && <span>{Number(message.tokens_used).toLocaleString('pt-BR')} tokens</span>}
                      {Array.isArray(message.tools_used) && message.tools_used.length > 0 && <span>{message.tools_used.length} ferramentas</span>}
                    </div>
                  )}
                </article>
              ))}
              {sending && (
                <article className="message assistant">
                  <div className="message-head"><span className="message-author">Prism IA</span><span className="message-model">{selectedModel.short}</span></div>
                  <div className="message-thinking"><span /><span /><span /><span>digitando...</span></div>
                </article>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </section>

        <div className="composer-area">
          {error && <div className="chat-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Fechar</button></div>}
          <div className="composer">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Escreva uma mensagem"
              disabled={sending}
              aria-label="Mensagem"
            />
            <div className="composer-footer">
              <button className="composer-model" onClick={() => setPickerOpen(true)}>{selectedModel.short}<span>·</span>{selectedEffort.name}</button>
              <button className="send-button" onClick={send} disabled={!input.trim() || sending}>{sending ? 'Enviando' : 'Enviar'}</button>
            </div>
          </div>
          <p className="composer-note">Revise informações importantes antes de usá-las</p>
          <p className="composer-shortcuts">Enter envia · Shift + Enter quebra a linha</p>
        </div>
      </main>

      <PlanPanel
        open={plansOpen}
        onClose={() => { setPlansOpen(false); setRequestedModel(''); }}
        currentPlan={user?.plan || 'Grátis'}
        requestedModel={requestedModel}
      />
    </div>
  );
}
