import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api.js';
import { useAuth } from './lib/auth.jsx';
import GoogleSignIn from './components/GoogleSignIn.jsx';

const MODELS = [
  { id: 'prism-nano-1.0', name: 'Prism Nano 1.0', note: 'Rápido e econômico' },
  { id: 'prism-mini-1.0', name: 'Prism Mini 1.0', note: 'Geral, conversa e programação' },
  { id: 'prism-tex-1.5', name: 'Prism Tex 1.5', note: 'Código, documentação e arquitetura' },
  { id: 'prism-taff-1.0', name: 'Prism Taff 1.0', note: 'Projetos complexos e debugging' },
  { id: 'prism-taff-2.0', name: 'Prism Taff 2.0', note: 'Orquestração máxima' },
];
const EFFORTS = [
  ['low', 'Low', 'Rápido'],
  ['medium', 'Médio', 'Equilibrado'],
  ['high', 'High', 'Profundo'],
  ['max', 'Max', 'Máximo'],
  ['ultracode', 'Ultra Code', 'Engenharia'],
];
const PLAN_DATA = [
  ['Grátis', 'R$0', '5 créditos/dia', 'Nano / Mini'],
  ['Base', 'R$8', '30 créditos/dia', 'Nano / Mini / Edge'],
  ['Medium', 'R$30', '700 créditos/dia', 'Nano / Mini / Edge / Tex'],
  ['Pro', 'R$90', '2.000 créditos/dia', 'Tex / Taff'],
  ['Empresarial', 'R$140', '6.000 créditos/dia', 'Todos os modelos'],
];
const BUILD_WORDS = /\b(site|website|webapp|web app|jogo|game|app|aplicativo|api|sistema|script|scripts|c[oó]digo|code|componente|p[aá]gina|landing|projeto|arquivo|arquivos|npm|react|three\.js|python|godot|unity|html|css|javascript|typescript|criar|construir|implementar|programar|bug|debug|corrigir|refatorar)\b/i;
const PHASES = [
  ['received', 'Pedido recebido'],
  ['analyzing', 'Analisando o projeto'],
  ['planning', 'Planejando'],
  ['writing', 'Escrevendo arquivos'],
  ['reviewing', 'Revisando'],
  ['updating', 'Atualizando workspace'],
  ['completed', 'Concluído'],
];

function initials(user) {
  return String(user?.name || user?.email || 'P').trim().slice(0, 2).toUpperCase();
}
function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}
function cls(...items) { return items.filter(Boolean).join(' '); }

export function PrismLogo({ compact = false }) {
  return <span className={cls('brand', compact && 'brand-compact')}><span className="brand-mark">P</span><span><strong>Prism</strong>{!compact && <small>IA</small>}</span></span>;
}

function Shell({ children, nav = true }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  return <div className="site-shell">
    {nav && <header className="site-nav">
      <button className="brand-button" onClick={() => navigate('/')} aria-label="Prism IA"><PrismLogo /></button>
      <nav>
        <Link to="/informacoes">Informações</Link>
        <Link to="/modelos">Modelos</Link>
        <Link to="/termos">Termos</Link>
      </nav>
      {user ? <Link className="nav-profile" to="/chat"><span>{initials(user)}</span><em>{user.name || 'Conta'}</em></Link> : <Link className="nav-login" to="/login">Entrar</Link>}
    </header>}
    {children}
  </div>;
}

