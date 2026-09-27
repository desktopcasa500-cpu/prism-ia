import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PrismCodexIntroBrutalist from './PrismCodexIntroBrutalist.jsx';
import { useAuth } from '../lib/auth.jsx';
import { modelItems } from '../content/prismTexts.js';

const TAFF = modelItems.find((item) => item.id === 'taff');

const USE_CASES = [
  { n: '01', title: 'Jogos', body: 'Mecânicas, loops de gameplay e estrutura de projeto prontos para evoluir, não só uma demo estática.' },
  { n: '02', title: 'Sites', body: 'Do layout à responsividade, com componentes reais e organização de projeto pensada para continuar depois do primeiro deploy.' },
  { n: '03', title: 'Backend completo', body: 'Rotas, modelos de dados e integrações — a base de um sistema funcional, não apenas um endpoint isolado.' },
];

const TAFF_PARALLAX_IMAGES = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_faffafdc-20ef-435d-9bc5-6fdf1edf49cc.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_ee56e65c-07e3-4d8d-9121-a7c34396767c.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_7087decc-7b4f-4504-bd4b-edd312316c87.png',
];

function Header() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';
  return <header className="site-header">
    <Link to="/" className="site-brand"><span className="site-mark" />PRISM IA</Link>
    <nav>
      <Link to="/informacoes">Informações</Link>
      <Link to="/modelos">Modelos</Link>
      <Link to="/termos">Termos</Link>
    </nav>
    {user ? <Link to="/chat" className="site-account"><span>{label.slice(0, 2).toUpperCase()}</span>{label}</Link> : <Link to="/login" className="site-login">Login</Link>}
  </header>;
}

function TaffParallax({ children }) {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const title = root.querySelector('.taff-intro h1');
    const leftImage = root.querySelector('.taff-parallax-column--left .taff-parallax-image');
    const centerImage = root.querySelector('.taff-parallax-column--center .taff-parallax-image');
    const rightImage = root.querySelector('.taff-parallax-column--right .taff-parallax-image');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frame = 0;

    const render = () => {
      frame = 0;
      const top = Math.max(0, window.scrollY || window.pageYOffset || 0);
      const rootTop = root.getBoundingClientRect().top + top;
      const localScroll = Math.max(0, top - rootTop);
      const sideOffset = Math.min(180, localScroll * 0.17);
      const centerOffset = Math.min(96, localScroll * 0.07);
      const titleProgress = Math.min(1, localScroll / Math.max(window.innerHeight * 1.15, 1));
      const pageProgress = Math.min(1, localScroll / Math.max(root.offsetHeight - window.innerHeight, 1));
      const titleOffset = reducedMotion ? 0 : titleProgress * -18;
      const titleScale = reducedMotion ? 1 : 1 - titleProgress * 0.025;

      root.style.setProperty('--taff-parallax-left', reducedMotion ? '0px' : `${sideOffset}px`);
      root.style.setProperty('--taff-parallax-center', reducedMotion ? '0px' : `${centerOffset}px`);
      root.style.setProperty('--taff-parallax-right', reducedMotion ? '0px' : `${sideOffset * -1}px`);
      root.style.setProperty('--taff-title-y', `${titleOffset}px`);
      root.style.setProperty('--taff-title-scale', titleScale.toFixed(4));
      root.style.setProperty('--taff-scroll-progress', pageProgress.toFixed(4));

      if (leftImage) leftImage.style.transform = 'translate3d(0,var(--taff-parallax-left),0) scale(1.04)';
      if (centerImage) centerImage.style.transform = 'translate3d(0,var(--taff-parallax-center),0) scale(1.02)';
      if (rightImage) rightImage.style.transform = 'translate3d(0,var(--taff-parallax-right),0) scale(1.04)';
      if (title) title.style.transform = 'translate3d(0,var(--taff-title-y),0) scale(var(--taff-title-scale))';
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(render);
    };

    render();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const targets = root.querySelectorAll('[data-taff-reveal]');
    if (!targets.length || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef} className="taff-parallax-layout">
    <div className="taff-scroll-progress" aria-hidden="true"><span /></div>
    <div className="taff-scroll-index" aria-hidden="true"><span>TAFF 2.0</span><b>PRISM IA</b></div>
    <aside className="taff-parallax-column taff-parallax-column--left" aria-hidden="true">
      <div className="taff-parallax-image" style={{ backgroundImage: `url("${TAFF_PARALLAX_IMAGES[0]}")` }} />
    </aside>

    <div className="taff-parallax-column taff-parallax-column--center">
      <div className="taff-parallax-image taff-parallax-image--center" style={{ backgroundImage: `url("${TAFF_PARALLAX_IMAGES[1]}")` }} />
      <div className="taff-parallax-content">{children}</div>
    </div>

    <aside className="taff-parallax-column taff-parallax-column--right" aria-hidden="true">
      <div className="taff-parallax-image" style={{ backgroundImage: `url("${TAFF_PARALLAX_IMAGES[2]}")` }} />
    </aside>
  </div>;
}

