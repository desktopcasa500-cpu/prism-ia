import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v5_seen';
const DURATION = 25000;
const PROMPT = 'Create a user-friendly car sales website designed to attract customers.';
const GREETING = 'good morning programmer';
const CLOUDS = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260906_224646_7b83df9b-d657-4258-a823-8abd2e9f17f0.png';
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const t = clamp(n); return t*t*(3-2*t); };
const range = (time,start,end) => clamp((time-start)/(end-start));
function Scene({ children, className = '', style = {} }) { return <div className={`prism-story-scene ${className}`} style={style}>{children}</div>; }
function TypeLine({ text, progress, className = '' }) { const count = Math.floor(text.length * clamp(progress)); return <span className={className}>{text.slice(0, count)}<i className="prism-story-caret" /></span>; }
function LogoMark({ className = '' }) { return <span className={`story-mark ${className}`} aria-hidden="true"><i/><i/><i/><i/></span>; }

export default function PrismCodexIntroBrutalist({ onComplete, userName = 'você' }) {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [time, setTime] = useState(0); const done = useRef(false);
  const complete = () => { if (done.current) return; done.current = true; localStorage.setItem(INTRO_KEY, '1'); onComplete?.(); };
  useEffect(() => {
    if (reduced) { complete(); return undefined; }
    const started = performance.now(); let frame;
    const tick = now => { const next = Math.min(now - started, DURATION); setTime(next); if (next < DURATION) frame = requestAnimationFrame(tick); else complete(); };
    frame = requestAnimationFrame(tick); const onKey = event => event.key === 'Escape' && complete(); window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); };
  }, [reduced]);
  const logoIn = ease(range(time, 250, 1700)); const modelIn = ease(range(time, 1100, 3200)); const logoDrift = ease(range(time, 1850, 3600)); const taffProgress = ease(range(time, 1200, 3400));
  const sky = ease(range(time, 3200, 7600)); const greeting = ease(range(time, 9600, 12200)); const demo = ease(range(time, 12200, 18200)); const build = ease(range(time, 17500, 23200)); const ending = ease(range(time, 22600, DURATION));
  return <section className="prism-story" aria-label="Apresentação do Prism Codex">
    <div className="prism-story-ui"><span>PRISM CODEX</span><button onClick={complete}>Pular <b>Esc</b></button></div><div className="prism-story-progress"><i style={{ width: `${Math.min(100, time / DURATION * 100)}%` }} /></div>
    <Scene className="story-logo" style={{ opacity: logoIn, transform: `translateY(${(1 - logoIn) * 34}vh)` }}><div className="story-brand" style={{ transform: `translateX(${-16 * logoDrift}vw)` }}><LogoMark/><strong>PRISM IA</strong></div><div className="story-model" style={{ opacity: modelIn }}><TypeLine text="TAFF" progress={taffProgress}/><b style={{ opacity: taffProgress > .72 ? 1 : taffProgress / .72 }}>2.0</b></div></Scene>
    <Scene className="story-sky" style={{ opacity: sky, backgroundImage: `url(${CLOUDS})`, backgroundPosition: `center ${58 - 28 * sky}%`, backgroundSize: `${112 + 16 * sky}% auto` }}><div className="story-sky-copy"><small>PRISM TAFF 2.0</small><strong>Room to think.<br/>Room to build.</strong></div></Scene>
    <Scene className="story-black" style={{ opacity: time >= 7600 && time < 9600 ? 1 : 0 }} />
    <Scene className="story-goodmorning" style={{ opacity: greeting }}><LogoMark className="story-good-logo"/><TypeLine text={GREETING} progress={range(time, 9900, 12200)} className="story-good-line"/></Scene>
    <Scene className="story-demo" style={{ opacity: demo, transform: `translateY(${26 - 26 * demo}px)` }}><div className="story-demo-window"><header><div className="story-dots"><i/><i/><i/></div><span>Prism Codex</span><small>{userName}</small></header><div className="story-demo-body"><aside><b>PRISM</b><span>Home</span><span className="active">Codex</span><span>Workspace</span></aside><main><div className="story-selector"><span>Prism Edge 1.0</span><b>⌄</b></div><div className="story-cursor" style={{ left: `${64 + 10 * ease(range(time, 13600, 14400))}%`, top: `${18 + 6 * ease(range(time, 13600, 14400))}%` }}/><div className="story-menu" style={{ opacity: range(time, 14200, 15100), transform: `translateY(${8 - 8 * ease(range(time, 14200, 15100))}px)` }}><span>Prism Edge 1.0</span><strong>Prism Taff 2.0</strong><span>Prism Tex 1.5</span></div><div className="story-user-line"><span>{userName}</span><em>agora</em></div><div className="story-prompt"><TypeLine text={PROMPT} progress={range(time, 15100, 17700)}/></div><button className="story-send">Enviar</button></main></div></div></Scene>
    <Scene className="story-build" style={{ opacity: build }}><div className="story-build-window"><header><span>PRISM TAFF 2.0</span><small>EXECUTANDO</small></header><div className="story-build-grid"><div className="story-plan"><small>PLANO</small><strong>Car sales website</strong><span className="done">✓ Estrutura</span><span className="active">· Pagamento</span><span>Catálogo</span><span>Testes</span><span>Revisão</span></div><div className="story-editor"><div className="story-code-tabs"><span>App.jsx</span><span>checkout.ts</span><span>inventory.css</span></div><pre>{`function Checkout({ cart }) {\n  const total = cart.reduce(sumTotal, 0);\n\n  return (\n    <PaymentSummary\n      total={total}\n      currency="BRL"\n      onConfirm={submitPayment}\n    />\n  );\n}`}</pre><div className="story-diff"><b>+90 linhas</b><span>·</span><b>-36 linhas</b><small>refatoração e validação</small></div></div></div><div className="story-status"><span>Planejando</span><span>Criando arquivos</span><span>Editando</span><span>Testando</span><b>Pronto</b></div></div></Scene>
    <Scene className="story-end" style={{ opacity: ending }}><LogoMark/><strong>PRISM CODEX</strong><small>Pronto quando você estiver.</small><button onClick={complete}>Entrar</button></Scene>
    <footer className="prism-story-footer"><span>PRISM IA</span><span>{String(Math.floor(time / 1000)).padStart(2,'0')} / 25</span></footer>
  </section>;
}
