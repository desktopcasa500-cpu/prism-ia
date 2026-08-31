import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import PrismCodexIntro, { INTRO_KEY } from '../components/PrismCodexIntro.jsx';
import './codex-rebuilt.css';

const MODELS = [
  { id: 'prism-nano-1.0', label: 'Prism Nano 1.0', note: 'Rápido e econômico' },
  { id: 'prism-mini-1.0', label: 'Prism Mini 1.0', note: 'Uso geral' },
  { id: 'prism-tex-1.5', label: 'Prism Tex 1.5', note: 'Código e arquitetura' },
  { id: 'prism-taff-1.0', label: 'Prism Taff 1.0', note: 'Projetos complexos' },
  { id: 'prism-taff-2.0', label: 'Prism Taff 2.0', note: 'Orquestração máxima' },
];

const PHASES = [
  ['received', 'Recebido'],
  ['analyzing', 'Analisando'],
  ['planning', 'Planejando'],
  ['writing', 'Escrevendo'],
  ['reviewing', 'Revisando'],
  ['updating', 'Atualizando'],
  ['completed', 'Concluído'],
];

const STARTER = [
  {
    path: 'src/App.jsx',
    kind: 'file',
    content: `export default function App() {\n  return <main>Comece a construir.</main>;\n}\n`,
  },
  { path: 'src/index.css', kind: 'file', content: '' },
  { path: 'package.json', kind: 'file', content: '{\n  "name": "prism-project"\n}\n' },
];

const BUILD_WORDS = /\b(site|website|webapp|web app|jogo|game|app|aplicativo|api|sistema|script|scripts|c[oó]digo|code|componente|p[aá]gina|landing|projeto|arquivo|arquivos|download|baixar|npm|react|three\.js|python|godot|unity|html|css|javascript|typescript|criar|construir|implementar|programar|bug|debug|corrigir|refatorar)\b/i;

function language(path = '') {
  const extension = path.split('.').pop()?.toLowerCase();
  return ({
    js: 'JavaScript',
    jsx: 'JSX',
    ts: 'TypeScript',
    tsx: 'TSX',
    css: 'CSS',
    html: 'HTML',
    json: 'JSON',
    py: 'Python',
    md: 'Markdown',
  })[extension] || 'Text';
}

