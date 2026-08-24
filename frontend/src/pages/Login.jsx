import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const { login } = useAuth(); const navigate = useNavigate();
  async function handleSubmit(e) { e.preventDefault(); setError(''); try { const res = await api.post('/auth/login', { email, password }); login(res.token, res.user); navigate('/chat'); } catch (err) { setError(err.message); } }
  return <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}><div className="glass" style={{ padding: 28 }}><h1>Entrar</h1><form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required /><input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required />{error && <p style={{ color: '#f87171' }}>{error}</p>}<button className="btn btn-primary">Entrar</button></form><p style={{ color: 'var(--text-dim)' }}>Não tem conta? <Link to="/register" style={{ color: 'var(--purple)' }}>Criar conta</Link></p></div></div>;
}
