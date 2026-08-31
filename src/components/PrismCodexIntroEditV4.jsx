import { useEffect, useMemo, useRef, useState } from 'react';
import './prism-codex-intro-v4.css';

export const INTRO_KEY = 'prism_codex_intro_seen';
const PROMPT = 'Create a website for selling my clothes.';
const MODEL = 'prism-taff-2.0';
const TOTAL_MS = 24_000;

const SHOTS = [
  {
    src: 'https://images.pexels.com/photos/5380590/pexels-photo-5380590.jpeg?auto=compress&cs=tinysrgb&w=2400',
    credit: 'Pexels / Tima Miroshnichenko',
    alt: 'Pessoa digitando em um teclado diante de telas',
  },
  {
    src: 'https://images.pexels.com/photos/5496459/pexels-photo-5496459.jpeg?auto=compress&cs=tinysrgb&w=2400',
    credit: 'Pexels / Pavel Danilyuk',
    alt: 'Mãos digitando em um laptop em ambiente escuro',
  },
  {
    src: 'https://images.pexels.com/photos/8102699/pexels-photo-8102699.jpeg?auto=compress&cs=tinysrgb&w=2400',
    credit: 'Pexels / Ron Lach',
    alt: 'Pessoa trabalhando em teclado',
  },
  {
    src: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&fm=jpg&q=88&w=2400',
    credit: 'Unsplash',
    alt: 'Workspace de desenvolvimento com código na tela',
  },
];

const SCENES = [
  { id: 'prism', duration: 3_000 },
  { id: 'editorial', duration: 2_650 },
  { id: 'columns', duration: 2_250 },
  { id: 'star', duration: 1_400 },
  { id: 'codex', duration: 2_600 },
  { id: 'lockup', duration: 2_000 },
  { id: 'morph', duration: 1_800 },
  { id: 'greeting', duration: 1_550 },
  { id: 'composer', duration: 2_650 },
  { id: 'models', duration: 2_100 },
  { id: 'agent', duration: 2_000 },
];

const MODELS = ['Prism Nano 1.0', 'Prism Mini 1.0', 'Prism Tex 1.5', 'Prism Taff 1.0', 'Prism Taff 2.0'];

function preloadImages() {
  return Promise.all(
    SHOTS.map(
      (shot) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = 'async';
          img.onload = resolve;
          img.onerror = resolve;
          img.src = shot.src;
        }),
    ),
  );
}

function useSceneClock(enabled) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const nextTimer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let index = 0;

    const advance = () => {
      if (cancelled) return;
      if (index >= SCENES.length - 1) return;
      index += 1;
      setSceneIndex(index);
      nextTimer.current = window.setTimeout(advance, SCENES[index].duration);
    };

    nextTimer.current = window.setTimeout(advance, SCENES[0].duration);
    return () => {
      cancelled = true;
      if (nextTimer.current) window.clearTimeout(nextTimer.current);
    };
  }, [enabled]);

  return sceneIndex;
}

function LetterSplit({ children }) {
  return (
    <span className="pce4-split-letters" aria-label={children}>
      {[...children].map((char, index) => (
        <span key={`${char}-${index}`} style={{ '--i': index }}>
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </span>
  );
}

function Typewriter({ active }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!active) {
      setText('');
      return undefined;
    }
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setText(PROMPT.slice(0, index));
      if (index >= PROMPT.length) window.clearInterval(timer);
    }, 42);
    return () => window.clearInterval(timer);
  }, [active]);
  return <>{text}<i className="pce4-caret" /></>;
}

