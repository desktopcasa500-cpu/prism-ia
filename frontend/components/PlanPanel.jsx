import './plans-panel.css';

const PLANS=[
 {name:'Grátis',price:'R$0',models:'Mini/Nano até HIGH · Edge até MEDIUM',credits:'5 créditos/dia · máximo 30'},
 {name:'Base',price:'R$8',models:'Mini/Nano/Edge até X-HIGH',credits:'30 créditos/dia · máximo 120'},
 {name:'Medium',price:'R$30',models:'Mini/Nano/Edge até MAX · Tex até MEDIUM',credits:'700 créditos/dia · máximo 1000'},
 {name:'Pro',price:'R$90',models:'Mini/Nano/Edge até MAX · Tex/Taff até HIGH',credits:'2000 créditos/dia · máximo 3000'},
 {name:'Empresarial',price:'R$140',models:'Todos os modelos até MAX · Edge EXTRA MAX',credits:'6000 créditos/dia · máximo 9000 · até 30 subcontas'}
];
export default function PlanPanel({open,onClose,currentPlan='Grátis'}){
 if(!open)return null;
 return <div className="plans-overlay" role="dialog" aria-modal="true" aria-label="Planos Prism" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}><section className="plans-panel"><header><div><span>PRISM / CONTA</span><h2>Planos</h2><p>Seu plano atual: <b>{currentPlan}</b></p></div><button onClick={onClose}>Fechar</button></header><div className="plans-grid">{PLANS.map(plan=><article className={plan.name===currentPlan?'current':''} key={plan.name}><div className="plan-head"><span>{plan.name}</span>{plan.name===currentPlan&&<small>ATUAL</small>}</div><strong>{plan.price}</strong><p>{plan.models}</p><small>{plan.credits}</small><button disabled={plan.name===currentPlan}>{plan.name===currentPlan?'Plano atual':'Fazer Upgrade'}</button></article>)}</div><div className="plans-foot"><span>Créditos são consumidos dinamicamente por tokens, complexidade, modelos e nível de pensamento.</span><b>Stripe preparado · cobrança real desativada</b></div></section></div>;
}
