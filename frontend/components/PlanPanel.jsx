import { useEffect, useState } from 'react';
import './plans-panel.css';

const PLANS = [
  { name:'Grátis', price:'R$0', models:'Mini até HIGH · Nano até HIGH · Edge até MEDIUM', credits:'5 créditos/dia · máximo 30' },
  { name:'Base', price:'R$8', models:'Mini/Nano/Edge até X-HIGH', credits:'30 créditos/dia · máximo 120' },
  { name:'Medium', price:'R$30', models:'Mini/Nano/Edge até MAX · Tex até MEDIUM', credits:'700 créditos/dia · máximo 1000' },
  { name:'Pro', price:'R$90', models:'Mini/Nano/Edge até MAX · Tex/Taff até HIGH', credits:'2000 créditos/dia · máximo 3000' },
  { name:'Empresarial', price:'R$140', models:'Todos os modelos até MAX · Edge EXTRA MAX', credits:'6000 créditos/dia · máximo 9000 · 30 subcontas' },
];

export default function PlanPanel({ open, onClose, currentPlan='Grátis', requestedModel='' }) {
  const [upgrade, setUpgrade] = useState(null);
  useEffect(() => { if (!open) setUpgrade(null); }, [open]);
  if (!open) return null;
  const title = requestedModel ? `${requestedModel} pede um plano acima do seu.` : 'Escolha o plano que acompanha o seu trabalho.';
  return <div className="plans-overlay" role="dialog" aria-modal="true" aria-label="Planos Prism" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
    <section className="plans-panel">
      <header><div><span>PRISM IA / CONTA</span><h2>{upgrade ? `Upgrade para ${upgrade.name}` : 'Planos'}</h2><p>{upgrade ? `Continue com ${upgrade.name} e libere mais espaço de trabalho.` : title}</p></div><button className="plans-close" onClick={onClose}>Fechar</button></header>
      {!upgrade ? <>
        <div className="plans-grid">{PLANS.map(plan=><article className={plan.name===currentPlan?'current':''} key={plan.name}><div className="plan-head"><span>{plan.name}</span>{plan.name===currentPlan&&<small>ATUAL</small>}</div><strong>{plan.price}</strong><p>{plan.models}</p><small>{plan.credits}</small><button disabled={plan.name===currentPlan} onClick={()=>setUpgrade(plan)}>{plan.name===currentPlan?'Plano atual':'Fazer Upgrade'}</button></article>)}</div>
        <footer className="plans-foot"><span>O consumo é calculado pelo trabalho executado, tokens, modelo e nível de pensamento.</span><b>Upgrade sem alterar suas conversas.</b></footer>
      </> : <div className="upgrade-view"><div className="upgrade-summary"><span>PLANO SELECIONADO</span><strong>{upgrade.name}</strong><b>{upgrade.price}<small>/mês</small></b><p>{upgrade.models}</p><small>{upgrade.credits}</small></div><div className="upgrade-actions"><button className="upgrade-back" onClick={()=>setUpgrade(null)}>Voltar aos planos</button><button className="upgrade-primary" onClick={()=>onClose?.()}>Continuar</button></div><p className="upgrade-note">A cobrança ainda não está conectada. A escolha será mantida como intenção de upgrade.</p></div>}
    </section>
  </div>;
}
