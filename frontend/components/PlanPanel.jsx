import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import './plans-panel.css';

const PLANS = [
  { name: 'Grátis', price: 'R$0', models: 'Prism Mini e Nano · acesso essencial', usage: '5 usos em 24h · 100 usos por semana' },
  { name: 'Base', price: 'R$8', models: 'Prism Mini e Nano · prioridade padrão', usage: '30 usos em 24h · 500 usos por semana' },
  { name: 'Medium', price: 'R$30', models: 'Prism Edge e Tex · maior capacidade', usage: '700 usos em 24h · 3.000 usos por semana' },
  { name: 'Pro', price: 'R$90', models: 'Edge, Tex e Taff · prioridade alta', usage: '2.000 usos em 24h · 10.000 usos por semana' },
  { name: 'Empresarial', price: 'R$140', models: 'Todos os modelos · Ultracode disponível', usage: '6.000 usos em 24h · 30.000 usos por semana' },
];

export default function PlanPanel({ open, onClose, currentPlan = 'Grátis', requestedModel = '', quotaBlocked = false }) {
  const [upgrade, setUpgrade] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState(null);
  useEffect(() => { if (!open) { setUpgrade(null); setBusy(false); setError(''); setResult(null); } }, [open]);
  if (!open) return null;
  async function checkout() {
    if (!upgrade || busy) return;
    setBusy(true); setError('');
    try {
      const response = await api.get('/billing/status');
      if (response.billingSimulation) {
        const simulated = await api.post('/billing/checkout', { plan: upgrade.name });
        setResult({ message: simulated.message || 'Upgrade simulado com sucesso.', simulated: true });
      } else if (!response.enabled) {
        const unavailable = new Error(response.simulationMessage || 'A cobrança ainda não está conectada neste ambiente.');
        unavailable.payload = { error: unavailable.message, code: 'BILLING_NOT_CONFIGURED' };
        throw unavailable;
      } else {
        const created = await api.post('/billing/checkout', { plan: upgrade.name, successUrl: `${window.location.origin}/configuracoes?billing=success`, cancelUrl: `${window.location.origin}/configuracoes?billing=cancelled` });
        if (!created?.url) throw new Error('O provedor de pagamento não retornou a página de checkout.');
        window.location.assign(created.url);
      }
    } catch (cause) { setError(cause.payload?.error || cause.message || 'Não foi possível iniciar o upgrade.'); setBusy(false); }
  }
  const introTitle = quotaBlocked ? 'Adicione créditos para usar este modelo' : upgrade ? `Upgrade para ${upgrade.name}` : 'Planos';
  const introText = quotaBlocked ? 'Sua cota atual não é suficiente para processar este modelo. Escolha um plano com maior capacidade.' : upgrade ? `Continue com ${upgrade.name} e libere mais capacidade.` : requestedModel ? `${requestedModel} pede um plano acima do seu.` : 'Escolha o plano que acompanha o seu trabalho.';
  return <div className="plans-overlay" role="dialog" aria-modal="true" aria-label="Planos Prism" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose?.(); }}>
    <section className="plans-panel">
      <header><div><span>PRISM IA / PLANO</span><h2>{introTitle}</h2><p>{introText}</p></div><button className="plans-close" onClick={onClose} disabled={busy}>Fechar</button></header>
      {result ? <div className="upgrade-view"><div className="upgrade-summary"><span>{result.simulated ? 'SIMULAÇÃO' : 'CONCLUÍDO'}</span><strong>{upgrade?.name}</strong><p>{result.message}</p><small>{result.simulated ? 'A cobrança real ainda não está conectada neste ambiente.' : 'A atualização do plano foi concluída.'}</small></div><div className="upgrade-actions"><button className="upgrade-primary" onClick={onClose}>Concluir</button></div></div> : !upgrade ? <><div className="plans-grid">{PLANS.map((plan) => <article className={plan.name === currentPlan ? 'current' : ''} key={plan.name}><div className="plan-head"><span>{plan.name}</span>{plan.name === currentPlan && <small>ATUAL</small>}</div><strong>{plan.price}</strong><p>{plan.models}</p><small>{plan.usage}</small><button disabled={plan.name === currentPlan} onClick={() => { setUpgrade(plan); setError(''); }}>{plan.name === currentPlan ? 'Plano atual' : 'Fazer upgrade'}</button></article>)}</div><footer className="plans-foot"><span>Stripe está preparado para ativação.</span><b>Quando habilitado, o checkout segue para o provedor de pagamento.</b></footer></> : <div className="upgrade-view"><div className="upgrade-summary"><span>PLANO SELECIONADO</span><strong>{upgrade.name}</strong><b>{upgrade.price}<small>/mês</small></b><p>{upgrade.models}</p><small>{upgrade.usage}</small></div>{error && <div className="upgrade-error" role="alert">{error}</div>}<div className="upgrade-actions"><button className="upgrade-back" onClick={() => setUpgrade(null)} disabled={busy}>Voltar</button><button className="upgrade-primary" onClick={checkout} disabled={busy}>{busy ? 'Processando…' : 'Confirmar upgrade'}</button></div></div>}
    </section>
  </div>;
}
