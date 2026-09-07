import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const STORAGE_KEY = 'prism_preferences';
const INTRO_KEY = 'prism_codex_intro_seen';

function readPreferences() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Math.max(0, Number(value || 0)));
}

function formatPercent(value) {
  return `${Math.round(Math.max(0, Number(value || 0)) * 100) / 100}%`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(() => ({ effort: 'medium', compactSidebar: false, ...readPreferences() }));
  const [account, setAccount] = useState(null);
  const [history, setHistory] = useState(null);
  const [health, setHealth] = useState({ state: 'checking', text: 'Verificando' });
  const [saved, setSaved] = useState(false);
  const [topUpState, setTopUpState] = useState('idle');

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get('/chat/usage/account'),
      api.get('/chat/usage/history?days=35'),
      api.get('/health', { timeout: 8000 }),
    ]).then(([nextAccount, nextHistory]) => {
      if (!active) return;
      setAccount(nextAccount);
      setHistory(nextHistory);
      setHealth({ state: 'online', text: 'Conectado' });
    }).catch(() => {
      if (!active) return;
      setHealth({ state: 'offline', text: 'Indisponível' });
    });
    return () => { active = false; };
  }, []);

  function update(key, value) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  async function simulateTopUp() {
    setTopUpState('loading');
    try {
      const result = await api.post('/billing/top-up/simulated', { amountCents: 500 });
      setAccount((current) => current ? { ...current, wallet: { ...current.wallet, balanceCents: result.balanceCents, lockedUntil: null } } : current);
      setTopUpState('done');
      window.setTimeout(() => setTopUpState('idle'), 1500);
    } catch {
      setTopUpState('error');
      window.setTimeout(() => setTopUpState('idle'), 1800);
    }
  }

  function replayCodexIntro() {
    localStorage.removeItem(INTRO_KEY);
    navigate('/codex');
  }

  function signOut() { logout(); navigate('/login', { replace: true }); }

  const daily = account?.usage?.daily;
  const weekly = account?.usage?.weekly;
  const totalTokens = history?.totalTokens || 0;
  const canTopUp = account?.wallet?.canUseExtraFunds === true;
  const balance = useMemo(() => (account?.wallet?.balanceCents || 0) / 100, [account?.wallet?.balanceCents]);

  return (
    <div className="settings-page settings-simple">
      <header className="settings-header">
        <Link className="settings-brand" to="/chat"><img src="/prism-logo.svg" alt="Prism IA" /> <span>Prism IA</span></Link>
        <Link className="settings-back" to="/chat">Voltar</Link>
      </header>

      <main className="settings-main">
        <div className="settings-nav-title">Configurações</div>

        <section className="settings-card account-card">
          <div className="settings-profile"><div className="settings-avatar">{(user?.name || 'U').slice(0, 1).toUpperCase()}</div><div><strong>{user?.name || 'Usuário'}</strong><p>{user?.email || 'Sem email disponível'}</p></div></div>
          <span className="settings-plan-pill">{user?.plan || 'Grátis'}</span>
        </section>

        <section className="settings-card">
          <div className="settings-card-header"><div><span>Uso</span><h2>Consumo</h2></div><small>{health.text}</small></div>
          <div className="usage-summary-grid">
            <div className="usage-stat"><span>Créditos hoje</span><strong>{formatNumber(daily?.used)} <small>/ {formatNumber(daily?.limit)}</small></strong><div className="usage-progress"><i style={{ width: `${Math.min(100, daily?.percentage || 0)}%` }} /></div><em>{formatPercent(daily?.percentage)} usado · renova {formatDate(daily?.resetsAt)}</em></div>
            <div className="usage-stat"><span>Uso semanal</span><strong>{formatNumber(weekly?.used)} <small>/ {formatNumber(weekly?.limit)}</small></strong><div className="usage-progress"><i style={{ width: `${Math.min(100, weekly?.percentage || 0)}%` }} /></div><em>{formatPercent(weekly?.percentage)} usado · fecha {formatDate(weekly?.resetsAt)}</em></div>
            <div className="usage-stat"><span>Tokens usados</span><strong>{formatNumber(totalTokens)}</strong><em>{history?.activeDays || 0} dias ativos nos últimos {history?.windowDays || 35}</em></div>
            <div className="usage-stat"><span>Fundos extras</span><strong>US$ {balance.toFixed(2)}</strong><em>{canTopUp ? 'Disponível a partir de US$ 5' : 'Disponível para planos acima do Medium'}</em></div>
          </div>
          {account?.usage?.lockedUntil && <div className="usage-lock"><strong>Uso semanal esgotado</strong><span>O acesso fica pausado até {formatDate(account.usage.lockedUntil)}.</span>{canTopUp && <button onClick={simulateTopUp}>{topUpState === 'loading' ? 'Processando…' : topUpState === 'done' ? 'Fundos adicionados' : topUpState === 'error' ? 'Tentar novamente' : 'Adicionar US$ 5'}</button>}</div>}
          {!account?.usage?.lockedUntil && canTopUp && <div className="usage-extra"><span>Precisa continuar usando após o limite semanal?</span><button onClick={simulateTopUp}>{topUpState === 'loading' ? 'Processando…' : topUpState === 'done' ? 'Fundos adicionados' : 'Adicionar US$ 5'}</button></div>}
        </section>

        <section className="settings-card">
          <div className="settings-card-header"><div><span>Preferências</span><h2>Como você usa a Prism</h2></div></div>
          <div className="settings-list-row"><div><strong>Esforço padrão</strong><p>Nível usado quando uma conversa começa.</p></div><select value={preferences.effort} onChange={(event) => update('effort', event.target.value)}><option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option><option value="max">Máximo</option><option value="ultracode">Ultra Code</option></select></div>
          <div className="settings-list-row"><div><strong>Barra lateral compacta</strong><p>Usa uma navegação mais estreita no Chat.</p></div><button className={`settings-switch ${preferences.compactSidebar ? 'on' : ''}`} onClick={() => update('compactSidebar', !preferences.compactSidebar)} aria-pressed={preferences.compactSidebar}><span /></button></div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header"><div><span>Codex</span><h2>Apresentação</h2></div></div>
          <div className="settings-list-row"><div><strong>Reproduzir apresentação do TAFF 2.0</strong><p>Abre novamente a apresentação cinematográfica do Codex.</p></div><button className="settings-outline" onClick={replayCodexIntro}>Reproduzir</button></div>
        </section>

        <section className="settings-card settings-connection">
          <div className="settings-card-header"><div><span>Sistema</span><h2>Conexão</h2></div></div>
          <div className="settings-list-row"><div><strong>Prism API</strong><p>Serviço responsável por autenticação e geração.</p></div><span className={`health-badge ${health.state}`}><i />{health.text}</span></div>
          <div className="settings-list-row"><div><strong>Stripe</strong><p>Integração preparada no backend; pagamentos reais permanecem desativados.</p></div><span className="settings-badge">Inativo</span></div>
        </section>

        <section className="settings-danger"><div><small>Sessão</small><h2>Sair da Prism IA</h2></div><button onClick={signOut}>Sair</button></section>
      </main>

      {saved && <div className="settings-saved" role="status">Salvo</div>}
    </div>
  );
}
