import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useEffect, useRef, useState } from 'react';

const quickLinks = [
  ['01', 'Informações', 'O que existe por trás da Prism e como a plataforma organiza o trabalho.', '/informacoes'],
  ['02', 'Modelos', 'Conheça os modelos Prism e o papel de cada um dentro do sistema.', '/modelos'],
  ['03', 'Termos', 'Roteamento, motores, créditos, privacidade e limites explicados sem esconder a mecânica.', '/termos'],
];

const flow = [
  ['01', 'VOCÊ', 'Uma ideia, pergunta, arquivo ou projeto entra no sistema.'],
  ['02', 'PRISM', 'A tarefa é entendida, dividida e encaminhada conforme o que ela realmente precisa.'],
  ['03', 'MOTORES', 'Os motores adequados trabalham na tarefa, em sequência ou em paralelo quando necessário.'],
  ['04', 'SÍNTESE', 'Os resultados são comparados, verificados e transformados em uma única entrega.'],
];

function initials(user) {
  const text = user?.name || user?.email || 'P';
  return text.trim().slice(0, 2).toUpperCase();
}

function HowItWorks() {
  const sectionRef = useRef(null);
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const track = trackRef.current;
      if (!viewport || !track) return;
      setDistance(Math.max(0, track.scrollWidth - viewport.clientWidth));
    };

    const update = () => {
      const section = sectionRef.current;
      if (!section) return;
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      const value = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / range));
      setProgress(value);
    };

    measure();
    update();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <section className="home-process" ref={sectionRef}>
      <div className="process-sticky">
        <div className="process-top">
          <span>02 / COMO FUNCIONA</span>
          <span>{String(Math.round(progress * 100)).padStart(3, '0')}%</span>
        </div>
        <div className="process-window" ref={viewportRef}>
          <div
            className="process-track"
            ref={trackRef}
            style={{ transform: `translate3d(${-distance * progress}px,0,0)` }}
          >
            {flow.map(([number, title, text]) => (
              <article className="process-card" key={number}>
                <span>{number}</span>
                <div className="process-line" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="process-caption">
          <strong>CONTINUE DESCENDO.</strong>
          <p>A rolagem vertical controla a sequência horizontal. Você não troca de página: o sistema se revela diante de você.</p>
        </div>
      </div>
    </section>
  );
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

        <section className="home-intro">
          <span>01 / A IDEIA</span>
          <h2>Você descreve.<br /><em>A Prism organiza.</em></h2>
          <p>O trabalho começa como uma conversa. A plataforma transforma o pedido em etapas de raciocínio, código e validação e usa os motores certos para cada uma delas.</p>
        </section>

        <HowItWorks />

        <section className="home-links">
          {quickLinks.map(([number, title, text, href]) => (
            <Link to={href} className="home-link" key={title}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{text}</p></div>
              <b>↗</b>
            </Link>
          ))}
        </section>

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
