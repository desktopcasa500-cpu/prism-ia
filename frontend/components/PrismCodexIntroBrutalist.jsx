import { useEffect, useMemo, useRef, useState } from 'react';
import prismLogo from '../assets/prism-logo.svg';

export const INTRO_KEY = 'prism_codex_intro_v10_seen';
const DURATION = 30000;
const PROMPT = 'Crie um site de vendas de carros com uma experiência premium e responsiva.';
const CLOUDS = [
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_faffafdc-20ef-435d-9bc5-6fdf1edf49cc.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_ee56e65c-07e3-4d8d-9121-a7c34396767c.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_7087decc-7b4f-4504-bd4b-edd312316c87.png',
  'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012400_95f21913-8063-40a9-8697-bfca001e82c0.png',
];
const CAR = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_012515_b011b372-fa91-49c4-8403-01e46db815a2.png';
const CODE = `const cars = [\n  { model: 'Apex GT', price: 'R$ 389.900' },\n  { model: 'Vector S', price: 'R$ 249.900' },\n  { model: 'Lumen X', price: 'R$ 319.900' },\n];\n\nexport function FeaturedCars() {\n  return cars.map((car) => (\n    <CarCard key={car.model} {...car} />\n  ));\n}`;

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const between = (time, start, end) => ease((time - start) / Math.max(1, end - start));
const type = (text, progress) => text.slice(0, Math.floor(text.length * clamp(progress)));

function Logo({ className = '' }) {
  return <img className={`taff10-logo ${className}`} src={prismLogo} alt="Prism IA" />;
}

