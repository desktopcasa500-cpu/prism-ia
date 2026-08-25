import { useState } from 'react';

const models = [
  'prism-nano-1.0',
  'prism-mini-1.0',
  'prism-tex-1.5',
  'prism-taff-1.0',
  'prism-taff-2.0'
];

const thoughts = [
  { id: 'low', name: 'Baixo' },
  { id: 'medium', name: 'Médio' },
  { id: 'high', name: 'Alto' },
  { id: 'max', name: 'MAX' },
  { id: 'ultracode', name: 'Ultra Code' }
];

export default function Codex() {
  const [model, setModel] = useState('prism-mini-1.0');
  const [thinking, setThinking] = useState('medium');
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!prompt.trim() || loading) return;

    const text = prompt;
    setPrompt('');
    setMessages((old) => [...old, { role: 'user', text }]);
    setLoading(true);

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ model, thinking, prompt: text })
      });

      const data = await response.json();
      const answer = data.text || data.error || 'Sem resposta do motor de IA.';

      setMessages((old) => [...old, { role: 'assistant', text: answer }]);

      if (answer.includes('<html') || answer.includes('<div')) {
        setPreview(answer);
      }
    } catch {
      setMessages((old) => [...old, { role: 'assistant', text: 'Erro ao conectar com o backend.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="codex-page codex-workspace">
      <aside className="codex-sidebar">
        <div className="codex-brand"><span className="codex-pixel-mark" /> Prism Codex</div>
        <button>Novo projeto</button>
        <section><small>Projetos</small><p>Nenhum projeto aberto</p></section>
        <section><small>Arquivos</small>{files.map((f)=><p key={f}>{f}</p>)}</section>
      </aside>

      <section className="codex-main">
        <header className="codex-toolbar">
          <select value={model} onChange={(e)=>setModel(e.target.value)}>
            {models.map((m)=><option key={m}>{m}</option>)}
          </select>
          <select value={thinking} onChange={(e)=>setThinking(e.target.value)}>
            {thoughts.map((t)=><option value={t.id} key={t.id}>{t.name}</option>)}
          </select>
        </header>

        <div className="codex-chat">
          {messages.length === 0 ? <div className="codex-empty"><h1>Prism Codex</h1><p>Crie, edite e execute projetos com IA.</p></div> : messages.map((m,i)=><article key={i} className={m.role}>{m.text}</article>)}
          {loading && <article className="assistant">Gerando código...</article>}
        </div>

        <div className="codex-input">
          <input type="file" multiple onChange={(e)=>setFiles([...e.target.files].map(f=>f.name))}/>
          <input value={prompt} placeholder="Crie ou edite um projeto..." onChange={(e)=>setPrompt(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&send()}/>
          <button onClick={send}>Enviar</button>
        </div>
      </section>

      <aside className="codex-preview">
        <header>Preview</header>
        <iframe title="preview" srcDoc={preview || '<h2>Preview do projeto</h2>'}/>
        <section className="codex-diff">
          <p className="removed">-80 linhas removidas</p>
          <p className="added">+30 linhas adicionadas</p>
        </section>
      </aside>
    </main>
  );
}
