import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await api.post('/auth/register', { name: name.trim(), email: email.trim(), password });
      login(result.token, result.user);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível criar sua conta.');
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <section className="auth-side">
        <Link className="brand" to="/"><span className="brand-mark">P</span><span>Prism IA</span></Link>
        <div><div className="eyebrow">Seu espaço</div><h1>Comece sem aprender a usar um painel.</h1><p>Crie sua conta e entre direto em uma experiência feita para conversar, construir e voltar ao que importa.</p></div>
        <div className="auth-quote">Modelos diferentes. Uma experiência só. Menos configuração, mais criação.</div>
      </section>
      <main className="auth-panel">
        <div className="auth-box">
          <h2>Criar conta</h2>
          <p className="lede">Leva menos de um minuto.</p>
          <GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} />
          <div className="divider">ou crie com email</div>
          <form className="form-stack" onSubmit={submit}>
            <div><label className="field-label">Nome</label><input className="input" value={name} onChange={(e)=>setName(e.target.value)} autoComplete="name" required /></div>
            <div><label className="field-label">Email</label><input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} autoComplete="email" required /></div>
            <div><label className="field-label">Senha</label><input className="input" type="password" minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="new-password" required /></div>
            {error && <div className="notice">{error}</div>}
            <button className="button button-warm" disabled={busy}>{busy ? 'Criando…' : 'Criar conta'}</button>
          </form>
          <div className="auth-footer">Já tem conta? <Link className="link" to="/login">Entrar</Link></div>
        </div>
      </main>
    </div>
  );
}
