import { useEffect, useMemo, useRef, useState } from 'react';
import prismLogo from '../assets/prism-logo.svg';

export const INTRO_KEY = 'prism_codex_intro_v9_seen';
const DURATION = 36000;
const PROMPT = 'Create a user-friendly car sales website designed to attract customers.';
const GREETING = 'good morning programmer';
const CLOUDS = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_faffafdc-20ef-435d-9bc5-6fdf1edf49cc.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_ee56e65c-07e3-4d8d-9121-a7c34396767c.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_7087decc-7b4f-4504-bd4b-edd312316c87.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_95f21913-8063-40a9-8697-bfca001e82c0.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012428_8611d95d-4fb7-4d7e-b75f-86a13b437bdf.png',
];
const CAR = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012515_b011b372-fa91-49c4-8403-01e46db815a2.png';
const BUILD_CODE = `const cars = [\n  { model: 'Apex GT', price: 'R$ 389.900', year: 2026 },\n  { model: 'Vector S', price: 'R$ 249.900', year: 2025 },\n  { model: 'Lumen X', price: 'R$ 319.900', year: 2026 },\n];\n\nexport function FeaturedCars() {\n  return cars.map((car) => (\n    <CarCard key={car.model} {...car} />\n  ));\n}`;

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const range = (time, start, end) => clamp((time - start) / Math.max(1, end - start));
const countUp = (time, start, end, max) => Math.round(smooth(range(time, start, end)) * max);

function Scene({ children, className = '', style }) {
  return <div className={`prism-story-scene ${className}`} style={style}>{children}</div>;
}

function TypeLine({ text, progress, className = '', cursor = true }) {
  const count = Math.floor(text.length * clamp(progress));
  return <span className={className}>{text.slice(0, count)}{cursor && <i className="prism-story-caret" />}</span>;
}

function Logo({ className = '' }) {
  return <img className={`story-logo-image ${className}`} src={prismLogo} alt="Prism IA" />;
}

