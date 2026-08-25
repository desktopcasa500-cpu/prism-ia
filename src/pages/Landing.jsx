import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import PrismScrollStory from '../components/PrismScrollStory.jsx';
import PrismNews from '../components/PrismNews.jsx';

const quickLinks = [
  ['01', 'Informações', 'O que existe por trás da Prism e como a plataforma organiza o trabalho.', '/informacoes'],
  ['02', 'Modelos', 'Conheça os modelos Prism e o papel de cada um dentro do sistema.', '/modelos'],
  ['03', 'Termos', 'Roteamento, motores, créditos, privacidade e limites explicados sem esconder a mecânica.', '/termos'],
];

function initials(user) {
  const text = user?.name || user?.email || 'P';
  return text.trim().slice(0, 2).toUpperCase();
}

export default function Landing() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';

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
        </nav>
        {user ? (
          <Link className="pixel-profile" to="/chat">
            <span className="pixel-avatar">{initials(user)}</span>
            <span>{label}</span>
          </Link>
        ) : (
          <Link className="pixel-login" to="/login">Login</Link>
        )}
      </header>

      <main>
        <section className="pixel-hero new-hero">
          <div className="pixel-hero-main">
            <div className="pixel-kicker">PRISM IA / 2026 / SOFTWARE ENGINEERING</div>
            <h1 className="pixel-title"><span>BUILD</span><span>WITH</span><span className="accent">MORE.</span></h1>
            <p className="pixel-hero-copy">Uma camada de engenharia que coloca diferentes motores de IA na mesma tarefa — para pensar, escrever, revisar e entregar software.</p>
            <div className="pixel-hero-actions">
              <Link className="pixel-cta" to={user ? '/chat' : '/register'}>{user ? 'Abrir plataforma' : 'Criar conta'}</Link>
              <Link className="pixel-cta secondary" to="/informacoes">Como funciona</Link>
            </div>
          </div>
          <aside className="pixel-hero-side">
            <div className="hero-meta"><span>PRISM / 001</span><span>ORCHESTRATION</span></div>
            <div className="pixel-grid-art" />
            <div className="hero-note">MULTIPLE ENGINES.<br />ONE WORKSPACE.</div>
          </aside>
        </section>

        <PrismScrollStory />

        <section className="home-intro">
          <span>01 / A IDEIA</span>
          <h2>Você descreve.<br /><em>A Prism organiza.</em></h2>
          <p>O trabalho começa como uma conversa. A plataforma transforma o pedido em etapas de raciocínio, código e validação e usa os motores certos para cada uma delas.</p>
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
          <div className="system-label">03 / O SISTEMA</div>
          <div className="system-art">
            <div className="node node-a">REASON</div><div className="node node-b">CODE</div><div className="node node-c">CHECK</div><div className="node node-d">SYNTHESIS</div>
            <div className="connector c1" /><div className="connector c2" /><div className="connector c3" />
          </div>
          <div className="system-copy">
            <h2>Não é uma IA.<br />É um fluxo.</h2>
            <p>Os modelos Prism são perfis de roteamento. Em tarefas simples, poucos motores são suficientes. Em tarefas complexas, eles podem trabalhar juntos e ter suas respostas comparadas antes da entrega.</p>
            <Link to="/termos">Entender o roteamento →</Link>
          </div>
        </section>

        <section className="home-bottom">
          <div><span>04 / ENTRAR</span><h2>Pronto para<br />construir?</h2></div>
          <div><p>Comece com uma conta gratuita e leve seus projetos para dentro do Prism Codex.</p><Link className="pixel-cta" to={user ? '/chat' : '/register'}>{user ? 'Ir para o Codex' : 'Começar agora'}</Link></div>
        </section>
      </main>

      <footer className="pixel-footer"><span>PRISM IA / ENGINEERING SOFTWARE</span><span>2026 / <Link to="/termos">TERMOS</Link></span></footer>
    </div>
  );
}
