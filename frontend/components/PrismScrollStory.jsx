import { useEffect, useRef, useState } from 'react';
import './prism-scroll-story.css';

const stories = [
  {
    kind: 'black',
    index: '01',
    eyebrow: 'O MÉTODO',
    title: 'Mais de um motor. Uma direção.',
    text: 'A Prism distribui cada etapa do trabalho entre motores especializados e reúne o resultado em um único fluxo.',
    mark: 'PRISM / SYSTEM'
  },
  {
    index: '02',
    eyebrow: 'ENTRADA',
    title: 'Você define o trabalho.',
    text: 'A intenção, o contexto e os arquivos entram juntos. A plataforma reduz a distância entre uma ideia e aquilo que precisa ser construído.',
    mark: 'INPUT'
  },
  {
    index: '03',
    eyebrow: 'ROTEAMENTO',
    title: 'O trabalho encontra o motor certo.',
    text: 'Tarefas diferentes recebem estratégias diferentes. Código, análise, revisão e síntese não precisam seguir o mesmo caminho.',
    mark: 'ROUTE'
  },
  {
    index: '04',
    eyebrow: 'EXECUÇÃO',
    title: 'A resposta vira trabalho real.',
    text: 'Arquivos, alterações e resultados aparecem no mesmo fluxo. O Codex trabalha sobre o projeto, não apenas sobre uma caixa de texto.',
    mark: 'BUILD'
  },
  {
    index: '05',
    eyebrow: 'RESULTADO',
    title: 'Você continua no controle.',
    text: 'Revise, aceite, rejeite, baixe ou continue. O resultado permanece visível e editável até o último passo.',
    mark: 'SHIP'
  }
];

export default function PrismScrollStory() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const distanceRef = { current: 0 };
    let frame = 0;

    const measure = () => {
      const nextDistance = Math.max(0, track.scrollWidth - section.clientWidth);
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
    };

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const nextProgress = Math.min(1, Math.max(0, -rect.top / scrollable));
      setProgress(nextProgress);

      if (!reducedMotion) {
        const eased = nextProgress * nextProgress * (3 - 2 * nextProgress);
        const drift = (nextProgress - 0.5) * -18;
        const scale = 1 + eased * 0.01;
        track.style.transform = `translate3d(${-distanceRef.current * nextProgress}px,${drift}px,0) scale(${scale})`;
      } else {
        track.style.transform = 'none';
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    measure();
    schedule();
    window.addEventListener('resize', measure);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });

    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="prism-scroll-story" aria-label="Como a Prism funciona">
      <div className="prism-scroll-story__pin">
        <header className="prism-scroll-story__header">
          <span>PRISM / COMO FUNCIONA</span>
          <span>{String(Math.round(progress * 100)).padStart(2, '0')}%</span>
        </header>
        <div className="prism-scroll-story__viewport">
          <div
            ref={trackRef}
            className="prism-scroll-story__track"
            style={{ transform: `translate3d(${-distance * progress}px,0,0)` }}
          >
            <article className="prism-scroll-story__intro">
              <p className="prism-scroll-story__kicker">A PRIMEIRA COISA DEPOIS DO HERO</p>
              <h2>Da intenção ao resultado.</h2>
              <p>Role a página. A Prism muda de eixo e mostra o caminho do trabalho enquanto você continua rolando.</p>
              <span className="prism-scroll-story__peek">PRÓXIMO / 01 →</span>
            </article>
            {stories.map((story) => (
              <article
                className={`prism-scroll-story__card ${story.kind === 'black' ? 'prism-scroll-story__card--black' : ''}`}
                key={story.index}
              >
                <div className="prism-scroll-story__meta">
                  <span>{story.index}</span>
                  <span>{story.eyebrow}</span>
                </div>
                <div className="prism-scroll-story__body">
                  <div className="prism-scroll-story__mark">{story.mark}</div>
                  <h3>{story.title}</h3>
                  <p>{story.text}</p>
                </div>
              </article>
            ))}
            <article className="prism-scroll-story__end">
              <span>PRISM IA / 2026</span>
              <strong>Trabalho real.<br />Visível. Editável.</strong>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
