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
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) throw new Error('Preencha seu e-mail e sua senha.');
      const result = await api.post('/auth/login', { email: cleanEmail, password });
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
    <div className="auth-screen">
      <main className="auth-screen__content">
        <header className="auth-screen__brand-row">
          <Link className="auth-screen__brand" to="/" aria-label="Prism IA">
            <span className="auth-screen__brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></span>
            <span>Prism IA</span>
          </Link>
        </header>

        <section className="auth-screen__left">
          <div className="auth-screen__intro">
            <div className="auth-screen__eyebrow">Seu espaço para pensar, criar e construir</div>
            <h1>Questione o que<br />vem a seguir.</h1>
            <p>Uma inteligência de trabalho para transformar ideias em algo concreto.</p>
          </div>

          <section className="auth-card" aria-labelledby="login-title">
            <div className="auth-card__heading">
              <span>Prism IA</span>
              <h2 id="login-title">Entrar</h2>
              <p>Continue exatamente de onde parou.</p>
            </div>

            <GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} />
            <div className="auth-card__divider"><span>ou</span></div>

            <form className="auth-card__form" onSubmit={submit}>
              <label htmlFor="login-email">E-mail</label>
              <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" autoFocus required placeholder="Digite seu e-mail" />

              <label htmlFor="login-password">Senha</label>
              <div className="auth-card__password">
                <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required placeholder="Digite sua senha" />
                <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button>
              </div>

              {error && <div className="auth-card__notice" role="alert">{error}</div>}

              <button className="auth-card__submit" type="submit" disabled={busy}>{busy ? 'Entrando...' : 'Continuar com e-mail'}</button>
            </form>

            <p className="auth-card__legal">Ao continuar, você declara estar ciente da <span>Política de Privacidade</span> do Prism IA.</p>
            <p className="auth-card__switch">Ainda não tem conta? <Link to="/register">Criar uma conta</Link></p>
          </section>
        </section>
      </main>

      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-visual__frame">
          <div className="auth-visual__board">
            <div className="auth-visual__paper paper-a"><b>IDEIAS</b><span /><span /><span /></div>
            <div className="auth-visual__paper paper-b"><b>PLANO</b><span /><span /><span /><span /></div>
            <div className="auth-visual__paper paper-c"><b>PRISM</b><span /><span /><span /></div>
            <div className="auth-visual__paper paper-d"><span className="chart chart-a" /><span className="chart chart-b" /><span className="chart chart-c" /></div>
            <div className="auth-visual__note note-a">COMECE<br />POR AQUI</div>
            <div className="auth-visual__note note-b">REFINE<br />DEPOIS</div>
            <div className="auth-visual__circle" />
            <div className="auth-visual__figure"><div className="head" /><div className="body" /><div className="arm" /></div>
          </div>
        </div>
        <div className="auth-visual__caption"><span>PRISM IA</span><small>Um lugar para as próximas ideias.</small></div>
      </aside>
    </div>
  );
}
