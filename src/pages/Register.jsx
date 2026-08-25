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
    <div className="auth-page">
      <section className="auth-side">
        <Link className="brand" to="/"><span className="brand-mark">P</span><span>Prism IA</span></Link>
        <div>
          <div className="eyebrow">Comece pelo trabalho</div>
          <h1>Uma conta. Um lugar para criar.</h1>
          <p>Entre direto no chat e use o Studio quando precisar organizar projetos, arquivos e ferramentas.</p>
        </div>
        <div className="auth-quote">Menos configuração. Mais espaço para pensar.</div>
      </section>
      <main className="auth-panel">
        <div className="auth-box">
          <div className="eyebrow">Prism IA</div>
          <h2>Criar conta</h2>
          <p className="lede">Leva menos de um minuto.</p>
          <GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} />
          <div className="divider">ou crie com email</div>
          <form className="form-stack" onSubmit={submit}>
            <div><label className="field-label" htmlFor="register-name">Nome</label><input id="register-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus required /></div>
            <div><label className="field-label" htmlFor="register-email">Email</label><input id="register-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
            <div><label className="field-label" htmlFor="register-password">Senha</label><input id="register-password" className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /></div>
            {error && <div className="notice" role="alert">{error}</div>}
            <button className="button button-warm" disabled={busy}>{busy ? 'Criando' : 'Criar conta'}</button>
          </form>
          <div className="auth-footer">Já tem conta? <Link className="link" to="/login">Entrar</Link></div>
        </div>
      </main>
    </div>
  );
}
