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
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const cleanName = name.trim().replace(/\s+/g, ' ');
      const cleanEmail = email.trim().toLowerCase();
      if (cleanName.length < 2) throw new Error('Digite seu nome.');
      if (!cleanEmail) throw new Error('Digite seu e-mail.');
      if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.');
      const result = await api.post('/auth/register', { name: cleanName, email: cleanEmail, password });
      if (!result.token || !result.user) throw new Error('A resposta do servidor está incompleta.');
      login(result.token, result.user);
      navigate('/chat', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível criar sua conta agora.');
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
            <div className="auth-screen__eyebrow">Um lugar para as ideias que vêm a seguir</div>
            <h1>Comece a criar<br />o que vem a seguir.</h1>
            <p>Uma conta para conversar com os modelos Prism, organizar projetos e manter seu trabalho em contexto.</p>
          </div>

          <section className="auth-card" aria-labelledby="register-title">
            <div className="auth-card__heading">
              <span>Prism IA</span>
              <h2 id="register-title">Criar conta</h2>
              <p>Comece seu workspace em poucos passos.</p>
            </div>

            <GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} />
            <div className="auth-card__divider"><span>ou</span></div>

            <form className="auth-card__form" onSubmit={submit}>
              <label htmlFor="register-name">Nome</label>
              <input id="register-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus required placeholder="Como podemos chamar você?" />

              <label htmlFor="register-email">E-mail</label>
              <input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="Digite seu e-mail" />

              <label htmlFor="register-password">Senha</label>
              <input id="register-password" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required placeholder="Crie uma senha" />

              {error && <div className="auth-card__notice" role="alert">{error}</div>}

              <button className="auth-card__submit" type="submit" disabled={busy}>{busy ? 'Criando...' : 'Continuar com e-mail'}</button>
            </form>

            <p className="auth-card__legal">Ao continuar, você declara estar ciente da <span>Política de Privacidade</span> do Prism IA.</p>
            <p className="auth-card__switch">Já tem uma conta? <Link to="/login">Entrar</Link></p>
          </section>
        </section>
      </main>

      <aside className="auth-visual" aria-hidden="true">
        <div className="auth-visual__frame">
          <div className="auth-visual__board">
            <div className="auth-visual__paper paper-a"><b>COMECE</b><span /><span /><span /></div>
            <div className="auth-visual__paper paper-b"><b>IDEIAS</b><span /><span /><span /><span /></div>
            <div className="auth-visual__paper paper-c"><b>PROJETO</b><span /><span /><span /></div>
            <div className="auth-visual__paper paper-d"><span className="chart chart-a" /><span className="chart chart-b" /><span className="chart chart-c" /></div>
            <div className="auth-visual__note note-a">PENSE<br />GRANDE</div>
            <div className="auth-visual__note note-b">CONSTRUA<br />AOS POUCOS</div>
            <div className="auth-visual__circle" />
            <div className="auth-visual__figure"><div className="head" /><div className="body" /><div className="arm" /></div>
          </div>
        </div>
        <div className="auth-visual__caption"><span>PRISM IA</span><small>Seu próximo projeto começa aqui.</small></div>
      </aside>
    </div>
  );
}
