import { useEffect, useRef, useState } from 'react';

const PROMPT = 'Create a website for selling my clothes.';
const INTRO_KEY = 'prism_codex_intro_seen';
const DURATION = 56_000;
const GRID = Array.from({ length: 48 }, (_, i) => i);
const RAYS = Array.from({ length: 24 }, (_, i) => i);

export default function PrismCodexIntro({ onComplete }) {
  const [typed, setTyped] = useState('');
  const completedRef = useRef(false);

  const complete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    localStorage.setItem(INTRO_KEY, '1');
    onComplete?.({ prompt: PROMPT, model: 'prism-taff-2.0' });
  };

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      complete();
      return undefined;
    }

    const timers = [];
    const later = (fn, ms) => timers.push(window.setTimeout(fn, ms));
    later(() => setTyped(''), 0);
    later(() => setTyped(PROMPT), 50_800);
    later(complete, DURATION);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') complete();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    let index = 0;
    let intervalId = null;
    const start = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        index += 1;
        setTyped(PROMPT.slice(0, index));
        if (index >= PROMPT.length) window.clearInterval(intervalId);
      }, 52);
    }, 47_900);
    return () => {
      window.clearTimeout(start);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section className="prism-codex-intro prism-codex-intro--edit" aria-label="Introdução do Prism Codex">
      <div className="edit-grid" aria-hidden="true">{GRID.map(i => <i key={i} style={{ '--i': i }} />)}</div>
      <div className="edit-pixels" aria-hidden="true">{GRID.slice(0, 24).map(i => <i key={i} style={{ '--i': i }} />)}</div>
      <div className="edit-rulers" aria-hidden="true"><span>00:00:00:00</span><b>PRISM / CODEX / EDIT_01</b><span>56.00s</span></div>
      <div className="edit-corners" aria-hidden="true"><span>REC</span><i /><span>01—08</span></div>
      <div className="edit-title" aria-hidden="true"><div className="edit-micro">PRISM AI / COMPUTATIONAL CULTURE / 2026</div><div className="edit-prism">PRISM</div><div className="edit-ai">AI</div><div className="edit-stamp">NO. 001<br />SYSTEM / MOTION</div></div>
      <div className="edit-glitch-word" aria-hidden="true"><span>PRISM</span><span>PRISM</span><span>PRISM</span></div>
      <div className="edit-editorial" aria-hidden="true"><div className="edit-editorial-top"><b>FABLE 5</b><span>OPENAI</span><span>MODELS</span><span>INFERENCE</span><em>01 / 04</em></div><div className="edit-editorial-main"><small>THE MACHINE / 001</small><strong>INTELLIGENCE<br /><i>IS A MATERIAL.</i></strong><span>DATA / AGENTS / COMPUTE<br />ORCHESTRATION / CODE</span></div><div className="edit-editorial-bottom"><span>HUMAN × MACHINE</span><span>PRISM RESEARCH</span><span>BUILD / RUN / REVIEW</span></div></div>
      <div className="edit-columns" aria-hidden="true"><div className="edit-column edit-column--a"><small>MODELS</small><strong>INFERENCE</strong><b>A</b><i /></div><div className="edit-column edit-column--b"><small>AGENTS</small><strong>COMPUTE</strong><b>B</b><i /></div></div>
      <div className="edit-star" aria-hidden="true"><div className="edit-star-core" />{RAYS.map(i => <i key={i} style={{ '--r': `${i * 15}deg`, '--d': `${i * 0.018}s` }} />)}<b>PRISM</b></div>
      <div className="edit-burst" aria-hidden="true">{RAYS.map(i => <i key={i} style={{ '--r': `${i * 15}deg`, '--d': `${i * 0.012}s` }} />)}</div>
      <div className="edit-codex" aria-hidden="true"><div className="edit-codex-small">PRISM AI</div><strong>CODEX</strong><span>ALL IN ONE</span><i /></div>
      <div className="edit-chat" aria-hidden="true"><div className="edit-greeting"><span>good morning,</span><strong>programmer</strong></div><div className="edit-composer"><div><span>PRISM CODEX</span><b>NEW PROJECT / 001</b></div><p>{typed}<i /></p><footer><span>DESCRIBE WHAT YOU WANT TO BUILD</span><strong>Prism Taff 2.0 ↗</strong></footer></div><div className="edit-models"><span>Prism Nano 1.0</span><span>Prism Mini 1.0</span><span>Prism Tex 1.5</span><span>Prism Taff 1.0</span><strong>Prism Taff 2.0 <em>SELECTED</em></strong></div></div>
      <div className="edit-end-card" aria-hidden="true"><span>PRISM CODEX</span><strong>ALL IN ONE</strong><small>BUILD / RUN / REVIEW</small></div>
      <button className="prism-intro-skip" type="button" onClick={complete}>Pular <span>ESC</span></button>
    </section>
  );
}

export { INTRO_KEY };
