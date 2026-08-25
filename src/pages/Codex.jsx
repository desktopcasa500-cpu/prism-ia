import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';

const MODELS = [
  ['prism-nano-1.0', 'Prism Nano 1.0', 'Rápido'],
  ['prism-mini-1.0', 'Prism Mini 1.0', 'Geral'],
  ['prism-tex-1.5', 'Prism Tex 1.5', 'Código'],
  ['prism-taff-1.0', 'Prism Taff 1.0', 'Avançado'],
  ['prism-taff-2.0', 'Prism Taff 2.0 Ultra Code', 'Máximo'],
];

const THINKING = [
  ['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto'], ['max', 'MAX'], ['ultracode', 'Ultra Code'],
];

const starterFiles = [
  { name: 'src', type: 'folder' },
  { name: 'App.jsx', type: 'file' },
  { name: 'index.css', type: 'file' },
  { name: 'package.json', type: 'file' },
];

function Icon({ children }) { return <span className="codex-icon" aria-hidden="true">{children}</span>; }

export default function Codex() {
  const [model, setModel] = useState('prism-mini-1.0');
  const [thinking, setThinking] = useState('medium');
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState(starterFiles);
  const [activeFile, setActiveFile] = useState('App.jsx');
  const [code, setCode] = useState('// Selecione um arquivo para começar\n');
  const [preview, setPreview] = useState('');
  const [tab, setTab] = useState('preview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sidebar, setSidebar] = useState(true);
  const [projectName, setProjectName] = useState('Novo projeto');
  const [filesOpen, setFilesOpen] = useState(true);
  const [attached, setAttached] = useState([]);
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);

  const selectedModel = useMemo(() => MODELS.find(([id]) => id === model) || MODELS[1], [model]);
  const selectedThinking = useMemo(() => THINKING.find(([id]) => id === thinking) || THINKING[1], [thinking]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); send(); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'p') { event.preventDefault(); setTab('preview'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function send() {
    const text = prompt.trim();
    if (!text || loading) return;
    setPrompt('');
    setError('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setLoading(true);
    try {
      const data = await api.post('/ai/generate', {
        model,
        thinking,
        prompt: text,
        context: messages.slice(-12).map((m) => `${m.role}: ${m.text}`).join('\n'),
        project: projectName,
        files: files.filter((f) => f.type === 'file').map((f) => f.name),
      }, { timeout: 90_000 });
      const answer = data?.text || data?.response || data?.message || '';
      if (!answer.trim()) throw new Error('A Prism recebeu o pedido, mas o provedor não devolveu conteúdo. Tente novamente.');
      setMessages((current) => [...current, { role: 'assistant', text: answer }]);
      const html = extractHtml(answer);
      if (html) { setPreview(html); setTab('preview'); }
      const codeBlock = extractCode(answer);
      if (codeBlock) setCode(codeBlock.code);
    } catch (err) {
      const message = err?.message || 'Não foi possível concluir a solicitação.';
      setError(message);
      setMessages((current) => [...current, { role: 'error', text: message }]);
    } finally { setLoading(false); }
  }

  function extractHtml(text) {
    const match = text.match(/```html\s*([\s\S]*?)```/i);
    if (match) return match[1];
    if (/<(?:!doctype|html|body|main|section|div)[\s>]/i.test(text)) return text;
    return '';
  }

  function extractCode(text) {
    const match = text.match(/```(?:jsx|tsx|javascript|js|css|html)?\s*([\s\S]*?)```/i);
    return match ? { code: match[1].trim() } : null;
  }

  function handleUpload(event) {
    const selected = [...(event.target.files || [])];
    if (!selected.length) return;
    setAttached((current) => [...current, ...selected.map((file) => file.name)]);
    const names = selected.map((file) => ({ name: file.name, type: 'file' }));
    setFiles((current) => [...current, ...names.filter((item) => !current.some((file) => file.name === item.name))]);
    setPrompt((current) => current || `Analise os arquivos anexados: ${selected.map((file) => file.name).join(', ')}`);
    event.target.value = '';
  }

  function removeAttachment(name) { setAttached((current) => current.filter((item) => item !== name)); }

  return (
    <main className="codex-shell">
      <header className="codex-topbar">
        <div className="codex-top-left">
          <button className="codex-ghost-button" onClick={() => setSidebar((value) => !value)} aria-label="Alternar barra lateral"><Icon>≡</Icon></button>
          <div className="codex-wordmark"><span className="codex-mark">P</span><span>Prism</span><b>Codex</b></div>
          <span className="codex-divider" />
          <button className="codex-project-title" onClick={() => setProjectName((value) => value === 'Novo projeto' ? 'Meu projeto' : 'Novo projeto')}>{projectName}<span>⌄</span></button>
        </div>
        <div className="codex-top-right">
          <span className="codex-save-state"><span className="codex-dot" /> Pronto</span>
          <button className="codex-ghost-button" title="Atalhos">⌘K</button>
          <button className="codex-avatar" title="Perfil">P</button>
        </div>
      </header>

      <div className="codex-layout">
        {sidebar && (
          <aside className="codex-filebar">
            <div className="codex-filebar-head">
              <span>EXPLORADOR</span>
              <button className="codex-mini-button" onClick={() => setFilesOpen((value) => !value)}>{filesOpen ? '−' : '+'}</button>
            </div>
            <button className="codex-new-project" onClick={() => { setProjectName('Novo projeto'); setMessages([]); setPreview(''); setCode('// Novo projeto\n'); }}><span>+</span> Novo projeto</button>
            {filesOpen && <div className="codex-tree">
              {files.map((file, index) => (
                <button key={`${file.name}-${index}`} className={`codex-tree-row ${activeFile === file.name ? 'active' : ''} ${file.type}`} onClick={() => file.type === 'file' && setActiveFile(file.name)}>
                  <span className="tree-glyph">{file.type === 'folder' ? '▸' : '·'}</span><span>{file.name}</span>
                </button>
              ))}
            </div>}
            <div className="codex-filebar-bottom">
              <button><Icon>⌁</Icon> GitHub</button>
              <button><Icon>◌</Icon> Configurações</button>
            </div>
          </aside>
        )}

        <section className="codex-center">
          <div className="codex-editorbar">
            <div className="codex-tabs">
              <button className="codex-tab active"><span className="file-dot" />{activeFile}<span className="tab-close">×</span></button>
            </div>
            <div className="codex-editor-actions"><button onClick={() => navigator.clipboard?.writeText(code)}>Copiar</button><button onClick={() => setCode('')}>Limpar</button></div>
          </div>
          <textarea className="codex-editor" spellCheck="false" value={code} onChange={(event) => setCode(event.target.value)} aria-label="Editor de código" />
          <div className="codex-bottom-tabs">
            {['preview', 'code', 'terminal'].map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item === 'preview' ? 'Preview' : item === 'code' ? 'Código' : 'Terminal'}</button>)}
          </div>
          <div className="codex-output">
            {tab === 'preview' && <iframe className="codex-preview-frame" title="Preview do projeto" sandbox="allow-scripts" srcDoc={preview || '<!doctype html><html><body style="margin:0;background:#101010;color:#aaa;font:14px system-ui;display:grid;place-items:center;height:100vh"><div>O preview aparecerá aqui quando a Prism criar uma interface.</div></body></html>'} />}
            {tab === 'code' && <pre className="codex-code-output">{code || '// Nenhum código no arquivo atual.'}</pre>}
            {tab === 'terminal' && <div className="codex-terminal"><span>$</span> Prism Codex aguardando um comando...</div>}
          </div>
        </section>

        <aside className="codex-chat-panel">
          <div className="codex-chat-head">
            <div><strong>Prism Codex</strong><span>Ambiente de desenvolvimento</span></div>
            <button className="codex-ghost-button">•••</button>
          </div>
          <div className="codex-controls">
            <label>Modelo<select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map(([id, label, hint]) => <option value={id} key={id}>{label} — {hint}</option>)}</select></label>
            <label>Pensamento<select value={thinking} onChange={(event) => setThinking(event.target.value)}>{THINKING.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select></label>
          </div>
          <div className="codex-messages">
            {!messages.length && <div className="codex-welcome"><div className="welcome-mark">P</div><h1>O que vamos construir?</h1><p>Descreva o resultado. A Prism cuida do código, dos arquivos e da próxima etapa.</p><div className="codex-suggestions"><button onClick={() => setPrompt('Crie uma landing page premium para uma marca de carros.')}>Landing page</button><button onClick={() => setPrompt('Analise a arquitetura deste projeto e encontre os principais problemas.')}>Analisar projeto</button><button onClick={() => setPrompt('Crie um jogo 3D simples e organize a estrutura do projeto.')}>Jogo 3D</button></div></div>}
            {messages.map((message, index) => <article key={`${message.role}-${index}`} className={`codex-message ${message.role}`}><div className="message-label">{message.role === 'user' ? 'Você' : message.role === 'error' ? 'Falha' : 'Prism'}</div><div className="message-body">{message.text}</div></article>)}
            {loading && <article className="codex-message assistant"><div className="message-label">Prism</div><div className="codex-thinking"><span /><span /><span /> Trabalhando no pedido</div></article>}
            <div ref={chatEndRef} />
          </div>
          <div className="codex-composer-wrap">
            {attached.length > 0 && <div className="codex-attachments">{attached.map((name) => <button key={name} onClick={() => removeAttachment(name)}>{name} ×</button>)}</div>}
            {error && <div className="codex-error"><span>{error}</span><button onClick={() => { setError(''); inputRef.current?.focus(); }}>Fechar</button></div>}
            <div className="codex-composer">
              <textarea ref={inputRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Diga o que você quer construir..." rows={3} />
              <div className="composer-footer"><label className="attach-button" title="Adicionar arquivos"><input type="file" multiple onChange={handleUpload} />＋</label><span>Enter envia · Shift+Enter quebra linha</span><button className="send-button" disabled={loading || !prompt.trim()} onClick={send}>{loading ? '...' : 'Enviar'}</button></div>
            </div>
            <div className="codex-model-status">{selectedModel[1]} · {selectedThinking[1]} <span>·</span> As respostas podem conter erros; revise código antes de publicar.</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
