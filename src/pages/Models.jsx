import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const models = [
  ['01', 'Prism Nano 1.0A', 'Leve', 'Respostas rápidas, dúvidas pontuais e trechos simples de código. Prioriza velocidade sobre profundidade.'],
  ['02', 'Prism Mini 1.0A', 'Rápido', 'Mais capacidade de manter contexto em tarefas curtas. Ideal para prototipagem rápida.'],
  ['03', 'Prism Edge 1.0A', 'Equilibrado', 'Combina velocidade e raciocínio para tarefas de programação que exigem mais de uma etapa.'],
  ['04', 'Prism Tex 1.0A', 'Técnico', 'Focado em geração e revisão de texto técnico, documentação e explicações longas de arquitetura.'],
  ['05', 'Prism Taff 2.0', 'Flagship', 'O modelo principal. Combina raciocínio, geração de código e validação em paralelo para tarefas complexas.'],
];

function Header() {
  const { user } = useAuth(); const label = user?.name || user?.email?.split('@')[0] || 'Perfil';
  return <header className="site-header"><Link to="/" className="site-brand"><span className="site-mark" />PRISM IA</Link><nav><Link to="/informacoes">Informações</Link><Link className="active" to="/modelos">Modelos</Link><Link to="/termos">Termos</Link></nav>{user ? <Link to="/chat" className="site-account"><span>{label.slice(0, 2).toUpperCase()}</span>{label}</Link> : <Link to="/login" className="site-login">Login</Link>}</header>;
}

export default function Models() {
  return <div className="editorial-page"><Header /><main>
    <section className="page-intro models-intro"><div className="eyebrow">03 / MODELOS</div><h1>Não são apenas<br />modelos.<br /><em>são rotas.</em></h1><p className="lead">Os nomes Prism representam configurações de orquestração. Cada uma combina velocidade, profundidade de raciocínio e custo de processamento de um jeito diferente.</p></section>
    <section className="model-list">{models.map(([num, name, level, text]) => <article key={name}><span className="model-num">{num}</span><div className="model-main"><h2>{name}</h2><p>{text}</p></div><span className="model-level">{level}</span></article>)}</section>
    <section className="effort-section"><div className="section-label">EXECUÇÃO / CONTROLE</div><div><h2>Effort Slider</h2><p>O nível de esforço define quanto processamento paralelo será aplicado a uma tarefa. No nível mais baixo, a prioridade é resposta rápida. Nos níveis altos, a Prism pode chamar mais motores, comparar mais alternativas e gastar mais créditos.</p><div className="effort-bar"><span>STANDARD</span><i /><span>ULTRACODE</span></div></div></section>
    <section className="ultra"><span>ULTRACODE</span><h2>Três motores.<br />Uma resposta.</h2><p>Ultracode não é um modelo separado. É um modo de execução para projetos grandes ou críticos: raciocínio, geração e validação acontecem simultaneamente e um sintetizador consolida o resultado.</p></section>
  </main></div>;
}
