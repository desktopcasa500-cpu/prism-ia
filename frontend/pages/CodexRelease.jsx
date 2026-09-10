import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import PrismReleaseSidebar from '../components/PrismReleaseSidebar.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import './release-hardened.css';

const MODELS = [
  { id: 'prism-nano-1.0', label: 'Nano 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-mini-1.0', label: 'Mini 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-edge-1.0', label: 'Edge 1.0A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-tex-1.5', label: 'Tex 1.5A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-tex-1.5B', label: 'Tex 1.5B', rank: 2, maturity: 'Em breve', disabled: true },
  { id: 'prism-taff-1.0', label: 'Taff 1.0A', rank: 3, maturity: 'Alfa' },
  { id: 'prism-taff-2.0', label: 'Taff 2.0', rank: 3, maturity: 'Release' },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const STARTER = [
  { path: 'index.html', content: '<!doctype html>\n<html lang="pt-BR">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>Prism Project</title>\n</head>\n<body>\n  <main id="app">Comece a construir.</main>\n</body>\n</html>\n', kind: 'file' },
  { path: 'style.css', content: 'body{font-family:system-ui,sans-serif;margin:0;padding:40px}#app{max-width:720px;margin:auto}', kind: 'file' },
  { path: 'script.js', content: "document.querySelector('#app').dataset.ready='true';\n", kind: 'file' },
];
function rankOf(plan) { return PLAN_RANK[plan] ?? 0; }
function ext(path) { return String(path || '').split('.').pop()?.toLowerCase() || 'txt'; }
function language(path) { return ({ html: 'HTML', htm: 'HTML', css: 'CSS', js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', json: 'JSON', md: 'Markdown' })[ext(path)] || ext(path).toUpperCase(); }

export default function CodexRelease() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [files, setFiles] = useState(STARTER);
  const [selectedPath, setSelectedPath] = useState('index.html');
  const [input, setInput] = useState('');
  const [model, setModel] = useState('prism-mini-1.0');
  const [mode, setMode] = useState('vibe');
  const [tab, setTab] = useState('code');
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState(null);
  const [error, setError] = useState('');
  const [plansOpen, setPlansOpen] = useState(false);
  const [requestedModel, setRequestedModel] = useState('');
  const [openModel, setOpenModel] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [usage, setUsage] = useState(null);
  const [controller, setController] = useState(null);
  const lockRef = useRef(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const rank = rankOf(user?.plan);
  const selectedModel = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const selectedFile = files.find((file) => file.path === selectedPath) || files[0];

  const authFail = useCallback((e) => {
    if (e?.status !== 401) return false;
    logout(); navigate('/login', { replace: true }); return true;
  }, [logout, navigate]);

  const refreshUsage = useCallback(async () => {
    try { setUsage(await api.get('/chat/usage')); } catch (e) { if (!authFail(e)) console.warn(e); }
  }, [authFail]);

  const loadProject = useCallback(async () => {
    try {
      const result = await api.get('/projects');
      let project = result.projects?.[0];
      if (!project) project = (await api.post('/projects', { name: 'Novo projeto' })).project;
      const detail = await api.get(`/projects/${encodeURIComponent(project.id)}`);
      const nextFiles = detail.files?.length ? detail.files : STARTER;
      if (!detail.files?.length) for (const file of STARTER) await api.post('/files', { projectId: project.id, path: file.path, content: file.content, kind: file.kind });
      setProjectId(project.id); setProjectName(project.name || 'Novo projeto'); setFiles(nextFiles); setSelectedPath(nextFiles[0]?.path || 'index.html');
    } catch (e) { if (!authFail(e)) setError(e.message || 'Não foi possível carregar o projeto.'); }
  }, [authFail]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setSessionId(id);
    try { const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages?surface=codex`); setMessages(result.messages || []); }
    catch (e) { if (!authFail(e)) setError(e.message || 'Não foi possível carregar a sessão.'); }
  }, [authFail]);

  useEffect(() => {
    (async () => {
      try { const result = await api.get('/chat/sessions?surface=codex'); setSessions(result.sessions || []); if (result.sessions?.[0]) await loadSession(result.sessions[0].id); await loadProject(); }
      catch (e) { if (!authFail(e)) setError(e.message || 'Não foi possível carregar o Codex.'); }
    })();
    refreshUsage();
  }, [authFail, loadProject, loadSession, refreshUsage]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, phase, sending]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(180, textareaRef.current.scrollHeight)}px`; } }, [input]);

  async function newSession() {
    if (sending) return;
    try { const result = await api.post('/chat/sessions', { surface: 'codex', title: 'Nova conversa' }); setSessions((list) => [result.session, ...list]); setSessionId(result.session.id); setMessages([]); setInput(''); }
    catch (e) { if (!authFail(e)) setError(e.message || 'Não foi possível criar a sessão.'); }
  }

  function chooseModel(id) {
    const item = MODELS.find((entry) => entry.id === id);
    if (!item || item.disabled) return;
    if (rank < item.rank) { setRequestedModel(item.label); setPlansOpen(true); setOpenModel(false); return; }
    setModel(id); setOpenModel(false);
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || sending || lockRef.current) return;
    lockRef.current = true; setSending(true); setError('');
    const abort = new AbortController(); setController(abort);
    let sid = sessionId;
    const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      if (!sid) { const created = await api.post('/chat/sessions', { surface: 'codex', title: prompt.slice(0, 64) }); sid = created.session.id; setSessionId(sid); setSessions((list) => [created.session, ...list]); }
      const local = { id: localId, role: 'user', content: prompt, model_id: model, created_at: new Date().toISOString() };
      setMessages((list) => [...list, local]); setInput('');
      if (mode === 'chat') {
        setPhase({ label: 'Respondendo', detail: 'Analisando o pedido' });
        const result = await api.post(`/chat/sessions/${encodeURIComponent(sid)}/messages`, { content: prompt, model, effort: 'high', clientRequestId: localId }, { timeout: 180000, signal: abort.signal });
        if (result.message) setMessages((list) => [...list.filter((item) => item.id !== localId), result.userMessage || local, result.message]);
        if (result.usage) setUsage(result.usage);
      } else {
        setPhase({ label: 'Planejando...', detail: 'Entendendo o objetivo' });
        await new Promise((resolve) => setTimeout(resolve, 120));
        setPhase({ label: 'Criando arquivos...', detail: 'Aplicando alterações no projeto' });
        const result = await api.streamPost('/ai/generate/stream', { model, thinking: 'high', prompt, context: messages.slice(-12).map((item) => `${item.role}: ${item.content}`).join('\n'), projectId, sessionId: sid, mcpServerIds: [] }, (event) => {
          if (event.type === 'phase') setPhase({ label: event.label || 'Trabalhando...', detail: event.detail || '' });
          if (event.type === 'artifact' && event.path) setFiles((current) => current.some((file) => file.path === event.path) ? current.map((file) => file.path === event.path ? { ...file, content: String(event.content || '') } : file) : [...current, { path: event.path, content: String(event.content || ''), kind: 'file' }]);
        }, { timeout: 240000, signal: abort.signal });
        setPhase({ label: 'Testando...', detail: 'Verificando o resultado' });
        await loadProject();
        setPhase({ label: 'Otimizando...', detail: 'Conferindo arquivos e preview' });
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (result?.message) setMessages((list) => [...list.filter((item) => item.id !== localId), local, result.message]);
        setPhase({ label: 'Concluído', detail: 'Projeto atualizado' });
      }
    } catch (e) {
      if (e?.name !== 'AbortError') { if (!authFail(e)) setError(e.message || 'Não foi possível concluir a tarefa.'); setPhase({ label: 'Falha', detail: e.message || 'A tarefa não foi concluída.' }); }
      setMessages((list) => list.filter((item) => item.id !== localId));
    } finally { setSending(false); setController(null); lockRef.current = false; refreshUsage(); }
  }

  const previewHtml = useMemo(() => {
    const htmlFile = files.find((file) => /\.html?$/i.test(file.path));
    if (!htmlFile) return '<!doctype html><html><body style="font-family:system-ui;padding:40px"><p>Nenhum arquivo HTML foi gerado ainda.</p></body></html>';
    let html = String(htmlFile.content || '');
    if (!/<html[\s>]/i.test(html)) html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
    const css = files.filter((file) => /\.css$/i.test(file.path)).map((file) => String(file.content || '')).join('\n');
    const js = files.filter((file) => /\.js$/i.test(file.path) && !/node_modules/i.test(file.path)).map((file) => String(file.content || '')).join('\n').replace(/<\/script/gi, '<\\/script');
    html = html.replace(/<\/head>/i, `${css ? `<style>${css}</style>` : ''}</head>`);
    html = html.replace(/<\/body>/i, `${js ? `<script>${js}</script>` : ''}</body>`);
    return html;
  }, [files]);

  async function downloadZip() {
    if (!projectId) return;
    try {
      const token = localStorage.getItem('prism_token') || '';
      const response = await fetch(`${api.baseUrl || '/api'}/projects/${encodeURIComponent(projectId)}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Não foi possível preparar o ZIP.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${projectName.replace(/[^a-z0-9._-]+/gi, '-') || 'prism-project'}.zip`; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.message || 'Não foi possível baixar o projeto.'); }
  }

  return <div className={`prism-release-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <PrismReleaseSidebar mode="codex" sessions={sessions} activeId={sessionId} onNew={newSession} onOpen={loadSession} onMode={(next) => next === 'home' ? navigate('/chat') : navigate('/codex')} onHome={() => navigate('/chat')} onCodex={() => navigate('/codex')} onProjects={() => navigate('/studio')} onArtifacts={() => setTab('code')} onSettings={() => navigate('/configuracoes')} onProfile={() => navigate('/configuracoes')} usage={usage} user={user} collapsed={collapsed} onCollapse={setCollapsed} mobileOpen={mobileOpen} onMobileOpen={setMobileOpen} />
    <main className="prism-workspace">
      <header className="prism-chat-topbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><button className="prism-sidebar-mobile-toggle" style={{ display: 'inline-grid' }} onClick={() => setMobileOpen(true)}>☰</button><h1>{mode === 'vibe' ? 'Vibe Coding' : 'Codex'} · {projectName}</h1></div><div className="prism-model-menu-wrap"><button className="prism-model-trigger" onClick={() => setOpenModel((value) => !value)}>Prism {selectedModel.label} · {selectedModel.maturity}⌄</button>{openModel && <div className="prism-model-menu">{MODELS.map((item) => <button key={item.id} className={item.id === model ? 'active' : ''} onClick={() => chooseModel(item.id)} disabled={item.disabled}><span><strong>Prism {item.label}</strong><small>{item.maturity}</small></span><b>{item.disabled ? 'Em breve' : rank < item.rank ? 'Upgrade' : item.id === model ? 'Atual' : ''}</b></button>)}</div>}</div></header>
      <div className="prism-workspace__body">
        <section className="prism-workspace__conversation">
          <div className="prism-chat-scroll">
            {error && <div className="prism-status error" role="alert">{error}</div>}
            {phase && <div className="prism-status"><strong>{phase.label}</strong>{phase.detail ? ` · ${phase.detail}` : ''}</div>}
            {messages.map((message) => <article className={`prism-message ${message.role}`} key={message.id}><div className="prism-message__author"><strong>{message.role === 'user' ? user?.name || 'Você' : 'Prism IA'}</strong></div><div className="prism-message__body">{message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} /> : <p>{message.content}</p>}</div></article>)}
            {sending && <div className="prism-progress"><div className="prism-progress__track"><div className="prism-progress__fill" style={{ width: phase?.label === 'Planejando...' ? '18%' : phase?.label === 'Criando arquivos...' ? '48%' : phase?.label === 'Testando...' ? '72%' : phase?.label === 'Otimizando...' ? '88%' : phase?.label === 'Concluído' ? '100%' : '12%' }} /></div><div className="prism-progress__label">{phase?.label || 'Trabalhando...'}</div></div>}
            <div ref={bottomRef} />
          </div>
          <footer className="prism-composer-wrap"><div className="prism-composer"><textarea ref={textareaRef} rows={1} value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={mode === 'vibe' ? 'Descreva o que o projeto deve fazer' : 'Escreva uma mensagem'} /><div className="prism-composer__row"><span className="prism-composer__hint">Vibe Coding · {mode === 'vibe' ? 'gera e testa arquivos' : 'conversa normal'}</span>{sending ? <button className="prism-cancel" onClick={() => controller?.abort()}>Cancelar</button> : <button className="prism-send" onClick={send} disabled={!input.trim()}>Enviar</button>}</div></div></footer>
        </section>
        <aside className="prism-file-panel">
          <div className="prism-file-panel__tabs"><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>Código</button><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button><button onClick={downloadZip}>Baixar ZIP</button></div>
          <div className="prism-file-tree">{files.map((file) => <button className={file.path === selectedPath ? 'active' : ''} key={file.path} onClick={() => { setSelectedPath(file.path); setTab('code'); }}>{file.path}</button>)}</div>
          {tab === 'code' ? <div className="prism-editor"><div style={{ padding: '10px 12px', color: '#867d74', borderBottom: '1px solid var(--prism-border)', fontSize: 11 }}>{language(selectedFile.path)} · {selectedFile.path}</div><pre>{selectedFile.content}</pre></div> : <div className="prism-preview"><iframe title="Preview do projeto Prism" sandbox="allow-scripts" srcDoc={previewHtml} /></div>}
        </aside>
      </div>
    </main>
    <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
  </div>;
}
