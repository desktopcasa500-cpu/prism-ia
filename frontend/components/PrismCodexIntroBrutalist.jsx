import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v8_seen';
const DURATION = 30000;
const PROMPT = 'Create a user-friendly car sales website designed to attract customers.';
const GREETING = 'good morning programmer';
const CLOUDS = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260906_225745_b60b7b78-602c-49fc-bb99-915cc0c7d87f.png';
const CODE = `function Checkout({ cart }) {\n  const total = cart.reduce(sumTotal, 0);\n\n  return (\n    <PaymentSummary\n      total={total}\n      currency="BRL"\n      onConfirm={submitPayment}\n    />\n  );\n}`;
const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const range = (time, start, end) => clamp((time - start) / (end - start));
const countUp = (time, start, end, maximum) => Math.round(ease(range(time, start, end)) * maximum);

function Scene({ children, className = '', style = {} }) {
  return <div className={`prism-story-scene ${className}`} style={style}>{children}</div>;
}

function TypeLine({ text, progress, className = '' }) {
  const count = Math.floor(text.length * clamp(progress));
  return <span className={className}>{text.slice(0, count)}<i className="prism-story-caret" /></span>;
}

function LogoMark({ className = '' }) {
  return <span className={`story-mark ${className}`} aria-hidden="true"><i /><i /><i /><i /></span>;
}

