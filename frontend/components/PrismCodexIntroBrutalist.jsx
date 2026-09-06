import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v6_seen';
const DURATION = 25000;
const PROMPT = 'Create a user-friendly car sales website designed to attract customers.';
const GREETING = 'good morning programmer';
const CLOUDS = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260906_225745_b60b7b78-602c-49fc-bb99-915cc0c7d87f.png';
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

  const logoIn = ease(range(time, 300, 1700));
  const logoDrift = ease(range(time, 1550, 3450));
  const taff = ease(range(time, 1100, 3450));
  const sky = ease(range(time, 3300, 6900));
  const greeting = ease(range(time, 8900, 11500));
  const demo = ease(range(time, 11500, 17600));
  const build = ease(range(time, 16900, 23200));
  const ending = ease(range(time, 22700, DURATION));
  const blackout = time >= 6900 && time < 8900;

  return <section className="prism-story" aria-label="Apresentação do Prism Codex">
    <div className="prism-story-backdrop" onMouseDown={event => event.target === event.currentTarget && complete()} />
    <div className="prism-story-card">
      <button className="prism-story-close" onClick={complete} aria-label="Fechar apresentação">×</button>
      <div className="prism-story-copy">
        <span className="story-copy-badge">Novo</span>
        <h2>Prism Codex</h2>
        <p>Um espaço para conversar, planejar e construir sem sair da mesma janela.</p>
        <div className="story-copy-points">
          <div><span>01</span><p>Escolha o modelo direto na conversa.</p></div>
          <div><span>02</span><p>Veja o trabalho tomar forma enquanto ele acontece.</p></div>
          <div><span>03</span><p>Alterne entre Home e Codex quando precisar.</p></div>
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

          <Scene className="story-sky" style={{ opacity: sky, backgroundImage: `url(${CLOUDS})`, backgroundPosition: `center ${58 - 24 * sky}%`, backgroundSize: `${118 + 10 * sky}%` }} />
          <Scene className="story-black" style={{ opacity: blackout ? 1 : 0 }} />

          <Scene className="story-goodmorning" style={{ opacity: greeting }}>
            <LogoMark className="story-good-logo"/>
            <TypeLine text={GREETING} progress={range(time, 9000, 11500)} className="story-good-line"/>
          </Scene>

          <Scene className="story-demo" style={{ opacity: demo, transform: `translateY(${20 - 20 * demo}px)` }}>
            <div className="story-demo-window">
              <header><div className="story-dots"><i/><i/><i/></div><span>Prism Codex</span><small>{userName}</small></header>
              <div className="story-demo-body">
                <aside><b>PRISM</b><span>Home</span><span className="active">Codex</span><span>Workspace</span></aside>
                <main>
                  <div className="story-selector"><span>Prism Edge 1.0</span><b>⌄</b></div>
                  <div className="story-cursor" style={{ left: `${63 + 9 * ease(range(time, 13100, 13900))}%`, top: `${18 + 7 * ease(range(time, 13100, 13900))}%` }}/>
                  <div className="story-menu" style={{ opacity: range(time, 13700, 14600), transform: `translateY(${8 - 8 * ease(range(time, 13700, 14600))}px)` }}><span>Prism Edge 1.0</span><strong>Prism Taff 2.0</strong><span>Prism Tex 1.5</span></div>
                  <div className="story-user-line"><span>{userName}</span><em>agora</em></div>
                  <div className="story-prompt"><TypeLine text={PROMPT} progress={range(time, 14600, 17300)}/></div>
                  <button className="story-send">Enviar</button>
                </main>
              </div>
            </div>
          </Scene>

          <Scene className="story-build" style={{ opacity: build }}>
            <div className="story-build-window">
              <header><span>PRISM TAFF 2.0</span><small>EXECUTANDO</small></header>
              <div className="story-build-grid">
                <div className="story-plan"><small>PLANO</small><strong>Car sales website</strong><span className="done">✓ Estrutura</span><span className="active">· Pagamento</span><span>Catálogo</span><span>Testes</span><span>Revisão</span></div>
                <div className="story-editor"><div className="story-code-tabs"><span>App.jsx</span><span>checkout.ts</span><span>inventory.css</span></div><pre>{`function Checkout({ cart }) {\n  const total = cart.reduce(sumTotal, 0);\n\n  return (\n    <PaymentSummary\n      total={total}\n      currency="BRL"\n      onConfirm={submitPayment}\n    />\n  );\n}`}</pre><div className="story-diff"><b>+90 linhas</b><span>·</span><b>-36 linhas</b><small>refatoração e validação</small></div></div>
              </div>
              <div className="story-status"><span>Planejando</span><span>Criando arquivos</span><span>Editando</span><span>Testando</span><b>Pronto</b></div>
            </div>
          </Scene>

          <Scene className="story-end" style={{ opacity: ending }}><LogoMark/><strong>PRISM CODEX</strong><small>Pronto quando você estiver.</small><button onClick={complete}>Entrar</button></Scene>
          <footer className="prism-story-footer"><span>PRISM IA</span><span>{String(Math.floor(time / 1000)).padStart(2, '0')} / 25</span></footer>
        </div>
      </div>
    </div>
  </section>;
}