function Landing() {
  const { user } = useAuth();
  const primary = user ? '/chat' : '/login';
  return <Shell>
    <main className="landing-page">
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">PRISM IA / SOFTWARE ENGINEERING / 2026</span>
          <h1>Build with <em>more.</em></h1>
          <p>Uma superfície tranquila para pensar, construir e revisar. Diferentes motores de IA trabalhando na mesma tarefa, sem transformar a interface em um painel de controle.</p>
          <div className="hero-actions"><Link className="button primary" to={primary}>{user ? 'Abrir a Prism' : 'Começar'}</Link><Link className="button" to="/informacoes">Como funciona</Link></div>
          <div className="hero-proof"><span>CHAT</span><i /><span>CODEX</span><i /><span>ORCHESTRATION</span><i /><span>WORKSPACE</span></div>
        </div>
        <div className="hero-system" aria-hidden="true">
          <div className="hero-ring ring-1" /><div className="hero-ring ring-2" /><div className="hero-ring ring-3" />
          <div className="hero-core"><span>P</span></div>
          <div className="hero-node n1">REASON</div><div className="hero-node n2">CODE</div><div className="hero-node n3">REVIEW</div><div className="hero-node n4">ROUTE</div>
          <div className="hero-line l1" /><div className="hero-line l2" /><div className="hero-line l3" /><div className="hero-line l4" />
        </div>
      </section>

      <section className="landing-statement"><span className="section-code">01 / A IDEIA</span><div><h2>Você descreve.<br /><em>A Prism organiza.</em></h2><p>O pedido começa como conversa. Quando a tarefa exige engenharia, o sistema transforma intenção em raciocínio, arquivos, revisão e resultado.</p></div><strong>INPUT → ROUTE → BUILD → REVIEW</strong></section>

      <section className="feature-grid-section"><span className="section-code">02 / O QUE MUDA</span><div className="feature-grid">
        {[
          ['CHAT', 'Conversa que continua', 'Contexto, decisões e histórico em um só lugar.'],
          ['CODEX', 'Projeto aberto de verdade', 'Arquivos, preview, código e execução do agente no mesmo workspace.'],
          ['ROUTE', 'Modelos em conjunto', 'O roteador pode distribuir partes do trabalho entre estratégias diferentes.'],
          ['REVIEW', 'Menos teatro. Mais resultado.', 'A interface mostra o trabalho e deixa você decidir o próximo movimento.'],
        ].map(([label, title, text]) => <article key={label}><span>{label}</span><h3>{title}</h3><p>{text}</p><b>↗</b></article>)}
      </div></section>

      <section className="model-strip"><div><span className="section-code">03 / MODELOS</span><h2>Uma família. Vários ritmos.</h2></div><div className="model-list">{MODELS.map((model, i) => <Link key={model.id} to={`/modelos/${model.id}`}><small>0{i + 1}</small><strong>{model.name}</strong><span>{model.note}</span></Link>)}</div></section>

      <section className="editorial-band"><span>PRISM CODEX</span><strong>ONE REQUEST.<br /><em>A LIVING WORKSPACE.</em></strong><small>BUILD / RUN / REVIEW</small></section>

      <section className="landing-bottom"><div><span className="section-code">04 / ENTRAR</span><h2>Pronto para<br />construir?</h2></div><div><p>Converse normalmente. Quando o trabalho virar software, o Codex assume o workspace.</p><div className="hero-actions"><Link className="button primary" to={primary}>{user ? 'Abrir a Prism' : 'Criar conta'}</Link><Link className="text-link" to="/modelos">Explorar modelos →</Link></div></div></section>
    </main>
    <footer className="site-footer"><span>PRISM IA / ENGINEERING SOFTWARE</span><span>2026</span></footer>
  </Shell>;
}

function AuthPage({ register = false }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const endpoint = register ? '/auth/register' : '/auth/login';
      const body = register ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password };
      const result = await api.post(endpoint, body);
      login(result.token, result.user); navigate('/chat', { replace: true });
    } catch (cause) { setError(cause?.message || 'Não foi possível concluir.'); }
    finally { setBusy(false); }
  };
  return <Shell nav={false}><div className="auth-layout"><section className="auth-art"><button className="brand-button" onClick={() => navigate('/')}><PrismLogo /></button><div className="auth-art-copy"><span>PRISM IA / 001</span><h1>{register ? 'Comece a construir.' : 'Bem-vindo de volta.'}</h1><p>Uma interface para conversa, código, projetos e raciocínio.</p></div><small>BUILD / RUN / REVIEW</small></section><section className="auth-panel"><div className="auth-box"><span className="eyebrow">{register ? 'CRIAR CONTA' : 'ENTRAR'}</span><h2>{register ? 'Sua conta na Prism.' : 'Entre na Prism.'}</h2><p>{register ? 'Crie uma conta para abrir o Chat e o Codex.' : 'Continue de onde parou.'}</p>{error && <div className="notice">{error}</div>}<form onSubmit={submit}>{register && <label>Nome<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>}<label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" autoComplete="email" /></label><label>Senha<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete={register ? 'new-password' : 'current-password'} /></label><button className="button primary wide" disabled={busy}>{busy ? 'Entrando...' : register ? 'Criar conta' : 'Entrar'}</button></form><div className="divider"><span>ou</span></div><GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} /><p className="auth-switch">{register ? 'Já tem uma conta?' : 'Ainda não tem conta?'} <Link to={register ? '/login' : '/register'}>{register ? 'Entrar' : 'Criar conta'}</Link></p></div></section></div></Shell>;
}

