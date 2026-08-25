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
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/auth/login', { email: email.trim().toLowerCase(), password });
      if (!result.token || !result.user) throw new Error('A resposta do servidor está incompleta.');
      login(result.token, result.user);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar agora.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-side">
        <Link className="brand" to="/"><span className="brand-mark">P</span><span>Prism IA</span></Link>
        <div>
          <div className="eyebrow">Seu espaço de trabalho</div>
          <h1>Volte exatamente de onde parou.</h1>
          <p>Conversas, projetos e contexto ficam reunidos em uma experiência simples, sem transformar seu trabalho em um painel.</p>
        </div>
        <div className="auth-quote">Uma boa ferramenta desaparece quando você começa a criar.</div>
      </section>
      <main className="auth-panel">
        <div className="auth-box">
          <div className="eyebrow">Prism IA</div>
          <h2>Entrar</h2>
          <p className="lede">Continue seu trabalho.</p>
          <GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} />
          <div className="divider">ou continue com email</div>
          <form className="form-stack" onSubmit={submit}>
            <div><label className="field-label" htmlFor="login-email">Email</label><input id="login-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required /></div>
            <div><label className="field-label" htmlFor="login-password">Senha</label><div className="password-wrap"><input id="login-password" className="input" style={{paddingRight:65}} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></div>
            {error && <div className="notice" role="alert">{error}</div>}
            <button className="button button-warm" disabled={busy}>{busy ? 'Entrando' : 'Entrar'}</button>
          </form>
          <div className="auth-footer">Ainda não tem conta? <Link className="link" to="/register">Criar uma conta</Link></div>
        </div>
      </main>
    </div>
  );
}
