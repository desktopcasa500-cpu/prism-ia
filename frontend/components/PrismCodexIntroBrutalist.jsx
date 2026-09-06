import { useEffect, useMemo, useRef, useState } from 'react';

export const INTRO_KEY = 'prism_codex_intro_v4_seen';
const DURATION = 22000;
const PROMPT = 'Create a user-friendly car sales website designed to attract customers.';
const clamp = n => Math.max(0, Math.min(1, n));
const ease = n => { const t = clamp(n); return t*t*(3-2*t); };
const range = (time,start,end) => clamp((time-start)/(end-start));

function Scene({children,className='',style={}}){return <div className={`prism-story-scene ${className}`} style={style}>{children}</div>}
function TypeLine({text,progress}){return <span>{text.slice(0,Math.floor(text.length*progress))}<i className="prism-story-caret"/></span>}

export default function PrismCodexIntroBrutalist({onComplete,userName='você'}){
  const reduced=useMemo(()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,[]);
  const [time,setTime]=useState(0); const done=useRef(false);
  const complete=()=>{if(done.current)return;done.current=true;localStorage.setItem(INTRO_KEY,'1');onComplete?.()};
  useEffect(()=>{
    if(reduced){complete();return undefined}
    const started=performance.now(); let frame;
    const tick=now=>{const next=Math.min(now-started,DURATION);setTime(next);if(next<DURATION)frame=requestAnimationFrame(tick);else complete()};
    frame=requestAnimationFrame(tick); const onKey=e=>e.key==='Escape'&&complete(); window.addEventListener('keydown',onKey);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',onKey)};
  },[reduced]);
  const t1=range(time,300,2200), t2=range(time,1800,4700), t3=range(time,4300,7400), t4=range(time,7400,9400), t5=range(time,9700,15000), t6=range(time,14500,20700);
  return <section className="prism-story" aria-label="Apresentação do Prism Codex">
    <div className="prism-story-ui"><span>PRISM CODEX</span><button onClick={complete}>Pular <b>Esc</b></button></div>
    <div className="prism-story-progress"><i style={{width:`${Math.min(100,time/DURATION*100)}%`}}/></div>

    <Scene className="story-logo" style={{opacity:ease(t1),transform:`translateX(${-34+34*ease(t1)}vw)`}}>
      <div className="story-brand"><span className="story-mark"><i/><i/><i/><i/></span><strong>PRISM IA</strong></div>
      <div className="story-model"><span>TAFF</span><b>2.0</b></div>
    </Scene>

    <Scene className="story-sky" style={{opacity:ease(t2)}}>
      <div className="story-horizon"/>
      <div className="story-cloud cloud-a"/><div className="story-cloud cloud-b"/><div className="story-cloud cloud-c"/>
      <div className="story-sky-copy"><small>PRISM TAFF 2.0</small><strong>Build with more<br/>room to think.</strong></div>
    </Scene>

    <Scene className="story-black" style={{opacity:range(time,7400,7450)}}/>

    <Scene className="story-goodmorning" style={{opacity:ease(t4)}}>
      <div className="story-good-logo"><span className="story-mark"><i/><i/><i/><i/></span></div>
      <strong>GOOD MORNING, PROGRAMMER</strong>
    </Scene>

    <Scene className="story-demo" style={{opacity:ease(t5),transform:`translateY(${26-26*ease(t5)}px)`}}>
      <div className="story-demo-window">
        <header><div className="story-dots"><i/><i/><i/></div><span>Prism Codex</span><small>{userName}</small></header>
        <div className="story-demo-body">
          <aside><b>PRISM</b><span>Conversas</span><span className="active">Novo projeto</span><span>Workspace</span></aside>
          <main>
            <div className="story-selector"><span>Prism Edge 1.0</span><b>⌄</b></div>
            <div className="story-cursor" style={{left:`${26+44*ease(range(time,10400,11300))}%`,top:`${50+4*ease(range(time,10400,11300))}%`}}/>
            <div className="story-menu" style={{opacity:range(time,11000,11800),transform:`translateY(${8-8*ease(range(time,11000,11800))}px)`}}><span>Prism Edge 1.0</span><strong>Prism Taff 2.0</strong><span>Prism Tex 1.5</span></div>
            <div className="story-user-line"><span>{userName}</span><em>agora</em></div>
            <div className="story-prompt"><TypeLine text={PROMPT} progress={range(time,11800,14200)}/></div>
            <button className="story-send">Enviar</button>
          </main>
        </div>
      </div>
    </Scene>

    <Scene className="story-build" style={{opacity:ease(t6)}}>
      <div className="story-build-window">
        <header><span>PRISM TAFF 2.0</span><small>RUNNING</small></header>
        <div className="story-build-grid">
          <div className="story-plan"><small>PLANO</small><strong>Car sales website</strong><span className="done">✓ Estrutura</span><span className="active">· Pagamento</span><span>Catálogo</span><span>Testes</span></div>
          <div className="story-editor"><div className="story-code-tabs"><span>App.jsx</span><span>checkout.ts</span><span>inventory.css</span></div><pre>{`function Checkout({ cart }) {\n  const total = cart.reduce(sumTotal, 0);\n\n  return (\n    <PaymentSummary\n      total={total}\n      currency="BRL"\n      onConfirm={submitPayment}\n    />\n  );\n}`}</pre><div className="story-diff"><b>+90 linhas</b><span>·</span><b>-36 linhas</b><small>refatoração e validação</small></div></div>
        </div>
        <div className="story-status"><span>Planejando</span><span>Criando arquivos</span><span>Editando</span><span>Testando</span><b>Otimizando</b></div>
      </div>
    </Scene>

    <Scene className="story-end" style={{opacity:ease(range(time,20000,DURATION))}}><span className="story-mark"><i/><i/><i/><i/></span><strong>PRISM CODEX</strong><small>Pronto quando você estiver.</small><button onClick={complete}>Entrar</button></Scene>
    <footer className="prism-story-footer"><span>PRISM IA</span><span>{String(Math.floor(time/1000)).padStart(2,'0')} / 22</span></footer>
  </section>;
}
