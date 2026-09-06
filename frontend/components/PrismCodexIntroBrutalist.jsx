import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v7_seen';
const DURATION = 27000;
const PROMPT = 'Create a user-friendly car sales website designed to attract customers.';
const GREETING = 'good morning programmer';
const CLOUDS = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260906_225745_b60b7b78-602c-49fc-bb99-915cc0c7d87f.png';
const CODE = `function Checkout({ cart }) {\n  const total = cart.reduce(sumTotal, 0);\n\n  return (\n    <PaymentSummary\n      total={total}\n      currency="BRL"\n      onConfirm={submitPayment}\n    />\n  );\n}`;
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
const range = (time, start, end) => clamp((time - start) / (end - start));
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
    frame = requestAnimationFrame(tick);
    const onKey = event => event.key === 'Escape' && complete();
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); };
  }, [reduced]);

  const logoIn = ease(range(time, 250, 1500));
  const logoDrift = ease(range(time, 1500, 3400));
  const taff = ease(range(time, 900, 3250));
  const sky = ease(range(time, 3150, 6800));
  const greeting = ease(range(time, 9150, 11800));
  const demo = ease(range(time, 11800, 17800));
  const build = ease(range(time, 17400, 23600));
  const ending = ease(range(time, 23100, DURATION));
  const blackout = time >= 6850 && time < 9150;
  const selectorOpen = ease(range(time, 13600, 14200));
  const selectedTaff = ease(range(time, 14200, 14850));
  const sendPress = ease(range(time, 17150, 17400));
  const codeProgress = ease(range(time, 18200, 22100));
  const codeCount = Math.floor(CODE.length * codeProgress);
  const planning = time >= 17800;
  const payment = ease(range(time, 18400, 19400));
  const catalog = ease(range(time, 19400, 20400));
  const tests = ease(range(time, 20400, 21400));
  const review = ease(range(time, 21400, 22400));

  return <section className="prism-story" aria-label="Apresentação do Prism Codex">
    <div className="prism-story-backdrop" onMouseDown={event => event.target === event.currentTarget && complete()} />
    <div className="prism-story-card">
      <button className="prism-story-close" onClick={complete} aria-label="Fechar apresentação">×</button>
      <div className="prism-story-copy">
        <span className="story-copy-badge">Novo</span>
        <h2>Prism Taff 2.0</h2>
        <p>Um modelo feito para pensar junto, planejar o trabalho e levar uma ideia até o código.</p>
        <div className="story-copy-points">
          <div><span>01</span><p>Troque de modelo no próprio campo de conversa.</p></div>
          <div><span>02</span><p>Acompanhe o plano, os arquivos e as mudanças em tempo real.</p></div>
          <div><span>03</span><p>Home e Codex ficam no mesmo lugar, sem interromper o fluxo.</p></div>
        </div>
        <div className="story-copy-actions"><button className="primary" onClick={complete}>Entrar no Codex</button><button onClick={complete}>Fechar</button></div>
      </div>

      <div className="prism-story-visual-wrap">
        <div className="prism-story-visual">
          <div className="prism-story-ui"><span>PRISM CODEX</span><button onClick={complete}>Pular <b>Esc</b></button></div>
          <div className="prism-story-progress"><i style={{ width: `${Math.min(100, time / DURATION * 100)}%` }} /></div>

          <Scene className="story-logo" style={{ opacity: logoIn }}>
            <div className="story-logo-stage" style={{ transform: `translateX(${-15 * logoDrift}%) translateY(${(1 - logoIn) * 36}%)` }}>
              <div className="story-brand"><LogoMark/><strong>PRISM IA</strong></div>
              <div className="story-model"><TypeLine text="TAFF" progress={taff}/><b style={{ opacity: taff > .68 ? 1 : taff / .68 }}>2.0</b></div>
            </div>
          </Scene>

          <Scene className="story-sky" style={{ opacity: sky, backgroundImage: `url(${CLOUDS})`, backgroundPosition: `center ${60 - 26 * sky}%`, backgroundSize: `${120 + 13 * sky}%` }} />
          <Scene className="story-black" style={{ opacity: blackout ? 1 : 0 }} />

          <Scene className="story-goodmorning" style={{ opacity: greeting }}>
            <LogoMark className="story-good-logo"/>
            <TypeLine text={GREETING} progress={range(time, 9350, 11800)} className="story-good-line"/>
          </Scene>

          <Scene className="story-demo" style={{ opacity: demo, transform: `translateY(${18 - 18 * demo}px)` }}>
            <div className="story-demo-window">
              <header><div className="story-dots"><i/><i/><i/></div><span>Prism Codex</span><small>{userName}</small></header>
              <div className="story-demo-body">
                <aside><b>PRISM</b><span>Home</span><span className="active">Codex</span><span>Workspace</span></aside>
                <main>
                  <div className={`story-selector ${selectedTaff > .45 ? 'selected' : ''}`}><span>{selectedTaff > .45 ? 'Prism Taff 2.0' : 'Prism Edge 1.0'}</span><b>⌄</b></div>
                  <div className="story-cursor" style={{ left: `${62 + 9 * ease(range(time, 13050, 13850))}%`, top: `${18 + 7 * ease(range(time, 13050, 13850))}%` }}/>
                  <div className="story-menu" style={{ opacity: selectorOpen, transform: `translateY(${7 - 7 * selectorOpen}px)` }}><span>Prism Edge 1.0</span><strong>Prism Taff 2.0</strong><span>Prism Tex 1.5</span></div>
                  <div className="story-user-line"><span>{userName}</span><em>agora</em></div>
                  <div className="story-prompt"><TypeLine text={PROMPT} progress={range(time, 14900, 17300)}/></div>
                  <button className="story-send" style={{ transform: `translateY(${sendPress * 1.5}px)`, opacity: 1 }}>Enviar</button>
                </main>
              </div>
            </div>
          </Scene>

          <Scene className="story-build" style={{ opacity: build }}>
            <div className="story-build-window">
              <header><span>PRISM TAFF 2.0</span><small>EXECUTANDO</small></header>
              <div className="story-build-grid">
                <div className="story-plan"><small>PLANO</small><strong>Car sales website</strong><span className={planning ? 'done' : ''}>{planning ? '✓' : '·'} Estrutura</span><span className={payment > .35 ? 'done' : 'active'}>{payment > .7 ? '✓' : '·'} Pagamento</span><span className={catalog > .35 ? 'done' : ''}>{catalog > .7 ? '✓' : '·'} Catálogo</span><span className={tests > .35 ? 'done' : ''}>{tests > .7 ? '✓' : '·'} Testes</span><span className={review > .35 ? 'done' : ''}>{review > .7 ? '✓' : '·'} Revisão</span></div>
                <div className="story-editor"><div className="story-code-tabs"><span>App.jsx</span><span>checkout.ts</span><span>inventory.css</span></div><pre>{CODE.slice(0, codeCount)}<i className="story-code-caret"/></pre><div className="story-diff"><b>+90 linhas</b><span>·</span><b>-36 linhas</b><small>refatoração e validação</small></div></div>
              </div>
              <div className="story-status"><span className={planning ? 'done' : ''}>Planejando</span><span className={codeProgress > .2 ? 'done' : ''}>Criando arquivos</span><span className={codeProgress > .55 ? 'done' : ''}>Editando</span><span className={codeProgress > .8 ? 'done' : ''}>Testando</span><b>{codeProgress > .96 ? 'Pronto' : 'Em andamento'}</b></div>
            </div>
          </Scene>

          <Scene className="story-end" style={{ opacity: ending }}><LogoMark/><strong>PRISM CODEX</strong><small>Pronto quando você estiver.</small><button onClick={complete}>Entrar</button></Scene>
          <footer className="prism-story-footer"><span>PRISM IA</span><span>{String(Math.floor(time / 1000)).padStart(2, '0')} / 27</span></footer>
        </div>
      </div>
    </div>
  </section>;
}