function InfoPage() {
  return <Shell><main className="content-page"><span className="eyebrow">PRISM / INFORMAÇÕES</span><h1>Uma camada de engenharia<br /><em>sobre modelos.</em></h1><p className="lead">A Prism organiza diferentes motores de IA em uma experiência única: conversa, roteamento, execução e revisão.</p><div className="content-grid">{[['01', 'Chat', 'Conversa com contexto contínuo e seleção de modelo.'], ['02', 'Codex', 'Workspace para projetos: arquivos, preview, código e agente.'], ['03', 'Orquestração', 'Estratégias diferentes podem participar da mesma tarefa.'], ['04', 'Créditos', 'O acesso aos modelos é controlado por planos e consumo.']].map(([n,t,c])=><article key={n}><span>{n}</span><h3>{t}</h3><p>{c}</p></article>)}</div></main></Shell>;
}
function ModelsPage() {
  return <Shell><main className="content-page"><span className="eyebrow">PRISM / MODELOS</span><h1>Escolha o <em>ritmo.</em></h1><p className="lead">Cada modelo Prism tem um papel diferente. O Codex pode usar perfis mais fortes quando a tarefa pede engenharia.</p><div className="model-catalog">{MODELS.map((m, i)=><Link to={`/modelos/${m.id}`} key={m.id}><small>{String(i + 1).padStart(2,'0')}</small><div><h3>{m.name}</h3><p>{m.note}</p></div><b>↗</b></Link>)}</div></main></Shell>;
}
function DetailPage({ type }) {
  const location = useLocation();
  const id = decodeURIComponent(location.pathname.split('/').pop() || '');
  const isModel = type === 'models';
  const model = MODELS.find(m => m.id === id);
  return <Shell><main className="detail-page"><Link to={isModel ? '/modelos' : '/informacoes'} className="back-link">← Voltar</Link><span className="eyebrow">PRISM / {isModel ? 'MODELO' : 'TEMA'}</span><h1>{isModel ? model?.name || 'Modelo Prism' : id}</h1><p className="lead">{model?.note || 'Detalhes da plataforma Prism IA.'}</p><div className="detail-rule" /><p>A Prism trata modelos como partes de um sistema maior. O objetivo é manter uma experiência clara enquanto a camada de engenharia decide como executar a tarefa.</p></main></Shell>;
}
function TermsPage() {
  return <Shell><main className="content-page"><span className="eyebrow">PRISM / TERMOS</span><h1>Como o sistema <em>funciona.</em></h1><div className="terms-list">{[['Roteamento','Modelos Prism são perfis de execução. A seleção depende do modelo escolhido e do nível de esforço.'],['Créditos','O consumo varia conforme plano e produto. Os limites exibidos na interface são informativos.'],['Privacidade','A aplicação mantém o banco atrás do backend; credenciais e chaves não devem ficar no frontend.'],['Revisão','Resultados gerados por IA precisam ser revisados antes de publicação ou uso em produção.']].map(([t,p])=><article key={t}><h3>{t}</h3><p>{p}</p></article>)}</div></main></Shell>;
}

function PlanModal({ onClose, current }) {
  return <div className="modal" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="plan-modal"><header><div><span className="eyebrow">PRISM / ACESSO</span><h2>Escolha o ritmo.</h2></div><button onClick={onClose}>Fechar</button></header><div className="plan-grid">{PLAN_DATA.map(([name, price, credits, access])=><article key={name} className={name === current ? 'current' : ''}><div><strong>{name}</strong><span>{price}</span></div><p>{credits}</p><small>{access}</small><button disabled={name === current}>{name === current ? 'Plano atual' : 'Escolher'}</button></article>)}</div></div></div>;
}

