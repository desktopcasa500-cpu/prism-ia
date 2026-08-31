import { useEffect, useMemo, useRef, useState } from 'react';

const INTRO_KEY = 'prism_codex_intro_seen';
const PROMPT = 'Create a website for selling my clothes.';
const MODEL = 'prism-taff-2.0';
const DURATION = 30_000;
const MODELS = ['Prism Nano 1.0', 'Prism Mini 1.0', 'Prism Tex 1.5', 'Prism Taff 1.0', 'Prism Taff 2.0'];
const PHOTOS = [
  { src: 'https://images.pexels.com/photos/5380590/pexels-photo-5380590.jpeg?auto=compress&cs=tinysrgb&w=2400', credit: 'Pexels · Tima Miroshnichenko' },
  { src: 'https://images.pexels.com/photos/5496459/pexels-photo-5496459.jpeg?auto=compress&cs=tinysrgb&w=2400', credit: 'Pexels · Pavel Danilyuk' },
  { src: 'https://images.pexels.com/photos/8102699/pexels-photo-8102699.jpeg?auto=compress&cs=tinysrgb&w=2400', credit: 'Pexels · Ron Lach' },
  { src: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&fm=jpg&q=88&w=2400', credit: 'Unsplash' },
];

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const easeOut = (n) => 1 - (1 - clamp(n)) ** 3;
const easeIn = (n) => clamp(n) ** 3;
const easeInOut = (n) => {
  const t = clamp(n);
  return t < 0.5 ? 8 * t ** 4 : 1 - ((-2 * t + 2) ** 4) / 2;
};
const between = (time, start, end) => clamp((time - start) / (end - start));

function preloadImages() {
  return Promise.all(PHOTOS.map((photo) => new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = resolve;
    img.onerror = resolve;
    img.src = photo.src;
  })));
}

function Letters({ text, className = '' }) {
  return <span className={`pce3-letters ${className}`} aria-label={text}>
    {[...text].map((char, index) => <span key={`${char}-${index}`} style={{ '--i': index }}>{char === ' ' ? '\u00a0' : char}</span>)}
  </span>;
}

