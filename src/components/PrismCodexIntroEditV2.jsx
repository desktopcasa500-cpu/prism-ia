import { useEffect, useMemo, useRef, useState } from 'react';

const INTRO_KEY = 'prism_codex_intro_seen';
const DURATION = 28_000;
const SHOTS = [
  { src: 'https://images.unsplash.com/photo-1759662011366-8a743eae9649?auto=format&fit=crop&fm=jpg&q=86&w=2400', credit: 'Unsplash · Jakub Żerdzicki', position: '50% 52%' },
  { src: 'https://images.pexels.com/videos/5473802/pexels-photo-5473802.jpeg?auto=compress&dpr=1&h=1080&w=1920', credit: 'Pexels · cottonbro studio', position: '50% 50%' },
  { src: 'https://images.pexels.com/videos/13522186/coder-coding-computer-computer-software-13522186.jpeg?auto=compress&dpr=1&h=1080&w=1920', credit: 'Pexels · Raddy', position: '52% 48%' },
  { src: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&fm=jpg&q=86&w=2400', credit: 'Unsplash', position: '55% 52%' },
  { src: 'https://images.unsplash.com/photo-1607971584791-aca00eb17fd5?auto=format&fit=crop&fm=jpg&q=86&w=2400', credit: 'Unsplash', position: '48% 55%' },
];
const SCENES = [
  { at: 0, duration: 2100, shot: 0, kicker: 'PRISM IA / ORIGINAL EDIT', title: ['IDEAS', 'BECOME', 'SYSTEMS.'], mode: 'hero' },
  { at: 2100, duration: 1500, shot: 1, kicker: '01 / INPUT', title: ['START', 'WITH A THOUGHT.'], mode: 'split' },
  { at: 3600, duration: 1400, shot: 2, kicker: '02 / INTENT', title: ['SAY', 'WHAT YOU MEAN.'], mode: 'type' },
  { at: 5000, duration: 1500, shot: 4, kicker: '03 / CONTEXT', title: ['KEEP', 'THE THREAD.'], mode: 'frame' },
  { at: 6500, duration: 1350, shot: 3, kicker: '04 / CODEX', title: ['CHAT', 'BECOMES', 'WORK.'], mode: 'impact' },
  { at: 7850, duration: 1750, shot: 3, kicker: '05 / BUILD', title: ['FILES', 'APPEAR.'], mode: 'code' },
  { at: 9600, duration: 1500, shot: 0, kicker: '06 / AGENT', title: ['PLAN.', 'THEN BUILD.'], mode: 'stack' },
  { at: 11100, duration: 1350, shot: 1, kicker: '07 / ORCHESTRATION', title: ['MORE', 'THAN ONE', 'MODEL.'], mode: 'orbit' },
  { at: 12450, duration: 1500, shot: 2, kicker: '08 / REVIEW', title: ['MAKE IT', 'BETTER.'], mode: 'review' },
  { at: 13950, duration: 1450, shot: 4, kicker: '09 / PREVIEW', title: ['SEE IT', 'LIVE.'], mode: 'preview' },
  { at: 15400, duration: 1500, shot: 3, kicker: '10 / HISTORY', title: ['EVERY', 'CHANGE', 'STAYS.'], mode: 'history' },
  { at: 16900, duration: 1500, shot: 0, kicker: '11 / TAFF 2.0', title: ['DEEPER', 'REASONING.'], mode: 'mono' },
  { at: 18400, duration: 1650, shot: 1, kicker: '12 / WORKSPACE', title: ['ALL', 'IN ONE', 'PLACE.'], mode: 'workspace' },
  { at: 20050, duration: 1800, shot: 3, kicker: '13 / RESULT', title: ['WORDS', 'TURN INTO', 'SOFTWARE.'], mode: 'result' },
  { at: 21850, duration: 1800, shot: 2, kicker: '14 / CODEX', title: ['DON’T JUST', 'ASK.'], mode: 'command' },
  { at: 23650, duration: 1850, shot: 4, kicker: '15 / PRISM CODEX', title: ['BUILD', 'THE THING.'], mode: 'reveal' },
  { at: 25500, duration: 2500, shot: 3, kicker: 'PRISM CODEX / 2026', title: ['WELCOME', 'TO CODEX.'], mode: 'final' },
];
function preloadImages() {
  return Promise.all(SHOTS.map((shot) => new Promise((resolve) => {
    const image = new Image(); image.onload = resolve; image.onerror = resolve; image.src = shot.src;
  })));
}
export default function PrismCodexIntroEditV2({ onComplete }) {
  const [time, setTime] = useState(0); const [ready, setReady] = useState(false);
  const completedRef = useRef(false); const startRef = useRef(0); const rafRef = useRef(0);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const complete = () => { if (completedRef.current) return; completedRef.current = true; localStorage.setItem(INTRO_KEY, '1'); onComplete?.({ model: 'prism-taff-2.0' }); };
  useEffect(() => {
    if (reduced) { complete(); return undefined; }
    let cancelled = false;
    preloadImages().finally(() => { if (cancelled) return; setReady(true); startRef.current = performance.now();
      const tick = (now) => { if (cancelled) return; const elapsed = now - startRef.current; setTime(Math.min(elapsed, DURATION)); if (elapsed >= DURATION) { complete(); return; } rafRef.current = requestAnimationFrame(tick); };
      rafRef.current = requestAnimationFrame(tick);
    });
    const onKeyDown = (event) => { if (event.key === 'Escape') complete(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); window.removeEventListener('keydown', onKeyDown); };
  }, [reduced]);
  let sceneIndex = 0; SCENES.forEach((scene, index) => { if (time >= scene.at) sceneIndex = index; });
  const scene = SCENES[sceneIndex]; const nextScene = SCENES[Math.min(sceneIndex + 1, SCENES.length - 1)];
  const shot = SHOTS[scene.shot]; const nextShot = SHOTS[nextScene.shot];
  const localProgress = Math.max(0, Math.min((time - scene.at) / scene.duration, 1));
  const progress = `${Math.min((time / DURATION) * 100, 100)}%`;
  const transition = localProgress > .72 ? Math.min((localProgress - .72) / .28, 1) : 0;
  return <section className={`prism-edit-v2 ${ready ? 'is-ready' : 'is-loading'} edit-${scene.mode}`} style={{ '--scene-progress': localProgress, '--crossfade': transition }} aria-label="Apresentação do Prism Codex">
    <div className="pe2-bg pe2-bg-a" style={{ backgroundImage: `url(${shot.src})`, backgroundPosition: shot.position }} />
    <div className="pe2-bg pe2-bg-b" style={{ backgroundImage: `url(${nextShot.src})`, opacity: transition }} />
    <div className="pe2-vignette" /><div className="pe2-colorwash" /><div className="pe2-grain" /><div className="pe2-scan" /><div className="pe2-flash" aria-hidden="true" />
    <div className="pe2-chrome"><div>PRISM / CODEX</div><div><span>REAL MATERIAL</span><b>{String(sceneIndex + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}</b></div></div>
    <div className="pe2-rule pe2-rule-top" /><div className="pe2-rule pe2-rule-bottom" style={{ '--progress': progress }}><i /></div>
    <div className="pe2-shot-meta">{shot.credit}<span />FILM / DIGITAL EDIT</div><div className="pe2-timecode">00:{String(Math.floor(time / 1000)).padStart(2, '0')}:{String(Math.floor((time % 1000) / 10)).padStart(2, '0')}</div>
    <div className="pe2-center-mark" aria-hidden="true"><span>P</span><i /><i /></div>
    <div className="pe2-copy"><span className="pe2-kicker">{scene.kicker}</span><h1>{scene.title.map((line) => <span key={line}>{line}</span>)}</h1>{scene.mode === 'final' && <p>Uma superfície para pensar, escrever código, revisar e continuar o projeto.</p>}</div>
    {(scene.mode === 'split' || scene.mode === 'workspace') && <div className="pe2-split-panel" aria-hidden="true"><div className="pe2-panel pe2-panel-a"><small>REQUEST</small><strong>DESCRIBE<br />THE IDEA.</strong><em>natural language</em></div><div className="pe2-panel pe2-panel-b"><small>CODEX</small><strong>TURN IT<br />INTO A SYSTEM.</strong><em>agent workspace</em></div></div>}
    {(scene.mode === 'type' || scene.mode === 'frame') && <div className="pe2-typed" aria-hidden="true"><span>PRISM / CONTEXT ENGINE</span><strong>message → context → intent → execution</strong><i /></div>}
    {scene.mode === 'impact' && <div className="pe2-impact" aria-hidden="true"><span>CHAT</span><b>→</b><span>WORK</span><strong>CODEX</strong></div>}
    {(scene.mode === 'code' || scene.mode === 'mono') && <div className="pe2-terminal" aria-hidden="true"><header><span>src / app / workspace</span><b>LIVE</b></header><div className="pe2-terminal-grid"><div className="pe2-lines">{Array.from({ length: 14 }, (_, i) => <span key={i}>{String(i + 1).padStart(2, '0')}</span>)}</div><pre>{`const workspace = await codex.build({\n  prompt,\n  context,\n  models: ['taff', 'tex'],\n});\n\nawait review(workspace);\nawait preview(workspace);\nreturn workspace;`}</pre></div><footer><span>BUILD / REVIEW / PREVIEW</span><strong>Prism Taff 2.0</strong></footer></div>}
    {scene.mode === 'stack' && <div className="pe2-stack" aria-hidden="true"><div><small>01</small><strong>ANALYZE</strong><span>intent + context</span></div><div><small>02</small><strong>BUILD</strong><span>files + code</span></div><div><small>03</small><strong>REVIEW</strong><span>quality + consistency</span></div></div>}
    {scene.mode === 'orbit' && <div className="pe2-orbit-map" aria-hidden="true"><div className="pe2-orbit-core">P</div><i /><i /><i /><i /><span>TAFF</span><span>TEX</span><span>EDGE</span><span>ROUTE</span></div>}
    {scene.mode === 'review' && <div className="pe2-review-card" aria-hidden="true"><small>REVIEW / 03</small><strong>Consistency</strong><span>12 changes · 0 blocking issues</span><b>PASS</b></div>}
    {scene.mode === 'preview' && <div className="pe2-preview-window" aria-hidden="true"><header><span>PREVIEW</span><b>LOCAL / LIVE</b></header><div className="pe2-preview-ui"><div className="pe2-preview-nav" /><div className="pe2-preview-title" /><div className="pe2-preview-grid"><i /><i /><i /></div></div></div>}
    {scene.mode === 'history' && <div className="pe2-history-card" aria-hidden="true"><small>PROJECT HISTORY</small>{['landing hero','pricing system','responsive layout','codex workspace'].map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong><em>{index === 3 ? 'current' : 'saved'}</em></div>)}</div>}
    {scene.mode === 'result' && <div className="pe2-clean-card" aria-hidden="true"><small>OUTPUT / VERIFIED</small><strong>software/<br />is&nbsp;alive.</strong><span>preview · files · changes · history</span></div>}
    {scene.mode === 'command' && <div className="pe2-command" aria-hidden="true"><span>PRISM CODEX</span><strong>What are we building?</strong><p>Describe the product. The workspace handles the rest.</p><i /></div>}
    {scene.mode === 'reveal' && <div className="pe2-reveal" aria-hidden="true"><span>PRISM AI</span><strong>CODEX</strong><small>BUILD / RUN / REVIEW</small><b>↗</b></div>}
    {scene.mode === 'final' && <div className="pe2-final-ui" aria-hidden="true"><div className="pe2-final-window"><header><span>PRISM CODEX</span><b>NEW PROJECT / 001</b></header><div className="pe2-final-input">Create a polished product website with Prism Codex.<i /></div><footer><span>DESCRIBE WHAT YOU WANT TO BUILD</span><strong>Prism Taff 2.0 ↗</strong></footer></div><div className="pe2-final-tags"><span>CHAT</span><span>VIBE CODE</span><b>CODEX</b></div></div>}
    <button className="pe2-skip" type="button" onClick={complete}>Pular <span>ESC</span></button><div className="pe2-progress-label">{Math.round(localProgress * 100)}%</div>
  </section>;
}
export { INTRO_KEY };
