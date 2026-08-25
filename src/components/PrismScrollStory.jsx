import { useEffect, useRef, useState } from 'react';
import './prism-scroll-story.css';

const stories = [
  {
    index: '01',
    eyebrow: 'ENTRADA',
    title: 'Você define o trabalho.',
    text: 'A Prism recebe a intenção, o contexto e os arquivos que realmente importam. Nada de formulários para cada detalhe.',
    mark: 'INPUT'
  },
  {
    index: '02',
    eyebrow: 'ROTEAMENTO',
    title: 'O trabalho encontra o motor certo.',
    text: 'A plataforma seleciona o modelo e a estratégia de execução adequados ao tipo de tarefa, em vez de tratar todo pedido como uma conversa igual.',
    mark: 'ROUTE'
  },
  {
    index: '03',
    eyebrow: 'EXECUÇÃO',
    title: 'A resposta vira trabalho real.',
    text: 'Código, arquivos, alterações e resultados aparecem no mesmo fluxo. O Codex trabalha sobre o projeto, não apenas sobre uma caixa de texto.',
    mark: 'BUILD'
  },
  {
    index: '04',
    eyebrow: 'RESULTADO',
    title: 'Você continua no controle.',
    text: 'Revise, aceite, rejeite, baixe ou continue. A Prism deixa o resultado visível e editável até o último passo.',
    mark: 'SHIP'
  }
];

export default function PrismScrollStory() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;
      setDistance(Math.max(0, track.scrollWidth - section.clientWidth));
    };

    const update = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const next = Math.min(1, Math.max(0, -rect.top / scrollable));
      setProgress(next);
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
            style={{ transform: `translate3d(${-distance * progress}px, 0, 0)` }}
          >
            <article className="prism-scroll-story__intro">
              <p className="prism-scroll-story__kicker">NÃO É UMA CAIXA PRETA</p>
              <h2>Da intenção ao resultado.</h2>
              <p>Um sistema de trabalho que mostra o que acontece entre o seu pedido e aquilo que a Prism entrega.</p>
            </article>
            {stories.map((story) => (
              <article className="prism-scroll-story__card" key={story.index}>
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
              <span>PRISM IA</span>
              <strong>Trabalho real. Visível. Editável.</strong>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
