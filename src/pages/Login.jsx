import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await api.post('/auth/login', { email: email.trim(), password });
      login(result.token, result.user);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <section className="auth-side">
        <Link className="brand" to="/"><span className="brand-mark">P</span><span>Prism IA</span></Link>
        <div><div className="eyebrow">Voltar ao trabalho</div><h1>Entre e continue sua próxima ideia.</h1><p>Suas conversas e projetos ficam ligados à sua conta para que o fluxo continue simples.</p></div>
        <div className="auth-quote">“A melhor interface é aquela que deixa a pessoa esquecer que está usando uma interface.”</div>
      </section>
      <main className="auth-panel">
        <div className="auth-box">
          <h2>Entrar</h2>
          <p className="lede">Bem-vindo de volta.</p>
          <GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} />
          <div className="divider">ou use seu email</div>
          <form className="form-stack" onSubmit={submit}>
            <div><label className="field-label">Email</label><input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required /></div>
            <div><label className="field-label">Senha</label><div className="password-wrap"><input className="input" style={{paddingRight:60}} type={showPassword ? 'text' : 'password'} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={()=>setShowPassword(v=>!v)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></div>
            {error && <div className="notice">{error}</div>}
            <button className="button button-warm" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          </form>
          <div className="auth-footer">Ainda não tem conta? <Link className="link" to="/register">Criar uma conta</Link></div>
        </div>
      </main>
    </div>
  );
}
