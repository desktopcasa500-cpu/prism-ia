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

const PLAN_RANK = {
  'Grátis': 0, free: 0,
  Base: 1, base: 1,
  Medium: 2, medium: 2,
  Pro: 3, pro: 3,
  Empresarial: 4, enterprise: 4,
};

const MODEL_STORAGE = 'prism.home.model';
const STARTERS = [
  ['Escrever', 'Transforme uma ideia em texto pronto.', 'Escreva uma página de apresentação para meu produto.'],
  ['Criar', 'Comece algo novo do zero.', 'Crie um plano completo para este projeto.'],
  ['Código', 'Construa, revise ou explique código.', 'Analise este problema e proponha uma implementação limpa.'],
  ['Aprender', 'Entenda um assunto com clareza.', 'Explique este assunto passo a passo, com exemplos.'],
  ['Analisar', 'Compare informações e encontre padrões.', 'Analise estas informações e destaque os pontos principais.'],
];

function rankOf(plan) { return PLAN_RANK[plan] ?? 0; }
function metadataOf(message) {
  if (!message?.metadata) return {};
  if (typeof message.metadata === 'object') return message.metadata;
  try { return JSON.parse(message.metadata); } catch { return {}; }
}
function requestId() {
  try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random()}`; }
}

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const controllerRef = useRef(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const searchRef = useRef(null);
  const selected = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const hasMessages = messages.length > 0;
  const canSend = Boolean(input.trim() || attachments.length) && !sending && !uploading;
  const filteredSessions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter((item) => String(item.title || 'Nova conversa').toLowerCase().includes(term));
  }, [searchTerm, sessions]);

  useEffect(() => { localStorage.setItem(MODEL_STORAGE, model); }, [model]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending]);
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(190, textareaRef.current.scrollHeight)}px`;
  }, [input]);
  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => searchRef.current?.focus());
  }, [searchOpen]);

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
    setSessionId(id);
    setLoading(true);
    setError('');
    setAttachments([]);
    setMobileOpen(false);
    try {
      const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages?surface=home`);
      setMessages(result.messages || []);
    } catch (cause) {
      if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar a conversa.');
    } finally {
      setLoading(false);
    }
  }, [authFail]);

  useEffect(() => {
    (async () => {
      try {
        const result = await api.get('/chat/sessions?surface=home');
        setSessions(result.sessions || []);
        if (result.sessions?.[0]) await loadSession(result.sessions[0].id);
      } catch (cause) {
        if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar o Chat.');
      } finally {
        setLoading(false);
      }
    })();
    refreshUsage();
  }, [authFail, loadSession, refreshUsage]);

  async function newSession() {
    if (sending) return;
    try {
      const result = await api.post('/chat/sessions', { surface: 'home' });
      setSessions((list) => [result.session, ...list]);
      setSessionId(result.session.id);
      setMessages([]);
      setInput('');
      setAttachments([]);
      setError('');
      setMobileOpen(false);
    } catch (cause) {
      if (!authFail(cause)) setError(cause.message || 'Não foi possível criar a conversa.');
    }
  }

  function chooseModel(id) {
    const next = MODELS.find((item) => item.id === id);
    if (!next) return;
    if (rank < next.rank) {
      setRequestedModel(next.label);
      setPlansOpen(true);
      setModelOpen(false);
      return;
    }
    setModel(next.id);
    setModelOpen(false);
  }

  function chooseStarter(prompt) {
    setInput(prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function send() {
    const content = input.trim();
    if ((!content && !attachments.length) || sending || uploading) return;
    setSending(true);
    setError('');
    const controller = new AbortController();
    controllerRef.current = controller;
    const rid = requestId();
    const selectedAttachments = [...attachments];
    let currentSession = sessionId;
    const localId = `local-${rid}`;
    try {
      if (!currentSession) {
        const created = await api.post('/chat/sessions', {
          surface: 'home',
          title: content.slice(0, 64) || 'Arquivos anexados',
        });
        currentSession = created.session.id;
        setSessionId(currentSession);
        setSessions((list) => [created.session, ...list]);
      }

      const optimistic = {
        id: localId,
        role: 'user',
        content,
        model_id: model,
        effort,
        metadata: { attachments: selectedAttachments },
      };
      setMessages((list) => [...list, optimistic]);
      setInput('');
      setAttachments([]);

      const result = await api.post(`/chat/sessions/${encodeURIComponent(currentSession)}/messages`, {
        content,
        model,
        effort,
        clientRequestId: rid,
        attachmentIds: selectedAttachments.map((item) => item.id).filter(Boolean),
      }, { timeout: 180000, signal: controller.signal });

      if (result.duplicate) {
        const history = await api.get(`/chat/sessions/${encodeURIComponent(currentSession)}/messages?surface=home`);
        setMessages(history.messages || []);
      } else if (result.message) {
        setMessages((list) => [
          ...list.filter((item) => item.id !== localId),
          result.userMessage || optimistic,
          result.message,
        ]);
      }
      if (result.usage) setUsage(result.usage);
    } catch (cause) {
      if (cause?.name !== 'AbortError') {
        if (cause?.payload?.code === 'PLAN_UPGRADE_REQUIRED' || cause?.status === 403) {
          setRequestedModel(cause.payload?.requiredPlan || selected.label);
          setPlansOpen(true);
        } else if (!authFail(cause)) {
          setError(cause.message || 'Não foi possível concluir a resposta.');
        }
      }
      setMessages((list) => list.filter((item) => item.id !== localId));
    } finally {
      setSending(false);
      controllerRef.current = null;
      setUploading(false);
      refreshUsage();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  const initial = String(user?.name || 'P').slice(0, 1).toUpperCase();
  const recentProjects = sessions.slice(0, 1);

  return (
    <div className="prism-reference-chat">
      <aside className={`prism-reference-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="prism-reference-sidebar__top">
          <button className="prism-reference-sidebar__account" type="button" onClick={() => navigate('/configuracoes')}>
            <span className="avatar">{initial}</span>
            <span className="name">{user?.name || 'Prism'}</span>
            <span className="chevron">⌄</span>
          </button>
          <button className="prism-reference-sidebar__toggle" type="button" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}>◧</button>
        </div>

        <button className="prism-reference-new" type="button" onClick={newSession}>
          <span>Nova Conversa</span><span className="arrow">⌄</span>
        </button>

        <div className="prism-reference-search-wrap">
          {searchOpen ? (
            <input ref={searchRef} className="prism-reference-search-input" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setSearchOpen(false); setSearchTerm(''); } }} placeholder="Buscar conversas" aria-label="Buscar conversas" />
          ) : (
            <button className="prism-reference-search" type="button" onClick={() => setSearchOpen(true)}><span className="icon">⌕</span><span>Buscar</span></button>
          )}
        </div>

        <nav className="prism-reference-nav" aria-label="Navegação principal">
          <button className="active" type="button" onClick={() => navigate('/chat')}>Início</button>
          <button type="button" onClick={() => navigate('/studio')}>Projetos</button>
          <button type="button" onClick={() => { setSearchOpen(true); setSearchTerm(''); }}>Conversas</button>
          <button type="button" onClick={() => navigate('/studio')}>Design Systems</button>
          <button type="button" onClick={() => navigate('/modelos')}>Modelos</button>
        </nav>

        <section className="prism-reference-section">
          <div className="prism-reference-section__label">Drafts</div>
          <div className="prism-reference-drafts">No drafts yet</div>
        </section>

        <section className="prism-reference-section">
          <div className="prism-reference-section__label">Projects</div>
          <div className="prism-reference-projects">
            {recentProjects.length ? recentProjects.map((item) => (
              <button className="prism-reference-project" key={item.id} type="button" onClick={() => loadSession(item.id)}>
                <span className="dot">⌁</span><span>{item.title || 'Novo projeto'}</span>
              </button>
            )) : <div className="prism-reference-project"><span className="dot">⌁</span><span>Sem projetos</span></div>}
          </div>
        </section>

        <div className="prism-reference-history">
          {filteredSessions.length > 0 && <div className="prism-reference-history__title">Conversas recentes</div>}
          {filteredSessions.map((item) => (
            <button key={item.id} type="button" className={`prism-reference-history__item ${item.id === sessionId ? 'active' : ''}`} onClick={() => loadSession(item.id)}>
              {item.title || 'Nova conversa'}
            </button>
          ))}
          {searchTerm && !filteredSessions.length && <div className="prism-reference-history__empty">Nenhuma conversa encontrada.</div>}
        </div>

        <div className="prism-reference-sidebar__bottom">
          <div className="prism-reference-team">
            <div className="prism-reference-team__icons"><span className="prism-reference-team__icon">✦</span><span className="prism-reference-team__line"/><span className="prism-reference-team__icon">P</span></div>
            <strong>Your new team is ready</strong>
            <button type="button" onClick={() => navigate('/configuracoes')}>View details</button>
          </div>
          <button type="button" className="prism-reference-sidebar__profile" onClick={() => navigate('/configuracoes')}>
            <span className="avatar">{initial}</span><span><strong>{user?.name || 'Você'}</strong><span>{user?.plan || 'Grátis'}</span></span>
          </button>
        </div>
      </aside>

      <main className="prism-reference-main">
        <header className="prism-reference-mobile-bar">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">☰</button>
          <span>{hasMessages ? (sessions.find((item) => item.id === sessionId)?.title || 'Conversa') : 'Prism IA'}</span>
        </header>

        <section className="prism-reference-conversation">
          {loading && <div className="prism-reference-status">Carregando conversa...</div>}
          {error && <div className="prism-reference-status error" role="alert">{error}</div>}

          {!hasMessages && !loading && !error && (
            <div className="prism-reference-empty">
              <div className="prism-reference-empty__inner">
                <h1>O que você quer criar?</h1>
                <div className="prism-reference-starters" aria-label="Sugestões rápidas">
                  {STARTERS.map(([label, description, prompt]) => (
                    <button key={label} type="button" onClick={() => chooseStarter(prompt)}>
                      <strong>{label}</strong><span>{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="prism-reference-messages">
              {messages.map((message) => {
                const meta = metadataOf(message);
                const files = Array.isArray(meta.attachments) ? meta.attachments : [];
                return (
                  <article className={`prism-reference-message ${message.role}`} key={message.id}>
                    <div className="prism-reference-message__author">{message.role === 'user' ? user?.name || 'Você' : 'Prism IA'}</div>
                    {files.length > 0 && <div className="prism-reference-composer__attachments">{files.map((file) => <span className="prism-reference-composer__attachment" key={file.id || file.name}>{file.name}</span>)}</div>}
                    <div className="message-copy">{message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} /> : <p>{message.content}</p>}</div>
                  </article>
                );
              })}
              {sending && <div className="prism-reference-working">Prism está trabalhando...</div>}
              <div ref={endRef} />
            </div>
          )}
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
