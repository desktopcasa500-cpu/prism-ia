import { useState } from 'react';

const models = [
  'Prism Nano 1.0',
  'Prism Mini 1.0',
  'Prism Tex 1.5',
  'Prism Taff 1.0',
  'Prism Taff 2.0 Ultra Code'
];

const thoughts = ['Baixo', 'Médio', 'Alto', 'Extra', 'MAX'];

export default function Codex() {
  const [model, setModel] = useState(models[1]);
  const [thinking, setThinking] = useState('Médio');
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);

  function send(text) {
    if (!text.trim()) return;
    setMessages((old) => [...old, { role: 'user', text }]);
  }

  return (
    <main className="codex-page codex-workspace">
      <aside className="codex-sidebar">
        <div className="codex-brand"><span className="codex-pixel-mark" /> Prism Codex</div>
        <button>Novo projeto</button>
        <section>
          <small>Projetos</small>
          <p>Nenhum projeto aberto</p>
        </section>
        <section>
          <small>Arquivos</small>
          {files.map((f) => <p key={f}>{f}</p>)}
        </section>
      </aside>

      <section className="codex-main">
        <header className="codex-toolbar">
          <select value={model} onChange={(e)=>setModel(e.target.value)}>
            {models.map((m)=><option key={m}>{m}</option>)}
          </select>
          <select value={thinking} onChange={(e)=>setThinking(e.target.value)}>
            {thoughts.map((t)=><option key={t}>{t}</option>)}
          </select>
        </header>

        <div className="codex-chat">
          {messages.length === 0 ? (
            <div className="codex-empty">
              <h1>Prism Codex</h1>
              <p>Crie sites, sistemas, jogos e código com contexto completo.</p>
            </div>
          ) : messages.map((m,i)=><article key={i}>{m.text}</article>)}
        </div>

        <div className="codex-input">
          <input type="file" multiple onChange={(e)=>setFiles([...e.target.files].map(f=>f.name))}/>
          <input placeholder="Peça para criar ou editar um projeto..." onKeyDown={(e)=>e.key==='Enter'&&send(e.currentTarget.value)}/>
        </div>
      </section>

      <aside className="codex-preview">
        <header>Preview</header>
        <div>HTML / React preview integrado aparecerá aqui.</div>
        <section className="codex-diff">
          <p className="removed">-80 linhas removidas</p>
          <p className="added">+30 linhas adicionadas</p>
        </section>
      </aside>
    </main>
  );
}
