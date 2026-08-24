import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Register() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const { login } = useAuth(); const navigate = useNavigate();
  async function handleSubmit(e) { e.preventDefault(); setError(''); try { const res = await api.post('/auth/register', { name, email, password }); login(res.token, res.user); navigate('/chat'); } catch (err) { setError(err.message); } }
  return <div className="container" style={{ maxWidth: 420, paddingTop: 80 }}><div className="glass" style={{ padding: 28 }}><h1>Criar conta</h1><form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} required /><input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required /><input type="password" placeholder="Senha (mín. 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required />{error && <p style={{ color: '#f87171' }}>{error}</p>}<button className="btn btn-primary">Criar Conta</button></form><p style={{ color: 'var(--text-dim)' }}>Já tem conta? <Link to="/login" style={{ color: 'var(--purple)' }}>Entrar</Link></p></div></div>;
}