export default function PrismCodexIntroBrutalist({ onComplete, userName = 'você' }) {
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
    if (reduced) {
      complete();
      return undefined;
    }

    const started = performance.now();
    let frame;
    const tick = (now) => {
      const next = Math.min(now - started, DURATION);
      setTime(next);
      if (next < DURATION) frame = requestAnimationFrame(tick);
      else complete();
    };

    frame = requestAnimationFrame(tick);
    const onKey = (event) => {
      if (event.key === 'Escape') complete();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
    };
  }, [reduced]);

  const logoIn = ease(range(time, 250, 1650));
  const logoDrift = ease(range(time, 1500, 3600));
  const taff = ease(range(time, 900, 3400));
  const sky = ease(range(time, 3250, 7000));
  const greeting = ease(range(time, 9300, 12000));
  const demo = ease(range(time, 12000, 18100));
  const build = ease(range(time, 17700, 24400));
  const ending = ease(range(time, 23800, DURATION));
  const blackout = time >= 7000 && time < 9300;
  const selectorOpen = ease(range(time, 13900, 14500));
  const selectedTaff = ease(range(time, 14500, 15150));
  const promptProgress = range(time, 15100, 17500);
  const sendPress = ease(range(time, 17500, 17700));
  const codeProgress = ease(range(time, 18500, 22800));
  const planning = ease(range(time, 18100, 18900));
  const thinking = ease(range(time, 18600, 19900));
  const programming = ease(range(time, 19400, 21400));
  const payment = ease(range(time, 20100, 21900));
  const tests = ease(range(time, 21100, 22600));
  const diff = ease(range(time, 22000, 23200));
  const codeCount = Math.floor(CODE.length * codeProgress);

  const thinkingCount = countUp(time, 18600, 19900, 14);
  const programmingCount = countUp(time, 19400, 21400, 92);
  const paymentCount = countUp(time, 20100, 21900, 8);
  const additions = countUp(time, 22000, 23200, 90);
  const removals = countUp(time, 22000, 23200, 36);

  return <section className="prism-story" aria-label="Apresentação do Prism TAFF 2.0">
    <div className="prism-story-backdrop" onMouseDown={(event) => event.target === event.currentTarget && complete()} />
    <div className="prism-story-card">
      <button className="prism-story-close" onClick={complete} aria-label="Fechar apresentação">×</button>

      <div className="prism-story-copy">
        <span className="story-copy-badge">PRISM · TOPO DE LINHA</span>
        <h2>TAFF 2.0</h2>
        <p className="story-copy-lead">O modelo mais forte da linha Prism, feito para projetos que exigem mais capacidade, mais contexto e execução de ponta a ponta.</p>

        <div className="story-copy-specs" aria-label="Principais características do TAFF 2.0">
          <div><span>01</span><strong>Desenvolvimento completo</strong><small>Jogos, sites e backend robusto.</small></div>
          <div><span>02</span><strong>Máxima capacidade</strong><small>Mais processamento para tarefas complexas.</small></div>
          <div><span>03</span><strong>Engenharia + criatividade</strong><small>Da ideia ao resultado em um único fluxo.</small></div>
        </div>

        <div className="story-copy-detail">
          <p>O Prism TAFF 2.0 é o modelo mais forte e avançado da linha Prism, representando o topo de linha em capacidade e desempenho.</p>
          <p>Focado especialmente em desenvolvimento completo, o TAFF 2.0 se destaca na criação de jogos, sites e backend robusto, entregando soluções de ponta a ponta com qualidade profissional.</p>
          <p>Por ser o mais caro da linha, seu uso é recomendado para tarefas que realmente demandem esse nível de capacidade, garantindo o melhor retorno sobre o investimento em processamento.</p>
        </div>

        <div className="story-copy-actions">
          <button className="primary" onClick={complete}>Entrar no Codex</button>
          <button onClick={complete}>Fechar</button>
        </div>
      </div>

      <div className="prism-story-visual-wrap">
        <div className="prism-story-visual">
          <div className="prism-story-ui">
            <span>PRISM TAFF 2.0</span>
            <button onClick={complete}>Pular <b>Esc</b></button>
          </div>
          <div className="prism-story-progress"><i style={{ width: `${Math.min(100, (time / DURATION) * 100)}%` }} /></div>

          <Scene className="story-logo" style={{ opacity: logoIn }}>
            <div className="story-logo-stage" style={{ transform: `translateX(${-16 * logoDrift}%) translateY(${(1 - logoIn) * 42}px)` }}>
              <div className="story-brand"><LogoMark /><strong>PRISM IA</strong></div>
              <div className="story-model"><TypeLine text="TAFF" progress={taff} /><b style={{ opacity: taff > 0.68 ? 1 : taff / 0.68 }}>2.0</b></div>
            </div>
          </Scene>

          <Scene className="story-sky" style={{ opacity: sky, backgroundImage: `url(${CLOUDS})`, backgroundPosition: `center ${61 - 27 * sky}%`, backgroundSize: `${120 + 14 * sky}%` }} />
          <Scene className="story-black" style={{ opacity: blackout ? 1 : 0 }} />

          <Scene className="story-goodmorning" style={{ opacity: greeting }}>
            <LogoMark className="story-good-logo" />
            <TypeLine text={GREETING} progress={range(time, 9500, 12000)} className="story-good-line" />
            <small className="story-good-subtitle">o trabalho começa antes do código.</small>
          </Scene>

          <Scene className="story-demo" style={{ opacity: demo, transform: `translateY(${18 - 18 * demo}px)` }}>
            <div className="story-demo-window">
              <header>
                <div className="story-dots"><i /><i /><i /></div>
                <span>Prism Codex</span>
                <small>{userName}</small>
              </header>
              <div className="story-demo-body">
                <aside>
                  <b>PRISM</b>
                  <span>Home</span>
                  <span className="active">Codex</span>
                  <span>Workspace</span>
                </aside>
                <main>
                  <div className={`story-selector ${selectedTaff > 0.45 ? 'selected' : ''}`}>
                    <span>{selectedTaff > 0.45 ? 'Prism Taff 2.0' : 'Prism Edge 1.0'}</span>
                    <b>⌄</b>
                  </div>
                  <div className="story-cursor" style={{ left: `${62 + 9 * ease(range(time, 13200, 14000))}%`, top: `${18 + 7 * ease(range(time, 13200, 14000))}%` }} />
                  <div className="story-menu" style={{ opacity: selectorOpen, transform: `translateY(${7 - 7 * selectorOpen}px)` }}>
                    <span>Prism Edge 1.0</span>
                    <strong>Prism Taff 2.0</strong>
                    <span>Prism Tex 1.5</span>
                  </div>
                  <div className="story-user-line"><span>{userName}</span><em>agora</em></div>
                  <div className="story-prompt"><TypeLine text={PROMPT} progress={promptProgress} /></div>
                  <button className="story-send" style={{ transform: `translateY(${sendPress * 1.5}px)` }}>Enviar</button>
                </main>
              </div>
            </div>
          </Scene>

          <Scene className="story-build" style={{ opacity: build }}>
            <div className="story-build-window">
              <header>
                <span>PRISM TAFF 2.0</span>
                <small>{codeProgress > 0.96 ? 'CONCLUÍDO' : 'EXECUTANDO'}</small>
              </header>

              <div className="story-build-metrics">
                <div><small>THINKING</small><strong>{thinkingCount}s</strong><em className={thinking > 0.98 ? 'done' : ''}>{thinking > 0.98 ? 'concluído' : 'analisando'}</em></div>
                <div><small>PROGRAMMING</small><strong>{programmingCount}</strong><em className={programming > 0.98 ? 'done' : ''}>{programming > 0.98 ? 'linhas processadas' : 'em andamento'}</em></div>
                <div><small>PAYMENT</small><strong>{paymentCount}/8</strong><em className={payment > 0.98 ? 'done' : ''}>{payment > 0.98 ? 'validado' : 'checando'}</em></div>
                <div><small>DIFF</small><strong>+{additions} / -{removals}</strong><em className={diff > 0.98 ? 'done' : ''}>{diff > 0.98 ? 'revisado' : 'comparando'}</em></div>
              </div>

              <div className="story-build-grid">
                <div className="story-plan">
                  <small>PLANO</small>
                  <strong>Car sales website</strong>
                  <span className={planning > 0.92 ? 'done' : ''}>{planning > 0.92 ? '✓' : '·'} Estrutura</span>
                  <span className={thinking > 0.92 ? 'done' : 'active'}>{thinking > 0.92 ? '✓' : '·'} Thinking</span>
                  <span className={programming > 0.92 ? 'done' : 'active'}>{programming > 0.92 ? '✓' : '·'} Programming</span>
                  <span className={payment > 0.92 ? 'done' : 'active'}>{payment > 0.92 ? '✓' : '·'} Payment</span>
                  <span className={tests > 0.92 ? 'done' : 'active'}>{tests > 0.92 ? '✓' : '·'} Testes</span>
                  <span className={diff > 0.92 ? 'done' : 'active'}>{diff > 0.92 ? '✓' : '·'} Diff</span>
                </div>

                <div className="story-editor">
                  <div className="story-code-tabs"><span>App.jsx</span><span>checkout.ts</span><span>inventory.css</span></div>
                  <pre>{CODE.slice(0, codeCount)}<i className="story-code-caret" /></pre>
                  <div className="story-diff"><b>+{additions} linhas</b><span>·</span><b>-{removals} linhas</b><small>refatoração e validação</small></div>
                </div>
              </div>

              <div className="story-status">
                <span className={planning > 0.92 ? 'done' : ''}>Planejando</span>
                <span className={programming > 0.2 ? 'done' : ''}>Criando arquivos</span>
                <span className={programming > 0.7 ? 'done' : ''}>Editando</span>
                <span className={tests > 0.7 ? 'done' : ''}>Testando</span>
                <b>{codeProgress > 0.96 ? 'Pronto' : 'Em andamento'}</b>
              </div>
            </div>
          </Scene>

          <Scene className="story-end" style={{ opacity: ending }}>
            <LogoMark />
            <strong>TAFF 2.0</strong>
            <small>O topo da linha Prism.</small>
            <button onClick={complete}>Entrar no Codex</button>
          </Scene>

          <footer className="prism-story-footer">
            <span>PRISM IA</span>
            <span>{String(Math.floor(time / 1000)).padStart(2, '0')} / 30</span>
          </footer>
        </div>
      </div>
    </div>
  </section>;
}
