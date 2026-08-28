import { useEffect, useState } from 'react';

const PROMPT='Create a website for selling my clothes.';
const INTRO_KEY='prism_codex_intro_seen';
const DURATION=56_000;
const MARKS=Array.from({length:32},(_,i)=>i);

export default function PrismCodexIntro({onComplete}){
 const [typed,setTyped]=useState('');
 const [phase,setPhase]=useState('title');
 useEffect(()=>{
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced){localStorage.setItem(INTRO_KEY,'1');onComplete?.({prompt:PROMPT,model:'prism-taff-2.0'});return undefined;}
  const timers=[];
  const later=(fn,ms)=>{const id=window.setTimeout(fn,ms);timers.push(id);};
  later(()=>setPhase('glitch'),9000);
  later(()=>setPhase('editorial'),10500);
  later(()=>setPhase('split'),19500);
  later(()=>setPhase('star'),27500);
  later(()=>setPhase('prism'),32500);
  later(()=>setPhase('codex'),37000);
  later(()=>setPhase('all'),42500);
  later(()=>setPhase('greeting'),46500);
  later(()=>setPhase('composer'),50500);
  later(()=>setPhase('models'),53500);
  later(()=>{localStorage.setItem(INTRO_KEY,'1');onComplete?.({prompt:PROMPT,model:'prism-taff-2.0'});},DURATION);
  return()=>timers.forEach(window.clearTimeout);
 },[onComplete]);
 useEffect(()=>{
  if(phase!=='composer'&&phase!=='models')return undefined;
  let index=0;setTyped('');
  const id=window.setInterval(()=>{index+=1;setTyped(PROMPT.slice(0,index));if(index>=PROMPT.length)window.clearInterval(id);},42);
  return()=>window.clearInterval(id);
 },[phase]);
 return <section className={`prism-codex-intro intro-${phase}`} aria-label="Introdução do Prism Codex">
  <div className="intro-pixel-grid" aria-hidden="true">{MARKS.map(i=><i key={i}/>)}</div>
  <div className="intro-frame" aria-hidden="true"><span className="frame-index">00 / 06</span><span className="frame-rule"/><span className="frame-meta">PRISM / CODEX</span></div>
  <div className="intro-noise" aria-hidden="true"/><div className="intro-vignette" aria-hidden="true"/>
  <div className="intro-title-scene" aria-hidden="true"><div className="title-kicker">PRISM / ARTIFICIAL INTELLIGENCE</div><div className="intro-prism-word" data-text="PRISM AI">PRISM AI</div><div className="title-coordinate">-23.5505 / -46.6333</div></div>
  <div className="intro-editorial" aria-hidden="true"><div className="editorial-top"><span>FABLE 5</span><b>OPENAI</b><span>MODELS</span><span>01—04</span></div><div className="editorial-hero"><small>THE MACHINE</small><strong>INTELLIGENCE<br/>IS A MATERIAL.</strong><em>PRISM / RESEARCH / 2026</em></div><div className="editorial-bottom"><span>INFERENCE</span><span>AGENTS</span><span>COMPUTE</span><span>ORCHESTRATION</span></div></div>
  <div className="intro-split" aria-hidden="true"><div className="split-half split-top"><div><small>01 / MODELS</small><strong>MODELS<br/>INFERENCE</strong></div><span className="split-number">A</span></div><div className="split-half split-bottom"><div><small>02 / SYSTEMS</small><strong>AGENTS<br/>COMPUTE</strong></div><span className="split-number">B</span></div></div>
  <div className="intro-star-wrap" aria-hidden="true"><div className="intro-star"><i/><i/><i/><i/><i/><i/></div><div className="star-core"/><span className="star-label">PRISM</span></div>
  <div className="intro-burst" aria-hidden="true">{Array.from({length:18},(_,index)=><i key={index} style={{'--i':index}}/>)}</div>
  <div className="intro-codex-scene" aria-hidden="true"><div className="codex-prism">PRISM <span>AI</span></div><div className="codex-word">CODEX</div><div className="codex-line"><span>BUILD / RUN / REVIEW</span><b>ALL IN ONE</b><span>001</span></div></div>
  <div className="intro-chat-scene"><div className="greeting">good morning, <span>programmer</span></div><div className="intro-real-composer"><div className="composer-top"><span>PRISM CODEX</span><span>NEW PROJECT / 001</span></div><div className="composer-prompt">{typed}<i className="caret"/></div><div className="composer-bottom"><span>↳ describe what you want to build</span><span className="composer-model">Prism Taff 2.0 <b>↗</b></span></div></div><div className="intro-models" aria-hidden="true"><span>Prism Nano 1.0</span><span>Prism Mini 1.0</span><span>Prism Tex 1.5</span><span>Prism Taff 1.0</span><strong>Prism Taff 2.0</strong></div></div>
  <div className="intro-corner-mark" aria-hidden="true"><span>PRISM</span><b>CODEX</b><i/></div>
 </section>;
}
export { INTRO_KEY };
