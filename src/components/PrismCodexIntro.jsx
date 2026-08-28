import { useEffect, useState } from 'react';

const PROMPT = 'Create a website for selling my clothes.';
const INTRO_KEY = 'prism_codex_intro_seen';

export default function PrismCodexIntro({ onComplete }) {
  const [typed, setTyped] = useState('');
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      localStorage.setItem(INTRO_KEY, '1');
      onComplete({ prompt: PROMPT, model: 'prism-taff-2.0' });
      return undefined;
    }

    let index = 0;
    const typeTimer = window.setInterval(() => {
      index += 1;
      setTyped(PROMPT.slice(0, index));
      if (index >= PROMPT.length) {
        window.clearInterval(typeTimer);
        window.setTimeout(() => setModelReady(true), 520);
      }
    }, 42);

    const completeTimer = window.setTimeout(() => {
      localStorage.setItem(INTRO_KEY, '1');
      onComplete({ prompt: PROMPT, model: 'prism-taff-2.0' });
    }, 18_900);

    return () => {
      window.clearInterval(typeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return <section className="prism-codex-intro" aria-label="Introdução do Prism Codex">
    <div className="intro-grain" aria-hidden="true" />
    <div className="intro-scene intro-scene-title"><div className="intro-prism-word">PRISM AI</div></div>
    <div className="intro-scene intro-scene-editorial" aria-hidden="true">
      <div className="intro-editorial-line intro-editorial-a"><span>FABLE 5</span><span>OPENAI</span><span>MODELOS</span></div>
      <div className="intro-editorial-line intro-editorial-b"><span>INFERENCE</span><span>DATA CENTERS</span><span>AGENTS</span></div>
      <div className="intro-editorial-line intro-editorial-c"><span>COMPUTE</span><span>CONTEXT</span><span>ORCHESTRATION</span></div>
    </div>
    <div className="intro-columns" aria-hidden="true">
      <div className="intro-column intro-column-top"><span>SUPERIOR</span><strong>MODELS / INFERENCE</strong><i /></div>
      <div className="intro-column intro-column-bottom"><span>INFERIOR</span><strong>AGENTS / COMPUTE</strong><i /></div>
    </div>
    <div className="intro-star" aria-hidden="true"><i /><b /><em /><span /></div>
    <div className="intro-explosion" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
    <div className="intro-scene intro-scene-codex">
      <div className="intro-prism-small">PRISM AI</div><div className="intro-codex-word">CODEX</div><div className="intro-all-in-one">ALL IN ONE</div>
    </div>
    <div className="intro-scene intro-scene-chat">
      <div className="intro-chat-greeting">good morning, programmer</div>
      <div className="intro-composer"><span className="intro-composer-text">{typed}<i className={typed ? 'typing-caret' : ''} /></span><div className={`intro-model-picker ${modelReady ? 'ready' : ''}`}><span>Prism Taff 2.0</span><b>⌄</b></div></div>
    </div>
    <div className="intro-model-popover" aria-hidden={!modelReady}><span>Prism Nano 1.0</span><span>Prism Mini 1.0</span><span>Prism Tex 1.5</span><span>Prism Taff 1.0</span><strong>Prism Taff 2.0</strong></div>
  </section>;
}

export { INTRO_KEY };
