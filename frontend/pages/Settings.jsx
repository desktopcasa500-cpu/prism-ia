import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const STORAGE_KEY = 'prism_preferences';
const INTRO_KEY = 'prism_codex_intro_seen';

function readPreferences() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(() => ({ effort: 'medium', compactSidebar: false, ...readPreferences() }));
  const [health, setHealth] = useState({ state: 'checking', text: 'Verificando conexão' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/health', { timeout: 8000 }).then(() => active && setHealth({ state: 'online', text: 'Backend conectado' })).catch(() => active && setHealth({ state: 'offline', text: 'Backend indisponível' }));
    return () => { active = false; };
  }, []);

  function update(key, value) {
    const next = { ...preferences, [key]: value };
    setPreferences(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  function replayCodexIntro() {
    localStorage.removeItem(INTRO_KEY);
    navigate('/codex');
  }

  function signOut() { logout(); navigate('/login', { replace: true }); }

  return <div className="settings-page">
    <header className="settings-header"><Link className="settings-brand" to="/chat"><span className="brand-mark" aria-hidden="true" /> Prism IA</Link><Link className="settings-back" to="/chat">Voltar ao chat</Link></header>
    <main className="settings-main">
      <div className="settings-intro"><span>PRISM / CONFIGURAÇÕES</span><h1>Seu workspace, do seu jeito.</h1><p>Preferências locais e informações da sua conta. Chaves de API continuam exclusivamente no ambiente do servidor.</p></div>
      <section className="settings-section"><div className="settings-section-head"><div><small>Conta</small><h2>Perfil</h2></div><span className="settings-index">01</span></div><div className="settings-row"><div><strong>{user?.name || 'Usuário'}</strong><p>{user?.email || 'Sem email disponível'}</p></div><span className="settings-badge">Plano {user?.plan || 'Grátis'}</span></div></section>
      <section className="settings-section"><div className="settings-section-head"><div><small>Chat</small><h2>Preferências</h2></div><span className="settings-index">02</span></div><div className="settings-row"><div><strong>Esforço padrão</strong><p>Escolha o nível usado ao iniciar uma nova conversa.</p></div><select value={preferences.effort} onChange={(event) => update('effort', event.target.value)}><option value="medium">Médio</option><option value="ultracode">Ultra</option></select></div><div className="settings-row"><div><strong>Interface compacta</strong><p>Reduz o espaço visual da navegação lateral.</p></div><button className={`settings-switch ${preferences.compactSidebar ? 'on' : ''}`} onClick={() => update('compactSidebar', !preferences.compactSidebar)} aria-pressed={preferences.compactSidebar}><span /></button></div></section>
      <section className="settings-section"><div className="settings-section-head"><div><small>Codex</small><h2>Introdução</h2></div><span className="settings-index">03</span></div><div className="settings-row"><div><strong>Reproduzir introdução do Codex</strong><p>Apaga o estado local e abre novamente a sequência cinematográfica na próxima entrada.</p></div><button className="settings-button" onClick={replayCodexIntro}>Reproduzir</button></div></section>
      <section className="settings-section"><div className="settings-section-head"><div><small>Sistema</small><h2>Conexão</h2></div><span className="settings-index">04</span></div><div className="settings-row"><div><strong>Prism API</strong><p>Estado atual do serviço usado pelo chat e autenticação.</p></div><span className={`health-badge ${health.state}`}><i />{health.text}</span></div><div className="settings-row"><div><strong>Banco de dados</strong><p>O navegador nunca recebe DATABASE_URL ou outras credenciais privadas.</p></div><span className="settings-badge">Servidor</span></div></section>
      <section className="settings-danger"><div><small>Sessão</small><h2>Sair da Prism IA</h2><p>Remove o token desta sessão neste navegador.</p></div><button onClick={signOut}>Sair</button></section>
      {saved && <div className="settings-saved" role="status">Preferência salva</div>}
    </main>
  </div>;
}
