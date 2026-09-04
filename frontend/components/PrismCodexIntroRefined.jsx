import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v5_seen';
const DURATION = 10000;
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const range = (time, start, end) => clamp((time - start) / (end - start));

export default function PrismCodexIntroRefined({ onComplete }) {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [time, setTime] = useState(0);
  const done = useRef(false);
  const complete = () => { if (done.current) return; done.current = true; localStorage.setItem(INTRO_KEY, '1'); onComplete?.(); };

  useEffect(() => {
    if (reduced) { complete(); return undefined; }
    const started = performance.now();
    let frame;
    const tick = (now) => {
      const next = Math.min(now - started, DURATION);
      setTime(next);
      if (next < DURATION) frame = requestAnimationFrame(tick); else complete();
    };
    frame = requestAnimationFrame(tick);
    const onKey = (event) => { if (event.key === 'Escape') complete(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); };
  }, [reduced]);

  const opening = ease(range(time, 0, 2200));
  const prompt = ease(range(time, 1700, 4300));
  const workspace = ease(range(time, 3900, 6900));
  const ending = ease(range(time, 6500, DURATION));

  return <section className="prism-intro-v5" aria-label="Apresentação do Prism Codex">
    <header className="pintro-v5-header">
      <span>Prism Codex</span>
      <button onClick={complete}>Pular</button>
    </header>

    <main className="pintro-v5-stage">
      <section className="pintro-v5-slide pintro-v5-slide-opening" style={{ opacity: 1 - prompt, transform: `translateY(${(1 - opening) * 12}px)` }}>
        <div className="pintro-v5-center">
          <p className="pintro-v5-overline">Prism IA</p>
          <h1>Prism Codex</h1>
          <p className="pintro-v5-subtitle">Um espaço para construir software com contexto.</p>
        </div>
      </section>

      <section className="pintro-v5-slide pintro-v5-slide-prompt" style={{ opacity: prompt * (1 - workspace), transform: `translateY(${28 - prompt * 28}px)` }}>
        <div className="pintro-v5-column">
          <p className="pintro-v5-overline">01</p>
          <h2>Comece pelo trabalho.</h2>
          <div className="pintro-v5-input"><span>Você</span><strong>Quero transformar esta ideia em um produto.</strong><i /></div>
          <p className="pintro-v5-note">Descreva o que precisa. O Codex mantém a conversa, o contexto e o projeto juntos.</p>
        </div>
      </section>

      <section className="pintro-v5-slide pintro-v5-slide-workspace" style={{ opacity: workspace * (1 - ending), transform: `translateY(${18 - workspace * 18}px)` }}>
        <div className="pintro-v5-wide">
          <div className="pintro-v5-section-head"><div><p className="pintro-v5-overline">02</p><h2>O trabalho acontece no workspace.</h2></div><span>arquivos · código · preview</span></div>
          <div className="pintro-v5-workspace">
            <aside><small>PROJETO</small><span>src</span><b>App.jsx</b><span>styles.css</span><span>package.json</span></aside>
            <div className="pintro-v5-editor"><header><span>App.jsx</span><small>editando</small></header><pre>{`export default function App() {\n  return (\n    <main>\n      <h1>Construa algo real.</h1>\n    </main>\n  );\n}`}</pre></div>
            <div className="pintro-v5-preview"><header><span>Preview</span><small>ao lado</small></header><div className="pintro-v5-preview-page"><div><b>Seu produto</b><span>cresce junto com o código.</span></div></div></div>
          </div>
        </div>
      </section>

      <section className="prism-intro-v5-slide pintro-v5-slide-end" style={{ opacity: ending, transform: `translateY(${20 - ending * 20}px)` }}>
        <div className="pintro-v5-center pintro-v5-end-center">
          <p className="pintro-v5-overline">03</p>
          <h2>Pronto para começar.</h2>
          <p className="pintro-v5-subtitle">Conversa para pensar. Codex para construir.</p>
          <button className="pintro-v5-enter" onClick={complete}>Entrar no Codex</button>
        </div>
      </section>
    </main>

    <footer className="pintro-v5-footer"><span>Esc para pular</span><span>{String(Math.min(3, Math.floor(time / 3300) + 1)).padStart(2, '0')} / 03</span></footer>
  </section>;
}
