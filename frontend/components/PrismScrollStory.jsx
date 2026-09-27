import { useEffect, useRef } from 'react';
import './prism-scroll-story.css';

const PARALLAX_IMAGES = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_faffafdc-20ef-435d-9bc5-6fdf1edf49cc.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_ee56e65c-07e3-4d8d-9121-a7c34396767c.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_7087decc-7b4f-4504-bd4b-edd312316c87.png',
];

const chapters = [
  {
    number: '01',
    label: 'ENTRADA',
    title: 'Você define o trabalho.',
    text: 'A intenção, o contexto e os arquivos entram juntos. A Prism reduz a distância entre uma ideia e aquilo que precisa ser construído.',
  },
  {
    number: '02',
    label: 'ROTEAMENTO',
    title: 'O trabalho encontra o motor certo.',
    text: 'Tarefas diferentes recebem estratégias diferentes. Código, análise, revisão e síntese não precisam seguir o mesmo caminho.',
  },
  {
    number: '03',
    label: 'EXECUÇÃO',
    title: 'A resposta vira trabalho real.',
    text: 'Arquivos, alterações, comandos e resultados aparecem no mesmo fluxo. O Codex trabalha sobre o projeto, não apenas sobre uma caixa de texto.',
  },
  {
    number: '04',
    label: 'REVISÃO',
    title: 'Você continua no controle.',
    text: 'Revise, aceite, rejeite, baixe ou continue. O resultado permanece visível e editável até o último passo.',
  },
];

export default function PrismScrollStory() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const root = sectionRef.current;
    if (!root) return undefined;

    const leftImage = root.querySelector('.prism-scroll-story__image--left');
    const centerImage = root.querySelector('.prism-scroll-story__image--center');
    const rightImage = root.querySelector('.prism-scroll-story__image--right');
    const title = root.querySelector('.prism-scroll-story__hero-title');
    const progress = root.querySelector('.prism-scroll-story__progress span');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frame = 0;

    const render = () => {
      frame = 0;
      const pageTop = window.scrollY || window.pageYOffset || 0;
      const rootTop = root.getBoundingClientRect().top + pageTop;
      const localScroll = Math.max(0, pageTop - rootTop);
      const total = Math.max(1, root.offsetHeight - window.innerHeight);
      const pageProgress = Math.min(1, localScroll / total);

      if (progress) progress.style.transform = `scaleX(${pageProgress})`;

      if (reducedMotion) {
        if (leftImage) leftImage.style.transform = 'none';
        if (centerImage) centerImage.style.transform = 'none';
        if (rightImage) rightImage.style.transform = 'none';
        if (title) title.style.transform = 'none';
        return;
      }

      const sideOffset = Math.min(150, localScroll * 0.09);
      const centerOffset = Math.min(54, localScroll * 0.035);
      const titleProgress = Math.min(1, localScroll / Math.max(window.innerHeight * 1.2, 1));
      const titleY = titleProgress * -20;
      const titleScale = 1 - titleProgress * 0.025;

      if (leftImage) leftImage.style.transform = `translate3d(0,${sideOffset}px,0) scale(1.045)`;
      if (centerImage) centerImage.style.transform = `translate3d(0,${centerOffset}px,0) scale(1.02)`;
      if (rightImage) rightImage.style.transform = `translate3d(0,${sideOffset * -1}px,0) scale(1.045)`;
      if (title) title.style.transform = `translate3d(0,${titleY}px,0) scale(${titleScale})`;
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(render);
    };

    const revealTargets = root.querySelectorAll('[data-scroll-reveal]');
    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
      revealTargets.forEach((element) => observer.observe(element));
    } else {
      revealTargets.forEach((element) => element.classList.add('is-visible'));
    }

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  return (
    <section ref={sectionRef} className="prism-scroll-story" aria-label="Como a Prism funciona">
      <div className="prism-scroll-story__progress" aria-hidden="true"><span /></div>

      <aside className="prism-scroll-story__side prism-scroll-story__side--left" aria-hidden="true">
        <div className="prism-scroll-story__side-label"><span>PRISM / 01</span><b>CONTEXT</b></div>
        <div className="prism-scroll-story__image prism-scroll-story__image--left" style={{ backgroundImage: `url("${PARALLAX_IMAGES[0]}")` }} />
      </aside>

      <div className="prism-scroll-story__center">
        <div className="prism-scroll-story__center-image">
          <div className="prism-scroll-story__image prism-scroll-story__image--center" style={{ backgroundImage: `url("${PARALLAX_IMAGES[1]}")` }} />
        </div>

        <section className="prism-scroll-story__hero" data-scroll-reveal>
          <div className="prism-scroll-story__hero-meta">
            <span>PRISM / COMO FUNCIONA</span>
            <span>ROLE PARA ENTRAR</span>
          </div>
          <h2 className="prism-scroll-story__hero-title">Da intenção<br /><em>ao resultado.</em></h2>
          <p>Uma camada de engenharia que transforma uma conversa em trabalho: contexto, roteamento, execução e revisão no mesmo fluxo.</p>
          <span className="prism-scroll-story__scroll-cue">SCROLL <b>↓</b></span>
        </section>

        <div className="prism-scroll-story__chapters">
          {chapters.map((chapter) => (
            <article className="prism-scroll-story__chapter" data-scroll-reveal key={chapter.number}>
              <div className="prism-scroll-story__chapter-index">
                <span>{chapter.number}</span>
                <small>{chapter.label}</small>
              </div>
              <div className="prism-scroll-story__chapter-body">
                <h3>{chapter.title}</h3>
                <p>{chapter.text}</p>
              </div>
            </article>
          ))}
        </div>

        <section className="prism-scroll-story__finish" data-scroll-reveal>
          <span>PRISM IA / 2026</span>
          <h3>Trabalho real.<br /><em>Visível. Editável.</em></h3>
        </section>
      </div>

      <aside className="prism-scroll-story__side prism-scroll-story__side--right" aria-hidden="true">
        <div className="prism-scroll-story__side-label"><span>PRISM / 02</span><b>EXECUTION</b></div>
        <div className="prism-scroll-story__image prism-scroll-story__image--right" style={{ backgroundImage: `url("${PARALLAX_IMAGES[2]}")` }} />
      </aside>
    </section>
  );
}
