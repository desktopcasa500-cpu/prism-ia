import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import PrismScrollStory from '../components/PrismScrollStory.jsx';
import PrismNews from '../components/PrismNews.jsx';

const quickLinks = [
  ['01', 'Informações', 'O que existe por trás da Prism e como a plataforma organiza o trabalho.', '/informacoes'],
  ['02', 'Modelos', 'Conheça os modelos Prism e o papel de cada um dentro do sistema.', '/modelos'],
  ['03', 'Termos', 'Roteamento, motores, créditos, privacidade e limites explicados sem esconder a mecânica.', '/termos'],
];

const capabilities = [
  ['CHAT', 'Conversa que vira execução', 'Peça, refine, compare e continue sem perder o contexto do trabalho.'],
  ['CODEX', 'Projeto aberto de verdade', 'Arquivos, alterações, preview e decisões ficam no mesmo espaço de trabalho.'],
  ['ROUTE', 'Modelos trabalhando em conjunto', 'A Prism pode distribuir partes diferentes da tarefa entre estratégias diferentes.'],
  ['REVIEW', 'Menos resposta. Mais resultado.', 'O foco é entregar algo que você possa revisar, editar, testar e usar.'],
];

function initials(user) {
  const text = user?.name || user?.email || 'P';
  return text.trim().slice(0, 2).toUpperCase();
}

export default function Landing() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';
  const primaryHref = user ? '/chat' : '/login';
  const primaryLabel = user ? 'Abrir a Prism' : 'Entrar e usar a IA';

  return (
    <div className="pixel-landing home-redesign">
      <header className="pixel-nav">
        <Link className="pixel-brand" to="/" aria-label="Prism IA">
          <span className="pixel-logo" />
          <span>PRISM IA</span>
        </Link>
        <nav className="pixel-navlinks">
          <Link to="/informacoes">Informações</Link>
          <Link to="/modelos">Modelos</Link>
          <Link to="/termos">Termos</Link>
          <a href="#sinal">Sinal</a>
        </nav>
        {user ? (
          <Link className="pixel-profile" to="/chat">
            <span className="pixel-avatar">{initials(user)}</span>
            <span>{label}</span>
          </Link>
        ) : (
          <Link className="pixel-login" to="/login">Entrar</Link>
        )}
      </header>

      <main>
        <section className="pixel-hero new-hero">
          <div className="pixel-hero-main">
            <div className="pixel-kicker">PRISM IA / 2026 / SOFTWARE ENGINEERING</div>
            <h1 className="pixel-title"><span>BUILD</span><span>WITH</span><span className="accent">MORE.</span></h1>
            <p className="pixel-hero-copy">Uma camada de engenharia que coloca diferentes motores de IA na mesma tarefa — para pensar, escrever, revisar e entregar software.</p>
            <div className="pixel-hero-actions">
              <Link className="pixel-cta pixel-cta-primary" to={primaryHref}>{primaryLabel}</Link>
              {!user && <Link className="pixel-cta secondary" to="/register">Criar conta</Link>}
              <Link className="pixel-cta secondary" to="/informacoes">Como funciona</Link>
            </div>
            <div className="hero-proof"><span>CHAT</span><i /> <span>CODEX</span><i /> <span>MODELS</span><i /> <span>WORKSPACE</span></div>
          </div>
          <aside className="pixel-hero-side">
            <div className="hero-meta"><span>PRISM / 001</span><span>ORCHESTRATION</span></div>
            <div className="pixel-grid-art" />
            <div className="hero-note"><b>MULTIPLE ENGINES.</b><br />ONE WORKSPACE.<br /><small>Uma interface para o trabalho inteiro.</small></div>
          </aside>
        </section>

        <PrismScrollStory />

        <section className="home-intro home-intro-expanded">
          <span>01 / A IDEIA</span>
          <div><h2>Você descreve.<br /><em>A Prism organiza.</em></h2><p>O trabalho começa como uma conversa. A plataforma transforma o pedido em etapas de raciocínio, código, revisão e validação e usa os motores certos para cada uma delas.</p></div>
          <div className="intro-stamp"><strong>PRISM</strong><span>INPUT → ROUTE → BUILD → REVIEW</span></div>
        </section>

        <section className="capability-section">
          <div className="section-index">02 / O QUE MUDA</div>
          <div className="capability-grid">
            {capabilities.map(([label, title, text]) => (
              <article className="capability-card" key={label}>
                <div className="capability-top"><span>{label}</span><b>↗</b></div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-links">
          {quickLinks.map(([number, title, text, href]) => (
            <Link to={href} className="home-link" key={title}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{text}</p></div>
              <b>↗</b>
            </Link>
          ))}
        </section>

        <PrismNews />

        <section className="home-system">
          <div className="system-label">05 / O SISTEMA</div>
          <div className="system-art">
            <div className="system-orbit orbit-one" /><div className="system-orbit orbit-two" />
            <div className="node node-a">REASON</div><div className="node node-b">CODE</div><div className="node node-c">CHECK</div><div className="node node-d">SYNTHESIS</div>
            <div className="connector c1" /><div className="connector c2" /><div className="connector c3" />
          </div>
          <div className="system-copy">
            <h2>Não é uma IA.<br />É um fluxo.</h2>
            <p>Os modelos Prism são perfis de roteamento. Em tarefas simples, poucos motores são suficientes. Em tarefas complexas, eles podem trabalhar juntos e ter suas respostas comparadas antes da entrega.</p>
            <Link to="/termos">Entender o roteamento →</Link>
          </div>
        </section>

        <section className="manifesto-section">
          <div className="manifesto-label">06 / PRINCÍPIO</div>
          <div className="manifesto-copy">
            <p className="manifesto-kicker">MENOS TEATRO. MAIS TRABALHO.</p>
            <h2>Uma ferramenta não precisa parecer uma máquina para fazer trabalho de máquina.</h2>
            <p>A Prism foi desenhada para ficar no caminho apenas quando precisa. A interface mostra o que importa, mantém o projeto acessível e deixa você decidir o próximo movimento.</p>
          </div>
          <div className="manifesto-mark">P / 26</div>
        </section>

        <section className="home-bottom">
          <div><span>07 / ENTRAR</span><h2>Pronto para<br />construir?</h2></div>
          <div><p>Entre na Prism e use a IA para conversar, escrever código, trabalhar em projetos e continuar de onde parou.</p><div className="bottom-actions"><Link className="pixel-cta" to={primaryHref}>{primaryLabel}</Link>{!user && <Link className="text-link" to="/register">Criar uma conta →</Link>}</div></div>
        </section>
      </main>

      <footer className="pixel-footer"><span>PRISM IA / ENGINEERING SOFTWARE</span><span>2026 / <Link to="/informacoes">INFO</Link> / <Link to="/modelos">MODELOS</Link> / <Link to="/termos">TERMOS</Link></span></footer>
    </div>
  );
}