function useSessionData() {
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const loadSessions = useCallback(async () => {
    const data = await api.get('/chat/sessions');
    const next = Array.isArray(data.sessions) ? data.sessions : [];
    setSessions(next);
    if (!active && next[0]) setActive(next[0].id);
    if (!next.length) { setActive(null); setMessages([]); }
  }, [active]);
  useEffect(() => { loadSessions().catch(() => {}); }, [loadSessions]);
  useEffect(() => { if (!active) return; api.get(`/chat/sessions/${encodeURIComponent(active)}/messages`).then(data => setMessages(data.messages || [])).catch(() => {}); }, [active]);
  return { sessions, setSessions, active, setActive, messages, setMessages };
}

function ChatPage({ codex = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const data = useSessionData();
  const [model, setModel] = useState(() => localStorage.getItem('prism-model') || 'prism-mini-1.0');
  const [effort, setEffort] = useState(() => localStorage.getItem('prism-effort') || 'medium');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState(false);
  const [showIntro, setShowIntro] = useState(() => codex && localStorage.getItem('prism_codex_seen') !== '1');
  const [phase, setPhase] = useState('');
  const [phaseEvents, setPhaseEvents] = useState([]);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState('');
  const [tab, setTab] = useState('preview');
  const [project, setProject] = useState(null);
  const [preview, setPreview] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef(null);
  const startedAt = useRef(0);
  const bottomRef = useRef(null);

  const selectedModel = MODELS.find(m => m.id === model) || MODELS[1];
  const selectedEffort = EFFORTS.find(e => e[0] === effort) || EFFORTS[1];
  useEffect(() => localStorage.setItem('prism-model', model), [model]);
  useEffect(() => localStorage.setItem('prism-effort', effort), [effort]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data.messages, busy]);
  useEffect(() => { if (!codex) return; api.get('/projects').then(async res => { let p = res.projects?.[0]; if (!p) { const created = await api.post('/projects', { name: 'Novo projeto' }); p = created.project; } const detail = await api.get(`/projects/${p.id}`); const fs = detail.files || []; setProject(p); setFiles(fs); setActiveFile(fs.find(f => f.kind !== 'folder')?.path || ''); }).catch(() => {}); }, [codex]);
  useEffect(() => { if (!files.length) return; const source = files.find(f => f.path === activeFile) || files.find(f => f.kind !== 'folder'); setPreview(source?.content || ''); }, [activeFile, files]);
  const newSession = async () => { try { const res = await api.post('/chat/sessions', { title: 'Nova conversa' }); data.setSessions(items => [res.session, ...items]); data.setActive(res.session.id); data.setMessages([]); setPrompt(''); } catch (cause) { setError(cause.message); } };
  const send = async () => {
    const value = prompt.trim(); if (!value || busy) return;
    if (codex || BUILD_WORDS.test(value)) return sendVibe(value);
    setBusy(true); setError('');
    try {
      let sid = data.active;
      if (!sid) { const created = await api.post('/chat/sessions', {}); sid = created.session.id; data.setActive(sid); data.setSessions(items => [created.session, ...items]); }
      data.setMessages(items => [...items, { id: `local-${Date.now()}`, role: 'user', content: value }]); setPrompt('');
      const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content: value, model, effort }, { timeout: 180000 });
      if (!result.message) throw new Error('Resposta inválida do servidor.');
      data.setMessages(items => [...items, result.message]);
    } catch (cause) { if (cause.status === 401 || cause.status === 403) { logout(); navigate('/login', { replace: true }); } else setError(cause.message || 'Falha ao responder.'); }
    finally { setBusy(false); }
  };
  const sendVibe = async (value) => {
    if (!project?.id) { setError('O workspace ainda está carregando.'); return; }
    setBusy(true); setError(''); setPhase('received'); setPhaseEvents([{ phase: 'received', detail: 'Preparando o agente' }]); startedAt.current = Date.now(); setElapsed(0);
    data.setMessages(items => [...items, { id: `local-${Date.now()}`, role: 'user', content: value }]); setPrompt('');
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const result = await api.streamPost('/ai/generate/stream', { model, thinking: effort, prompt: value, context: data.messages.slice(-12).map(m => `${m.role}: ${m.content}`).join('\n'), projectId: project.id }, event => {
        if (event.type === 'phase') { setPhase(event.phase); setPhaseEvents(items => [...items.filter(i => i.phase !== event.phase), event]); }
        if (event.type === 'artifact') { setFiles(items => items.some(i => i.path === event.path) ? items.map(i => i.path === event.path ? { ...i, content: event.content } : i) : [...items, { path: event.path, content: event.content, kind: 'file' }]); setActiveFile(event.path); setTab('code'); }
      }, { timeout: 180000, signal: controller.signal });
      data.setMessages(items => [...items, { id: `assistant-${Date.now()}`, role: 'assistant', content: result.text || 'Alterações aplicadas ao projeto.', files: [...(result.files_created || []), ...(result.files_changed || [])] }]);
    } catch (cause) { if (cause?.name !== 'AbortError') setError(cause.message || 'O agente falhou.'); }
    finally { setBusy(false); abortRef.current = null; }
  };
  useEffect(() => { if (!busy) return; const timer = setInterval(() => setElapsed(Date.now() - startedAt.current), 100); return () => clearInterval(timer); }, [busy]);

  return <div className={cls('app-frame', codex && 'codex-page')}>
    {showIntro && codex && <CodexIntro onDone={() => { localStorage.setItem('prism_codex_seen', '1'); setShowIntro(false); }} />}
    <aside className="app-sidebar"><button className="brand-button" onClick={() => navigate('/chat')}><PrismLogo compact /></button><button className="sidebar-primary" onClick={newSession}>+ <span>Novo chat</span></button><button className={cls('sidebar-nav', !codex && 'active')} onClick={() => navigate('/chat')}>Chat <small>conversa</small></button><button className={cls('sidebar-nav', codex && 'active')} onClick={() => navigate('/codex')}>Prism Codex <small>build</small></button><button className="sidebar-nav" onClick={() => setPlans(true)}>Planos <small>{user?.plan || 'Grátis'}</small></button><div className="sidebar-history"><span>CONVERSAS</span>{data.sessions.map(s => <button key={s.id} className={data.active === s.id ? 'selected' : ''} onClick={() => data.setActive(s.id)}>{s.title || 'Nova conversa'}</button>)}</div><div className="sidebar-bottom"><button onClick={() => navigate('/configuracoes')}><span className="avatar">{initials(user)}</span><span><strong>{user?.name || 'Usuário'}</strong><small>{user?.plan || 'Grátis'}</small></span><b>↗</b></button></div></aside>
    <main className="app-main"><header className="app-topbar"><div><span className="top-kicker">PRISM / {codex ? 'CODEX' : 'CHAT'}</span><strong>{codex ? 'Vibe Code' : 'Conversa'}</strong></div><div className="top-controls"><label>MODELO<select value={model} onChange={e => setModel(e.target.value)}>{MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>PENSAMENTO<select value={effort} onChange={e => setEffort(e.target.value)}>{EFFORTS.map(e => <option key={e[0]} value={e[0]}>{e[1]}</option>)}</select></label>{codex && <button className="top-link" onClick={() => navigate('/chat')}>Voltar</button>}</div></header>
      <div className={cls('app-content', codex && 'has-workspace')}><section className="chat-panel"><div className="chat-scroll">{data.messages.length === 0 ? <div className="chat-empty"><span>PRISM {codex ? 'CODEX' : 'IA'}</span><h1>{codex ? 'O que vamos construir?' : 'O que vamos fazer?'}</h1><p>{codex ? 'Descreva a ideia. Quando houver software, arquivos ou implementação, o Codex transforma o pedido em workspace.' : 'Comece com uma pergunta, uma ideia ou um problema.'}</p><div className="suggestions"><button onClick={() => setPrompt('Crie uma landing page premium para a Prism IA')}>Criar uma landing page</button><button onClick={() => setPrompt('Revise meu código e encontre os principais problemas')}>Revisar código</button><button onClick={() => setPrompt('Explique este conceito de forma simples')}>Explicar algo</button></div></div> : data.messages.map(m => <article key={m.id} className={cls('chat-message', m.role === 'user' ? 'user' : 'assistant')}><div className="message-head"><span>{m.role === 'user' ? 'VOCÊ' : 'PRISM'}</span></div><div>{m.content}</div>{m.files?.length ? <div className="file-chips">{m.files.map(f => <button key={f} onClick={() => { setActiveFile(f); setTab('code'); }}>{f}</button>)}</div> : null}</article>)}{busy && <div className="agent-card"><div><span>PRISM {codex ? 'CODEX · AGENTE' : 'IA'}</span><small>{(elapsed / 1000).toFixed(1)}s</small></div>{codex ? <div className="phase-list">{PHASES.map(([id, label], i) => { const active = PHASES.findIndex(p => p[0] === phase); return <div className={cls(i < active && 'done', i === active && 'active')} key={id}><b>{i < active ? '✓' : i === active ? '·' : '○'}</b><span>{label}</span></div>; })}</div> : <div className="typing"><i/><i/><i/></div>}</div>}{error && <div className="chat-error">{error}<button onClick={() => setError('')}>Fechar</button></div>}<div ref={bottomRef}/></div><div className="composer-wrap"><div className={cls('composer', busy && 'busy')}><textarea value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={codex ? 'Descreva o que você quer construir...' : 'Como posso ajudar você hoje?'} /><div className="composer-foot"><span>ENTER envia · SHIFT + ENTER quebra linha</span>{busy ? <button onClick={() => abortRef.current?.abort()}>Parar</button> : <button className="send" onClick={send} disabled={!prompt.trim()}>Enviar ↗</button>}</div></div><small>As respostas podem conter erros. Revise resultados antes de publicar.</small></div></section>
      {codex && <aside className="workspace"><header><div><span>WORKSPACE</span><strong>{project?.name || 'Novo projeto'}</strong></div><div><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>Code</button></div></header>{tab === 'preview' ? <div className="workspace-preview"><div className="browser"><span>● ● ●</span><b>{project?.name || 'Prism Codex'}</b></div><iframe title="Preview" sandbox="allow-scripts" srcDoc={`<!doctype html><html><body style="margin:0;background:#faf9f6;color:#1d1b18;font-family:system-ui;padding:32px">${preview || '<main style="max-width:720px;margin:12vh auto"><div style="font-size:12px;letter-spacing:.18em;color:#8a847a">PRISM CODEX</div><h1 style="font-size:48px;letter-spacing:-.05em">Preview do projeto</h1><p style="color:#77716a">Quando o agente criar arquivos, a prévia aparecerá aqui.</p></main>'}</body></html>`} /></div> : <div className="code-workspace"><div className="file-tree"><span>ARQUIVOS</span>{files.filter(f => f.kind !== 'folder').map(f => <button className={activeFile === f.path ? 'active' : ''} key={f.path} onClick={() => setActiveFile(f.path)}>{f.path}</button>)}</div><div className="code-view"><div className="code-head"><span>{activeFile || 'nenhum arquivo'}</span><small>{languageOf(activeFile)}</small></div><pre>{String(files.find(f => f.path === activeFile)?.content || '').split('\n').map((line, i) => <code key={i}><b>{String(i + 1).padStart(3, '0')}</b>{line || ' '}{'\n'}</code>)}</pre></div></div>}</aside>}
      </div></main>
    {plans && <PlanModal current={user?.plan || 'Grátis'} onClose={() => setPlans(false)} />}
  </div>;
}