export default function PrismCodexIntroEditV4({ onComplete }) {
  const reduced = useMemo(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    [],
  );
  const [ready, setReady] = useState(false);
  const [agentState, setAgentState] = useState('idle');
  const doneRef = useRef(false);
  const sceneIndex = useSceneClock(ready && !reduced);
  const scene = SCENES[sceneIndex];

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
    const onKeyDown = (event) => {
      if (event.key === 'Escape') complete();
    };
    const onAgentState = (event) => setAgentState(event.detail?.state || 'idle');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('prism:codex-agent-state', onAgentState);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('prism:codex-agent-state', onAgentState);
    };
  }, [reduced]);

  useEffect(() => {
    if (!ready || reduced || scene.id !== 'agent') return undefined;
    const timer = window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('prism:codex-autostart', {
          detail: { prompt: PROMPT, model: MODEL, thinking: 'ultracode' },
        }),
      );
    }, 240);
    return () => window.clearTimeout(timer);
  }, [ready, reduced, scene.id]);

  useEffect(() => {
    if (!ready || reduced) return undefined;
    if (sceneIndex !== SCENES.length - 1) return undefined;
    const timer = window.setTimeout(complete, scene.duration);
    return () => window.clearTimeout(timer);
  }, [ready, reduced, sceneIndex, scene.duration]);

  const isFinal = scene.id === 'agent';
  const agentWorking = ['started', 'streaming'].includes(agentState);
  const agentDone = agentState === 'completed';
  const agentFailed = agentState === 'failed';

  return (
    <section className={`pce4 ${ready ? 'pce4-ready' : 'pce4-loading'} pce4-scene-${scene.id}`} aria-label="Introdução do Prism Codex">
      <div className="pce4-frame" />
      <div className="pce4-grain" />
      <div className="pce4-cut" />
      <div className="pce4-topline"><span>PRISM</span><span>CODEX / 001</span></div>
      <button className="pce4-skip" type="button" onClick={complete}>Pular <b>ESC</b></button>

      {scene.id === 'prism' && (
        <div className="pce4-scene pce4-prism-scene">
          <div className="pce4-prism-word"><LetterSplit>PRISM AI</LetterSplit></div>
          <div className="pce4-prism-sub">ARTIFICIAL INTELLIGENCE</div>
        </div>
      )}

      {scene.id === 'editorial' && (
        <div className="pce4-scene pce4-editorial-scene">
          <img className="pce4-editorial-image" src={SHOTS[3].src} alt="" />
          <div className="pce4-editorial-mask" />
          <div className="pce4-editorial-type">
            <span>01 / MACHINE INTELLIGENCE</span>
            <strong>MODELS<br /><em>INFERENCE</em></strong>
            <small>AGENTS · COMPUTE · SOFTWARE</small>
          </div>
          <div className="pce4-editorial-edge">THE NEW MEDIUM</div>
        </div>
      )}

      {scene.id === 'columns' && (
        <div className="pce4-scene pce4-columns-scene">
          <div className="pce4-column pce4-column-top">
            <img src={SHOTS[0].src} alt="" />
            <div><span>MODELS</span><strong>INFERENCE</strong></div>
          </div>
          <div className="pce4-column pce4-column-bottom">
            <img src={SHOTS[1].src} alt="" />
            <div><span>AGENTS</span><strong>EXECUTION</strong></div>
          </div>
        </div>
      )}

      {scene.id === 'star' && (
        <div className="pce4-scene pce4-star-scene" aria-hidden="true">
          <div className="pce4-star" />
          <div className="pce4-star-ring" />
          <span className="pce4-star-label">PRISM</span>
        </div>
      )}

      {scene.id === 'codex' && (
        <div className="pce4-scene pce4-codex-scene">
          <div className="pce4-codex-word">CODEX</div>
          <div className="pce4-codex-under">A DEVELOPMENT SYSTEM BY PRISM</div>
        </div>
      )}

      {scene.id === 'lockup' && (
        <div className="pce4-scene pce4-lockup-scene">
          <div className="pce4-lockup-ai">PRISM AI</div>
          <div className="pce4-lockup-codex">CODEX</div>
          <div className="pce4-lockup-note">ALL IN ONE</div>
        </div>
      )}

      {scene.id === 'morph' && (
        <div className="pce4-scene pce4-morph-scene">
          <div className="pce4-all">ALL IN ONE</div>
          <div className="pce4-prism-logo">Prism</div>
        </div>
      )}

      {scene.id === 'greeting' && (
        <div className="pce4-scene pce4-greeting-scene">
          <span>good morning,</span>
          <strong>programmer</strong>
        </div>
      )}

      {scene.id === 'composer' && (
        <div className="pce4-scene pce4-composer-scene">
          <div className="pce4-composer">
            <div className="pce4-composer-label">PRISM CODEX</div>
            <div className="pce4-composer-text"><Typewriter active /></div>
            <div className="pce4-composer-meta">BUILD / VIBE CODE</div>
          </div>
        </div>
      )}

      {scene.id === 'models' && (
        <div className="pce4-scene pce4-models-scene">
          <div className="pce4-models-head">MODELOS</div>
          <div className="pce4-models-list">
            {MODELS.map((model, index) => (
              <div key={model} className={`pce4-model-row ${index === MODELS.length - 1 ? 'selected' : ''}`}>
                <span>0{index + 1}</span>
                <strong>{model}</strong>
                {index === MODELS.length - 1 && <i>✓</i>}
              </div>
            ))}
          </div>
        </div>
      )}

      {scene.id === 'agent' && (
        <div className="pce4-scene pce4-agent-scene">
          <img className="pce4-agent-image" src={SHOTS[0].src} alt="" />
          <div className="pce4-agent-overlay" />
          <div className="pce4-agent-type">
            <span>PRISM TAFF 2.0</span>
            <strong>ANALYZE<br />BUILD<br />REVIEW</strong>
            <small>{agentFailed ? 'BACKEND UNAVAILABLE' : agentDone ? 'COMPLETED' : agentWorking ? 'AGENT WORKING' : 'STARTING AGENT'}</small>
          </div>
          <div className={`pce4-agent-state state-${agentState}`}><i />{agentFailed ? 'UNAVAILABLE' : agentDone ? 'DONE' : agentWorking ? 'WORKING' : 'STARTING'}</div>
          <div className="pce4-agent-prompt">{PROMPT}</div>
          <div className="pce4-agent-caption">REAL WORKSPACE · REAL FILES · REAL EXECUTION PATH</div>
        </div>
      )}

      <div className="pce4-footer"><span>{SHOTS[sceneIndex % SHOTS.length].credit}</span><span>{String(sceneIndex + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}</span></div>
      <div className={`pce4-readiness ${isFinal ? 'visible' : ''}`} aria-hidden="true" />
    </section>
  );
}
