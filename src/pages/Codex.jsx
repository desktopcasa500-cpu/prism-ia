import { useEffect, useMemo, useRef, useState } from 'react';
import { api, getAuthToken } from '../lib/api';
import '../codex.css';

const models = [
  ['prism-nano-1.0', 'Prism Nano 1.0'],
  ['prism-mini-1.0', 'Prism Mini 1.0'],
  ['prism-tex-1.5', 'Prism Tex 1.5'],
  ['prism-taff-1.0', 'Prism Taff 1.0'],
  ['prism-taff-2.0', 'Prism Taff 2.0 Ultra Code'],
];
const thoughts = [['low','Baixo'],['medium','Médio'],['high','Alto'],['max','MAX'],['ultracode','Ultra Code']];

function FileIcon({ path }) { return <span className="codex-file-icon">{path?.split('.').pop()?.toUpperCase().slice(0,2) || 'F'}</span>; }

export default function Codex() {
  const [model, setModel] = useState('prism-mini-1.0');
  const [thinking, setThinking] = useState('medium');
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [panel, setPanel] = useState('preview');
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  const selectedContent = useMemo(() => files.find(f => f.path === selectedFile)?.content || '', [files, selectedFile]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ projects }, { sessions }] = await Promise.all([api.get('/projects'), api.get('/chat/sessions')]);
        if (!active) return;
        const current = projects[0] || (await api.post('/projects', { name: 'Prism Codex' })).project;
        const currentSession = sessions[0] || (await api.post('/chat/sessions', { title: 'Nova conversa' })).session;
        const [history, projectFiles] = await Promise.all([api.get(`/chat/sessions/${currentSession.id}/messages`), api.get(`/projects/${current.id}/files`)]);
        if (!active) return;
        setProject(current); setSession(currentSession);
        setMessages(history.messages.map(m => ({ role: m.role, text: m.content })));
        setFiles(projectFiles.files || []);
        setSelectedFile(projectFiles.files?.[0]?.path || null);
      } catch (e) { if (active) setError(e.message || 'Não foi possível carregar o Codex.'); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function send() {
    if (!prompt.trim() || loading || !session) return;
    const text = prompt.trim(); setPrompt(''); setError('');
    setMessages(current => [...current, { role: 'user', text }, { role: 'assistant', text: '' }]); setLoading(true);
    try {
      const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
      const apiRoot = configured ? (configured.endsWith('/api') ? configured : `${configured}/api`) : '/api';
      const response = await fetch(`${apiRoot}/chat/sessions/${session.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ content: text, effort: thinking, model, stream: true }),
      });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `Erro ${response.status}`); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n'); buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find(item => item.startsWith('data: ')); if (!line) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'delta') setMessages(current => { const copy = [...current]; copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + payload.text }; return copy; });
          if (payload.type === 'done') setError('');
        }
      }
    } catch (e) {
      setMessages(current => { const copy = [...current]; copy[copy.length - 1] = { role: 'assistant', text: `Não consegui concluir esta resposta. ${e.message || 'Tente novamente.'}` }; return copy; });
      setError(e.message || 'Erro de conexão com a IA.');
    } finally { setLoading(false); inputRef.current?.focus(); }
  }

  async function upload(event) {
    const selected = [...event.target.files]; if (!selected.length || !project) return;
    const form = new FormData(); selected.forEach(file => form.append('files', file)); form.append('projectId', project.id);
    try {
      const configured = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, ''); const apiRoot = configured ? (configured.endsWith('/api') ? configured : `${configured}/api`) : '/api';
      const response = await fetch(`${apiRoot}/uploads/analyze`, { method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` }, body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Falha no upload');
      const refreshed = await api.get(`/projects/${project.id}/files`); setFiles(refreshed.files || []); setSelectedFile(refreshed.files?.[0]?.path || null);
    } catch (e) { setError(e.message || 'Falha no upload.'); }
    event.target.value = '';
  }

  function newChat() { window.location.reload(); }

  return <main className="codex-shell">
    <aside className="codex-files-panel">
      <div className="codex-panel-brand"><span className="codex-mark" /> <strong>Prism Codex</strong></div>
      <button className="codex-new" onClick={newChat}>+ Nova conversa</button>
      <div className="codex-project-title"><span>PROJETO</span><strong>{project?.name || 'Carregando...'}</strong></div>
      <div className="codex-tree">
        {files.length ? files.map(file => <button className={selectedFile === file.path ? 'active' : ''} key={file.path} onClick={() => { setSelectedFile(file.path); setPanel('editor'); }}><FileIcon path={file.path}/><span>{file.path}</span></button>) : <div className="codex-empty-tree">Nenhum arquivo ainda</div>}
      </div>
      <label className="codex-upload">Adicionar arquivos<input type="file" multiple onChange={upload} hidden /></label>
    </aside>

    <section className="codex-center">
      <header className="codex-topbar">
        <div className="codex-selects">
          <label>Modelo<select value={model} onChange={e => setModel(e.target.value)}>{models.map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
          <label>Pensamento<select value={thinking} onChange={e => setThinking(e.target.value)}>{thoughts.map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></label>
        </div>
        <div className="codex-status"><span /> {loading ? 'Gerando resposta' : 'Pronto'}</div>
      </header>

      <div className="codex-workarea">
        {panel === 'editor' && selectedFile ? <div className="codex-editor-view"><div className="codex-tab"><FileIcon path={selectedFile}/>{selectedFile}</div><pre>{selectedContent || 'Conteúdo carregando...'}</pre></div> : <div className="codex-chat-view">
          {!messages.length && <div className="codex-welcome"><div className="codex-mark large"/><h1>O que vamos construir?</h1><p>Peça para criar, explicar, corrigir ou transformar qualquer coisa.</p><div className="codex-suggestions"><button onClick={() => setPrompt('Crie um site moderno de carros')}>Criar um site</button><button onClick={() => setPrompt('Analise meu projeto e encontre bugs')}>Encontrar bugs</button><button onClick={() => setPrompt('Explique a arquitetura deste projeto')}>Analisar projeto</button></div></div>}
          {messages.map((message, index) => <article key={index} className={`codex-message ${message.role}`}><div className="codex-avatar">{message.role === 'user' ? 'Você' : 'P'}</div><div className="codex-message-body">{message.text || (loading && index === messages.length - 1 ? 'Pensando...' : '')}</div></article>)}
          <div ref={bottomRef}/>
        </div>}
      </div>

      {error && <div className="codex-error">{error}</div>}
      <div className="codex-composer"><label className="attach">+<input type="file" multiple onChange={upload} hidden /></label><textarea ref={inputRef} value={prompt} placeholder="Peça qualquer coisa ao Prism Codex..." onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} /><button className="send" disabled={loading || !prompt.trim()} onClick={send}>{loading ? '...' : '↑'}</button><small>Enter envia · Shift + Enter quebra linha</small></div>
    </section>

    <aside className="codex-right-panel">
      <div className="codex-right-tabs"><button className={panel === 'preview' ? 'active' : ''} onClick={() => setPanel('preview')}>Preview</button><button className={panel === 'editor' ? 'active' : ''} onClick={() => setPanel('editor')}>Código</button><button>Terminal</button></div>
      {panel === 'preview' ? <iframe title="Prism preview" sandbox="allow-scripts" srcDoc={preview || '<!doctype html><html><body style="margin:0;background:#111;color:#aaa;font:14px system-ui;display:grid;place-items:center;height:100vh"><div><strong>Preview do projeto</strong><br><span>Quando o Codex gerar uma aplicação, ela aparecerá aqui.</span></div></body></html>'}/> : <div className="codex-side-code"><pre>{selectedContent || 'Selecione um arquivo para visualizar o código.'}</pre></div>}
    </aside>
  </main>;
}
