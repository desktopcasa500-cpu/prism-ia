import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

function formatNumber(value) { return new Intl.NumberFormat('pt-BR').format(Math.max(0, Number(value || 0))); }
function formatDate(value) { if (!value) return '—'; const date = new Date(value); if (Number.isNaN(date.getTime())) return '—'; return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date); }

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [usage, setUsage] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [billing, setBilling] = useState(null);
  const [health, setHealth] = useState('Verificando');
  const [error, setError] = useState('');
  const [topUpState, setTopUpState] = useState('idle');
  const [effort, setEffort] = useState(() => localStorage.getItem('prism-default-effort') || 'medium');
  const [compact, setCompact] = useState(() => localStorage.getItem('prism-compact-sidebar') === 'true');

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/chat/usage'), api.get('/billing/wallet'), api.get('/billing/status'), api.get('/health', { timeout: 8000 })])
      .then(([nextUsage, nextWallet, nextBilling, nextHealth]) => { if (!active) return; setUsage(nextUsage); setWallet(nextWallet); setBilling(nextBilling); setHealth(nextHealth?.ok ? 'Conectado' : 'Indisponível'); })
      .catch(() => { if (active) setHealth('Indisponível'); });
    return () => { active = false; };
  }, []);

  async function simulateTopUp() {
    setTopUpState('loading'); setError('');
    try { const result = await api.post('/billing/top-up/simulated', { amountCents: 500 }); setWallet((current) => ({ ...current, balanceCents: result.balanceCents, lockedUntil: null })); setTopUpState('done'); setUsage((current) => current ? { ...current, lockedUntil: null } : current); window.setTimeout(() => setTopUpState('idle'), 1600); }
    catch (e) { setError(e.message || 'Não foi possível adicionar os fundos simulados.'); setTopUpState('error'); }
  }

  function updateEffort(value) { setEffort(value); localStorage.setItem('prism-default-effort', value); }
  function updateCompact(value) { setCompact(value); localStorage.setItem('prism-compact-sidebar', String(value)); }
  function signOut() { logout(); navigate('/login', { replace: true }); }

  const canTopUp = wallet?.canUseExtraFunds === true;
  const locked = Boolean(usage?.lockedUntil);

  return <div className="settings-page settings-simple">
    <header className="settings-header"><Link className="settings-brand" to="/chat"><img src="/prism-logo.svg" alt="Prism IA" /><span>Prism IA</span></Link><Link className="settings-back" to="/chat">Voltar ao chat</Link></header>
    <main className="settings-main">
      <div className="settings-nav-title">Configurações</div>

      <section className="settings-card">
        <div className="settings-card-header"><div><span>Geral</span><h2>Preferências</h2></div></div>
        <div className="settings-list-row"><div><strong>Esforço padrão</strong><p>Define a profundidade usada nas novas conversas.</p></div><select value={effort} onChange={(e) => updateEffort(e.target.value)}><option value="low">Baixo</option><option value="medium">Médio</option><option value="high">Alto</option><option value="max">Máximo</option><option value="ultracode">Ultra Code</option></select></div>
        <div className="settings-list-row"><div><strong>Navegação compacta</strong><p>Reduz a largura da barra lateral no Home e no Codex.</p></div><button className={`settings-switch ${compact ? 'on' : ''}`} onClick={() => updateCompact(!compact)} aria-pressed={compact}><span /></button></div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header"><div><span>Conta</span><h2>Perfil</h2></div></div>
        <div className="settings-profile"><div className="settings-avatar">{String(user?.name || 'U').slice(0, 1).toUpperCase()}</div><div><strong>{user?.name || 'Usuário'}</strong><p>{user?.email || 'Sem email disponível'}</p></div><span className="settings-plan-pill">{user?.plan || 'Grátis'}</span></div>
        <div className="settings-list-row"><div><strong>Serviço</strong><p>Backend e autenticação da Prism IA.</p></div><span className="settings-badge">{health}</span></div>
      </section>

      <section className="settings-card">
        <div className="settings-card-header"><div><span>Plano/Uso</span><h2>Limites e continuidade</h2></div><small>{usage?.timezone || 'America/Sao_Paulo'}</small></div>
        <div className="usage-summary-grid">
          <div className="usage-stat"><span>Uso diário</span><strong>{formatNumber(usage?.daily?.used)} <small>/ {formatNumber(usage?.daily?.limit)}</small></strong><em>Janela móvel de 24h · próxima renovação {formatDate(usage?.daily?.resetsAt)}</em></div>
          <div className="usage-stat"><span>Uso semanal</span><strong>{formatNumber(usage?.weekly?.used)} <small>/ {formatNumber(usage?.weekly?.limit)}</small></strong><em>Reset fixo no domingo às 00:00 · {formatDate(usage?.weekly?.resetsAt)}</em></div>
          <div className="usage-stat"><span>Fundos extras</span><strong>{canTopUp ? 'Disponível' : 'Indisponível'}</strong><em>Elegível a partir do plano Medium · mínimo US$ 5</em></div>
        </div>
        {locked && <div className="usage-lock"><strong>Limite semanal atingido</strong><span>Grátis e Base aguardam o próximo domingo. Planos Medium+ podem adicionar fundos para continuar imediatamente.</span>{canTopUp && <button onClick={simulateTopUp}>{topUpState === 'loading' ? 'Processando…' : topUpState === 'done' ? 'Fundos simulados' : 'Adicionar US$ 5'}</button>}</div>}
        {!locked && canTopUp && <div className="usage-extra"><span>Fundos extras simulados podem ser usados quando a cota semanal acabar.</span><button onClick={simulateTopUp}>{topUpState === 'loading' ? 'Processando…' : topUpState === 'done' ? 'Fundos simulados' : 'Adicionar US$ 5'}</button></div>}
        {error && <div className="upgrade-error" role="alert">{error}</div>}
      </section>

      <section className="settings-card">
        <div className="settings-card-header"><div><span>Cobrança</span><h2>Stripe</h2></div><span className="settings-badge">{billing?.enabled ? 'Ativo' : 'Inativo'}</span></div>
        <div className="settings-list-row"><div><strong>Estado da cobrança</strong><p>{billing?.enabled ? 'Checkout e webhooks estão disponíveis.' : 'A infraestrutura está preparada, mas nenhuma cobrança real é processada.'}</p></div><span className="settings-badge">{billing?.enabled ? 'Conectado' : 'Simulação'}</span></div>
        {!billing?.enabled && <div className="usage-extra"><span>A cobrança ainda não está conectada.</span><strong>Upgrades no ambiente atual são simulados sem cobrança real.</strong></div>}
      </section>

      <section className="settings-danger"><div><small>Sessão</small><h2>Sair da Prism IA</h2></div><button onClick={signOut}>Sair</button></section>
    </main>
  </div>;
}
