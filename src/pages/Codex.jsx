import { useEffect, useRef, useState } from 'react';
import { api, getAuthToken } from '../lib/api';

const models = [
  ['prism-nano-1.0', 'Prism Nano 1.0'],
  ['prism-mini-1.0', 'Prism Mini 1.0'],
  ['prism-tex-1.5', 'Prism Tex 1.5'],
  ['prism-taff-1.0', 'Prism Taff 1.0'],
  ['prism-taff-2.0', 'Prism Taff 2.0 Ultra Code'],
];
const thoughts = [['low','Baixo'],['medium','Médio'],['high','Alto'],['max','MAX'],['ultracode','Ultra Code']];

export default function Codex() {
  const [model, setModel] = useState('prism-mini-1.0');
  const [thinking, setThinking] = useState('medium');
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  const [session, setSession] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ projects }, { sessions }] = await Promise.all([api.get('/projects'), api.get('/chat/sessions')]);
        if (!active) return;
        let current = projects[0];
        if (!current) current = (await api.post('/projects', { name: 'Prism Codex' })).project;
        setProject(current);
        let currentSession = sessions[0];
        if (!currentSession) currentSession = (await api.post('/chat/sessions', { title: 'Nova conversa' })).session;
        setSession(currentSession);
        const history = await api.get(`/chat/sessions/${currentSession.id}/messages`);
        if (active) setMessages(history.messages.map(m => ({ role: m.role, text: m.content })));
        const projectFiles = await api.get(`/projects/${current.id}/files`);
        if (active) setFiles(projectFiles.files || []);
      } catch (error) {
        if (active) setMessages([{ role: 'assistant', text: `Não foi possível carregar o workspace: ${error.message}` }]);
      }
    })();
    return () => { active = false; };
  }, []);

  async function send() {
    if (!prompt.trim() || loading || !session) return;
    const text = prompt.trim();
    setPrompt('');
    setMessages(current => [...current, { role: 'user', text }, { role: 'assistant', text: '' }]);
    setLoading(true);
    try {
      const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
      const apiRoot = configuredApiUrl ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`) : '/api';
      const response = await fetch(`${apiRoot}/chat/sessions/${session.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ content: text, effort: thinking, model, stream: true }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Erro ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find(item => item.startsWith('data: '));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6));
          if (payload.type === 'delta') {
            setMessages(current => {
              const copy = [...current];
              const last = copy.length - 1;
              copy[last] = { ...copy[last], text: copy[last].text + payload.text };
              return copy;
            });
          }
        }
      }
    } catch (error) {
      setMessages(current => {
        const copy = [...current];
        copy[copy.length - 1] = { role: 'assistant', text: error.message || 'Erro no backend' };
        return copy;
      });
    } finally { setLoading(false); inputRef.current?.focus(); }
  }

  async function upload(event) {
    const selected = [...event.target.files];
    if (!selected.length || !project) return;
    setFiles(current => [...current, ...selected.map(file => ({ path: file.name, content: '' }))]);
    for (const file of selected) {
      const form = new FormData();
      form.append('files', file);
      try { await fetch('/api/uploads/analyze', { method: 'POST', headers: { Authorization: `Bearer ${getAuthToken()}` }, body: form }); } catch {}
    }
  }

  function changePreview(value) {
    setPreview(value);
    const looksLikeHtml = /<(!doctype|html|body|div|main|section|header|h1)\b/i.test(value);
    if (looksLikeHtml) setPreview(value);
  }

  return <main className="codex-page codex-workspace">
    <aside className="codex-sidebar">
      <div className="codex-brand"><span className="codex-pixel-mark"/> Prism Codex</div>
      <button onClick={() => window.location.reload()}>Novo projeto</button>
      <section><small>Projeto</small><p>{project?.name || 'Carregando...'}</p></section>
      <section><small>Arquivos</small>{files.length ? files.map(file => <p key={file.path}>{file.path}</p>) : <p>Nenhum arquivo</p>}</section>
    </aside>
    <section className="codex-main">
      <header className="codex-toolbar">
        <select value={model} onChange={e => setModel(e.target.value)}>{models.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <select value={thinking} onChange={e => setThinking(e.target.value)}>{thoughts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
      </header>
      <div className="codex-chat">
        {!messages.length && <div className="codex-empty"><h1>Prism Codex</h1><p>Crie, edite e analise projetos reais com IA.</p></div>}
        {messages.map((message, index) => <article key={index} className={message.role}>{message.text || (loading && index === messages.length - 1 ? 'Gerando...' : '')}</article>)}
      </div>
      <div className="codex-input">
        <input ref={inputRef} type="file" multiple onChange={upload}/>
        <input value={prompt} placeholder="Crie ou edite um projeto..." onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}/>
        <button disabled={loading} onClick={send}>{loading ? 'Gerando' : 'Enviar'}</button>
      </div>
    </section>
    <aside className="codex-preview">
      <header>Preview</header>
      <iframe title="preview" sandbox="allow-scripts" srcDoc={preview || '<main style="font-family:system-ui;padding:32px"><h2>Preview Prism</h2><p>O preview aparecerá aqui quando a IA gerar HTML.</p></main>'}/>
      <section className="codex-diff"><p className="removed">Diff disponível nas alterações do projeto</p><p className="added">Arquivos persistidos no banco</p></section>
    </aside>
  </main>;
}