export default function PrismCodexIntroEditV3({ onComplete }) {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [agentState, setAgentState] = useState('idle');
  const doneRef = useRef(false);
  const agentTriggeredRef = useRef(false);
  const frameRef = useRef(0);

  const complete = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    localStorage.setItem(INTRO_KEY, '1');
    onComplete?.({ prompt: PROMPT, model: MODEL });
  };

  useEffect(() => {
    let cancelled = false;
    if (reduced) {
      complete();
      return undefined;
    }
    preloadImages().finally(() => {
      if (!cancelled) setReady(true);
    });
    const keydown = (event) => { if (event.key === 'Escape') complete(); };
    const state = (event) => setAgentState(event.detail?.state || 'idle');
    window.addEventListener('keydown', keydown);
    window.addEventListener('prism:codex-agent-state', state);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('prism:codex-agent-state', state);
    };
  }, [reduced]);

  useEffect(() => {
    if (!ready || reduced) return undefined;
    let cancelled = false;
    const start = performance.now();
    const tick = (now) => {
      if (cancelled) return;
      const next = Math.min(now - start, DURATION);
      setTime(next);
      if (next < DURATION) frameRef.current = requestAnimationFrame(tick);
      else complete();
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
    };
  }, [ready, reduced]);

  useEffect(() => {
    if (!ready || reduced || time < 27_450 || agentTriggeredRef.current) return;
    agentTriggeredRef.current = true;
    window.dispatchEvent(new CustomEvent('prism:codex-autostart', {
      detail: { prompt: PROMPT, model: MODEL, thinking: 'ultracode' },
    }));
  }, [ready, reduced, time]);

  if (!ready && !reduced) {
    return <section className="prism-codex-edit-v3 pce3-loading" aria-label="Carregando apresentação do Prism Codex"><span>PRISM</span></section>;
  }

  const titleOut = between(time, 3000, 3850);
  const editorial = between(time, 3850, 6650);
  const columns = between(time, 6400, 9000);
  const star = between(time, 8750, 9800);
  const prism = between(time, 9550, 12500);
  const codexIn = between(time, 12000, 12750);
  const codexDrop = between(time, 15500, 17500);
  const codexReturn = between(time, 17500, 18250);
  const allInOne = between(time, 18250, 20550);
  const morph = between(time, 20350, 21500);
  const greeting = between(time, 21300, 22700);
  const composer = between(time, 22400, 25300);
  const models = between(time, 25050, 27350);
  const agent = between(time, 27350, 30000);
  const promptProgress = between(time, 22900, 24500);
  const promptCount = Math.floor(PROMPT.length * promptProgress);
  const modelSelected = models > 0.68;
  const activePhoto = PHOTOS[Math.min(PHOTOS.length - 1, Math.floor(time / 7500))];
  const agentLive = ['started', 'streaming', 'completed'].includes(agentState);

  return <section className="prism-codex-edit-v3" aria-label="Introdução cinematográfica do Prism Codex">
    <div className="pce3-image pce3-image-a" style={{ backgroundImage: `url(${activePhoto.src})`, transform: `scale(${1.04 + easeOut((time % 7500) / 7500) * .06})` }} />
    <div className="pce3-image pce3-image-b" style={{ backgroundImage: `url(${PHOTOS[(Math.floor(time / 7500) + 1) % PHOTOS.length].src})`, opacity: clamp((time % 7500) / 1500) * .52 }} />
    <div className="pce3-grade" />
    <div className="pce3-grain" />
    <div className="pce3-scan" />
    <div className="pce3-flash" style={{ opacity: star > 0 && star < 1 ? Math.sin(star * Math.PI) * .92 : 0 }} />

    <header className="pce3-header"><span>PRISM IA</span><span>CODEX / ORIGINAL EDIT</span></header>
    <div className="pce3-rule pce3-rule-top" />
    <div className="pce3-progress"><i style={{ width: `${clamp(time / DURATION) * 100}%` }} /></div>
    <button className="pce3-skip" type="button" onClick={complete}>Pular <b>ESC</b></button>

    <div className="pce3-scene pce3-prism-title" style={{ opacity: 1 - titleOut, transform: `scale(${1 + easeOut(titleOut) * .05})` }}>
      <Letters text="PRISM AI" className="pce3-script" />
      <span>ARTIFICIAL INTELLIGENCE / COMPUTATIONAL SYSTEMS</span>
    </div>

    <div className="pce3-scene pce3-glitch" style={{ opacity: titleOut }} aria-hidden="true">
      <Letters text="PRISM AI" className="pce3-glitch-copy" />
      <i className="pce3-slice pce3-slice-a" /><i className="pce3-slice pce3-slice-b" /><i className="pce3-slice pce3-slice-c" />
    </div>

    <div className="pce3-scene pce3-editorial" style={{ opacity: editorial, transform: `translate3d(0,${(1 - easeOut(editorial)) * 34}px,0)` }} aria-hidden="true">
      <div className="pce3-editorial-top"><b>PRISM / RESEARCH</b><span>001 — MACHINE INTELLIGENCE</span></div>
      <div className="pce3-editorial-grid">
        <div className="pce3-editorial-lead"><small>THE MACHINE</small><strong>INTELLIGENCE<br /><em>IS A MATERIAL.</em></strong><p>MODELS · INFERENCE · AGENTS · COMPUTE</p></div>
        <div className="pce3-editorial-rows">
          {[
            ['MODELS', 'INFERENCE / REASONING', '01'],
            ['OPENAI', 'MODELS / RESEARCH', '02'],
            ['DATA CENTERS', 'COMPUTE / SCALE', '03'],
            ['AGENTS', 'TOOLS / EXECUTION', '04'],
            ['SOFTWARE', 'INTERFACE / WORKFLOW', '05'],
          ].map(([title, detail, number]) => <div key={number}><b>{title}</b><span>{detail}</span><em>{number}</em></div>)}
        </div>
      </div>
      <div className="pce3-editorial-bottom"><span>HUMAN × MACHINE</span><span>{activePhoto.credit}</span></div>
    </div>

    <div className="pce3-scene pce3-columns" style={{ opacity: columns }} aria-hidden="true">
      <div className="pce3-column pce3-column-top" style={{ transform: `translate3d(0,${-easeInOut(columns) * 125}%,0)` }}><small>SUPERIOR</small><strong>MODELS<br />INFERENCE</strong><span>CONTEXT / REASONING</span><div className="pce3-column-image" style={{ backgroundImage: `url(${PHOTOS[1].src})` }} /></div>
      <div className="pce3-column pce3-column-bottom" style={{ transform: `translate3d(0,${easeInOut(columns) * 125}%,0)` }}><small>INFERIOR</small><strong>AGENTS<br />COMPUTE</strong><span>TOOLS / EXECUTION</span><div className="pce3-column-image" style={{ backgroundImage: `url(${PHOTOS[2].src})` }} /></div>
    </div>

    <div className="pce3-scene pce3-star-scene" style={{ opacity: star }} aria-hidden="true">
      <div className="pce3-star" style={{ transform: `translate(-50%,-50%) scale(${.1 + easeOut(star) * 1.45})` }} />
      {Array.from({ length: 24 }, (_, index) => <i key={index} className="pce3-ray" style={{ '--r': `${index * 15}deg`, '--burst': star }} />)}
      <div className="pce3-burst" style={{ transform: `translate(-50%,-50%) scale(${1 + easeOut(star) * 8})`, opacity: 1 - star }} />
    </div>

    <div className="pce3-scene pce3-prism-return" style={{ opacity: prism * (1 - allInOne), transform: `scale(${.9 + easeOut(prism) * .1})` }}><Letters text="PRISM AI" className="pce3-script pce3-script-large" /></div>
    <div className="pce3-scene pce3-codex-enter" style={{ opacity: codexIn, transform: `translateY(${(1 - easeOut(codexIn)) * -60}px)` }}><strong>CODEX</strong><small>PRISM AI / DEVELOPMENT SYSTEM</small></div>

    <div className="pce3-scene pce3-lockup" aria-hidden="true">
      <div className="pce3-lockup-ai" style={{ transform: `translate(-50%,${-easeIn(codexDrop) * 160}px)`, opacity: 1 - codexDrop }}>PRISM <b>AI</b></div>
      <div className="pce3-lockup-codex" style={{ transform: `translate(-50%,${(1 - easeOut(codexReturn)) * 65}px)` }}>CODEX</div>
      <div className="pce3-lockup-all" style={{ opacity: allInOne, transform: `translate(-50%,${(1 - easeOut(allInOne)) * 28}px)` }}>ALL IN ONE</div>
    </div>

    <div className="pce3-scene pce3-morph" style={{ opacity: morph }} aria-hidden="true">
      <div className="pce3-all-word" style={{ opacity: 1 - easeOut(morph), transform: `scale(${1 - easeOut(morph) * .4})` }}>ALL IN ONE</div>
      <div className="pce3-logo-morph" style={{ opacity: between(morph, .2, .9), transform: `scale(${.75 + easeOut(morph) * .25})` }}><span className="pce3-logo-star">✦</span><strong>PRISM</strong></div>
    </div>

    <div className="pce3-scene pce3-greeting" style={{ opacity: greeting, transform: `translateY(${(1 - easeOut(greeting)) * 30}px)` }}><span>good morning,</span><strong>programmer</strong></div>

    <div className="pce3-scene pce3-composer-scene" style={{ opacity: composer, transform: `translateY(${(1 - easeOut(composer)) * 22}px) scale(${.98 + composer * .02})` }}>
      <div className="pce3-composer"><header><span>PRISM CODEX</span><b>NEW PROJECT / 001</b></header><div className="pce3-composer-text">{PROMPT.slice(0, promptCount)}<i /></div><footer><span>DESCRIBE WHAT YOU WANT TO BUILD</span><b>Prism Taff 2.0 ↗</b></footer></div>
    </div>

    <div className="pce3-scene pce3-models" style={{ opacity: models, transform: `translateY(${(1 - easeOut(models)) * 18}px)` }}>
      <div className="pce3-model-head">MODELOS</div>
      {MODELS.map((label, index) => <div key={label} className={`pce3-model-row ${index === MODELS.length - 1 && modelSelected ? 'selected' : ''}`}><span>0{index + 1}</span><b>{label}</b>{index === MODELS.length - 1 && modelSelected ? <i>✓</i> : null}</div>)}
    </div>

    <div className="pce3-scene pce3-agent" style={{ opacity: agent }}>
      <div className="pce3-agent-bg" style={{ backgroundImage: `url(${PHOTOS[0].src})`, transform: `scale(${1.02 + easeOut(agent) * .08})` }} /><div className="pce3-agent-grade" />
      <div className="pce3-agent-content"><span>PRISM TAFF 2.0 / {agentLive ? 'AGENT ONLINE' : agentState === 'failed' ? 'UNAVAILABLE' : 'STARTING'}</span><strong>ANALYZE <i>→</i> BUILD <i>→</i> REVIEW</strong><small>{agentState === 'failed' ? 'Backend indisponível para esta execução.' : 'workspace · files · preview · real execution path'}</small></div>
      <div className={`pce3-agent-status state-${agentState}`}><i />{agentState === 'failed' ? 'UNAVAILABLE' : agentState === 'completed' ? 'DONE' : agentLive ? 'WORKING' : 'STARTING'}</div>
    </div>

    <footer className="pce3-footer"><span>{activePhoto.credit}</span><span>{String(Math.floor(time / 1000)).padStart(2, '0')} / 30</span></footer>
  </section>;
}

export { INTRO_KEY };
