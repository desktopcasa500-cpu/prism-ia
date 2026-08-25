import { useState } from 'react';
import { api } from '../lib/api';

const models = [
  'prism-nano-1.0',
  'prism-mini-1.0',
  'prism-tex-1.5',
  'prism-taff-1.0',
  'prism-taff-2.0'
];

const thoughts = [
  ['low','Baixo'],
  ['medium','Médio'],
  ['high','Alto'],
  ['max','MAX'],
  ['ultracode','Ultra Code']
];

export default function Codex() {
  const [model,setModel]=useState('prism-mini-1.0');
  const [thinking,setThinking]=useState('medium');
  const [messages,setMessages]=useState([]);
  const [prompt,setPrompt]=useState('');
  const [files,setFiles]=useState([]);
  const [preview,setPreview]=useState('');
  const [loading,setLoading]=useState(false);

  async function send(){
    if(!prompt.trim()||loading)return;
    const text=prompt;
    setPrompt('');
    setMessages(m=>[...m,{role:'user',text}]);
    setLoading(true);
    try{
      const data=await api.post('/ai/generate',{model,thinking,prompt:text});
      const answer=data.text||data.response||'Resposta vazia';
      setMessages(m=>[...m,{role:'assistant',text:answer}]);
      if(answer.includes('<html')||answer.includes('<div')||answer.includes('<body'))setPreview(answer);
    }catch(e){
      setMessages(m=>[...m,{role:'assistant',text:e.message||'Erro no backend'}]);
    }finally{setLoading(false);}
  }

  async function upload(event){
    const selected=[...event.target.files];
    setFiles(selected.map(f=>f.name));
    const form=new FormData();
    selected.forEach(f=>form.append('files',f));
    try{ await fetch('/api/uploads/analyze',{method:'POST',body:form}); }catch{}
  }

  return <main className="codex-page codex-workspace">
    <aside className="codex-sidebar">
      <div className="codex-brand"><span className="codex-pixel-mark"/> Prism Codex</div>
      <button>Novo projeto</button>
      <section><small>Projetos</small><p>Nenhum projeto aberto</p></section>
      <section><small>Arquivos</small>{files.map(f=><p key={f}>{f}</p>)}</section>
    </aside>
    <section className="codex-main">
      <header className="codex-toolbar">
        <select value={model} onChange={e=>setModel(e.target.value)}>{models.map(m=><option key={m}>{m}</option>)}</select>
        <select value={thinking} onChange={e=>setThinking(e.target.value)}>{thoughts.map(t=><option value={t[0]} key={t[0]}>{t[1]}</option>)}</select>
      </header>
      <div className="codex-chat">
        {!messages.length&&<div className="codex-empty"><h1>Prism Codex</h1><p>Crie sistemas completos com IA.</p></div>}
        {messages.map((m,i)=><article key={i} className={m.role}>{m.text}</article>)}
        {loading&&<article className="assistant">Gerando código...</article>}
      </div>
      <div className="codex-input">
        <input type="file" multiple onChange={upload}/>
        <input value={prompt} placeholder="Crie ou edite um projeto..." onChange={e=>setPrompt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}/>
        <button onClick={send}>Enviar</button>
      </div>
    </section>
    <aside className="codex-preview">
      <header>Preview</header>
      <iframe title="preview" srcDoc={preview||'<h2>Preview Prism</h2>'}/>
      <section className="codex-diff"><p className="removed">-80 linhas</p><p className="added">+30 linhas</p></section>
    </aside>
  </main>;
}
