import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v4_seen';
const DURATION = 12500;
const PROMPT = 'Crie um site que pareça uma marca de verdade.';
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const range = (time, start, end) => clamp((time - start) / (end - start));

function Scene({ children, className = '', style }) { return <div className={`pintro-v4-scene ${className}`} style={style}>{children}</div>; }

export default function PrismCodexIntroRefined({ onComplete }) {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [time, setTime] = useState(0);
  const done = useRef(false);
  const complete = () => { if (done.current) return; done.current = true; localStorage.setItem(INTRO_KEY, '1'); onComplete?.(); };

  useEffect(() => {
    if (reduced) { complete(); return undefined; }
    const started = performance.now(); let frame;
    const tick = (now) => { const next = Math.min(now - started, DURATION); setTime(next); if (next < DURATION) frame = requestAnimationFrame(tick); else complete(); };
    frame = requestAnimationFrame(tick);
    const onKey = (event) => { if (event.key === 'Escape') complete(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); };
  }, [reduced]);

  return <section className="prism-intro-v4" aria-label="Apresentação do Prism Codex">
    <header className="pintro-v4-header"><span>PRISM CODEX</span><button onClick={complete}>Pular</button></header>
    <div className="pintro-v4-progress"><i style={{ width: `${(time / DURATION) * 100}%` }} /></div>
    <div className="pintro-v4-scenes">
      <Scene className="pintro-v4-opening" style={{ opacity: ease(range(time, 0, 2300)), transform: `translateY(${20 - 20 * ease(range(time, 0, 2300))}px)` }}>
        <div className="pintro-v4-inner"><p className="pintro-v4-kicker">Prism IA</p><div className="pintro-v4-wordmark">PRISM CODEX</div><p>Um espaço para pensar, construir e revisar software com contexto.</p><div className="pintro-v4-rule" /></div>
      </Scene>
      <Scene className="pintro-v4-prompt" style={{ opacity: ease(range(time, 1900, 4400)), transform: `translateY(${24 - 24 * ease(range(time, 1900, 4400))}px)` }}>
        <div className="pintro-v4-inner"><p className="pintro-v4-kicker">01 / Pedido</p><div className="pintro-v4-prompt-card"><p className="pintro-v4-prompt-label">Você descreve o trabalho</p><div className="pintro-v4-prompt-text">{PROMPT.slice(0, Math.floor(PROMPT.length * range(time, 2150, 3600)))}</div><div className="pintro-v4-prompt-meta"><span>contexto</span><span>arquivos</span><span>ferramentas</span></div></div></div>
      </Scene>
      <Scene className="pintro-v4-work" style={{ opacity: ease(range(time, 3950, 7200)) }}>
        <div className="pintro-v4-inner"><div className="pintro-v4-work-head"><strong>O workspace acompanha o trabalho.</strong><span>código + resultado</span></div><div className="pintro-v4-workspace"><aside className="pintro-v4-files"><strong>Projeto</strong><span>src</span><span className="active">App.jsx</span><span>styles.css</span><span>package.json</span></aside><div className="pintro-v4-editor"><header><span>App.jsx</span><em>editável</em></header><pre>{`export default function App() {\n  return (\n    <main>\n      <h1>Construa algo real.</h1>\n    </main>\n  );\n}`}</pre></div><div className="pintro-v4-preview"><header><span>Preview</span><em>ao lado</em></header><div className="pintro-v4-preview-body"><div><strong>O resultado aparece aqui.</strong><span>sem trocar de contexto.</span></div></div></div></div></div>
      </Scene>
      <Scene className="pintro-v4-connected" style={{ opacity: ease(range(time, 6900, 9100)), transform: `translateX(${30 - 30 * ease(range(time, 6900, 9100))}px)` }}>
        <div className="pintro-v4-inner"><div><p className="pintro-v4-kicker">02 / Contexto conectado</p><h2>O trabalho reúne modelos, ferramentas e contexto no mesmo lugar.</h2><p>Use MCP e integrações quando a tarefa realmente precisar delas.</p></div><div className="pintro-v4-connections"><div className="pintro-v4-connection"><strong>Modelos</strong><span>Prism e provedores conectados</span></div><div className="pintro-v4-connection"><strong>MCP</strong><span>Ferramentas e serviços do workspace</span></div><div className="pintro-v4-connection"><strong>Arquivos</strong><span>Estado real do projeto</span></div></div></div>
      </Scene>
      <Scene className="pintro-v4-agent" style={{ opacity: ease(range(time, 8800, 10900)) }}>
        <div className="pintro-v4-inner"><p className="pintro-v4-kicker">03 / Agente</p><div className="pintro-v4-agent-flow"><strong>ANALISAR</strong><i>→</i><strong>CONSTRUIR</strong><i>→</i><strong>REVISAR</strong></div><div className="pintro-v4-agent-line"><i style={{ width: `${range(time, 9000, 10750) * 100}%` }} /></div><div className="pintro-v4-agent-note">O agente trabalha no projeto. Você acompanha cada etapa.</div></div>
      </Scene>
      <Scene className="pintro-v4-end" style={{ opacity: ease(range(time, 10400, DURATION)), transform: `scale(${.98 + .02 * ease(range(time, 10400, DURATION))})` }}>
        <div className="pintro-v4-inner"><div className="pintro-v4-end-mark">P</div><strong>Prism Codex</strong><p>Seu próximo projeto começa aqui.</p><button onClick={complete}>Entrar no Codex</button></div>
      </Scene>
    </div>
    <footer className="pintro-v4-footer"><span>Prism IA</span><span>{String(Math.floor(time / 1000)).padStart(2, '0')} / 12</span></footer>
  </section>;
}
