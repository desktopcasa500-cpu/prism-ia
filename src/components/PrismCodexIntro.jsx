import { useEffect, useMemo, useState } from 'react';

const INTRO_KEY = 'prism_codex_intro_seen';
const PROMPT = 'Create a polished product website with Prism Codex.';
const TOTAL_MS = 10_800;

const scenes = [
  { id: 'signal', kicker: 'PRISM AI / 01', title: ['INTELLIGENCE', 'IN MOTION.'], copy: 'A workspace where models, code and ideas move as one system.' },
  { id: 'prism', kicker: 'PRISM / CODEX', title: ['ONE REQUEST.', 'A LIVING WORKSPACE.'], copy: 'Describe what you want. Codex plans, builds, reviews and updates.' },
  { id: 'build', kicker: 'BUILD / RUN / REVIEW', title: ['FROM WORDS', 'TO SOFTWARE.'], copy: 'Files appear in sequence while the workspace keeps the whole project in view.' },
  { id: 'final', kicker: 'PRISM CODEX / 2026', title: ['WELCOME TO', 'CODEX.'], copy: 'The quiet surface for serious building.' },
];

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function PrismCodexIntro({ onComplete }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [skip, setSkip] = useState(false);
  const [ready, setReady] = useState(false);
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  useEffect(() => {
    if (reduced) {
      localStorage.setItem(INTRO_KEY, '1');
      onComplete?.({ prompt: PROMPT, model: 'prism-taff-2.0' });
      return undefined;
    }

    let cancelled = false;
    const run = async () => {
      await delay(450);
      if (cancelled) return;
      setReady(true);

      const sceneDurations = [1900, 2300, 2800, 2500];
      for (let i = 0; i < sceneDurations.length; i += 1) {
        setSceneIndex(i);
        if (i === 3) {
          for (let cursor = 0; cursor <= PROMPT.length; cursor += 1) {
            await delay(28);
            if (cancelled) return;
            setTyped(PROMPT.slice(0, cursor));
          }
        }
        await delay(sceneDurations[i]);
        if (cancelled) return;
      }

      localStorage.setItem(INTRO_KEY, '1');
      onComplete?.({ prompt: PROMPT, model: 'prism-taff-2.0' });
    };

    run();
    return () => { cancelled = true; };
  }, [onComplete, reduced]);

  useEffect(() => {
    if (skip) {
      localStorage.setItem(INTRO_KEY, '1');
      onComplete?.({ prompt: PROMPT, model: 'prism-taff-2.0' });
    }
  }, [onComplete, skip]);

  const scene = scenes[sceneIndex];

  return (
    <section className={`codex-cinematic ${ready ? 'is-ready' : ''} scene-${scene.id}`} aria-label="Apresentação do Prism Codex">
      <div className="ccx-noise" aria-hidden="true" />
      <div className="ccx-grid" aria-hidden="true" />
      <div className="ccx-scanline" aria-hidden="true" />
      <div className="ccx-topline" aria-hidden="true">
        <span>PRISM</span><b>CODEX</b><span>001 / 004</span><span>10.8s</span>
      </div>
      <div className="ccx-corner ccx-corner--tl" aria-hidden="true">REC</div>
      <div className="ccx-corner ccx-corner--tr" aria-hidden="true">{String(sceneIndex + 1).padStart(2, '0')}—04</div>
      <div className="ccx-corner ccx-corner--bl" aria-hidden="true">BUILD / RUN / REVIEW</div>
      <div className="ccx-corner ccx-corner--br" aria-hidden="true">PRISM AI</div>

      <div className="ccx-stage">
        <div className="ccx-wordmark" aria-hidden="true">PRISM</div>
        <div className="ccx-orbit" aria-hidden="true">
          <i /><i /><i /><i /><i /><i />
          <span>P</span>
        </div>

        <div className="ccx-copy">
          <small>{scene.kicker}</small>
          <h1>{scene.title.map((line) => <span key={line}>{line}</span>)}</h1>
          <p>{scene.copy}</p>
        </div>

        {scene.id === 'signal' && (
          <div className="ccx-signal" aria-hidden="true">
            <span>MODEL</span><b>ROUTER</b><em>001</em>
            <div className="ccx-signal-line" />
            <span>CONTEXT</span><b>PROJECT</b><em>LIVE</em>
            <div className="ccx-signal-line ccx-signal-line--short" />
          </div>
        )}

        {scene.id === 'prism' && (
          <div className="ccx-stack" aria-hidden="true">
            <div className="ccx-card ccx-card--one"><small>REQUEST</small><strong>Describe what you want to build.</strong><span>natural language</span></div>
            <div className="ccx-card ccx-card--two"><small>PLAN</small><strong>Analyze → plan → implement</strong><span>agent orchestration</span></div>
            <div className="ccx-card ccx-card--three"><small>WORKSPACE</small><strong>Files + preview + review</strong><span>live project state</span></div>
          </div>
        )}

        {scene.id === 'build' && (
          <div className="ccx-editor" aria-hidden="true">
            <header><span>src/components/Hero.jsx</span><b>LIVE</b></header>
            <div className="ccx-editor-body">
              <div className="ccx-lines">{Array.from({ length: 9 }, (_, i) => <i key={i}>{String(i + 1).padStart(2, '0')}</i>)}</div>
              <pre><code>{`export default function Hero() {\n  return (\n    <main className="hero">\n      <span>PRISM CODEX</span>\n      <h1>Build without leaving the thought.\n    </main>\n  );\n}`}</code></pre>
            </div>
            <footer><span>writing artifact</span><strong>src / components / Hero.jsx</strong></footer>
          </div>
        )}

        {scene.id === 'final' && (
          <div className="ccx-final-ui" aria-hidden="true">
            <div className="ccx-composer-mini">
              <header><span>PRISM CODEX</span><b>NEW PROJECT / 001</b></header>
              <p>{typed}<i /></p>
              <footer><span>DESCRIBE WHAT YOU WANT TO BUILD</span><strong>Prism Taff 2.0 ↗</strong></footer>
            </div>
            <div className="ccx-final-tags"><span>CHAT</span><span>VIBE CODE</span><strong>CODEX</strong></div>
          </div>
        )}
      </div>

      <button className="ccx-skip" onClick={() => setSkip(true)} aria-label="Pular apresentação">Pular <span>ESC</span></button>
      <div className="ccx-progress" aria-hidden="true"><i style={{ '--progress': `${((sceneIndex + 1) / scenes.length) * 100}%` }} /></div>
    </section>
  );
}

export { INTRO_KEY };
