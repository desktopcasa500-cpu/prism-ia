import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';

const MODELS = [
  ['prism-nano-1.0', 'Prism Nano 1.0', 'Rápido'],
  ['prism-mini-1.0', 'Prism Mini 1.0', 'Geral'],
  ['prism-tex-1.5', 'Prism Tex 1.5', 'Código'],
  ['prism-taff-1.0', 'Prism Taff 1.0', 'Avançado'],
  ['prism-taff-2.0', 'Prism Taff 2.0 Ultra Code', 'Máximo'],
];
const THINKING = [['low','Baixo'],['medium','Médio'],['high','Alto'],['max','MAX'],['ultracode','Ultra Code']];
const STARTER = [
  { path: 'src', type: 'folder' },
  { path: 'src/App.jsx', type: 'file', content: '// Comece descrevendo o que você quer construir.\n' },
  { path: 'src/index.css', type: 'file', content: '' },
  { path: 'package.json', type: 'file', content: '{\n  "name": "prism-project"\n}\n' },
];

function Icon({ children }) { return <span className="codex-icon" aria-hidden="true">{children}</span>; }
function formatError(error) { return error?.message || 'Não foi possível concluir o pedido.'; }
function extractBlock(text, language = '') {
  const source = String(text || '');
  const marker = '```';
  let start = source.indexOf(marker);
  while (start !== -1) {
    const lineEnd = source.indexOf('\n', start + marker.length);
    if (lineEnd === -1) return '';
    const header = source.slice(start + marker.length, lineEnd).trim().toLowerCase();
    const end = source.indexOf(marker, lineEnd + 1);
    if (end === -1) return '';
    if (!language || !header || header === language.toLowerCase() || header.split(/\s+/)[0] === language.toLowerCase()) return source.slice(lineEnd + 1, end).trim();
    start = source.indexOf(marker, end + marker.length);
  }
  return '';
}
function extractHtml(text) {
  const block = extractBlock(text, 'html');
  if (block) return block;
  return /<!doctype html|<html[\s>]/i.test(String(text || '')) ? text : '';
}

