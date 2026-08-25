import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const models = [
  ['Nano 1.0A', 'rápido'],
  ['Mini 1.0', 'equilibrado'],
  ['Edge 1.0A', 'raciocínio'],
  ['Tex 1.0A', 'técnico'],
  ['Taff 2.0', 'flagship'],
];

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
    setBusy(true); setError('');
    try {
      const result = await api.post('/auth/login', { email: email.trim().toLowerCase(), password });
      if (!result.token || !result.user) throw new Error('A resposta do servidor está incompleta.');
      login(result.token, result.user);
      navigate('/chat', { replace: true });
    } catch (err) { setError(err.message || 'Não foi possível entrar agora.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-page">
      <section className="auth-side">
        <Link className="auth-brand" to="/" aria-label="Prism IA">
          <span className="auth-brand-mark" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/></span>
          <span>Prism IA</span>
        </Link>

        <div className="auth-copy">
          <div className="auth-kicker">Seu espaço de trabalho</div>
          <h1>Questione.<br/>Construa.<br/>Refine.</h1>
          <p>Uma camada de engenharia que coordena modelos diferentes para transformar ideias, código e arquitetura em trabalho concreto.</p>
          <div className="auth-presentation">
            <div className="auth-presentation-head"><span>Uma plataforma. Cinco perfis.</span><span>01—05</span></div>
            <div className="auth-models">
              {models.map(([name, label]) => <div className="auth-model" key={name}><strong>Prism {name}</strong><span>{label}</span></div>)}
            </div>
          </div>
        </div>

        <div className="auth-bottom-note">Orquestração paralela para código, arquitetura e documentação. O resultado final é sintetizado antes de chegar ao seu workspace.</div>
      </section>

      <main className="auth-panel">
        <div className="auth-box">
          <div className="auth-kicker">Prism IA / acesso</div>
          <h2>Entrar</h2>
          <p className="lede">Continue exatamente de onde parou.</p>
          <GoogleSignIn onSuccess={() => navigate('/chat', { replace: true })} />
          <div className="divider">ou continue com email</div>
          <form className="form-stack" onSubmit={submit}>
            <div><label className="field-label" htmlFor="login-email">Email</label><input id="login-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required /></div>
            <div><label className="field-label" htmlFor="login-password">Senha</label><div className="password-wrap"><input id="login-password" className="input" style={{ paddingRight: 70 }} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></div></div>
            {error && <div className="notice" role="alert">{error}</div>}
            <button className="button button-warm" disabled={busy}>{busy ? 'Entrando' : 'Entrar'}</button>
          </form>
          <div className="auth-footer">Ainda não tem conta? <Link className="link" to="/register">Criar uma conta</Link></div>
        </div>
        <div className="auth-orbit" aria-hidden="true"><img className="auth-mascot" src="/src/assets/prism-panda.svg" alt="" /></div>
      </main>
    </div>
  );
}
