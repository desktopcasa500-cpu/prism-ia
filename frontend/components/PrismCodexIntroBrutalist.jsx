import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v3_seen';
const DURATION = 14500;
const PROMPT = 'Crie um site de roupas que pareça uma marca de verdade.';
const clamp = (n) => Math.max(0, Math.min(1, n));
const ease = (n) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const range = (time, start, end) => clamp((time - start) / (end - start));

function Scene({ children, className = '', style }) {
  return <div className={`pintro-scene ${className}`} style={style}>{children}</div>;
}

export default function PrismCodexIntroBrutalist({ onComplete }) {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [time, setTime] = useState(0);
  const done = useRef(false);

  const complete = () => {
    if (done.current) return;
    done.current = true;
    localStorage.setItem(INTRO_KEY, '1');
    onComplete?.();
  };

  useEffect(() => {
    if (reduced) { complete(); return undefined; }
    const started = performance.now();
    let frame;
    const tick = (now) => {
      const next = Math.min(now - started, DURATION);
      setTime(next);
      if (next < DURATION) frame = requestAnimationFrame(tick);
      else complete();
    };
    frame = requestAnimationFrame(tick);
    const onKey = (event) => event.key === 'Escape' && complete();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
    };
  }, [reduced]);

  return <section className="prism-intro-v3" aria-label="Apresentação do Prism Codex">
    <div className="pintro-v3-grain" />
    <header className="pintro-v3-header"><span>PRISM CODEX</span><span>APRESENTAÇÃO</span><button onClick={complete}>Pular <b>Esc</b></button></header>
    <div className="pintro-v3-progress"><i style={{ width: `${(time / DURATION) * 100}%` }} /></div>

    <Scene className="pintro-v3-opening" style={{ opacity: ease(range(time, 0, 2600)), transform: `translateY(${22 - ease(range(time, 0, 2600)) * 22}px)` }}>
      <small>PRISM IA</small>
      <h1>PRISM</h1>
      <p>Think. Make. Ship.</p>
      <div className="pintro-v3-ring" />
    </Scene>

    <Scene className="pintro-v3-prompt" style={{ opacity: ease(range(time, 2100, 4700)), transform: `translateY(${25 - ease(range(time, 2100, 4700)) * 25}px)` }}>
      <small>01 / PROMPT</small>
      <div className="pintro-v3-prompt-box"><span>PRISM CODEX</span><strong>{PROMPT.slice(0, Math.floor(PROMPT.length * range(time, 2300, 3900)))}</strong><em>context · files · tools</em></div>
    </Scene>

    <Scene className="pintro-v3-work" style={{ opacity: ease(range(time, 4300, 7600)) }}>
      <div className="pintro-v3-work-head"><small>02 / WORKSPACE</small><span>ONE PLACE</span></div>
      <div className="pintro-v3-workspace">
        <aside><b>PROJECT</b><span>src</span><span>App.jsx</span><span>styles.css</span><span>package.json</span></aside>
        <main><header><span>App.jsx</span><em>LIVE</em></header><pre>{`export default function App() {\n  return (\n    <main>\n      <h1>Build something real.</h1>\n    </main>\n  );\n}`}</pre></main>
        <div className="pintro-v3-result"><b>PREVIEW</b><div><strong>THE RESULT</strong><span>updates beside the code.</span></div></div>
      </div>
    </Scene>

    <Scene className="pintro-v3-connected" style={{ opacity: ease(range(time, 7300, 10100)), transform: `translateX(${35 - ease(range(time, 7300, 10100)) * 35}px)` }}>
      <small>03 / CONNECTED</small>
      <h2>Claude <i>×</i> Higgsfield <i>×</i> MCP</h2>
      <p>Ferramentas entram quando o trabalho pede.</p>
    </Scene>

    <Scene className="pintro-v3-agent" style={{ opacity: ease(range(time, 9800, 12500)) }}>
      <small>04 / AGENT</small>
      <div className="pintro-v3-agent-flow"><strong>ANALYZE</strong><i>→</i><strong>BUILD</strong><i>→</i><strong>REVIEW</strong></div>
      <div className="pintro-v3-agent-line"><i style={{ width: `${range(time, 10000, 12400) * 100}%` }} /></div>
    </Scene>

    <Scene className="pintro-v3-end" style={{ opacity: ease(range(time, 12100, DURATION)), transform: `scale(${.98 + ease(range(time, 12100, DURATION)) * .02})` }}>
      <div className="pintro-v3-mark">P</div>
      <strong>PRISM CODEX</strong>
      <span>Ready when you are.</span>
      <button onClick={complete}>Entrar</button>
    </Scene>

    <footer className="pintro-v3-footer"><span>PRISM IA</span><span>{String(Math.floor(time / 1000)).padStart(2, '0')} / 14</span></footer>
  </section>;
}