function languageOf(path = '') { const e = path.split('.').pop()?.toLowerCase(); return ({ js:'JavaScript', jsx:'JSX', ts:'TypeScript', tsx:'TSX', css:'CSS', html:'HTML', json:'JSON', py:'Python' })[e] || 'Text'; }

function CodexIntro({ onDone }) {
  const [scene, setScene] = useState(0); const [typed, setTyped] = useState('');
  const scenes = [
    ['PRISM AI / 01', ['INTELLIGENCE', 'IN MOTION.'], 'Um sistema visual para pensar, construir e revisar.'],
    ['PRISM / CODEX', ['ONE REQUEST.', 'A LIVING WORKSPACE.'], 'Descreva. O Codex planeja, constrói e revisa.'],
    ['BUILD / RUN / REVIEW', ['FROM WORDS', 'TO SOFTWARE.'], 'Arquivos surgem enquanto o projeto permanece visível.'],
    ['PRISM CODEX / 2026', ['WELCOME TO', 'CODEX.'], 'A superfície tranquila para trabalho sério.'],
  ];
  useEffect(() => { const timers = []; [0,1,2,3].forEach((i) => timers.push(setTimeout(() => setScene(i), i === 0 ? 250 : [250, 2250, 4850, 7600][i]))); const t = setTimeout(() => { const text='Create with Prism Codex.'; let i=0; const id=setInterval(() => { setTyped(text.slice(0, ++i)); if(i>=text.length) clearInterval(id); }, 45); timers.push(id); }, 8400); const done=setTimeout(onDone, 11000); timers.push(done); return () => timers.forEach(clearTimeout); }, [onDone]);
  const s = scenes[scene];
  return <div className="codex-intro"><div className="intro-grid"/><div className="intro-scan"/><div className="intro-top"><span>PRISM</span><b>CODEX</b><span>0{scene+1} / 04</span><span>11.0s</span></div><div className="intro-copy"><small>{s[0]}</small><h1><span>{s[1][0]}</span><span>{s[1][1]}</span></h1><p>{s[2]}</p></div><div className={cls('intro-visual', `scene-${scene}`)}>{scene === 0 && <div className="intro-orbit"><div>P</div>{Array.from({length:6},(_,i)=><i key={i} style={{transform:`rotate(${i*60}deg) translateX(180px)`}}/>)}</div>}{scene === 1 && <div className="intro-stack"><article>REQUEST<strong>Describe what you want to build.</strong></article><article>PLAN<strong>Analyze → plan → implement</strong></article><article>WORKSPACE<strong>Files + preview + review</strong></article></div>}{scene === 2 && <div className="intro-editor"><header><span>src/components/Hero.jsx</span><b>LIVE</b></header><pre>{`export default function Hero() {\n  return (\n    <main className="hero">\n      <span>PRISM CODEX</span>\n      <h1>Build without leaving the thought.</h1>\n    </main>\n  );\n}`}</pre></div>}{scene === 3 && <div className="intro-final"><header>PRISM CODEX <span>NEW PROJECT / 001</span></header><p>{typed}<i/></p><footer>DESCRIBE WHAT YOU WANT TO BUILD <b>Prism Taff 2.0 ↗</b></footer></div>}</div><button className="intro-skip" onClick={onDone}>Pular <span>ESC</span></button><div className="intro-progress"><i style={{width:`${((scene+1)/4)*100}%`}}/></div></div>;
}

function SettingsPage() {
  const { user, logout } = useAuth(); const navigate = useNavigate();
  return <Shell><main className="content-page"><span className="eyebrow">PRISM / CONFIGURAÇÕES</span><h1>Seu espaço.</h1><div className="settings-card"><div><span>CONTA</span><strong>{user?.name || 'Usuário'}</strong><p>{user?.email || ''}</p></div><button className="button" onClick={() => { logout(); navigate('/'); }}>Sair da conta</button></div></main></Shell>;
}

export default function PrismSite({ page }) {
  switch (page) {
    case 'landing': return <Landing />;
    case 'login': return <AuthPage />;
    case 'register': return <AuthPage register />;
    case 'chat': return <ChatPage />;
    case 'codex': return <ChatPage codex />;
    case 'info': return <InfoPage />;
    case 'models': return <ModelsPage />;
    case 'model-detail': return <DetailPage type="models" />;
    case 'terms': return <TermsPage />;
    case 'term-detail': return <DetailPage type="terms" />;
    case 'settings': return <SettingsPage />;
    default: return <Landing />;
  }
}
