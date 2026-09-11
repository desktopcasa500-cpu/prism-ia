import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import MarkdownMessage from '../components/MarkdownMessage.jsx';
import PrismReleaseSidebar from '../components/PrismReleaseSidebar.jsx';
import FileAttachments from '../components/FileAttachments.jsx';
import ThinkingSelector from '../components/ThinkingSelector.jsx';
import PlanPanel from '../components/PlanPanel.jsx';
import '../release-hardened.css';

const MODELS = [
  { id: 'prism-nano-1.0', label: 'Nano 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-mini-1.0', label: 'Mini 1.0A', rank: 0, maturity: 'Alfa' },
  { id: 'prism-edge-1.0', label: 'Edge 1.0A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-tex-1.5', label: 'Tex 1.5A', rank: 2, maturity: 'Alfa' },
  { id: 'prism-taff-1.0', label: 'Taff 1.0A', rank: 3, maturity: 'Alfa' },
  { id: 'prism-taff-2.0', label: 'Taff 2.0', rank: 3, maturity: 'Release' },
];
const PLAN_RANK = { 'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };
const MODEL_STORAGE = 'prism.codex.model';
const STARTER = [
  { path: 'index.html', kind: 'file', content: '<!doctype html>\n<html lang="pt-BR">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Project</title></head>\n<body><main id="app">Comece a construir.</main></body>\n</html>\n' },
  { path: 'style.css', kind: 'file', content: 'body{font-family:system-ui,sans-serif;margin:0;padding:40px}#app{max-width:720px;margin:auto}' },
  { path: 'script.js', kind: 'file', content: "document.querySelector('#app')?.setAttribute('data-ready','true');\n" },
];
function rankOf(plan) { return PLAN_RANK[plan] ?? 0; }
function parseMeta(message) { if (!message?.metadata) return {}; if (typeof message.metadata === 'object') return message.metadata; try { return JSON.parse(message.metadata); } catch { return {}; } }
function requestId() { try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random()}`; } }
function ext(path) { return String(path || '').split('.').pop()?.toLowerCase() || 'txt'; }
function language(path) { return ({ html: 'HTML', htm: 'HTML', css: 'CSS', js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX', json: 'JSON', md: 'Markdown' })[ext(path)] || ext(path).toUpperCase(); }
function normalizePath(path) { return String(path || '').replace(/^\.\//, '').replace(/^\//, '').replace(/\\/g, '/'); }
function localFile(files, reference) {
  const clean = normalizePath(String(reference || '').split('#')[0].split('?')[0]);
  if (!clean || clean.startsWith('http:') || clean.startsWith('https:') || clean.startsWith('data:') || clean.startsWith('blob:') || clean.startsWith('//')) return null;
  return files.find((file) => normalizePath(file.path) === clean) || files.find((file) => normalizePath(file.path) === clean.replace(/^\.\.\//, '')) || null;
}
function escapeForInlineScript(content) { return String(content || '').replace(/<\/script/gi, '<\\/script'); }

export default function CodexRelease() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const rank = rankOf(user?.plan);
  const [sessions, setSessions] = useState([]); const [sessionId, setSessionId] = useState(null); const [messages, setMessages] = useState([]);
  const [projectId, setProjectId] = useState(null); const [projectName, setProjectName] = useState('Novo projeto'); const [files, setFiles] = useState(STARTER); const [selectedPath, setSelectedPath] = useState('index.html');
  const [input, setInput] = useState(''); const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) || 'prism-mini-1.0'); const [effort, setEffort] = useState('medium');
  const [modelOpen, setModelOpen] = useState(false); const [tab, setTab] = useState('preview'); const [sending, setSending] = useState(false); const [phase, setPhase] = useState(null); const [error, setError] = useState('');
  const [plansOpen, setPlansOpen] = useState(false); const [requestedModel, setRequestedModel] = useState(''); const [usage, setUsage] = useState(null); const [attachments, setAttachments] = useState([]); const [uploading, setUploading] = useState(false); const [collapsed, setCollapsed] = useState(false); const [mobileOpen, setMobileOpen] = useState(false);
  const controllerRef = useRef(null); const bottomRef = useRef(null); const textareaRef = useRef(null); const previewFrameRef = useRef(null);
  const selectedModel = useMemo(() => MODELS.find((item) => item.id === model) || MODELS[1], [model]);
  const selectedFile = files.find((file) => file.path === selectedPath) || files[0];
  const canSend = Boolean(input.trim() || attachments.length) && !sending && !uploading;

  useEffect(() => { localStorage.setItem(MODEL_STORAGE, model); }, [model]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, sending, phase]);
  useEffect(() => { if (!textareaRef.current) return; textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(190, textareaRef.current.scrollHeight)}px`; }, [input]);

  const authFail = useCallback((cause) => { if (cause?.status !== 401) return false; logout(); navigate('/login', { replace: true }); return true; }, [logout, navigate]);
  const refreshUsage = useCallback(async () => { try { setUsage(await api.get('/chat/usage')); } catch (cause) { if (!authFail(cause)) console.warn(cause); } }, [authFail]);

  const loadProject = useCallback(async () => {
    try {
      const result = await api.get('/projects');
      let project = result.projects?.[0];
      if (!project) project = (await api.post('/projects', { name: 'Novo projeto' })).project;
      const detail = await api.get(`/projects/${encodeURIComponent(project.id)}`);
      const nextFiles = detail.files?.length ? detail.files : STARTER;
      if (!detail.files?.length) for (const file of STARTER) await api.post('/files', { projectId: project.id, path: file.path, content: file.content, kind: file.kind });
      setProjectId(project.id); setProjectName(project.name || 'Novo projeto'); setFiles(nextFiles);
      setSelectedPath((current) => nextFiles.some((file) => file.path === current) ? current : nextFiles.find((file) => /\.html?$/i.test(file.path))?.path || nextFiles[0]?.path || 'index.html');
    } catch (cause) { if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar o projeto.'); }
  }, [authFail]);

  const loadSession = useCallback(async (id) => {
    if (!id) return;
    setSessionId(id); setAttachments([]); setError('');
    try { const result = await api.get(`/chat/sessions/${encodeURIComponent(id)}/messages?surface=codex`); setMessages(result.messages || []); }
    catch (cause) { if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar a sessão.'); }
  }, [authFail]);

  useEffect(() => {
    (async () => {
      try { const result = await api.get('/chat/sessions?surface=codex'); setSessions(result.sessions || []); if (result.sessions?.[0]) await loadSession(result.sessions[0].id); await loadProject(); }
      catch (cause) { if (!authFail(cause)) setError(cause.message || 'Não foi possível carregar o Codex.'); }
    })();
    refreshUsage();
  }, [authFail, loadProject, loadSession, refreshUsage]);

  useEffect(() => {
    const onMessage = (event) => {
      if (!previewFrameRef.current?.contentWindow || event.source !== previewFrameRef.current.contentWindow) return;
      const data = event.data || {};
      if (data.type === 'prism-preview-open' && data.path) {
        const target = files.find((file) => normalizePath(file.path) === normalizePath(data.path));
        if (target) { setSelectedPath(target.path); setTab('preview'); }
      }
      if (data.type === 'prism-preview-error' && data.message) setError(`Preview: ${data.message}`);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [files]);

  async function newSession() {
    if (sending) return;
    try { const result = await api.post('/chat/sessions', { surface: 'codex', title: 'Nova conversa' }); setSessions((list) => [result.session, ...list]); setSessionId(result.session.id); setMessages([]); setInput(''); setAttachments([]); setError(''); }
    catch (cause) { if (!authFail(cause)) setError(cause.message || 'Não foi possível criar a sessão.'); }
  }

  function chooseModel(id) {
    const next = MODELS.find((item) => item.id === id); if (!next) return;
    if (rank < next.rank) { setRequestedModel(next.label); setPlansOpen(true); setModelOpen(false); return; }
    setModel(next.id); setModelOpen(false);
  }

  async function send() {
    const prompt = input.trim(); if ((!prompt && !attachments.length) || sending || uploading) return;
    setSending(true); setError(''); setPhase({ label: 'Preparando', detail: 'Lendo o pedido e o projeto' });
    const controller = new AbortController(); controllerRef.current = controller; const rid = requestId(); const localId = `local-${rid}`; const selectedAttachments = [...attachments];
    let sid = sessionId;
    try {
      if (!sid) { const created = await api.post('/chat/sessions', { surface: 'codex', title: prompt.slice(0, 64) || 'Arquivos anexados' }); sid = created.session.id; setSessionId(sid); setSessions((list) => [created.session, ...list]); }
      const local = { id: localId, role: 'user', content: prompt, model_id: model, effort, metadata: { attachments: selectedAttachments } };
      setMessages((list) => [...list, local]); setInput(''); setAttachments([]);
      const result = await api.streamPost('/ai/generate/stream', {
        model, thinking: effort, prompt: prompt || 'Analise os arquivos anexados e faça o necessário.',
        context: messages.slice(-10).map((item) => `${item.role}: ${item.content}`).join('\n'), projectId, sessionId: sid, mcpServerIds: [], attachmentIds: selectedAttachments.map((item) => item.id).filter(Boolean),
      }, (event) => {
        if (event.type === 'phase') setPhase({ label: event.label || 'Trabalhando', detail: event.detail || '' });
        if (event.type === 'artifact' && event.path) {
          setFiles((current) => current.some((file) => file.path === event.path) ? current.map((file) => file.path === event.path ? { ...file, content: String(event.content || '') } : file) : [...current, { path: event.path, content: String(event.content || ''), kind: 'file' }]);
          setSelectedPath(event.path); setTab(/\.html?$/i.test(event.path) ? 'preview' : 'code');
        }
      }, { timeout: 240000, signal: controller.signal });
      await loadProject();
      if (result?.message) setMessages((list) => [...list.filter((item) => item.id !== localId), result.userMessage || local, result.message]);
      else setMessages((list) => list.filter((item) => item.id !== localId));
      setPhase({ label: 'Pronto', detail: 'Workspace atualizado' });
    } catch (cause) {
      if (cause?.name !== 'AbortError') {
        if (cause?.payload?.code === 'PLAN_UPGRADE_REQUIRED' || cause?.status === 403) { setRequestedModel(cause?.payload?.requiredPlan || selectedModel.label); setPlansOpen(true); }
        else if (!authFail(cause)) setError(cause.message || 'Não foi possível concluir a tarefa.');
      }
      setMessages((list) => list.filter((item) => item.id !== localId)); setPhase(null);
    } finally { setSending(false); controllerRef.current = null; setUploading(false); refreshUsage(); }
  }

  const previewHtml = useMemo(() => {
    const htmlFile = files.find((file) => normalizePath(file.path) === normalizePath(selectedPath) && /\.html?$/i.test(file.path)) || files.find((file) => /^index\.html?$/i.test(normalizePath(file.path))) || files.find((file) => /\.html?$/i.test(file.path));
    if (!htmlFile) return '<!doctype html><html lang="pt-BR"><body style="font-family:system-ui;padding:40px"><p>Nenhum HTML gerado.</p></body></html>';

    let html = String(htmlFile.content || '').trim();
    if (!/<html[\s>]/i.test(html)) html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;

    html = html.replace(/<link([^>]+href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*)>/gi, (full, attrs, href) => {
      const cssFile = localFile(files, href);
      return cssFile ? `<style data-prism-file="${normalizePath(cssFile.path)}">${String(cssFile.content || '')}</style>` : full;
    });
    html = html.replace(/<script([^>]+src=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*)><\/script>/gi, (full, attrs, src) => {
      const jsFile = localFile(files, src);
      return jsFile ? `<script data-prism-file="${normalizePath(jsFile.path)}">${escapeForInlineScript(jsFile.content)}</script>` : full;
    });

    const allCss = files.filter((file) => /\.css$/i.test(file.path)).filter((file) => !new RegExp(`data-prism-file=["']${normalizePath(file.path).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["']`, 'i').test(html)).map((file) => String(file.content || '')).join('\n');
    const allJs = files.filter((file) => /\.js$/i.test(file.path)).filter((file) => !new RegExp(`data-prism-file=["']${normalizePath(file.path).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["']`, 'i').test(html)).map((file) => escapeForInlineScript(file.content)).join('\n');

    html = html.replace(/<\/head>/i, `${allCss ? `<style data-prism-bundle="1">${allCss}</style>` : ''}</head>`);
    html = html.replace(/<\/body>/i, `${allJs ? `<script data-prism-bundle="1">${allJs}</script>` : ''}</body>`);

    const runtime = `<script>(function(){
      function report(error){ try { parent.postMessage({type:'prism-preview-error',message:String(error&&error.message||error)}, '*'); } catch(_){} }
      window.addEventListener('error', function(e){ report(e.error || e.message); });
      window.addEventListener('unhandledrejection', function(e){ report(e.reason); });
      document.addEventListener('click', function(e){
        const a=e.target.closest && e.target.closest('a[href]'); if(!a) return;
        const href=a.getAttribute('href') || '';
        if(/^(https?:|mailto:|tel:|#|javascript:|data:|blob:)/i.test(href)) return;
        const clean=href.split('#')[0].split('?')[0].replace(/^\.\//,'').replace(/^\//,'');
        if(!/\.html?$/i.test(clean)) return;
        e.preventDefault();
        parent.postMessage({type:'prism-preview-open',path:clean}, '*');
      });
    })();</script>`;
    return html.replace(/<\/body>/i, `${runtime}</body>`);
  }, [files, selectedPath]);

  async function downloadZip() {
    if (!projectId) return;
    try {
      const token = localStorage.getItem('prism_token') || ''; const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('Não foi possível preparar o ZIP.');
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${projectName.replace(/[^a-z0-9._-]+/gi, '-') || 'prism-project'}.zip`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause.message || 'Não foi possível baixar o projeto.'); }
  }

  return <div className={`prism-release-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <PrismReleaseSidebar mode="codex" sessions={sessions} activeId={sessionId} onNew={newSession} onOpen={loadSession} onMode={(next) => navigate(next === 'home' ? '/chat' : '/codex')} onHome={() => navigate('/chat')} onCodex={() => navigate('/codex')} onProjects={() => navigate('/studio')} onArtifacts={() => setTab('code')} onSettings={() => navigate('/configuracoes')} onProfile={() => navigate('/configuracoes')} usage={usage} user={user} collapsed={collapsed} onCollapse={setCollapsed} mobileOpen={mobileOpen} onMobileOpen={setMobileOpen} />
    <main className="prism-workspace">
      <header className="prism-chat-topbar"><div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}><button className="prism-sidebar-mobile-toggle" type="button" onClick={() => setMobileOpen(true)}>☰</button><div><h1>{projectName}</h1><small style={{ color: '#999890', fontSize: 10 }}>Codex · workspace</small></div></div><div className="prism-model-menu-wrap"><button className="prism-model-trigger" type="button" onClick={() => setModelOpen((value) => !value)}>Prism {selectedModel.label}</button>{modelOpen && <div className="prism-model-menu" role="menu"><strong>MODELOS</strong>{MODELS.map((item) => <button key={item.id} type="button" className={item.id === model ? 'active' : ''} onClick={() => chooseModel(item.id)}><span><strong>Prism {item.label}</strong><small>{item.maturity}</small></span><b>{rank < item.rank ? 'Upgrade' : item.id === model ? 'Atual' : ''}</b></button>)}</div>}</div></header>
      <div className="prism-workspace__body">
        <section className="prism-workspace__conversation">
          <div className="prism-chat-scroll">{error && <div className="prism-status error" role="alert">{error}</div>}{phase && <div className="prism-status"><strong>{phase.label}</strong>{phase.detail ? ` · ${phase.detail}` : ''}</div>}{!messages.length && !sending && <div className="prism-message prism-message--welcome"><div className="prism-message__author"><strong>Prism Codex</strong></div><div className="prism-message__body"><h2>O que você quer construir?</h2><p>Descreva o produto, a tela ou a mudança. O Codex trabalha diretamente no workspace.</p></div></div>}{messages.map((message) => { const meta = parseMeta(message); const filesAttached = Array.isArray(meta.attachments) ? meta.attachments : []; return <article className={`prism-message ${message.role}`} key={message.id}><div className="prism-message__author"><strong>{message.role === 'user' ? user?.name || 'Você' : 'Prism Codex'}</strong>{message.role === 'assistant' && message.model_id ? <span>{MODELS.find((item) => item.id === message.model_id)?.label || message.model_id}</span> : null}</div><div className="prism-message__body">{filesAttached.length > 0 && <div className="prism-message__attachments">{filesAttached.map((file) => <div className="prism-message__attachment" key={file.id || file.name}><span className="prism-message__attachment-icon">{String(file.mime_type || '').startsWith('image/') ? '▧' : '□'}</span><span>{file.name}</span><small>anexo</small></div>)}</div>}{message.role === 'assistant' ? <MarkdownMessage content={message.content} messageId={String(message.id)} /> : <p>{message.content}</p>}</div></article>; })}<div ref={bottomRef} /></div>
          <footer className="prism-composer-wrap"><div className="prism-composer"><textarea ref={textareaRef} rows={1} value={input} disabled={sending} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Descreva o que você quer construir" /><div className="prism-composer__row"><div className="prism-composer__tools"><FileAttachments value={attachments} onChange={setAttachments} disabled={sending} onUploadingChange={setUploading} label="Adicionar arquivos" /><ThinkingSelector value={effort} onChange={setEffort} rank={rank} disabled={sending} /></div><span className="prism-composer__hint">Enter envia · Shift+Enter quebra linha</span>{sending ? <button className="prism-cancel" type="button" onClick={() => controllerRef.current?.abort()}>Parar</button> : <button className="prism-send" type="button" disabled={!canSend} onClick={send}>Construir</button>}</div></div></footer>
        </section>
        <aside className="prism-file-panel"><div className="prism-file-panel__tabs"><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>Código</button><button onClick={downloadZip}>Baixar</button></div><div className="prism-file-tree">{files.map((file) => <button type="button" key={file.path} className={file.path === selectedPath ? 'active' : ''} onClick={() => { setSelectedPath(file.path); setTab(/\.html?$/i.test(file.path) ? 'preview' : 'code'); }}>{file.path}</button>)}</div>{tab === 'code' ? <div className="prism-editor"><div style={{ padding: '9px 12px', borderBottom: '1px solid var(--p-line)', color: '#8f8e87', fontSize: 10 }}>{language(selectedFile.path)} · {selectedFile.path}</div><pre>{selectedFile.content}</pre></div> : <div className="prism-preview"><iframe ref={previewFrameRef} title="Preview do projeto Prism Codex" sandbox="allow-scripts allow-forms allow-modals allow-popups" srcDoc={previewHtml} /></div>}</aside>
      </div>
    </main>
    <PlanPanel open={plansOpen} onClose={() => { setPlansOpen(false); setRequestedModel(''); }} currentPlan={user?.plan || 'Grátis'} requestedModel={requestedModel} />
  </div>;
}