function finalSiteMarkup(progress) {
  const reveal = smooth(progress);
  return (
    <div className="story-site-shell" style={{ '--site-reveal': reveal }}>
      <div className="story-site-nav">
        <div className="story-site-brand"><Logo className="story-site-logo" /><strong>PRISM MOTORS</strong></div>
        <div className="story-site-nav-links"><span>Comprar</span><span>Financiamento</span><span>Contato</span></div>
        <button>Ver estoque</button>
      </div>
      <div className="story-site-hero">
        <div className="story-site-copy">
          <small>ESTOQUE SELECIONADO</small>
          <h3>Encontre o carro certo.<br />Sem perder tempo.</h3>
          <p>Uma experiência simples para descobrir, comparar e comprar veículos premium.</p>
          <div className="story-site-actions"><button>Explorar carros</button><span>Entrega para todo o Brasil</span></div>
        </div>
        <div className="story-car-image" />
      </div>
      <div className="story-site-cards">
        {['Apex GT', 'Vector S', 'Lumen X'].map((name, index) => (
          <article key={name} style={{ opacity: Math.max(0, Math.min(1, reveal * 1.35 - index * 0.16)) }}>
            <span>{index === 0 ? '2026' : index === 1 ? '2025' : '2026'}</span>
            <strong>{name}</strong>
            <small>{index === 0 ? 'R$ 389.900' : index === 1 ? 'R$ 249.900' : 'R$ 319.900'}</small>
          </article>
        ))}
      </div>
    </div>
  );
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
    if (reduced) {
      complete();
      return undefined;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now) => {
      const next = Math.min(now - started, DURATION);
      setTime(next);
      if (next < DURATION) frame = requestAnimationFrame(tick);
      else complete();
    };
    frame = requestAnimationFrame(tick);
    const onKey = (event) => { if (event.key === 'Escape') complete(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); };
  }, [reduced]);

  useEffect(() => {
    for (const source of CLOUDS) {
      const image = new Image();
      image.src = source;
    }
    const car = new Image();
    car.src = CAR;
  }, []);

  const logoIn = smooth(range(time, 200, 1500));
  const titleProgress = smooth(range(time, 900, 3100));
  const sky = smooth(range(time, 2500, 8200));
  const blackout = time >= 8200 && time < 10500;
  const greeting = smooth(range(time, 10400, 12900));
  const demo = smooth(range(time, 12900, 17800));
  const build = smooth(range(time, 17200, 28300));
  const finalSite = smooth(range(time, 27400, 32600));
  const ending = smooth(range(time, 31900, DURATION));
  const cursorMove = smooth(range(time, 14300, 15100));
  const selectorOpen = smooth(range(time, 14900, 15600));
  const selectedTaff = smooth(range(time, 15500, 16100));
  const promptProgress = smooth(range(time, 16000, 17400));
  const buildReveal = smooth(range(time, 17800, 28100));
  const planning = smooth(range(time, 17800, 19400));
  const thinking = smooth(range(time, 18800, 21000));
  const programming = smooth(range(time, 20100, 24000));
  const payment = smooth(range(time, 21800, 25300));
  const testing = smooth(range(time, 23900, 26700));
  const publish = smooth(range(time, 26100, 28100));
  const codeCount = Math.floor(BUILD_CODE.length * buildReveal);
  const thinkingSeconds = countUp(time, 18800, 21000, 12);
  const fileCount = countUp(time, 20100, 24000, 9);
  const paymentCount = countUp(time, 21800, 25300, 8);
  const testCount = countUp(time, 23900, 26700, 24);

  const cloudIndex = Math.min(CLOUDS.length - 1, Math.floor(clamp((time - 2500) / 9800) * CLOUDS.length));
  const cloudProgress = clamp(((time - 2500) % 9800) / 9800);

  return (
    <section className="prism-story" aria-label="Apresentação do Prism TAFF 2.0">
      <div className="prism-story-backdrop" onMouseDown={(event) => event.target === event.currentTarget && complete()} />
      <div className="prism-story-card">
        <button className="prism-story-close" onClick={complete} aria-label="Fechar apresentação">×</button>
        <div className="prism-story-copy">
          <span className="story-copy-badge">PRISM · TAFF 2.0</span>
          <h2>O modelo para<br />construir no limite.</h2>
          <p className="story-copy-lead">O Prism TAFF 2.0 é o modelo mais forte da linha Prism, criado para desenvolvimento completo, projetos complexos e execução de ponta a ponta.</p>
          <div className="story-copy-specs">
            <div><span>01</span><strong>Desenvolvimento completo</strong><small>Jogos, sites e backend robusto.</small></div>
            <div><span>02</span><strong>Máxima capacidade</strong><small>Mais processamento para tarefas exigentes.</small></div>
            <div><span>03</span><strong>Do plano ao produto</strong><small>Raciocínio, implementação e revisão no mesmo fluxo.</small></div>
          </div>
          <div className="story-copy-detail">
            <p>O TAFF 2.0 representa o topo de linha em capacidade e desempenho.</p>
            <p>Focado especialmente em desenvolvimento completo, destaca-se na criação de jogos, sites e backend robusto, entregando soluções profissionais de ponta a ponta.</p>
            <p>Por consumir mais recursos, é indicado para tarefas que realmente exigem esse nível de capacidade.</p>
          </div>
          <div className="story-copy-actions"><button className="primary" onClick={complete}>Entrar no Codex</button><button onClick={complete}>Fechar</button></div>
        </div>

        <div className="prism-story-visual-wrap">
          <div className="prism-story-visual">
            <div className="prism-story-ui"><span>PRISM TAFF 2.0</span><button onClick={complete}>Pular <b>Esc</b></button></div>
            <div className="prism-story-progress"><i style={{ width: `${(time / DURATION) * 100}%` }} /></div>

            <Scene className="story-logo-reveal" style={{ opacity: logoIn }}>
              <div className="story-title-lockup">
                <Logo className="story-main-logo" />
                <div className="story-title"><span>TAFF</span><b style={{ opacity: titleProgress }}>2.0</b></div>
              </div>
            </Scene>

            <Scene className="story-cloud-field" style={{ opacity: sky }}>
              {CLOUDS.map((source, index) => {
                const distance = index - cloudIndex;
                const opacity = distance === 0 ? 1 - cloudProgress * 0.65 : distance === 1 ? cloudProgress * 0.65 : 0;
                const scale = 1 + (index * 0.018) + cloudProgress * 0.025;
                const x = (index % 2 === 0 ? -1 : 1) * cloudProgress * 1.5;
                return <div key={source} className="story-cloud-layer" style={{ opacity: Math.max(0, opacity), backgroundImage: `url(${source})`, transform: `scale(${scale}) translate3d(${x}%, ${-cloudProgress * 2.5}%, 0)` }} />;
              })}
              <div className="story-cloud-vignette" />
            </Scene>
            <Scene className="story-black" style={{ opacity: blackout ? 1 : 0 }} />

            <Scene className="story-goodmorning" style={{ opacity: greeting }}>
              <Logo className="story-good-logo" />
              <TypeLine text={GREETING} progress={range(time, 10600, 12800)} className="story-good-line" />
              <small>o trabalho começa antes do código.</small>
            </Scene>

            <Scene className="story-demo" style={{ opacity: demo, transform: `translateY(${18 - 18 * demo}px)` }}>
              <div className="story-demo-window">
                <header><div className="story-dots"><i /><i /><i /></div><span>Prism Codex</span><small>TAFF 2.0</small></header>
                <div className="story-demo-body">
                  <aside><b>PRISM</b><span>Home</span><span className="active">Codex</span><span>Workspace</span></aside>
                  <main>
                    <div className={`story-selector ${selectedTaff > 0.5 ? 'selected' : ''}`}><span>{selectedTaff > 0.5 ? 'Prism Taff 2.0' : 'Prism Edge 1.0'}</span><b>⌄</b></div>
                    <div className="story-menu" style={{ opacity: selectorOpen, transform: `translateY(${8 - 8 * selectorOpen}px)` }}><span>Prism Nano 1.0A</span><span>Prism Mini 1.0A</span><strong>Prism Taff 2.0</strong></div>
                    <div className="story-user-line"><span>programmer</span><em>agora</em></div>
                    <div className="story-prompt"><TypeLine text={PROMPT} progress={promptProgress} /></div>
                    <div className="story-image-cursor" style={{ left: `${64 + cursorMove * 17}%`, top: `${53 - cursorMove * 18}%` }} />
                    <button className="story-send">Enviar</button>
                  </main>
                </div>
              </div>
            </Scene>

            <Scene className="story-build" style={{ opacity: build }}>
              <div className="story-build-window">
                <header><span>TAFF 2.0 / construção</span><small>{publish > 0.9 ? 'PUBLICADO' : 'TRABALHANDO'}</small></header>
                <div className="story-build-metrics">
                  <div><small>PLANEJANDO</small><strong>{planning > 0.98 ? 'OK' : '...'}</strong><em>{planning > 0.98 ? 'estrutura definida' : 'entendendo o pedido'}</em></div>
                  <div><small>THINKING</small><strong>{thinkingSeconds}s</strong><em>{thinking > 0.98 ? 'decisões concluídas' : 'avaliando'}</em></div>
                  <div><small>PROGRAMANDO</small><strong>{fileCount}/9</strong><em>{programming > 0.98 ? 'arquivos criados' : 'criando'}</em></div>
                  <div><small>REVISÃO</small><strong>{testCount}/24</strong><em>{testing > 0.98 ? 'testes concluídos' : 'validando'}</em></div>
                </div>
                <div className="story-build-main">
                  <div className="story-build-plan">
                    <small>PLANO DE EXECUÇÃO</small>
                    <strong>Car sales website</strong>
                    <span className={planning > 0.95 ? 'done' : 'active'}>01 · Planejar</span>
                    <span className={thinking > 0.95 ? 'done' : 'active'}>02 · Pensar</span>
                    <span className={programming > 0.95 ? 'done' : 'active'}>03 · Programar</span>
                    <span className={payment > 0.95 ? 'done' : 'active'}>04 · Integrar</span>
                    <span className={testing > 0.95 ? 'done' : 'active'}>05 · Testar</span>
                    <span className={publish > 0.95 ? 'done' : 'active'}>06 · Publicar</span>
                  </div>
                  <div className="story-build-editor">
                    <div className="story-code-tabs"><span>FeaturedCars.jsx</span><span>inventory.js</span><span>landing.css</span></div>
                    <pre>{BUILD_CODE.slice(0, codeCount)}<i className="story-code-caret" /></pre>
                    <div className="story-build-footer"><span>{programming > 0.5 ? 'implementando interface' : 'preparando arquivos'}</span><b>{paymentCount}/8 integrações</b></div>
                  </div>
                </div>
              </div>
            </Scene>

            <Scene className="story-final-site" style={{ opacity: finalSite, transform: `scale(${0.96 + 0.04 * finalSite}) translateY(${18 - 18 * finalSite}px)` }}>
              {finalSiteMarkup(finalSite)}
            </Scene>

            <Scene className="story-end" style={{ opacity: ending }}>
              <Logo className="story-end-logo" />
              <strong>TAFF 2.0</strong>
              <small>do primeiro plano ao produto pronto.</small>
              <button onClick={complete}>Entrar no Codex</button>
            </Scene>
          </div>
        </div>
      </div>
    </section>
  );
}
