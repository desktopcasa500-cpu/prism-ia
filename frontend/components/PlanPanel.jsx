import { useEffect, useState } from 'react';
import './plans-panel.css';

const PLANS = [
  { name: 'Grátis', price: 'R$0', models: 'Prism Mini e Nano · acesso essencial', usage: 'Créditos diários renovados a cada novo dia' },
  { name: 'Base', price: 'R$8', models: 'Prism Mini e Nano · prioridade de fila padrão', usage: 'Mais créditos diários e uma cota semanal proporcional' },
  { name: 'Medium', price: 'R$30', models: 'Prism Edge e Tex · maior capacidade', usage: 'Cota diária maior com limite semanal proporcional' },
  { name: 'Pro', price: 'R$90', models: 'Edge, Tex e Taff · programação intensiva', usage: 'Capacidade alta, prioridade e fundos extras elegíveis' },
  { name: 'Empresarial', price: 'R$140', models: 'Todos os modelos · Ultracode disponível', usage: 'Maior capacidade e fundos extras com desbloqueio semanal' },
];

export default function PlanPanel({ open, onClose, currentPlan = 'Grátis', requestedModel = '' }) {
  const [upgrade, setUpgrade] = useState(null);
  useEffect(() => { if (!open) setUpgrade(null); }, [open]);
  if (!open) return null;
  const title = requestedModel ? `${requestedModel} pede um plano acima do seu.` : 'Escolha o plano que acompanha o seu trabalho.';
  return <div className="plans-overlay" role="dialog" aria-modal="true" aria-label="Planos Prism" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
    <section className="plans-panel">
      <header><div><span>PRISM IA / CONTA</span><h2>{upgrade ? `Upgrade para ${upgrade.name}` : 'Planos'}</h2><p>{upgrade ? `Continue com ${upgrade.name} e libere mais capacidade.` : title}</p></div><button className="plans-close" onClick={onClose}>Fechar</button></header>
      {!upgrade ? <>
        <div className="plans-grid">{PLANS.map((plan) => <article className={plan.name === currentPlan ? 'current' : ''} key={plan.name}><div className="plan-head"><span>{plan.name}</span>{plan.name === currentPlan && <small>ATUAL</small>}</div><strong>{plan.price}</strong><p>{plan.models}</p><small>{plan.usage}</small><button disabled={plan.name === currentPlan} onClick={() => setUpgrade(plan)}>{plan.name === currentPlan ? 'Plano atual' : 'Fazer Upgrade'}</button></article>)}</div>
        <footer className="plans-foot"><span>Seu uso combina créditos diários e uma cota semanal. Os créditos são calculados por solicitações realizadas.</span><b>Os limites acompanham o plano e o fuso horário da sua conta.</b></footer>
      </> : <div className="upgrade-view"><div className="upgrade-summary"><span>PLANO SELECIONADO</span><strong>{upgrade.name}</strong><b>{upgrade.price}<small>/mês</small></b><p>{upgrade.models}</p><small>{upgrade.usage}</small></div><div className="upgrade-actions"><button className="upgrade-back" onClick={() => setUpgrade(null)}>Voltar aos planos</button><button className="upgrade-primary" onClick={() => onClose?.()}>Continuar</button></div><p className="upgrade-note">A cobrança ainda não está conectada. A escolha será mantida como intenção de upgrade.</p></div>}
    </section>
  </div>;
}
