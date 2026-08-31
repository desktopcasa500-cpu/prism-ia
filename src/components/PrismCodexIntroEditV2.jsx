import { useEffect, useMemo, useRef, useState } from 'react';

const INTRO_KEY = 'prism_codex_intro_seen';
const DURATION = 30_000;
const PROMPT = 'Create a website for selling my clothes.';
const MODELS = ['Prism Nano 1.0', 'Prism Mini 1.0', 'Prism Tex 1.5', 'Prism Taff 1.0', 'Prism Taff 2.0'];

const PHOTOS = [
  { src: 'https://images.pexels.com/photos/5380590/pexels-photo-5380590.jpeg?auto=compress&cs=tinysrgb&w=2400', credit: 'Pexels · Tima Miroshnichenko', alt: 'Pessoa digitando em teclado com telas de código', position: '50% 48%' },
  { src: 'https://images.pexels.com/photos/5496459/pexels-photo-5496459.jpeg?auto=compress&cs=tinysrgb&w=2400', credit: 'Pexels · Pavel Danilyuk', alt: 'Mãos digitando código em laptop em uma sala escura', position: '50% 48%' },
  { src: 'https://images.pexels.com/photos/8102699/pexels-photo-8102699.jpeg?auto=compress&cs=tinysrgb&w=2400', credit: 'Pexels · Ron Lach', alt: 'Mão digitando em teclado preto', position: '52% 54%' },
  { src: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&fm=jpg&q=88&w=2400', credit: 'Unsplash', alt: 'Workspace com monitor mostrando código', position: '55% 50%' },
];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const easeOut = (value) => 1 - (1 - clamp(value)) ** 3;
const easeIn = (value) => clamp(value) ** 3;
const easeInOut = (value) => { const t = clamp(value); return t < 0.5 ? 8 * t ** 4 : 1 - ((-2 * t + 2) ** 4) / 2; };

function preloadImages() {
  return Promise.all(PHOTOS.map((photo) => new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = resolve;
    image.onerror = resolve;
    image.src = photo.src;
  })));
}

function Letters({ text, className = '', mode = 'in' }) {
  return <span className={`pce-letters ${className} pce-letters--${mode}`} aria-label={text}>{[...text].map((char, index) => <span key={`${char}-${index}`} className="pce-letter" style={{ '--i': index }}>{char === ' ' ? '\u00a0' : char}</span>)}</span>;
}

