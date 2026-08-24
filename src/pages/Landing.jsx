import { Link } from 'react-router-dom';

const models = [
  ['Nano 1.0A', 'Rápido para o dia a dia'],
  ['Mini 1.0A', 'Equilíbrio e contexto'],
  ['Edge 1.0A', 'Velocidade para código'],
  ['Tex 1.0A', 'Análise e escrita'],
  ['Taff 2.0', 'Projetos complexos'],
];

const plans = [
  ['Free', 'R$ 0', 'Para conhecer o Prism.'],
  ['Base', 'R$ 29', 'Mais espaço para experimentar.'],
  ['Medium', 'R$ 59', 'Para projetos recorrentes.'],
  ['Pro', 'R$ 119', 'Potência para construir mais.'],
  ['Empresarial', 'Sob consulta', 'Equipe, escala e suporte.'],
];

export default function Landing() {
  return (
    <div>
      <header className="site-nav">
        <div className="shell nav-inner">
          <Link className="brand" to="/">
            <span className="brand-mark">P</span>
            <span>Prism IA</span>
          </Link>
          <nav className="nav-actions">
            <Link className="button button-subtle" to="/login">Entrar</Link>
            <Link className="button button-primary" to="/register">Começar</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="shell hero">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">Prism IA · laboratório criativo</div>
              <h1>Uma inteligência que <em>trabalha com você.</em></h1>
              <p className="hero-copy">Converse, escreva, programe e transforme uma ideia em projeto. O Prism organiza o trabalho para que a interface desapareça e a criação fique em primeiro plano.</p>
              <div className="hero-actions">
                <Link className="button button-warm" to="/register">Criar minha conta</Link>
                <Link className="button" to="/login">Já tenho conta</Link>
              </div>
            </div>
            <div className="hero-note">
              <strong>Feito para longas sessões</strong>
              Uma experiência calma, com hierarquia clara, respostas legíveis e ferramentas que aparecem quando fazem sentido — não uma parede de controles.
            </div>
          </div>
        </section>

        <section className="shell section">
          <div className="section-head">
            <div>
              <div className="eyebrow">O jeito Prism</div>
              <h2>Estrutura sem cara de painel.</h2>
            </div>
          </div>
          <div className="story-grid">
            <article className="story-card"><div className="story-number">01</div><h3>Conversa primeiro</h3><p>O chat é o centro do produto. Menus e ações secundárias não brigam com aquilo que você está criando.</p></article>
            <article className="story-card"><div className="story-number">02</div><h3>Modelos que trabalham juntos</h3><p>O Prism pode orquestrar diferentes modelos e fornecedores por tarefa, preservando uma experiência única para você.</p></article>
            <article className="story-card"><div className="story-number">03</div><h3>Projetos vivos</h3><p>Conversas, contexto e ideias ficam organizados para que você possa voltar exatamente de onde parou.</p></article>
            <article className="story-card"><div className="story-number">04</div><h3>Calmo de propósito</h3><p>Paleta quente, contraste confortável, movimento pequeno e detalhes que parecem desenhados, não renderizados por uma máquina.</p></article>
          </div>
        </section>

        <section className="shell section">
          <div className="section-head">
            <div><div className="eyebrow">Modelos Prism</div><h2>Escolha pelo trabalho.</h2></div>
          </div>
          <div className="model-rail">
            {models.map(([name, desc], index) => <article className="model-chip" key={name}><small>0{index + 1}</small><strong>Prism {name}</strong><small>{desc}</small></article>)}
          </div>
        </section>

        <section className="shell section" id="planos">
          <div className="section-head"><div><div className="eyebrow">Planos</div><h2>Comece pequeno. Cresça quando precisar.</h2></div></div>
          <div className="price-grid">
            {plans.map(([name, price, description], index) => <article className={`price-card ${index === 3 ? 'featured' : ''}`} key={name}><h3>{name}</h3><div className="price">{price}</div><p>{description}</p>{index === 3 && <span className="eyebrow" style={{color:'#8a573f'}}>Mais escolhido</span>}</article>)}
          </div>
        </section>
      </main>

      <footer className="shell footer">Prism IA · uma experiência para pensar, construir e criar.</footer>
    </div>
  );
}