function Stat({ label, value, note }) {
  return <div className="taff10-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

const STYLES = `
.taff10{position:fixed;inset:0;z-index:7000;display:grid;place-items:center;background:#0b0b0a;color:#f5f3ed;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
.taff10 *{box-sizing:border-box}.taff10-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 72% 45%,rgba(241,235,214,.08),transparent 34%),#080807}.taff10-frame{position:relative;width:min(1400px,94vw);height:min(800px,90vh);min-height:560px;display:grid;grid-template-columns:38% 62%;background:#f5f3ed;color:#24231f;border:1px solid rgba(255,255,255,.13);box-shadow:0 42px 120px rgba(0,0,0,.5);overflow:hidden}.taff10-copy{position:relative;z-index:4;display:flex;flex-direction:column;padding:clamp(28px,4vw,58px);background:#f5f3ed}.taff10-kicker{font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;color:#8c897f}.taff10-title{margin:18px 0 0;font:500 clamp(42px,4.3vw,72px)/.9 Georgia,"Times New Roman",serif;letter-spacing:-.06em}.taff10-lead{max-width:410px;margin:20px 0 0;color:#6f6d65;font-size:14px;line-height:1.65}.taff10-facts{display:grid;gap:14px;margin-top:auto;padding-top:34px}.taff10-fact{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;padding-top:13px;border-top:1px solid #dbd9d1}.taff10-fact>span{font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#aaa79d}.taff10-fact strong{display:block;font-size:12px;font-weight:650;color:#33312c}.taff10-fact small{display:block;margin-top:4px;font-size:10px;line-height:1.45;color:#8b887f}.taff10-actions{display:flex;gap:8px;margin-top:24px}.taff10-action{height:36px;border:1px solid #cfcac0;padding:0 14px;background:transparent;color:#2d2b26;border-radius:999px;font-size:10px;font-weight:650;cursor:pointer}.taff10-action.primary{background:#24231f;color:#fff;border-color:#24231f}.taff10-action:hover{transform:translateY(-1px)}
.taff10-stage{position:relative;min-width:0;background:#0c0c0b;overflow:hidden}.taff10-topline{position:absolute;top:0;left:0;right:0;z-index:30;height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(180deg,rgba(7,7,6,.86),rgba(7,7,6,0));font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:rgba(255,255,255,.72)}.taff10-topline button{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;height:28px;padding:0 11px;font-size:9px;cursor:pointer}.taff10-progress{position:absolute;left:18px;right:18px;bottom:16px;z-index:30;height:2px;background:rgba(255,255,255,.12)}.taff10-progress i{display:block;height:100%;background:#fff;transform-origin:left center}
.taff10-scene{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden}.taff10-logo-scene{background:#0a0a09}.taff10-logo-lock{display:flex;align-items:center;gap:18px;transform:translateY(-5%)}.taff10-logo{display:block;width:54px;height:54px;object-fit:contain}.taff10-word{font:500 clamp(50px,6vw,84px)/.85 Georgia,"Times New Roman",serif;letter-spacing:-.065em}.taff10-word b{font:600 18px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em;color:#a9a69c;vertical-align:baseline;margin-left:7px}
.taff10-sky{background:#ced8db}.taff10-sky img{position:absolute;inset:-4%;width:108%;height:108%;object-fit:cover;filter:saturate(.84) contrast(.96);animation:taff10-drift 13s ease-in-out infinite alternate}.taff10-sky:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,7,6,.02),rgba(7,7,6,.16))}.taff10-sky-copy{position:absolute;left:7%;bottom:12%;z-index:2;max-width:430px}.taff10-sky-copy span{font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;color:rgba(255,255,255,.68)}.taff10-sky-copy h3{margin:10px 0 0;font:500 clamp(36px,4.7vw,66px)/.92 Georgia,"Times New Roman",serif;letter-spacing:-.05em}.taff10-sky-copy p{margin:10px 0 0;color:rgba(255,255,255,.8);font-size:12px;line-height:1.5}
.taff10-dark{background:#080807;color:#f2f0e8}.taff10-dark-content{text-align:left;width:min(74%,620px);transform:translateY(-4%)}.taff10-dark-content .eyebrow{display:block;color:#77756d;font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.15em}.taff10-dark-content h3{margin:12px 0 0;font:500 clamp(38px,4.8vw,68px)/.94 Georgia,"Times New Roman",serif;letter-spacing:-.055em}.taff10-dark-content p{max-width:480px;margin:14px 0 0;color:#8f8c83;font-size:13px;line-height:1.6}
.taff10-ui-scene{padding:7%}.taff10-ui{width:100%;height:100%;border-radius:12px;overflow:hidden;background:#fbfaf7;color:#2b2a25;border:1px solid #3c3a35;box-shadow:0 24px 70px rgba(0,0,0,.45);transform:translateY(16px) scale(.97)}.taff10-ui-head{height:36px;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid #e1dfd7;font-size:9px}.taff10-dots{display:flex;gap:4px}.taff10-dots i{width:6px;height:6px;border-radius:50%;background:#d0cdc5}.taff10-ui-head span{color:#75726a}.taff10-ui-head small{margin-left:auto;color:#a09c93;font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace}.taff10-ui-body{display:grid;grid-template-columns:118px minmax(0,1fr);height:calc(100% - 36px)}.taff10-ui-nav{background:#f1f0ea;padding:15px 11px;display:flex;flex-direction:column;gap:7px;border-right:1px solid #e0ded6}.taff10-ui-nav strong{font-size:10px;margin-bottom:10px}.taff10-ui-nav span{font-size:9px;color:#8f8c84;padding:6px 7px;border-radius:6px}.taff10-ui-nav span.active{background:#e1e0d9;color:#292821}.taff10-ui-main{position:relative;padding:22px;background:#fffefa}.taff10-model{position:absolute;top:20px;right:20px;display:flex;align-items:center;gap:8px;border:1px solid #d5d2ca;background:#faf9f5;border-radius:7px;padding:8px 10px;font-size:9px}.taff10-model strong{font-weight:650}.taff10-menu{position:absolute;top:56px;right:20px;width:180px;padding:6px;border:1px solid #d5d2ca;border-radius:7px;background:#fffefa;box-shadow:0 15px 36px rgba(30,28,24,.12)}.taff10-menu span,.taff10-menu strong{display:block;padding:8px;border-radius:5px;font-size:9px}.taff10-menu strong{background:#efeee8}.taff10-prompt{position:absolute;left:22px;right:22px;bottom:26px;min-height:68px;border:1px solid #d4d1c8;border-radius:9px;padding:14px;color:#6c6961;font-size:11px;line-height:1.55;background:#fff}.taff10-prompt b{color:#25241f}.taff10-send{position:absolute;right:27px;bottom:72px;height:28px;padding:0 11px;border:0;border-radius:7px;background:#292822;color:#fff;font-size:9px}.taff10-caret{display:inline-block;width:1px;height:12px;margin-left:2px;background:#3b3932;vertical-align:-2px;animation:taff10-blink 1s steps(2,end) infinite}
.taff10-build{padding:7%}.taff10-build-card{width:100%;height:100%;border-radius:12px;overflow:hidden;background:#f7f6f1;color:#282720;border:1px solid #3b3a34;box-shadow:0 24px 75px rgba(0,0,0,.43)}.taff10-build-head{height:38px;display:flex;align-items:center;padding:0 13px;border-bottom:1px solid #dedbd1;font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace}.taff10-build-head small{margin-left:auto;color:#8f8b80}.taff10-stats{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid #dedbd1}.taff10-stat{padding:13px 11px;border-right:1px solid #dedbd1}.taff10-stat:last-child{border-right:0}.taff10-stat span{display:block;color:#9a978e;font:700 7px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.taff10-stat strong{display:block;margin-top:7px;font-size:18px;font-weight:650}.taff10-stat small{display:block;margin-top:4px;color:#918e85;font-size:8px}.taff10-code-wrap{display:grid;grid-template-columns:132px minmax(0,1fr);height:calc(100% - 96px)}.taff10-plan{padding:15px 13px;background:#efeee8;border-right:1px solid #dedbd1}.taff10-plan span{display:block;color:#9a978e;font:700 7px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em}.taff10-plan strong{display:block;margin-top:10px;font-size:11px}.taff10-plan em{display:block;margin-top:16px;color:#6f6c63;font-style:normal;font-size:9px;line-height:1.7}.taff10-code{padding:15px;background:#fffefa;overflow:hidden}.taff10-code-head{display:flex;gap:7px;margin-bottom:10px}.taff10-code-head span{padding:6px 8px;border:1px solid #dfddd6;border-radius:5px;background:#f4f2ec;color:#69665e;font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace}.taff10-code-head span.active{background:#292822;color:#fff;border-color:#292822}.taff10-code pre{margin:0;white-space:pre-wrap;color:#3d3a33;font:10px/1.72 ui-monospace,SFMono-Regular,Menlo,monospace}.taff10-code .cursor{display:inline-block;width:6px;height:13px;background:#36342e;vertical-align:-2px;animation:taff10-blink .9s steps(2,end) infinite}
.taff10-result{padding:7%;background:#0b0b0a}.taff10-result-card{width:100%;height:100%;border-radius:12px;overflow:hidden;background:#f5f3ed;color:#292822;border:1px solid #34332e;box-shadow:0 24px 75px rgba(0,0,0,.48)}.taff10-result-nav{height:38px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid #d9d6ce;background:#fbfaf6}.taff10-result-nav strong{font-size:9px}.taff10-result-nav span{display:flex;gap:14px;margin-left:24px;color:#959189;font-size:8px}.taff10-result-nav b{margin-left:auto;background:#272620;color:#fff;border-radius:6px;padding:7px 9px;font-size:8px}.taff10-result-body{display:grid;grid-template-columns:40% 60%;height:calc(100% - 38px)}.taff10-result-copy{padding:24px;display:flex;flex-direction:column;justify-content:center}.taff10-result-copy small{color:#99968d;font:700 7px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.11em}.taff10-result-copy h3{margin:8px 0;font:500 28px/.98 Georgia,"Times New Roman",serif;letter-spacing:-.045em}.taff10-result-copy p{margin:0;color:#74716a;font-size:9px;line-height:1.55}.taff10-result-copy button{align-self:flex-start;margin-top:14px;border:0;background:#272620;color:#fff;border-radius:6px;padding:7px 9px;font-size:8px}.taff10-result-image{margin:14px 14px 14px 0;border-radius:8px;background:url('${CAR}') center/cover no-repeat;transform:scale(1.02);filter:saturate(.88)}
.taff10-end{background:#090908;text-align:center}.taff10-end-inner{display:flex;flex-direction:column;align-items:center;gap:12px;transform:translateY(-3%)}.taff10-end-inner .taff10-logo{width:50px;height:50px}.taff10-end-inner span{font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;color:#8a887f}.taff10-end-inner strong{font:500 clamp(34px,4.8vw,62px)/.9 Georgia,"Times New Roman",serif;letter-spacing:-.055em}.taff10-end-inner small{color:#66645d;font-size:9px}
@keyframes taff10-drift{from{transform:scale(1.02) translate3d(-.4%,0,0)}to{transform:scale(1.06) translate3d(.4%,-.8%,0)}}@keyframes taff10-blink{50%{opacity:0}}
@media(max-width:900px){.taff10-frame{width:96vw;height:92vh;grid-template-columns:1fr;min-height:0}.taff10-copy{display:none}.taff10-stage{height:100%}.taff10-ui-scene,.taff10-build,.taff10-result{padding:9%}.taff10-ui-body,.taff10-code-wrap,.taff10-result-body{grid-template-columns:98px minmax(0,1fr)}.taff10-ui-nav{padding:12px 8px}.taff10-stats{grid-template-columns:repeat(2,1fr)}.taff10-stat:nth-child(2){border-right:0}.taff10-stat:nth-child(-n+2){border-bottom:1px solid #dedbd1}.taff10-code-wrap{height:calc(100% - 146px)}.taff10-plan{display:none}.taff10-result-body{grid-template-columns:1fr}.taff10-result-image{display:none}.taff10-result-copy{padding:26px}.taff10-end-inner strong{font-size:44px}}
@media(max-width:560px){.taff10-frame{width:100vw;height:100dvh;border:0}.taff10-ui-scene,.taff10-build,.taff10-result{padding:12% 8%}.taff10-ui-body{grid-template-columns:82px minmax(0,1fr)}.taff10-ui-nav span{font-size:8px;padding:5px}.taff10-ui-main{padding:14px}.taff10-model{top:14px;right:14px}.taff10-menu{top:50px;right:14px}.taff10-prompt{left:14px;right:14px;bottom:18px}.taff10-send{right:18px;bottom:62px}.taff10-progress{left:12px;right:12px;bottom:12px}.taff10-topline{padding:0 12px}}
`;

export default function PrismCodexIntroBrutalist({ onComplete }) {
  const reduced = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, []);
  const [time, setTime] = useState(0);
  const doneRef = useRef(false);
  const complete = () => { if (doneRef.current) return; doneRef.current = true; try { localStorage.setItem(INTRO_KEY, '1'); } catch {} onComplete?.(); };

  useEffect(() => {
    if (reduced) { setTime(DURATION - 1); return undefined; }
    const start = performance.now();
    let frame = 0;
    const tick = (now) => { const next = Math.min(DURATION, now - start); setTime(next); if (next < DURATION) frame = requestAnimationFrame(tick); else complete(); };
    frame = requestAnimationFrame(tick);
    const esc = (event) => { if (event.key === 'Escape') complete(); };
    window.addEventListener('keydown', esc);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', esc); };
  }, [reduced]);

  useEffect(() => { [...CLOUDS, CAR].forEach((src) => { const img = new Image(); img.src = src; }); }, []);

  const logo = between(time, 250, 1700);
  const title = between(time, 700, 2300);
  const sky = between(time, 1700, 5600);
  const dark = between(time, 5200, 6900);
  const intro2 = between(time, 6600, 8900);
  const ui = between(time, 8700, 15500);
  const modelOpen = between(time, 10800, 11900);
  const modelSelected = between(time, 11700, 12400);
  const prompt = between(time, 12000, 14800);
  const build = between(time, 14700, 22600);
  const code = between(time, 16000, 22000);
  const result = between(time, 22000, 27800);
  const end = between(time, 27000, DURATION);
  const typed = type(PROMPT, prompt);
  const codeTyped = type(CODE, code);

  return (
    <section className="taff10" aria-label="Apresentação do Prism TAFF 2.0">
      <style>{STYLES}</style>
      <div className="taff10-backdrop" />
      <div className="taff10-frame">
        <aside className="taff10-copy">
          <span className="taff10-kicker">PRISM / TAFF 2.0</span>
          <h1 className="taff10-title">Construir no limite.</h1>
          <p className="taff10-lead">O modelo mais forte da linha Prism, apresentado como uma única experiência: intenção, decisão, código e resultado.</p>
          <div className="taff10-facts">
            <div className="taff10-fact"><span>01</span><div><strong>Desenvolvimento completo</strong><small>Sites, jogos e backend do plano à entrega.</small></div></div>
            <div className="taff10-fact"><span>02</span><div><strong>Mais capacidade</strong><small>Feito para tarefas que pedem contexto e profundidade.</small></div></div>
            <div className="taff10-fact"><span>03</span><div><strong>Um fluxo contínuo</strong><small>O trabalho não termina na resposta: ele vira resultado.</small></div></div>
          </div>
          <div className="taff10-actions"><button type="button" className="taff10-action primary" onClick={complete}>Entrar no Codex</button><button type="button" className="taff10-action" onClick={complete}>Fechar</button></div>
        </aside>

        <div className="taff10-stage">
          <div className="taff10-topline"><span>PRISM TAFF 2.0</span><button type="button" onClick={complete}>Pular · Esc</button></div>
          <div className="taff10-progress"><i style={{ transform: `scaleX(${time / DURATION})` }} /></div>

          <div className="taff10-scene taff10-logo-scene" style={{ opacity: logo }}>
            <div className="taff10-logo-lock" style={{ transform: `translateY(${-5 + (1 - logo) * 4}%)` }}>
              <Logo className="taff10-logo" /><div className="taff10-word">TAFF <b style={{ opacity: title }}>2.0</b></div>
            </div>
          </div>

          <div className="taff10-scene taff10-sky" style={{ opacity: sky }}>
            <img src={CLOUDS[Math.min(CLOUDS.length - 1, Math.floor((Math.max(0, time - 1700) / 3900) * CLOUDS.length))]} alt="" />
            <div className="taff10-sky-copy"><span>PRISM / ATMOSPHERE</span><h3>Começamos no céu.</h3><p>Luz, espaço e movimento quase imperceptível.</p></div>
          </div>

          <div className="taff10-scene taff10-dark" style={{ opacity: dark }}>
            <div className="taff10-dark-content"><span className="eyebrow">TAFF 2.0 / INTENÇÃO</span><h3>Você descreve.<br />A Prism organiza.</h3><p>Do pedido ao trabalho real, cada etapa ganha uma função.</p></div>
          </div>

          <div className="taff10-scene taff10-dark" style={{ opacity: intro2 }}>
            <div className="taff10-dark-content"><span className="eyebrow">PRISM CODEX</span><h3>Agora começa a construção.</h3><p>Escolha o modelo, envie o pedido e deixe o Codex transformar a intenção em projeto.</p></div>
          </div>

          <div className="taff10-scene taff10-ui-scene" style={{ opacity: ui, transform: `translateY(${16 - 16 * ui}px)` }}>
            <div className="taff10-ui">
              <header className="taff10-ui-head"><div className="taff10-dots"><i/><i/><i/></div><span>Prism Codex</span><small>TAFF 2.0</small></header>
              <div className="taff10-ui-body">
                <aside className="taff10-ui-nav"><strong>PRISM</strong><span>Home</span><span className="active">Codex</span><span>Projetos</span><span>Artefatos</span></aside>
                <main className="taff10-ui-main">
                  <div className="taff10-model"><span>{modelSelected > .45 ? 'Prism Taff 2.0' : 'Prism Edge 1.0'}</span><strong>⌄</strong></div>
                  <div className="taff10-menu" style={{ opacity: modelOpen, transform: `translateY(${8 - 8 * modelOpen}px)` }}><span>Prism Nano 1.0A</span><span>Prism Mini 1.0A</span><strong>Prism Taff 2.0</strong></div>
                  <div className="taff10-prompt"><b>{typed}</b><i className="taff10-caret" /></div>
                  <button type="button" className="taff10-send">Enviar</button>
                </main>
              </div>
            </div>
          </div>

          <div className="taff10-scene taff10-build" style={{ opacity: build, transform: `translateY(${18 - 18 * build}px)` }}>
            <div className="taff10-build-card">
              <header className="taff10-build-head"><span>TAFF 2.0 / execução</span><small>{code > .9 ? 'REVISANDO' : 'TRABALHANDO'}</small></header>
              <div className="taff10-stats">
                <Stat label="PLANEJAMENTO" value={time > 16800 ? 'OK' : '...'} note="estrutura definida" />
                <Stat label="THINKING" value={`${Math.max(1, Math.round(code * 12))}s`} note="decisões" />
                <Stat label="ARQUIVOS" value={`${Math.min(9, Math.max(1, Math.round(code * 9)))}/9`} note="criando" />
                <Stat label="REVISÃO" value={`${Math.min(24, Math.max(1, Math.round(code * 24)))}/24`} note="validando" />
              </div>
              <div className="taff10-code-wrap">
                <aside className="taff10-plan"><span>PLANO DE EXECUÇÃO</span><strong>Car sales website</strong><em>Homepage<br/>Catálogo<br/>Busca<br/>Checkout<br/>Responsivo</em></aside>
                <div className="taff10-code"><div className="taff10-code-head"><span className="active">src/App.jsx</span><span>src/styles.css</span><span>package.json</span></div><pre>{codeTyped}<span className="cursor" /></pre></div>
              </div>
            </div>
          </div>

          <div className="taff10-scene taff10-result" style={{ opacity: result, transform: `translateY(${16 - 16 * result}px)` }}>
            <div className="taff10-result-card">
              <nav className="taff10-result-nav"><strong>PRISM MOTORS</strong><span>Comprar · Estoque · Contato</span><b>Ver estoque</b></nav>
              <div className="taff10-result-body">
                <div className="taff10-result-copy"><small>SITE GERADO PELO CODEX</small><h3>Encontre o carro certo.<br/>Sem perder tempo.</h3><p>Uma experiência premium, simples e pronta para continuar evoluindo.</p><button>Explorar carros</button></div>
                <div className="taff10-result-image" />
              </div>
            </div>
          </div>

          <div className="taff10-scene taff10-end" style={{ opacity: end }}>
            <div className="taff10-end-inner"><Logo className="taff10-logo"/><span>PRISM IA</span><strong>TAFF 2.0</strong><small>Do pedido ao produto.</small></div>
          </div>
        </div>
      </div>
    </section>
  );
}
