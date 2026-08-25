import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Register() {
  const navigate = useNavigate(); const { login } = useAuth();
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');try{const cleanName=name.trim().replace(/\s+/g,' ');const cleanEmail=email.trim().toLowerCase();if(cleanName.length<2)throw new Error('Digite seu nome.');if(password.length<6)throw new Error('A senha precisa ter pelo menos 6 caracteres.');const result=await api.post('/auth/register',{name:cleanName,email:cleanEmail,password});if(!result.token||!result.user)throw new Error('A resposta do servidor está incompleta.');login(result.token,result.user);navigate('/chat',{replace:true});}catch(err){setError(err.message||'Não foi possível criar sua conta agora.');}finally{setBusy(false);}}
  return <div className="auth-page">
    <section className="auth-side">
      <Link className="auth-brand" to="/" aria-label="Prism IA"><span className="auth-brand-mark" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span><span>Prism IA</span></Link>
      <div className="auth-copy"><div className="auth-kicker">Comece pelo trabalho</div><h1>Uma conta.<br/>Um lugar<br/>para criar.</h1><p>Converse com os modelos Prism, organize projetos e mantenha o contexto do seu trabalho em um só lugar.</p><div className="auth-presentation"><div className="auth-presentation-head"><span>Comece simples. Escale quando precisar.</span><span>PRISM / 2026</span></div></div></div>
      <div className="auth-bottom-note">Seu histórico pertence à sua conta. Projetos, sessões e mensagens ficam separados por usuário.</div>
    </section>
    <main className="auth-panel"><div className="auth-box"><div className="auth-kicker">Prism IA / novo workspace</div><h2>Criar conta</h2><p className="lede">Leva menos de um minuto.</p><GoogleSignIn onSuccess={() => navigate('/chat',{replace:true})}/><div className="divider">ou crie com email</div><form className="form-stack" onSubmit={submit}>
      <div><label className="field-label" htmlFor="register-name">Nome</label><input id="register-name" className="input" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" autoFocus required /></div>
      <div><label className="field-label" htmlFor="register-email">Email</label><input id="register-email" className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required /></div>
      <div><label className="field-label" htmlFor="register-password">Senha</label><input id="register-password" className="input" type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" required /></div>
      {error&&<div className="notice" role="alert">{error}</div>}<button className="button button-warm" disabled={busy}>{busy?'Criando':'Criar conta'}</button></form><div className="auth-footer">Já tem conta? <Link className="link" to="/login">Entrar</Link></div></div><div className="auth-orbit" aria-hidden="true"><img className="auth-mascot" src="/prism-panda.svg" alt="" /></div></main>
  </div>;
}
