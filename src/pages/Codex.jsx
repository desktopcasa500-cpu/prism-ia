import { useEffect, useMemo, useRef, useState } from 'react';
import { api, getAuthToken } from '../lib/api';

const MODELS = [['prism-nano-1.0', 'Prism Nano 1.0', 'Rápido'], ['prism-mini-1.0', 'Prism Mini 1.0', 'Geral'], ['prism-tex-1.5', 'Prism Tex 1.5', 'Código'], ['prism-taff-1.0', 'Prism Taff 1.0', 'Avançado'], ['prism-taff-2.0', 'Prism Taff 2.0 Ultra Code', 'Máximo']];
const THINKING = [['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto'], ['max', 'MAX'], ['ultracode', 'Ultra Code']];
const STARTER = [{ path: 'src', type: 'folder', content: '' }, { path: 'src/App.jsx', type: 'file', content: '// O Codex preencherá este arquivo quando você pedir uma implementação.\n' }, { path: 'src/index.css', type: 'file', content: '' }, { path: 'package.json', type: 'file', content: '{\n  "name": "prism-project"\n}\n' }];

function formatError(error) { return error?.message || 'Não foi possível concluir o pedido.'; }

function languageFromPath(path = '') {
  const ext = path.split('.').pop()?.toLowerCase();
  return { js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx', css: 'css', html: 'html', json: 'json', md: 'markdown', py: 'python' }[ext] || '';
}

function extractArtifacts(text) {
  const source = String(text || '');
  const artifacts = [];
  const tagged = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match;
  while ((match = tagged.exec(source))) artifacts.push({ path: match[1].trim(), content: match[2].replace(/^\n/, '').replace(/\n$/, '') });

  const fenced = /```([^\n]*)\n([\s\S]*?)```/g;
  while ((match = fenced.exec(source))) {
    const header = match[1].trim();
    const body = match[2].replace(/\n$/, '');
    const tokens = header.split(/\s+/).filter(Boolean);
    const pathToken = tokens.find((token) => token.includes('/') || /\.(jsx?|tsx?|ts|css|html|json|md|py)$/i.test(token));
    if (pathToken) artifacts.push({ path: pathToken.replace(/^path=/, ''), content: body });
    else if (tokens[0] && ['html', 'css', 'javascript', 'js', 'jsx'].includes(tokens[0].toLowerCase())) artifacts.push({ path: tokens[0].toLowerCase() === 'html' ? 'index.html' : 'src/App.jsx', content: body });
  }

  return artifacts.filter((artifact, index, list) => artifact.path && list.findIndex((item) => item.path === artifact.path) === index);
}

function cleanAssistantText(text, artifacts) {
  let clean = String(text || '');
  clean = clean.replace(/<prism:summary>([\s\S]*?)<\/prism:summary>/gi, '$1');
  clean = clean.replace(/<file\s+path=["'][^"']+["']\s*>[\s\S]*?<\/file>/gi, '');
  clean = clean.replace(/```[^\n]*\n[\s\S]*?```/g, '');
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  if (!clean && artifacts.length) return 'Implementei as alterações no projeto e atualizei a área de trabalho.';
  return clean || 'A Prism concluiu o pedido.';
}

function buildPreview(projectFiles) {
  const files = projectFiles.filter((file) => file.type !== 'folder');
  const htmlFile = files.find((file) => /(^|\/)index\.html$/i.test(file.path)) || files.find((file) => /\.html$/i.test(file.path));
  const css = files.filter((file) => /\.css$/i.test(file.path)).map((file) => file.content || '').join('\n');
  const js = files.filter((file) => /\.(js|mjs)$/i.test(file.path)).map((file) => file.content || '').join('\n');
  if (htmlFile) {
    let html = htmlFile.content || '';
    if (css && !/<style[\s>]/i.test(html)) html = html.replace(/<\/head>/i, `<style>${css}</style></head>`);
    if (js && !/<script[\s>]/i.test(html)) html = html.replace(/<\/body>/i, `<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body>`);
    return html;
  }
  const jsx = files.find((file) => /\.(jsx|tsx)$/i.test(file.path));
  if (jsx) {
    const source = jsx.content || '';
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script><script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script><script src="https://unpkg.com/@babel/standalone/babel.min.js"></script><style>${css}</style></head><body><div id="root"></div><script type="text/babel">${source.replace(/import[\s\S]*?;\s*/g, '').replace(/export default /g, '').replace(/<\/script/gi, '<\\/script')}\nconst root=ReactDOM.createRoot(document.getElementById('root')); root.render(typeof App !== 'undefined' ? React.createElement(App) : React.createElement('div',null,'Preview pronto.'));</script></body></html>`;
  }
  return '';
}

export default function Codex() {
  const [model, setModel] = useState('prism-taff-2.0');
  const [thinking, setThinking] = useState('ultracode');
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState(STARTER);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [code, setCode] = useState(STARTER[1].content);
  const [preview, setPreview] = useState('');
  const [tab, setTab] = useState('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [projectOpen, setProjectOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);
  const saveTimer = useRef(null);
  const selectedModel = useMemo(() => MODELS.find(([id]) => id === model) || MODELS[1], [model]);
  const selectedThinking = useMemo(() => THINKING.find(([id]) => id === thinking) || THINKING[1], [thinking]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.get('/projects');
        if (!alive) return;
        if (data.projects?.length) {
          const project = data.projects[0];
          setProjectId(project.id); setProjectName(project.name);
          const detail = await api.get(`/projects/${project.id}`);
          if (!alive) return;
          if (detail.files?.length) {
            const loaded = detail.files.map((file) => ({ ...file, type: file.kind || 'file' }));
            setFiles(loaded);
            const first = loaded.find((file) => file.type !== 'folder');
            if (first) { setActiveFile(first.path); setCode(first.content || ''); }
            setPreview(buildPreview(loaded));
          }
        } else {
          const created = await api.post('/projects', { name: 'Novo projeto' });
          if (!alive) return;
          setProjectId(created.project.id); setProjectName(created.project.name);
          for (const file of STARTER.filter((item) => item.type === 'file')) await api.post('/files', { projectId: created.project.id, path: file.path, content: file.content, kind: 'file' });
        }
      } catch { /* The UI remains usable until the backend becomes available. */ }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading]);
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  function selectFile(file) {
    if (file.type === 'folder') return;
    setActiveFile(file.path); setCode(file.content || ''); setTab('code');
  }

  function updateCode(value) {
    setCode(value);
    setFiles((current) => current.map((file) => file.path === activeFile ? { ...file, content: value } : file));
    if (projectId) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const target = files.find((file) => file.path === activeFile);
        if (!target?.id) return;
        setSaving(true);
        try { await api.patch(`/files/${target.id}`, { path: activeFile, content: value }); }
        catch { setError('Não foi possível salvar o arquivo no projeto.'); }
        finally { setSaving(false); }
      }, 600);
    }
  }

  async function applyArtifacts(artifacts) {
    if (!projectId || !artifacts.length) return files;
    const next = [...files];
    setSaving(true);
    try {
      for (const artifact of artifacts) {
        const existing = next.find((file) => file.path === artifact.path);
        if (existing?.id) {
          await api.patch(`/files/${existing.id}`, { path: artifact.path, content: artifact.content });
          const index = next.findIndex((file) => file.path === artifact.path);
          next[index] = { ...next[index], content: artifact.content, type: 'file' };
        } else {
          const created = await api.post('/files', { projectId, path: artifact.path, content: artifact.content, kind: 'file' });
          next.push({ ...(created.file || {}), path: artifact.path, content: artifact.content, type: 'file' });
        }
      }
      setFiles(next);
      const target = next.find((file) => file.path === activeFile) || next.find((file) => file.path === artifacts[0].path);
      if (target) { setActiveFile(target.path); setCode(target.content || ''); }
      const nextPreview = buildPreview(next);
      if (nextPreview) setPreview(nextPreview);
      setTab(nextPreview ? 'preview' : 'code');
      return next;
    } finally { setSaving(false); }
  }

  async function send() {
    const text = prompt.trim();
    if (!text || loading) return;
    setPrompt(''); setError(''); setLoading(true);
    setMessages((current) => [...current, { role: 'user', text }]);
    try {
      const context = messages.slice(-12).map((message) => `${message.role}: ${message.text}`).join('\n');
      const projectFiles = files.filter((file) => file.type !== 'folder').map((file) => `${file.path}:\n${file.content || ''}`).join('\n\n').slice(-80_000);
      const agentPrompt = [
        'Você é o agente de engenharia do Prism Codex. Trabalhe como uma IDE agent, não como um chatbot comum.',
        'Analise o pedido, o contexto e os arquivos atuais. Quando a tarefa envolver código, produza as alterações necessárias nos arquivos.',
        'IMPORTANTE: mantenha o código fora da resposta conversacional. Entregue cada arquivo alterado usando exatamente <file path="CAMINHO">CODIGO</file>.',
        'Depois das alterações, escreva uma explicação curta dentro de <prism:summary>RESUMO</prism:summary>.',
        'Não invente execução, testes, commits ou resultados que você não realizou.',
        `Modelo: ${model}. Nível: ${thinking}.`,
        `Projeto: ${projectName}.`,
        `Arquivos atuais:\n${projectFiles || '(projeto vazio)'}`,
        context ? `Contexto recente:\n${context}` : '',
        `Pedido do usuário:\n${text}`,
      ].filter(Boolean).join('\n\n');

      const data = await api.post('/ai/generate', { model, thinking, prompt: agentPrompt, context, project: projectName, files: projectFiles }, { timeout: 180000 });
      const answer = String(data?.text || data?.response || data?.message || '').trim();
      if (!answer) throw new Error('A Prism não recebeu uma resposta válida do provedor.');
      const artifacts = extractArtifacts(answer);
      if (artifacts.length) {
        await applyArtifacts(artifacts);
        setMessages((current) => [...current, { role: 'assistant', text: cleanAssistantText(answer, artifacts), artifacts: artifacts.map((item) => item.path) }]);
      } else {
        setMessages((current) => [...current, { role: 'assistant', text: cleanAssistantText(answer, []) }]);
      }
    } catch (err) {
      const message = formatError(err); setError(message); setMessages((current) => [...current, { role: 'error', text: message }]);
    } finally { setLoading(false); }
  }

  async function downloadProject() {
    if (!projectId) { setError('Crie ou abra um projeto antes de baixar.'); return; }
    try {
      const response = await fetch(`/api/projects/${projectId}/download`, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Não foi possível gerar o download.'); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${projectName.replace(/[^a-z0-9_-]+/gi, '-') || 'prism-project'}.zip`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch (err) { setError(formatError(err)); }
  }

  return <main className="codex-shell brutal-codex">
    <header className="codex-topbar">
      <div className="codex-top-left"><div className="codex-wordmark"><span className="codex-mark">P</span><span>Prism</span><b>Codex</b></div><span className="codex-divider"/><button className="codex-project-title" onClick={() => setProjectOpen((value) => !value)}>{projectName}<span>⌄</span></button></div>
      <div className="codex-top-right"><span className={`codex-save-state ${loading || saving ? 'busy' : ''}`}><span className="codex-dot"/>{loading ? 'Trabalhando' : saving ? 'Salvando' : 'Pronto'}</span><button className={`brutal-action ${projectOpen ? 'selected' : ''}`} onClick={() => setProjectOpen((value) => !value)}>Projeto</button><button className="brutal-action" onClick={downloadProject}>Baixar .ZIP</button><button className={`brutal-action ${chatOpen ? 'selected' : ''}`} onClick={() => setChatOpen((value) => !value)}>Chat</button></div>
    </header>

    <div className={`codex-layout ${projectOpen ? 'project-open' : 'project-closed'} ${chatOpen ? '' : 'no-chat'}`}>
      <section className="codex-center brutal-workspace">
        <div className="codex-editorbar brutal-toolbar"><div><span className="workspace-kicker">VIBE CODE / WORKSPACE</span><strong>{tab === 'preview' ? 'Preview' : activeFile}</strong></div><div className="codex-editor-actions"><button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>Preview</button><button className={tab === 'code' ? 'active' : ''} onClick={() => setTab('code')}>Código</button><button className={tab === 'terminal' ? 'active' : ''} onClick={() => setTab('terminal')}>Terminal</button></div></div>
        <div className="codex-output brutal-preview-output">
          {tab === 'preview' && <iframe className="codex-preview-frame" title="Preview do projeto" sandbox="allow-scripts" srcDoc={preview || '<!doctype html><html><body style="margin:0;background:#f4f2ec;color:#111;font:14px system-ui;display:grid;place-items:center;height:100vh"><div style="max-width:460px;text-align:center"><b style="font-size:20px">Seu projeto aparece aqui.</b><p style="color:#666">Peça ao Codex para construir algo. O agente colocará o código nos arquivos e atualizará o preview.</p></div></body></html>'} />}
          {tab === 'code' && <div className="brutal-code-view"><div className="codex-line-numbers">{code.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea className="codex-editor" spellCheck="false" value={code} onChange={(event) => updateCode(event.target.value)} aria-label="Editor de código" /></div>}
          {tab === 'terminal' && <div className="codex-terminal"><span>$</span><div><strong>Prism Codex</strong><p>O terminal visual está pronto para integração com o executor do projeto. O agente não inventa comandos executados.</p></div></div>}
        </div>
        <div className="brutal-preview-footer"><span>{activeFile}</span><span>{files.filter((file) => file.type !== 'folder').length} arquivos</span><span>{saving ? 'sincronizando' : 'salvo no projeto'}</span></div>
      </section>

      {projectOpen && <aside className="codex-filebar brutal-project-panel"><div className="codex-filebar-head"><div><span>PROJETO</span><strong>{projectName}</strong></div><span className="project-count">{files.filter((file) => file.type !== 'folder').length}</span></div><div className="project-panel-actions"><button onClick={() => setProjectOpen(false)}>Fechar</button><button onClick={downloadProject}>Baixar</button></div><div className="codex-tree">{files.map((file, index) => <button key={`${file.path}-${index}`} className={`codex-tree-row ${file.type} ${activeFile === file.path ? 'active' : ''}`} onClick={() => selectFile(file)}><span className="tree-glyph">{file.type === 'folder' ? '▾' : '·'}</span><span>{file.path}</span></button>)}</div><div className="project-panel-note">O agente trabalha nos arquivos do projeto. Código fica no workspace; o chat mostra somente decisões, progresso e resultado.</div></aside>}

      {chatOpen && <aside className="codex-chat-panel brutal-chat-panel"><div className="codex-chat-head"><div><strong>Prism</strong><span>Agente · {selectedModel[1]} · {selectedThinking[1]}</span></div><button className="codex-ghost-button" onClick={() => setMessages([])}>Limpar</button></div><div className="codex-controls"><label>Modelo<select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map(([id, label, hint]) => <option value={id} key={id}>{label} — {hint}</option>)}</select></label><label>Pensamento<select value={thinking} onChange={(event) => setThinking(event.target.value)}>{THINKING.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label></div><div className="codex-messages">
        {!messages.length && <div className="codex-welcome"><div className="welcome-mark">P</div><h1>Construa.</h1><p>Descreva o que você quer mudar. O agente trabalha nos arquivos e coloca o resultado no workspace.</p><div className="codex-suggestions"><button onClick={() => setPrompt('Crie uma landing page brutalista premium para uma marca de carros.')}>Criar uma interface</button><button onClick={() => setPrompt('Analise este projeto e corrija os bugs mais importantes.')}>Encontrar problemas</button><button onClick={() => setPrompt('Crie a estrutura de um jogo 3D e prepare os arquivos iniciais.')}>Criar um jogo 3D</button></div></div>}
        {messages.map((message, index) => <article key={`${message.role}-${index}`} className={`codex-message ${message.role}`}><div className="message-label">{message.role === 'user' ? 'Você' : message.role === 'error' ? 'Prism · erro' : 'Prism'}</div><div className="message-body">{message.text}</div>{message.artifacts?.length > 0 && <div className="message-artifacts">{message.artifacts.map((path) => <button key={path} onClick={() => { const file = files.find((item) => item.path === path); if (file) selectFile(file); }}>{path}</button>)}</div>}</article>)}
        {loading && <article className="codex-message assistant"><div className="message-label">Prism</div><div className="codex-thinking"><span/><span/><span/> trabalhando no projeto</div></article>}<div ref={chatEndRef}/>
      </div><div className="codex-composer-wrap">{error && <div className="codex-error"><span>{error}</span><button onClick={() => setError('')}>Fechar</button></div>}<div className="codex-composer"><textarea ref={inputRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Descreva o que vamos construir..." rows={3}/><div className="composer-footer"><span>Enter envia</span><button className="send-button" disabled={loading || !prompt.trim()} onClick={send}>{loading ? '...' : 'Enviar'}</button></div></div><div className="codex-model-status">{selectedModel[1]} <span>·</span> {selectedThinking[1]}</div></div></aside>}
    </div>
  </main>;
}