export default function Codex() {
  const [model, setModel] = useState('prism-mini-1.0');
  const [thinking, setThinking] = useState('medium');
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState(STARTER);
  const [activeFile, setActiveFile] = useState('src/App.jsx');
  const [code, setCode] = useState(STARTER[1].content);
  const [preview, setPreview] = useState('');
  const [tab, setTab] = useState('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [attached, setAttached] = useState([]);
  const [fileMenu, setFileMenu] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const chatEndRef = useRef(null);

  const selectedModel = useMemo(() => MODELS.find(([id]) => id === model) || MODELS[1], [model]);
  const selectedThinking = useMemo(() => THINKING.find(([id]) => id === thinking) || THINKING[1], [thinking]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, loading]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); send(); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') { event.preventDefault(); setExplorerOpen((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function selectFile(file) { if (file.type === 'file') { setActiveFile(file.path); setCode(file.content || ''); } }
  function addFiles(list) {
    const incoming = [...list].map((file) => ({ path: file.webkitRelativePath || file.name, type: 'file', content: '' }));
    if (!incoming.length) return;
    setFiles((current) => [...current, ...incoming.filter((item) => !current.some((f) => f.path === item.path))]);
    setAttached((current) => [...current, ...incoming.map((item) => item.path).filter((name) => !current.includes(name))]);
    setFileMenu(false);
  }
  async function send() {
    const text = prompt.trim();
    if (!text || loading) return;
    setPrompt(''); setError(''); setLoading(true); setMessages((current) => [...current, { role: 'user', text }]);
    try {
      const context = messages.slice(-16).map((m) => `${m.role}: ${m.text}`).join('\n');
      const data = await api.post('/ai/generate', { model, thinking, prompt: text, context, project: projectName, files: files.filter((f) => f.type === 'file').map((f) => `${f.path}: ${f.content || ''}`).join('\n\n').slice(-60000) }, { timeout: 120000 });
      const answer = String(data?.text || data?.response || data?.message || '').trim();
      if (!answer) throw new Error('A Prism não recebeu uma resposta válida do provedor.');
      setMessages((current) => [...current, { role: 'assistant', text: answer }]);
      const html = extractHtml(answer); const block = extractBlock(answer);
      if (html) { setPreview(html); setTab('preview'); } if (block) setCode(block);
    } catch (err) { const message = formatError(err); setError(message); setMessages((current) => [...current, { role: 'error', text: message }]); }
    finally { setLoading(false); }
  }
  function resetProject() { setProjectName('Novo projeto'); setFiles(STARTER); setActiveFile('src/App.jsx'); setCode(STARTER[1].content); setPreview(''); setMessages([]); setAttached([]); setError(''); }

  return (
    <main className="codex-shell">
      <header className="codex-topbar">
        <div className="codex-top-left"><button className="codex-ghost-button" onClick={() => setExplorerOpen((v) => !v)} title="Explorador (Ctrl/Cmd+B)"><Icon>☰</Icon></button><div className="codex-wordmark"><span className="codex-mark">P</span><span>Prism</span><b>Codex</b></div><span className="codex-divider" /><button className="codex-project-title" onClick={() => setProjectName((v) => v === 'Novo projeto' ? 'Meu projeto' : 'Novo projeto')}>{projectName}<span>⌄</span></button></div>
        <div className="codex-top-right"><span className={`codex-save-state ${loading ? 'busy' : ''}`}><span className="codex-dot" />{loading ? 'Trabalhando' : 'Sincronizado'}</span><button className="codex-ghost-button" onClick={() => setChatOpen((v) => !v)} title="Alternar conversa"><Icon>◐</Icon></button><button className="codex-avatar">P</button></div>
      </header>
      <div className={`codex-layout ${explorerOpen ? '' : 'no-explorer'} ${chatOpen ? '' : 'no-chat'}`}>
        {explorerOpen && <aside className="codex-filebar"><div className="codex-filebar-head"><div><span>PROJETO</span><strong>{projectName}</strong></div><button className="codex-mini-button" onClick={() => setFileMenu((v) => !v)} title="Adicionar arquivo">+</button></div>{fileMenu && <div className="codex-file-menu"><button onClick={() => fileRef.current?.click()}>Adicionar arquivos</button><button onClick={() => { resetProject(); setFileMenu(false); }}>Novo projeto</button></div>}<input ref={fileRef} hidden type="file" multiple onChange={(e) => addFiles(e.target.files || [])} /><div className="codex-tree">{files.map((file, index) => <button key={`${file.path}-${index}`} className={`codex-tree-row ${file.type} ${activeFile === file.path ? 'active' : ''}`} onClick={() => selectFile(file)}><span className="tree-glyph">{file.type === 'folder' ? '⌄' : '·'}</span><span>{file.path.split('/').pop()}</span></button>)}</div><div className="codex-filebar-bottom"><button onClick={() => setPrompt('Conecte e analise meu repositório GitHub.')}>GitHub</button><button onClick={() => setPrompt('Analise a estrutura deste projeto e encontre problemas.')}>Analisar projeto</button></div></aside>}
        <section className="codex-center"><div className="codex-editorbar"><div className="codex-tabs"><div className="codex-tab active"><span className="file-dot" />{activeFile}<span className="tab-close">×</span></div></div><div className="codex-editor-actions"><button onClick={() => navigator.clipboard?.writeText(code)}>Copiar</button><button onClick={() => setCode('')}>Limpar</button></div></div><div className="codex-editor-wrap"><div className="codex-line-numbers">{code.split('\n').map((_, i) => <span key={i}>{i + 1}</span>)}</div><textarea className="codex-editor" spellCheck="false" value={code} onChange={(event) => setCode(event.target.value)} aria-label="Editor de código" /></div><div className="codex-bottom-tabs">{['preview','code','terminal'].map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'preview' ? 'Preview' : item === 'code' ? 'Código' : 'Terminal'}</button>)}</div><div className="codex-output">{tab === 'preview' && <iframe className="codex-preview-frame" title="Preview do projeto" sandbox="allow-scripts" srcDoc={preview || '<!doctype html><html><body style="margin:0;background:#0d0d0d;color:#777;font:14px system-ui;display:grid;place-items:center;height:100vh"><div>O resultado do seu projeto aparecerá aqui.</div></body></html>'} />}{tab === 'code' && <pre className="codex-code-output">{code || '// Arquivo vazio.'}</pre>}{tab === 'terminal' && <div className="codex-terminal"><span>$</span> Preview e execução ficam disponíveis quando o projeto tiver uma aplicação executável.</div>}</div></section>
        {chatOpen && <aside className="codex-chat-panel"><div className="codex-chat-head"><div><strong>Prism</strong><span>{selectedModel[1]} · {selectedThinking[1]}</span></div><button className="codex-ghost-button" onClick={() => setMessages([])}>Limpar</button></div><div className="codex-controls"><label>Modelo<select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map(([id,label,hint]) => <option value={id} key={id}>{label} — {hint}</option>)}</select></label><label>Pensamento<select value={thinking} onChange={(e) => setThinking(e.target.value)}>{THINKING.map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select></label></div><div className="codex-messages">{!messages.length && <div className="codex-welcome"><div className="welcome-mark">P</div><h1>O que você quer fazer?</h1><p>Peça qualquer coisa. A conversa é o ponto de partida; o projeto aparece quando fizer sentido.</p><div className="codex-suggestions"><button onClick={() => setPrompt('Crie uma landing page premium para uma marca de carros.')}>Criar uma interface</button><button onClick={() => setPrompt('Analise este projeto e encontre os bugs mais importantes.')}>Encontrar problemas</button><button onClick={() => setPrompt('Crie a estrutura de um jogo 3D e explique como executar.')}>Criar um jogo 3D</button></div></div>}{messages.map((message, index) => <article key={`${message.role}-${index}`} className={`codex-message ${message.role}`}><div className="message-label">{message.role === 'user' ? 'Você' : message.role === 'error' ? 'Prism · erro' : 'Prism'}</div><div className="message-body">{message.text}</div></article>)}{loading && <article className="codex-message assistant"><div className="message-label">Prism</div><div className="codex-thinking"><span /><span /><span /> Analisando o pedido</div></article>}<div ref={chatEndRef} /></div><div className="codex-composer-wrap">{attached.length > 0 && <div className="codex-attachments">{attached.map((name) => <button key={name} onClick={() => setAttached((c) => c.filter((x) => x !== name))}>{name} ×</button>)}</div>}{error && <div className="codex-error"><span>{error}</span><button onClick={() => { setError(''); inputRef.current?.focus(); }}>Fechar</button></div>}<div className="codex-composer"><textarea ref={inputRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Descreva o que você quer fazer..." rows={3} /><div className="composer-footer"><button className="attach-button" onClick={() => { setFileMenu((v) => !v); setExplorerOpen(true); }} title="Adicionar contexto">＋</button><span>Enter envia · Shift+Enter nova linha</span><button className="send-button" disabled={loading || !prompt.trim()} onClick={send}>{loading ? '...' : 'Enviar'}</button></div></div><div className="codex-model-status">{selectedModel[1]} <span>·</span> {selectedThinking[1]} <span>·</span> Ctrl/Cmd+Enter</div></div></aside>}
      </div>
    </main>
  );
}