export default function PrismCodexIntroEditV2({ onComplete }) {
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const doneRef = useRef(false);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  const complete = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    localStorage.setItem(INTRO_KEY, '1');
    onComplete?.({ prompt: PROMPT, model: 'prism-taff-2.0' });
  };

  useEffect(() => {
    if (reduced) { complete(); return undefined; }
    let cancelled = false;
    preloadImages().finally(() => {
      if (cancelled) return;
      setReady(true);
      startRef.current = performance.now();
      const tick = (now) => {
        if (cancelled) return;
        const next = Math.min(now - startRef.current, DURATION);
        setTime(next);
        if (next >= DURATION) { complete(); return; }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });
    const onKeyDown = (event) => { if (event.key === 'Escape') complete(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); window.removeEventListener('keydown', onKeyDown); };
  }, [reduced]);

  const introOut = clamp((time - 3000) / 720);
  const editorialIn = clamp((time - 3720) / 820);
  const columnsIn = clamp((time - 4540) / 520);
  const columnsOut = clamp((time - 6920) / 900);
  const starIn = clamp((time - 7820) / 500);
  const starBurst = clamp((time - 8320) / 680);
  const prismIn = clamp((time - 9000) / 420);
  const prismHold = clamp((time - 9420) / 2580);
  const codexIn = clamp((time - 12_000) / 620);
  const codexDrop = clamp((time - 15_620) / 460);
  const codexCenter = clamp((time - 18_080) / 640);
  const morph = clamp((time - 20_720) / 760);
  const greeting = clamp((time - 21_480) / 760);
  const composer = clamp((time - 22_240) / 960);
  const modelMenu = clamp((time - 23_460) / 760);
  const selected = clamp((time - 24_660) / 440);
  const agent = clamp((time - 25_280) / 1280);

  const promptProgress = clamp((time - 22_540) / 1250);
  const promptCount = Math.floor(PROMPT.length * promptProgress);
  const selectedModel = MODELS[MODELS.length - 1];
  const image = PHOTOS[Math.min(Math.floor(time / 5200), PHOTOS.length - 1)];
  const overall = `${clamp(time / DURATION) * 100}%`;

  return (
    <section className={`prism-codex-edit ${ready ? 'is-ready' : 'is-loading'}`} aria-label="Apresentação cinematográfica do Prism Codex">
      <div className="pce-photo pce-photo--a" style={{ backgroundImage: `url(${image.src})`, backgroundPosition: image.position }} />
      <div className="pce-photo pce-photo--b" style={{ backgroundImage: `url(${PHOTOS[(Math.floor(time / 5200) + 1) % PHOTOS.length].src})`, opacity: clamp((time % 5200) / 900) * 0.62 }} />
      <div className="pce-image-grade" />
      <div className="pce-noise" />
      <div className="pce-scanline" />
      <div className="pce-flash" style={{ opacity: starBurst > 0 && starBurst < 1 ? Math.sin(starBurst * Math.PI) * 0.9 : 0 }} />

      <header className="pce-ui"><span>PRISM IA / CODEX</span><span>ORIGINAL EDIT · 001</span></header>
      <div className="pce-rule pce-rule--top" />
      <div className="pce-rule pce-rule--bottom"><i style={{ width: overall }} /></div>
      <button className="pce-skip" type="button" onClick={complete}>Pular <b>ESC</b></button>

      <div className="pce-stage pce-stage--title" style={{ opacity: 1 - introOut, transform: `scale(${1 + introOut * 0.08})` }}>
        <Letters text="PRISM AI" className="pce-title-script" />
        <span className="pce-title-caption">ARTIFICIAL INTELLIGENCE / COMPUTATIONAL SYSTEMS</span>
      </div>

      <div className="pce-stage pce-stage--glitch" style={{ opacity: introOut, pointerEvents: 'none' }}>
        <Letters text="PRISM AI" className="pce-glitch-word" mode="out" />
        <i className="pce-glitch-slice pce-glitch-slice--1" /><i className="pce-glitch-slice pce-glitch-slice--2" /><i className="pce-glitch-slice pce-glitch-slice--3" />
      </div>

      <div className="pce-stage pce-editorial" style={{ opacity: editorialIn, transform: `translateY(${(1 - easeOut(editorialIn)) * 45}px)` }}>
        <div className="pce-editorial-top"><span>PRISM RESEARCH / SYSTEMS</span><b>01 / EDIT</b></div>
        <div className="pce-editorial-title"><small>THE MACHINE</small><strong>INTELLIGENCE<br /><em>IS A MATERIAL.</em></strong></div>
        <div className="pce-editorial-list">
          <div><small>01</small><b>MODELS</b><span>INFERENCE / REASONING</span></div>
          <div><small>02</small><b>DATA CENTERS</b><span>COMPUTE / SCALE</span></div>
          <div><small>03</small><b>AGENTS</b><span>TOOLS / EXECUTION</span></div>
          <div><small>04</small><b>SOFTWARE</b><span>INTERFACE / WORKFLOW</span></div>
        </div>
        <div className="pce-editorial-bottom"><span>HUMAN × MACHINE</span><span>{image.credit}</span></div>
      </div>

      <div className="pce-stage pce-columns" style={{ opacity: columnsIn }}>
        <div className="pce-column pce-column--top" style={{ transform: `translateY(${-columnsOut * 125}%) translateX(${(1 - columnsIn) * -3}%)` }}><small>SUPERIOR</small><strong>MODELS / INFERENCE</strong><span>CONTEXT / REASONING</span><img src={PHOTOS[1].src} alt="" /></div>
        <div className="pce-column pce-column--bottom" style={{ transform: `translateY(${columnsOut * 125}%) translateX(${(1 - columnsIn) * 3}%)` }}><small>INFERIOR</small><strong>AGENTS / COMPUTE</strong><span>TOOLS / EXECUTION</span><img src={PHOTOS[2].src} alt="" /></div>
      </div>

      <div className="pce-stage pce-star-scene" style={{ opacity: starIn }} aria-hidden="true">
        <div className="pce-star" style={{ transform: `translate(-50%, -50%) scale(${lerpStar(starIn, starBurst)})` }}><span />{Array.from({ length: 32 }, (_, index) => <i key={index} style={{ '--r': `${index * 11.25}deg`, '--burst': starBurst }} />)}</div>
        <div className="pce-burst-ring" style={{ transform: `translate(-50%, -50%) scale(${1 + starBurst * 7})`, opacity: 1 - starBurst }} />
      </div>

      <div className="pce-stage pce-prism-again" style={{ opacity: prismIn * (1 - morph), transform: `scale(${.82 + prismIn * .18})` }}><Letters text="PRISM AI" className="pce-prism-script" /></div>

      <div className="pce-stage pce-codex-stage" style={{ opacity: codexIn, transform: `translateY(${(1 - easeOut(codexIn)) * -50}px)` }}><div className="pce-codex-word">CODEX</div><small>PRISM AI / DEVELOPMENT SYSTEM</small></div>

      <div className="pce-stage pce-codex-lock" style={{ opacity: codexDrop }}>
        <div className="pce-lock-ai" style={{ transform: `translateY(${-easeIn(codexDrop) * 150}px)`, opacity: 1 - codexDrop }}>PRISM <b>AI</b></div>
        <div className="pce-lock-codex" style={{ transform: `translateY(${(1 - easeOut(codexCenter)) * 70}px)` }}>CODEX</div>
        <div className="pce-lock-all" style={{ opacity: codexCenter, transform: `translateY(${(1 - easeOut(codexCenter)) * 28}px)` }}>ALL IN ONE</div>
      </div>

      <div className="pce-stage pce-morph" style={{ opacity: morph }}>
        <div className="pce-morph-all" style={{ transform: `translateY(${(1 - easeOut(morph)) * 25}px) scale(${1 - morph * .36})`, letterSpacing: `${.03 - morph * .12}em` }}>ALL IN ONE</div>
        <div className="pce-morph-logo" style={{ opacity: clamp((morph - .36) / .64), transform: `scale(${.72 + morph * .28})` }}><span>✦</span><b>PRISM</b></div>
      </div>

      <div className="pce-stage pce-chat-sequence" style={{ opacity: greeting, transform: `translateY(${(1 - easeOut(greeting)) * 35}px)` }}>
        <div className="pce-greeting"><span>good morning,</span><strong>programmer</strong></div>
      </div>

      <div className="pce-stage pce-composer-sequence" style={{ opacity: composer, transform: `translateY(${(1 - easeOut(composer)) * 22}px) scale(${.98 + composer * .02})` }}>
        <div className="pce-real-composer">
          <div className="pce-composer-head"><span>PRISM CODEX</span><b>NEW PROJECT / 001</b></div>
          <div className="pce-composer-text">{PROMPT.slice(0, promptCount)}<i /></div>
          <div className="pce-composer-foot"><span>DESCRIBE WHAT YOU WANT TO BUILD</span><b>Prism Taff 2.0 ↗</b></div>
        </div>
      </div>

      <div className="pce-stage pce-model-menu" style={{ opacity: modelMenu, transform: `translateY(${(1 - easeOut(modelMenu)) * 18}px)` }}>
        <div className="pce-menu-head">MODELOS</div>
        {MODELS.map((model, index) => <div className={`pce-model-row ${index === 4 && selected > .2 ? 'selected' : ''}`} key={model} style={{ '--delay': `${index * .045}s` }}><span>{String(index + 1).padStart(2, '0')}</span><b>{model}</b>{index === 4 && selected > .2 ? <i>✓</i> : null}</div>)}
      </div>

      <div className="pce-stage pce-agent-sequence" style={{ opacity: agent }}>
        <div className="pce-agent-photo" style={{ backgroundImage: `url(${PHOTOS[0].src})` }} />
        <div className="pce-agent-grade" />
        <div className="pce-agent-content"><span>PRISM TAFF 2.0 / AGENT ONLINE</span><strong>ANALYZE → BUILD → REVIEW</strong><small>workspace · files · preview · real execution path</small></div>
        <div className="pce-agent-status"><i /> WORKING</div>
      </div>

      <div className="pce-foot"><span>{image.credit}</span><span>{Math.round(time / 1000).toString().padStart(2, '0')}s / 30s</span></div>
    </section>
  );
}

function lerpStar(inProgress, burstProgress) {
  const base = .08 + easeOut(inProgress) * 1.12;
  return base + burstProgress * 1.4;
}