function buildPreview(files) {
  const realFiles = files.filter((file) => file.kind !== 'folder');
  const htmlFile = realFiles.find((file) => /(^|\/)index\.html$/i.test(file.path)) || realFiles.find((file) => /\.html$/i.test(file.path));
  const css = realFiles.filter((file) => /\.css$/i.test(file.path)).map((file) => file.content || '').join('\n');

  if (htmlFile) {
    const source = htmlFile.content || '';
    return css && !/<style[\s>]/i.test(source)
      ? source.replace('</head>', `<style>${css}</style></head>`)
      : source;
  }

  const jsxFile = realFiles.find((file) => /\.(jsx|tsx)$/i.test(file.path));
  if (!jsxFile) return '<!doctype html><html><body><main style="font-family:system-ui;padding:40px">Nenhuma prévia disponível.</main></body></html>';

  const safe = String(jsxFile.content || '')
    .replace(/import[\s\S]*?;\s*/g, '')
    .replace(/export default /g, '')
    .replace(/<\/script/gi, '<\\/script');

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>${css}</style></head><body><div id="root"></div><script type="text/babel">${safe}\nReactDOM.createRoot(document.getElementById('root')).render(typeof App !== 'undefined' ? React.createElement(App) : React.createElement('div',null,'Preview indisponível'));</script></body></html>`;
}

function formatTime(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function PhaseRail({ activePhase, events }) {
  const activeIndex = Math.max(0, PHASES.findIndex(([id]) => id === activePhase));
  return (
    <div className="pcx-phase-rail">
      {PHASES.map(([id, label], index) => {
        const event = events.find((item) => item.phase === id);
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : '';
        return (
          <div className={`pcx-phase ${state}`} key={id}>
            <span>{index < activeIndex ? '✓' : index === activeIndex ? '·' : '○'}</span>
            <div><strong>{label}</strong>{event?.detail ? <small>{event.detail}</small> : null}</div>
          </div>
        );
      })}
    </div>
  );
}

function FileTree({ files, activeFile, query, onSelect }) {
  const visible = files.filter((file) => file.kind !== 'folder' && (!query || file.path.toLowerCase().includes(query.toLowerCase())));
  return (
    <div className="pcx-tree">
      <div className="pcx-tree-title">ARQUIVOS <span>{visible.length}</span></div>
      <input value={query} onChange={(event) => onSelect('__search__', event.target.value)} placeholder="Filtrar arquivos" aria-label="Filtrar arquivos" />
      <div className="pcx-tree-list">
        {visible.map((file) => (
          <button key={file.path} className={file.path === activeFile ? 'active' : ''} onClick={() => onSelect(file.path)} title={file.path}>
            <span className="pcx-file-dot" />{file.path}
          </button>
        ))}
        {!visible.length && <small className="pcx-tree-empty">Nenhum arquivo encontrado.</small>}
      </div>
    </div>
  );
}

export default function Codex() {
  const [showIntro, setShowIntro] = useState(() => localStorage.getItem(INTRO_KEY) !== '1');
  const [mode, setMode] = useState('chat');
  const [model, setModel] = useState('prism-mini-1.0');
  const [effort, setEffort] = useState('medium');
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('');
  const [phaseEvents, setPhaseEvents] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [showPlans, setShowPlans] = useState(false);
  const [files, setFiles] = useState(STARTER);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [activeFile, setActiveFile] = useState(STARTER[0].path);
  const [workspaceTab, setWorkspaceTab] = useState('preview');
  const [fileQuery, setFileQuery] = useState('');
  const [code, setCode] = useState(STARTER[0].content);
  const [nearBottom, setNearBottom] = useState(true);

  const chatRef = useRef(null);
  const startedAt = useRef(0);
  const abortRef = useRef(null);
  const generatedTimers = useRef(new Set());

  const selectedModel = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const preview = useMemo(() => buildPreview(files), [files]);
  const lineCount = useMemo(() => Math.max(1, code.split('\n').length), [code]);

  const finishIntro = useCallback(() => {
    localStorage.setItem(INTRO_KEY, '1');
    setShowIntro(false);
  }, []);

  const replayIntro = useCallback(() => {
    localStorage.removeItem(INTRO_KEY);
    setShowIntro(true);
  }, []);

  const loadProject = useCallback(async () => {
    const data = await api.get('/projects');
    let project = data.projects?.[0];
    if (!project) {
      const created = await api.post('/projects', { name: 'Novo projeto' });
      project = created.project;
      await Promise.all(STARTER.map((file) => api.post('/files', { projectId: project.id, path: file.path, content: file.content, kind: 'file' })));
    }
    const detail = await api.get(`/projects/${project.id}`);
    const loaded = detail.files?.length ? detail.files.map((file) => ({ ...file, kind: file.kind || 'file' })) : STARTER;
    const first = loaded.find((file) => file.kind !== 'folder') || STARTER[0];
    setProjectId(project.id);
    setProjectName(project.name || 'Novo projeto');
    setFiles(loaded);
    setActiveFile(first.path);
    setCode(first.content || '');
  }, []);

  const loadSessions = useCallback(async () => {
    const data = await api.get('/chat/sessions');
    setSessions(data.sessions || []);
  }, []);

  const openSession = useCallback(async (id) => {
    setSessionId(id);
    setMode('chat');
    setError('');
    const data = await api.get(`/chat/sessions/${id}/messages`);
    setMessages((data.messages || []).map((item) => ({ id: item.id, role: item.role, text: item.content, tokens: item.tokens_used })));
  }, []);

  const createChat = useCallback(async () => {
    const created = await api.post('/chat/sessions', { title: 'Nova conversa' });
    setSessions((items) => [created.session, ...items]);
    setSessionId(created.session.id);
    setMessages([]);
    setMode('chat');
    setError('');
  }, []);

  useEffect(() => {
    Promise.all([loadProject(), loadSessions()]).catch((cause) => setError(cause?.message || 'Não foi possível carregar o Codex.'));
    return () => generatedTimers.current.forEach((timer) => clearInterval(timer));
  }, [loadProject, loadSessions]);

  useEffect(() => {
    if (!sessionId && sessions[0]) openSession(sessions[0].id).catch(() => {});
  }, [openSession, sessionId, sessions]);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt.current), 100);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    if (nearBottom) chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [loading, messages, nearBottom]);

  const handleScroll = () => {
    const node = chatRef.current;
    if (!node) return;
    setNearBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 100);
  };

  const sendChat = useCallback(async (value) => {
    let sid = sessionId;
    if (!sid) {
      const created = await api.post('/chat/sessions', { title: value.slice(0, 64) });
      sid = created.session.id;
      setSessionId(sid);
      setSessions((items) => [created.session, ...items]);
    }

    setMessages((items) => [...items, { id: `user-${Date.now()}`, role: 'user', text: value }]);
    setPrompt('');
    setLoading(true);
    setError('');
    try {
      const result = await api.post(`/chat/sessions/${sid}/messages`, { content: value, model, effort }, { timeout: 90_000 });
      setMessages((items) => [...items, {
        id: result.message?.id || `assistant-${Date.now()}`,
        role: 'assistant',
        text: result.message?.content || '',
        tokens: result.message?.tokens_used,
        providers: result.providers_used || [],
      }]);
    } catch (cause) {
      setError(cause?.message || 'A resposta falhou.');
    } finally {
      setLoading(false);
    }
  }, [effort, model, sessionId]);

  const sendVibe = useCallback(async (value) => {
    if (!projectId) {
      setError('O workspace ainda está carregando.');
      return;
    }

    setMessages((items) => [...items, { id: `user-${Date.now()}`, role: 'user', text: value }]);
    setPrompt('');
    setLoading(true);
    setMode('vibe');
    setPhase('received');
    setPhaseEvents([{ phase: 'received', detail: 'Preparando o agente' }]);
    setError('');
    startedAt.current = Date.now();
    setElapsed(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await api.streamPost('/ai/generate/stream', {
        model,
        thinking: effort === 'max' ? 'ultracode' : effort,
        prompt: value,
        context: messages.slice(-12).map((item) => `${item.role}: ${item.text}`).join('\n'),
        projectId,
      }, (event) => {
        if (event.type === 'phase') {
          setPhase(event.phase);
          setPhaseEvents((items) => [...items.filter((item) => item.phase !== event.phase), event]);
        }
        if (event.type === 'artifact') {
          const full = String(event.content || '');
          setWorkspaceTab('code');
          setActiveFile(event.path);
          setFiles((items) => items.some((item) => item.path === event.path)
            ? items.map((item) => item.path === event.path ? { ...item, content: full, kind: 'file' } : item)
            : [...items, { path: event.path, content: full, kind: 'file' }]);

          let cursor = 0;
          const timer = window.setInterval(() => {
            cursor = Math.min(full.length, cursor + Math.max(28, Math.ceil(full.length / 60)));
            setCode(full.slice(0, cursor));
            if (cursor >= full.length) {
              clearInterval(timer);
              generatedTimers.current.delete(timer);
            }
          }, 18);
          generatedTimers.current.add(timer);
        }
      }, { timeout: 180_000, signal: controller.signal });

      await loadProject();
      setMessages((items) => [...items, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: result.text || 'Alterações aplicadas ao projeto.',
        files: [...(result.files_created || []), ...(result.files_changed || [])],
        tools: (result.tools_used || []).filter((item) => item?.tool),
      }]);
    } catch (cause) {
      if (cause?.name !== 'AbortError') setError(cause?.message || 'O agente não conseguiu concluir a tarefa.');
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [effort, loadProject, messages, model, projectId]);

  const submitPrompt = () => {
    const value = prompt.trim();
    if (!value || loading) return;
    if (mode === 'vibe' || BUILD_WORDS.test(value)) sendVibe(value);
    else sendChat(value);
  };

  const selectFile = (path, optionalQuery) => {
    if (path === '__search__') {
      setFileQuery(optionalQuery || '');
      return;
    }
    const file = files.find((item) => item.path === path);
    if (!file || file.kind === 'folder') return;
    setActiveFile(path);
    setCode(file.content || '');
    setWorkspaceTab('code');
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className={`pcx-root ${mode === 'vibe' ? 'is-building' : ''}`}>
      {showIntro ? <PrismCodexIntro onComplete={finishIntro} /> : null}

      <aside className="pcx-sidebar">
        <div className="pcx-brand-row">
          <button className="pcx-brand" onClick={() => setMode('chat')} aria-label="Prism Codex">
            <span className="pcx-brand-mark">P</span>
            <span><strong>Prism</strong><small>Codex</small></span>
          </button>
          <span className="pcx-status-dot" title="Codex online" />
        </div>

        <button className="pcx-new" onClick={createChat}><span>+</span>Novo chat</button>

        <nav className="pcx-nav" aria-label="Navegação do Codex">
          <button className={mode === 'chat' ? 'active' : ''} onClick={() => setMode('chat')}><span>Chat</span><small>conversa</small></button>
          <button className={mode === 'vibe' ? 'active' : ''} onClick={() => setMode('vibe')}><span>Vibe Code</span><small>construir</small></button>
          <button onClick={() => setShowPlans(true)}><span>Planos</span><small>créditos</small></button>
        </nav>

        <div className="pcx-history">
          <div className="pcx-history-head"><span>Conversas</span><button onClick={createChat}>+</button></div>
          <div className="pcx-history-list">
            {sessions.length === 0 ? <span className="pcx-muted">Nenhuma conversa ainda.</span> : sessions.map((session) => (
              <button key={session.id} className={sessionId === session.id ? 'selected' : ''} onClick={() => openSession(session.id)}>{session.title || 'Nova conversa'}</button>
            ))}
          </div>
        </div>

        <div className="pcx-sidebar-foot">
          <button onClick={replayIntro} className="pcx-replay"><span>01</span>Reproduzir apresentação</button>
          <button className="pcx-plan-button" onClick={() => setShowPlans(true)}><span><small>PLANO</small><strong>Grátis</strong></span><em>↗</em></button>
        </div>
      </aside>

      <main className="pcx-main">
        <header className="pcx-header">
          <div className="pcx-header-left">
            <span className="pcx-kicker">PRISM / CODEX</span>
            <span className="pcx-separator">/</span>
            <strong>{mode === 'vibe' ? 'Vibe Code' : 'Chat'}</strong>
          </div>
          <div className="pcx-header-right">
            <label className="pcx-control"><span>MODELO</span><select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="pcx-control"><span>PENSAMENTO</span><select value={effort} onChange={(event) => setEffort(event.target.value)}><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option><option value="max">MAX</option></select></label>
            {mode === 'vibe' ? <button className="pcx-header-action" onClick={() => setMode('chat')}>Voltar ao chat</button> : null}
          </div>
        </header>

        <div className="pcx-content">
          <section className="pcx-chat-panel">
            <div className="pcx-chat-scroll" ref={chatRef} onScroll={handleScroll}>
              {messages.length === 0 ? (
                <div className="pcx-welcome">
                  <div className="pcx-welcome-eyebrow"><span className="pcx-welcome-mark">P</span><span>PRISM CODEX / 001</span></div>
                  <div className="pcx-welcome-title"><span>O que</span><span>vamos</span><em>construir?</em></div>
                  <p>Converse normalmente. Quando a tarefa pede software, arquivos ou uma implementação, o Codex transforma a intenção em um workspace vivo.</p>
                  <div className="pcx-suggestions">
                    <button onClick={() => setPrompt('Crie uma landing page premium para o Prism IA')}>Criar uma landing page</button>
                    <button onClick={() => setPrompt('Analise meu projeto e encontre os bugs mais importantes')}>Analisar um projeto</button>
                    <button onClick={() => setPrompt('Refatore esta interface para ficar mais consistente e responsiva')}>Refatorar interface</button>
                  </div>
                </div>
              ) : null}

              {messages.map((message) => (
                <article className={`pcx-message ${message.role}`} key={message.id}>
                  <div className="pcx-message-meta"><span>{message.role === 'user' ? 'VOCÊ' : 'PRISM CODEX'}</span>{message.role !== 'user' && message.tokens ? <small>{message.tokens} tokens</small> : null}</div>
                  <div className="pcx-message-text">{message.text}</div>
                  {message.files?.length ? <div className="pcx-message-files">{message.files.map((file) => <button key={file} onClick={() => selectFile(file)}>{file}</button>)}</div> : null}
                  {message.providers?.length ? <div className="pcx-message-foot">{message.providers.join(' · ')}</div> : null}
                  {message.tools?.length ? <div className="pcx-message-foot">MCP · {message.tools.map((item) => item.tool).join(' · ')}</div> : null}
                </article>
              ))}

              {loading ? (
                <article className="pcx-message assistant pcx-live-message">
                  <div className="pcx-message-meta"><span>PRISM CODEX · AGENTE</span><small>{formatTime(elapsed)}</small></div>
                  {mode === 'vibe' ? (
                    <div className="pcx-live-panel">
                      <div className="pcx-live-heading"><strong>{PHASES.find(([id]) => id === phase)?.[1] || 'Trabalhando'}</strong><span>{selectedModel.note}</span></div>
                      <PhaseRail activePhase={phase} events={phaseEvents} />
                    </div>
                  ) : (
                    <div className="pcx-typing"><i /><i /><i /></div>
                  )}
                </article>
              ) : null}

              {error ? <div className="pcx-error"><strong>Não foi possível concluir</strong><span>{error}</span><button onClick={() => setError('')}>Fechar</button></div> : null}
            </div>

            {!nearBottom && <button className="pcx-jump" onClick={() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })}>↓ fim</button>}

            <div className="pcx-composer-wrap">
              <div className={`pcx-composer ${loading ? 'is-busy' : ''}`}>
                <div className="pcx-composer-head"><span>{mode === 'vibe' ? 'VIBE CODE / BUILD' : 'PRISM CODEX'}</span><small>{selectedModel.label}</small></div>
                <textarea value={prompt} rows={1} placeholder={mode === 'vibe' ? 'Descreva o que você quer construir...' : 'Pergunte qualquer coisa ou descreva o que deseja construir...'} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitPrompt(); } }} />
                <div className="pcx-composer-bar">
                  <span>ENTER para enviar · SHIFT + ENTER para quebrar linha</span>
                  <div>{loading ? <button className="pcx-stop" onClick={stop}>Parar</button> : <button className="pcx-send" disabled={!prompt.trim()} onClick={submitPrompt}>Enviar ↗</button>}</div>
                </div>
              </div>
              <span className="pcx-composer-note">O Codex pode errar. Revise o código e o resultado antes de publicar.</span>
            </div>
          </section>

          {mode === 'vibe' ? (
            <aside className="pcx-workspace">
              <header className="pcx-workspace-top">
                <div><span>WORKSPACE</span><strong>{projectName}</strong></div>
                <div className="pcx-workspace-tabs"><button className={workspaceTab === 'preview' ? 'active' : ''} onClick={() => setWorkspaceTab('preview')}>Preview</button><button className={workspaceTab === 'code' ? 'active' : ''} onClick={() => setWorkspaceTab('code')}>Code</button></div>
              </header>
              {workspaceTab === 'preview' ? (
                <div className="pcx-preview-shell"><div className="pcx-browserbar"><span /><span /><span /><strong>{projectName}</strong><small>LOCAL / PREVIEW</small></div><iframe title="Prévia do projeto" className="pcx-preview" sandbox="allow-scripts" srcDoc={preview} /></div>
              ) : (
                <div className="pcx-editor">
                  <FileTree files={files} activeFile={activeFile} query={fileQuery} onSelect={selectFile} />
                  <div className="pcx-code">
                    <header className="pcx-code-head"><span>{activeFile}</span><div><small>{language(activeFile)}</small><small>{lineCount} linhas</small></div></header>
                    <pre>{code.split('\n').map((line, index) => <div key={`${index}-${line}`}><span>{String(index + 1).padStart(3, '0')}</span><code>{line || ' '}</code></div>)}</pre>
                  </div>
                </div>
              )}
            </aside>
          ) : null}
        </div>
      </main>

      {showPlans ? (
        <div className="pcx-modal-backdrop" role="dialog" aria-modal="true" aria-label="Planos" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlans(false); }}>
          <div className="pcx-plans">
            <header><div><span>PRISM CODEX / ACESSO</span><h2>Escolha o ritmo.</h2></div><button onClick={() => setShowPlans(false)}>Fechar</button></header>
            <div className="pcx-plan-grid">
              {[
                ['Grátis', 'R$0', '5 créditos/dia', 'Mini / Nano'],
                ['Base', 'R$8', '30 créditos/dia', 'Mini / Nano / Edge'],
                ['Medium', 'R$30', '700 créditos/dia', 'Mini / Nano / Edge / Tex'],
                ['Pro', 'R$90', '2.000 créditos/dia', 'Tex / Taff'],
                ['Empresarial', 'R$140', '6.000 créditos/dia', 'Todos os modelos'],
              ].map(([name, price, credits, access], index) => (
                <article className={index === 0 ? 'current' : ''} key={name}><div><strong>{name}</strong><span>{price}</span></div><p>{credits}</p><small>{access}</small><button>{index === 0 ? 'Plano atual' : 'Escolher'}</button></article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
