import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const features = [
  ['Vibe Coding & IDE integrada', 'Visualização do projeto, árvore de arquivos e diffs de código enquanto a tarefa acontece.'],
  ['Prism Codex', 'Chat completo com métricas de sessões, mensagens, tokens, dias ativos, streaks e atividade.'],
  ['Prism Home', 'Uma experiência direta, focada em código, para quem quer chegar da ideia à execução sem excesso de interface.'],
  ['Effort Slider', 'Controle do esforço computacional aplicado à tarefa, do padrão ao máximo desempenho.'],
  ['Modo Ultracode', 'Execução simultânea de três motores para projetos exigentes, seguida de síntese dos resultados.'],
];

const plans = [
  ['Grátis', 'R$ 0', 'Acesso limitado aos modelos Mini e Nano'],
  ['Base', 'R$ 8/mês', 'Cota inicial para uso casual'],
  ['Medium', 'R$ 30/mês', 'Cota expandida, modelos Edge e Tex'],
  ['Pro', 'R$ 90/mês', 'Alto volume para desenvolvedores ativos'],
  ['Empresarial', 'R$ 140/mês', 'Ultracode, orquestração paralela e prioridade de servidores'],
];

function Header() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';
  const initials = label.slice(0, 2).toUpperCase();
  return <header className="site-header"><Link to="/" className="site-brand"><span className="site-mark" />PRISM IA</Link><nav><Link className="active" to="/informacoes">Informações</Link><Link to="/modelos">Modelos</Link><Link to="/termos">Termos</Link></nav>{user ? <Link to="/chat" className="site-account"><span>{initials}</span>{label}</Link> : <Link to="/login" className="site-login">Login</Link>}</header>;
}

export default function Info() {
  return <div className="editorial-page"><Header /><main>
    <section className="page-intro"><div className="eyebrow">02 / INFORMAÇÕES</div><h1>Prism IA —<br />engenharia de software<br /><em>com orquestração.</em></h1><p className="lead">A Prism IA é uma plataforma de desenvolvimento que combina, em tempo real, respostas de múltiplos motores de inteligência artificial para gerar código, arquitetura e documentação técnica com mais velocidade e consistência do que o uso isolado de um único modelo.</p></section>
    <section className="split-section"><aside><span>01</span><strong>O que fazemos</strong></aside><div className="reading"><p>Em vez de depender de uma única IA, a Prism IA envia sua solicitação para diferentes motores especializados. Um cuida do raciocínio e planejamento de arquitetura, outro da geração de código em alta velocidade e um terceiro da validação, otimização e revisão. Um módulo sintetizador consolida as respostas em um resultado único.</p><div className="feature-list">{features.map(([title, text], i) => <article key={title}><span>{String(i + 1).padStart(2, '0')}</span><div><h2>{title}</h2><p>{text}</p></div></article>)}</div></div></section>
    <section className="plans-section"><div className="section-label">PLANOS / 05</div><div className="plans-grid">{plans.map(([name, price, text], i) => <article className={i === 4 ? 'plan-dark' : ''} key={name}><span>0{i + 1}</span><h2>{name}</h2><strong>{price}</strong><p>{text}</p></article>)}</div></section>
    <section className="closing-note"><span>PRISM / 2026</span><p>A plataforma foi pensada como uma camada de engenharia: menos tempo trocando entre ferramentas, mais tempo construindo.</p><Link to="/register">Criar uma conta →</Link></section>
  </main></div>;
}
