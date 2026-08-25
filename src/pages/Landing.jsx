import { Link } from 'react-router-dom';

const models = [
  ['Nano 1.0A', 'Rápido para tarefas simples'],
  ['Mini 1.0A', 'Equilíbrio para o dia a dia'],
  ['Edge 1.0A', 'Código com resposta rápida'],
  ['Tex 1.0A', 'Texto, contexto e análise'],
  ['Taff 2.0', 'Projetos que exigem mais'],
];

const plans = [
  ['Free', 'R$ 0', 'Para conhecer o Prism.'],
  ['Base', 'R$ 29', 'Para usar com frequência.'],
  ['Medium', 'R$ 59', 'Para projetos recorrentes.'],
  ['Pro', 'R$ 119', 'Para construir sem apertar o limite.'],
  ['Empresarial', 'Sob consulta', 'Para equipes e operações maiores.'],
];

export default function Landing() {
  return (
    <div>
      <header className="site-nav">
        <div className="shell nav-inner">
          <Link className="brand" to="/" aria-label="Prism IA, página inicial"><span className="brand-mark">P</span><span>Prism IA</span></Link>
          <nav className="nav-actions" aria-label="Navegação principal">
            <Link className="button button-subtle" to="/login">Entrar</Link>
            <Link className="button button-primary" to="/register">Começar</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="shell hero">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">Prism IA</div>
              <h1>Uma ferramenta que fica fora do caminho.</h1>
              <p className="hero-copy">Converse, escreva, programe e desenvolva projetos em um espaço pensado para sessões longas. Sem uma parede de controles. Sem ruído desnecessário.</p>
              <div className="hero-actions">
                <Link className="button button-warm" to="/register">Criar conta</Link>
                <Link className="button" to="/login">Entrar</Link>
              </div>
            </div>
            <div className="hero-note">
              <strong>Calmo por design</strong>
              Hierarquia clara, tipografia confortável e ferramentas secundárias mantidas fora do centro da experiência.
            </div>
          </div>
        </section>

        <section className="shell section">
          <div className="section-head"><div><div className="eyebrow">Experiência</div><h2>Feito para trabalhar, não para impressionar.</h2></div></div>
          <div className="story-grid">
            <article className="story-card"><div className="story-number">01</div><h3>Conversa primeiro</h3><p>O trabalho começa no chat. O restante só aparece quando realmente ajuda.</p></article>
            <article className="story-card"><div className="story-number">02</div><h3>Contexto contínuo</h3><p>Conversations and projects stay organized so returning to a task does not mean starting over.</p></article>
            <article className="story-card"><div className="story-number">03</div><h3>Modelos por tarefa</h3><p>Modelos diferentes podem participar do fluxo sem obrigar você a aprender uma interface diferente para cada um.</p></article>
            <article className="story-card"><div className="story-number">04</div><h3>Espaço para criar</h3><p>Contraste confortável, movimento discreto e uma interface que não tenta ocupar mais atenção do que o trabalho.</p></article>
          </div>
        </section>

        <section className="shell section">
          <div className="section-head"><div><div className="eyebrow">Modelos</div><h2>Escolha pelo tipo de trabalho.</h2></div></div>
          <div className="model-rail">
            {models.map(([name, desc], index) => <article className="model-chip" key={name}><small>0{index + 1}</small><strong>Prism {name}</strong><small>{desc}</small></article>)}
          </div>
        </section>

        <section className="shell section" id="planos">
          <div className="section-head"><div><div className="eyebrow">Planos</div><h2>Comece pequeno. Mude quando precisar.</h2></div></div>
          <div className="price-grid">
            {plans.map(([name, price, description], index) => <article className={`price-card ${index === 3 ? 'featured' : ''}`} key={name}><h3>{name}</h3><div className="price">{price}</div><p>{description}</p>{index === 3 && <span className="eyebrow">Mais completo</span>}</article>)}
          </div>
        </section>
      </main>
      <footer className="shell footer">Prism IA · um espaço para pensar, construir e voltar ao trabalho.</footer>
    </div>
  );
}
