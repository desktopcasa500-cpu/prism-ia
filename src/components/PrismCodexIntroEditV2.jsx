import { useEffect, useMemo, useRef, useState } from 'react';

const INTRO_KEY = 'prism_codex_intro_seen';
const DURATION = 22_400;

// Real photography from public web sources. No generated media is committed.
const SHOTS = [
  { src: 'https://images.unsplash.com/photo-1759662011366-8a743eae9649?auto=format&fit=crop&fm=jpg&q=82&w=2200', credit: 'Unsplash · Jakub Żerdzicki', position: '50% 54%' },
  { src: 'https://images.pexels.com/videos/5473802/pexels-photo-5473802.jpeg?auto=compress&dpr=1&h=1080&w=1920', credit: 'Pexels · cottonbro studio', position: '50% 50%' },
  { src: 'https://images.pexels.com/videos/13522186/coder-coding-computer-computer-software-13522186.jpeg?auto=compress&dpr=1&h=1080&w=1920', credit: 'Pexels · Raddy', position: '52% 48%' },
  { src: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&fm=jpg&q=82&w=2200', credit: 'Unsplash', position: '55% 52%' },
  { src: 'https://images.unsplash.com/photo-1607971584791-aca00eb17fd5?auto=format&fit=crop&fm=jpg&q=82&w=2200', credit: 'Unsplash', position: '48% 55%' },
];

const SCENES = [
  { at: 0, duration: 1900, shot: 0, kicker: 'PRISM IA / ORIGINAL EDIT', title: ['IDEAS', 'BECOME', 'SYSTEMS.'], mode: 'hero' },
  { at: 1900, duration: 1700, shot: 1, kicker: '01 / INPUT', title: ['YOU', 'DESCRIBE.'], mode: 'split' },
  { at: 3600, duration: 1800, shot: 2, kicker: '02 / INTENT', title: ['PRISM', 'UNDERSTANDS.'], mode: 'type' },
  { at: 5400, duration: 1800, shot: 0, kicker: '03 / CONTEXT', title: ['THE', 'CONTEXT', 'STAYS.'], mode: 'frame' },
  { at: 7200, duration: 1600, shot: 3, kicker: '04 / CODEX', title: ['NOT A', 'CHAT BOX.'], mode: 'impact' },
  { at: 8800, duration: 1800, shot: 3, kicker: '05 / BUILD', title: ['A LIVING', 'WORKSPACE.'], mode: 'code' },
  { at: 10600, duration: 1600, shot: 4, kicker: '06 / AGENT', title: ['PLAN.', 'BUILD.', 'REVIEW.'], mode: 'stack' },
  { at: 12200, duration: 1900, shot: 1, kicker: '07 / ORCHESTRATION', title: ['MANY', 'ENGINES.', 'ONE FLOW.'], mode: 'grid' },
  { at: 14100, duration: 1500, shot: 2, kicker: '08 / RESULT', title: ['FROM WORDS', 'TO SOFTWARE.'], mode: 'clean' },
  { at: 15600, duration: 1900, shot: 3, kicker: '09 / PRISM TAFF 2.0', title: ['THINK', 'DEEPER.'], mode: 'mono' },
  { at: 17500, duration: 1900, shot: 0, kicker: '10 / CODEX', title: ['BUILD', 'WITHOUT', 'LEAVING.'], mode: 'reveal' },
  { at: 19400, duration: 3000, shot: 3, kicker: 'PRISM CODEX / 2026', title: ['WELCOME', 'TO CODEX.'], mode: 'final' },
];

function preloadImages() {
  return Promise.all(SHOTS.map((shot) => new Promise((resolve) => {
    const image = new Image();
    image.onload = resolve;
    image.onerror = resolve;
    image.src = shot.src;
  })));
}

export default function PrismCodexIntroEditV2({ onComplete }) {
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const completedRef = useRef(false);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    localStorage.setItem(INTRO_KEY, '1');
    onComplete?.({ model: 'prism-taff-2.0' });
  };

  useEffect(() => {
    if (reduced) {
      complete();
      return undefined;
    }
    let cancelled = false;
    preloadImages().finally(() => {
      if (cancelled) return;
      setReady(true);
      startRef.current = performance.now();
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = now - startRef.current;
        setTime(Math.min(elapsed, DURATION));
        if (elapsed >= DURATION) {
          complete();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });
    const onKeyDown = (event) => { if (event.key === 'Escape') complete(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [reduced]);

  let sceneIndex = 0;
  SCENES.forEach((scene, index) => { if (time >= scene.at) sceneIndex = index; });
  const scene = SCENES[sceneIndex];
  const shot = SHOTS[scene.shot];
  const progress = `${Math.min((time / DURATION) * 100, 100)}%`;
  const localProgress = Math.max(0, Math.min((time - scene.at) / scene.duration, 1));

  return (
    <section className={`prism-edit-v2 ${ready ? 'is-ready' : 'is-loading'} edit-${scene.mode}`} aria-label="Apresentação do Prism Codex">
      <div className="pe2-bg" style={{ backgroundImage: `url(${shot.src})`, backgroundPosition: shot.position }} />
      <div className="pe2-vignette" /><div className="pe2-grain" /><div className="pe2-scan" /><div className="pe2-bloom" />
      <div className="pe2-chrome"><div>PRISM / CODEX</div><div><span>REAL MATERIAL</span><b>{String(sceneIndex + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}</b></div></div>
      <div className="pe2-rule pe2-rule-top" /><div className="pe2-rule pe2-rule-bottom" style={{ '--progress': progress }}><i /></div>
      <div className="pe2-shot-meta">{shot.credit}<span />FILM / DIGITAL EDIT</div><div className="pe2-timecode">00:{String(Math.floor(time / 1000)).padStart(2, '0')}:{String(Math.floor((time % 1000) / 10)).padStart(2, '0')}</div>
      <div className="pe2-center-mark" aria-hidden="true"><span>P</span><i /><i /></div>
      <div className="pe2-copy"><span className="pe2-kicker">{scene.kicker}</span><h1>{scene.title.map((line) => <span key={line}>{line}</span>)}</h1>{scene.mode === 'final' ? <p>Uma superfície para pensar, escrever código, revisar e continuar o projeto.</p> : null}</div>
      {(scene.mode === 'split' || scene.mode === 'grid') && <div className="pe2-split-panel" aria-hidden="true"><div className="pe2-panel pe2-panel-a"><small>REQUEST</small><strong>DESCRIBE<br />THE IDEA.</strong><em>natural language</em></div><div className="pe2-panel pe2-panel-b"><small>CODEX</small><strong>TURN IT<br />INTO A SYSTEM.</strong><em>agent workspace</em></div></div>}
      {(scene.mode === 'type' || scene.mode === 'frame') && <div className="pe2-typed" aria-hidden="true"><span>PRISM / UNDERSTANDING</span><strong>context → intent → plan → execution</strong><i /></div>}
      {scene.mode === 'impact' && <div className="pe2-impact" aria-hidden="true"><span>CODE</span><b>X</b><span>WORKSPACE</span><strong>≠</strong><span>CHAT</span></div>}
      {(scene.mode === 'code' || scene.mode === 'mono') && <div className="pe2-terminal" aria-hidden="true"><header><span>src / app / workspace</span><b>LIVE</b></header><div className="pe2-terminal-grid"><div className="pe2-lines">{Array.from({ length: 12 }, (_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div><pre>{`const workspace = await codex.build({\n  prompt,\n  context,\n  models: ['taff', 'tex'],\n});\n\nawait review(workspace);\nreturn workspace;`}</pre></div><footer><span>BUILD / REVIEW</span><strong>Prism Taff 2.0</strong></footer></div>}
      {(scene.mode === 'stack' || scene.mode === 'reveal') && <div className="pe2-stack" aria-hidden="true"><div><small>01</small><strong>ANALYZE</strong><span>intent + context</span></div><div><small>02</small><strong>BUILD</strong><span>files + code</span></div><div><small>03</small><strong>REVIEW</strong><span>quality + consistency</span></div></div>}
      {scene.mode === 'clean' && <div className="pe2-clean-card" aria-hidden="true"><small>OUTPUT / VERIFIED</small><strong>software/<br />is&nbsp;alive.</strong><span>preview · files · changes · history</span></div>}
      {scene.mode === 'final' && <div className="pe2-final-ui" aria-hidden="true"><div className="pe2-final-window"><header><span>PRISM CODEX</span><b>NEW PROJECT / 001</b></header><div className="pe2-final-input">Create a polished product website with Prism Codex.<i /></div><footer><span>DESCRIBE WHAT YOU WANT TO BUILD</span><strong>Prism Taff 2.0 ↗</strong></footer></div><div className="pe2-final-tags"><span>CHAT</span><span>VIBE CODE</span><b>CODEX</b></div></div>}
      <button className="pe2-skip" type="button" onClick={complete}>Pular <span>ESC</span></button><div className="pe2-progress-label">{Math.round(localProgress * 100)}%</div>
    </section>
  );
}

export { INTRO_KEY };
