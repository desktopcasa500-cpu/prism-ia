import { useNavigate } from 'react-router-dom';

const tools = [
  ['ARQUIVOS', 'Leia, organize e revise o projeto com contexto de arquivos.'],
  ['CÓDIGO', 'Planeje implementações, refatore trechos e explique decisões técnicas.'],
  ['GITHUB', 'Conecte seu repositório quando a integração estiver autorizada.'],
];

export default function Codex() {
  const navigate = useNavigate();
  return (
    <main className="codex-page">
      <header className="codex-header">
        <button className="codex-brand" onClick={() => navigate('/chat')}><span className="codex-pixel-mark" /> Prism Codex</button>
        <button className="codex-back" onClick={() => navigate('/chat')}>Voltar ao chat</button>
      </header>
      <section className="codex-hero">
        <p className="codex-kicker">PRISM / CODEX</p>
        <h1>Um espaço para construir software.</h1>
        <p>O Codex transforma a conversa em trabalho técnico: contexto, código, revisão e execução organizada em um único espaço.</p>
      </section>
      <section className="codex-grid">
        {tools.map(([title, description], index) => (
          <article className="codex-card" key={title}>
            <span className="codex-number">0{index + 1}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <section className="codex-start">
        <div><span className="codex-kicker">COMEÇAR</span><h2>Abra uma conversa técnica.</h2><p>O contexto da sua sessão permanece separado das outras conversas.</p></div>
        <button onClick={() => navigate('/chat')}>Abrir chat <span>→</span></button>
      </section>
    </main>
  );
}
