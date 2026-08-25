import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

function Header() {
  const { user } = useAuth(); const label = user?.name || user?.email?.split('@')[0] || 'Perfil';
  return <header className="site-header"><Link to="/" className="site-brand"><span className="site-mark" />PRISM IA</Link><nav><Link to="/informacoes">Informações</Link><Link to="/modelos">Modelos</Link><Link className="active" to="/termos">Termos</Link></nav>{user ? <Link to="/chat" className="site-account"><span>{label.slice(0, 2).toUpperCase()}</span>{label}</Link> : <Link to="/login" className="site-login">Login</Link>}</header>;
}

const terms = [
  ['Roteamento', 'É o processo de decidir, para cada solicitação, quais motores serão chamados, em que ordem e com qual nível de esforço. Nos níveis avançados, a mesma solicitação pode ser enviada em paralelo para diferentes motores.'],
  ['Google Gemini', 'Motor externo usado pela plataforma para planejamento de arquitetura, raciocínio conceitual e estruturação de contexto.'],
  ['Groq', 'Camada de inferência usada para geração de código em alta velocidade e refatoração, utilizando os modelos disponibilizados pela plataforma.'],
  ['NVIDIA NIM', 'Motor utilizado via OpenRouter para etapas de validação, otimização e revisão de segurança.'],
  ['OpenRouter', 'Serviço intermediário que oferece acesso a modelos de diferentes provedores por uma API unificada. A Prism utiliza essa camada para determinados motores.'],
  ['Créditos', 'Unidade de consumo da plataforma. O custo aumenta conforme a quantidade de motores chamados e o nível de esforço aplicado.'],
  ['Tokens', 'Unidades de processamento de texto usadas pelos motores externos. Mais contexto e respostas maiores normalmente significam mais tokens.'],
];

export default function Terms() {
  return <div className="editorial-page"><Header /><main>
    <section className="page-intro terms-intro"><div className="eyebrow">04 / TERMOS</div><h1>Como a Prism<br />decide<br /><em>o que chamar.</em></h1><p className="lead">A Prism IA não treina seus próprios modelos de linguagem. Ela funciona como uma camada de orquestração sobre APIs de terceiros: recebe a solicitação, roteia a tarefa e combina as respostas.</p></section>
    <section className="terms-reading"><div className="terms-statement"><span>NOTA</span><p>Os modelos Prism — Nano, Mini, Edge, Tex e Taff — são perfis de roteamento. Eles definem quais motores externos são chamados, com que peso e com qual esforço.</p></div><div className="terms-list">{terms.map(([name, text], i) => <article key={name}><span>{String(i + 1).padStart(2, '0')}</span><div><h2>{name}</h2><p>{text}</p></div></article>)}</div></section>
    <section className="privacy-note"><div><span>DADOS / ISOLAMENTO</span><h2>Cada conta tem<br />seu próprio espaço.</h2></div><p>A plataforma usa isolamento por usuário para que mensagens, tokens, histórico e métricas não sejam misturados entre contas. A disponibilidade dos motores externos pode variar conforme seus próprios provedores atualizam os serviços. A Prism trata essas diferenças com filas, limites de uso e controle de requisições.</p></section>
    <section className="closing-note"><span>PRISM / 2026</span><p>Transparência sobre a tecnologia faz parte do produto. Estes termos descrevem a arquitetura de roteamento da plataforma em linguagem direta.</p><Link to="/">Voltar para a página inicial →</Link></section>
  </main></div>;
}