export default function TaffPresentation() {
  const { user } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const ctaTo = user ? '/chat' : '/register';
  const ctaLabel = user ? 'Usar Prism Taff 2.0' : 'Criar conta e testar';

  return <div className="editorial-page brutal-library taff-page">
    <Header />

    <TaffParallax>
      <main>
        <section className="page-intro taff-intro" data-taff-reveal>
          <div className="eyebrow taff-seal"><span className="taff-seal-dot" /> RELEASE — PRISM TAFF 2.0</div><div className="taff-hero-code">NVIDIA / GROQ / OPENCODE ZEN <span>·</span> ULTRACODE</div>
          <h1>Pensamento<br/>em <em>velocidade</em><br/>de produção.</h1>
          <p className="lead">{TAFF?.summary}</p>
          <div className="taff-cta-row">
            <Link className="taff-cta-primary" to={ctaTo}>{ctaLabel}</Link>
            <button type="button" className="taff-cta-secondary" onClick={() => setShowDemo(true)}>Ver demonstração</button>
          </div>
        </section>

        <section className="taff-proof" data-taff-reveal>
          <article><span>01</span><strong>Contexto</strong><p>Pedido, arquivos e histórico entram no mesmo trabalho.</p></article>
          <article><span>02</span><strong>Execução</strong><p>O modelo trabalha sobre a tarefa, não só sobre a conversa.</p></article>
          <article><span>03</span><strong>Revisão</strong><p>Resultado, alterações e artefatos continuam visíveis.</p></article>
        </section>

        <section className="reading taff-about" data-taff-reveal>
          <p>{TAFF?.body}</p>
        </section>

        <section className="feature-list taff-cases" data-taff-reveal>
          {USE_CASES.map((item) => <article key={item.n}>
            <span>{item.n}</span>
            <div><h2>{item.title}</h2><p>{item.body}</p></div>
          </article>)}
        </section>

        <section className="ultra taff-closing" data-taff-reveal>
          <span>DO PEDIDO AO PRODUTO</span>
          <h2>O modelo de<br/>ponta a ponta.</h2>
          <p>Prism Taff 2.0 é o modelo flagship da linha Prism: mais capacidade de processamento, mais camadas de verificação, resultado pronto para revisar e evoluir.</p>
        </section>

        <section className="closing-note taff-final-cta" data-taff-reveal>
          <span>PRÓXIMO PASSO</span>
          <p>Disponível para quem já usa Prism IA e para quem está começando agora.</p>
          <Link to={ctaTo}>{ctaLabel} →</Link>
        </section>
      </main>
    </TaffParallax>

    {showDemo && <PrismCodexIntroBrutalist onComplete={() => setShowDemo(false)} />}
  </div>;
}
