import { Link, useParams } from 'react-router-dom';
import { infoItems, modelItems } from '../content/prismTexts.js';

function TaffReleasePage({ item }) {
  return <div className="editorial-page taff-release-page">
    <header className="site-header">
      <Link to="/" className="site-brand"><span className="site-mark" />PRISM IA</Link>
      <nav><Link to="/informacoes">Informações</Link><Link className="active" to="/modelos">Modelos</Link><Link to="/termos">Termos</Link></nav>
      <Link to="/login" className="site-login">Login</Link>
    </header>
    <main>
      <section className="taff-release-hero">
        <div className="taff-release-hero__meta"><span>05 / MODELOS</span><b>RELEASE</b></div>
        <h1>TAFF<br /><em>2.0</em></h1>
        <p className="taff-release-hero__lead">Pensamento que não perde velocidade. O modelo de topo da Prism para transformar problemas complexos em trabalho executável.</p>
        <div className="taff-release-hero__actions">
          <Link className="taff-release-button taff-release-button--dark" to="/codex">Usar TAFF 2.0</Link>
          <Link className="taff-release-button" to="/configuracoes">Fazer upgrade</Link>
        </div>
      </section>

      <section className="taff-release-intro">
        <div className="taff-release-intro__label">A IDEIA</div>
        <div>
          <h2>Mais raciocínio.<br />Sem abrir mão do ritmo.</h2>
          <p>{item.summary} O TAFF 2.0 foi desenhado para tarefas em que planejamento, contexto e execução precisam permanecer conectados até a entrega.</p>
        </div>
      </section>

      <section className="taff-release-pillars">
        <article><span>01</span><div><strong>PENSAMENTO</strong><h3>Entende o problema antes de correr.</h3><p>Organiza contexto, identifica dependências, compara caminhos e transforma uma solicitação ampla em decisões técnicas utilizáveis.</p></div></article>
        <article><span>02</span><div><strong>VELOCIDADE</strong><h3>Entrega sem transformar profundidade em espera.</h3><p>Depois de definir o caminho, mantém o foco na implementação, reduzindo a distância entre a primeira ideia e um resultado que você consegue usar.</p></div></article>
      </section>

      <section className="taff-release-usecases">
        <div className="taff-release-usecases__head"><span>ONDE ELE RENDE MAIS</span><h2>Três terrenos.<br /><em>Um mesmo motor.</em></h2></div>
        <div className="taff-release-usecases__grid">
          <article><span>JOGOS</span><h3>Do sistema ao gameplay.</h3><p>Arquitetura, lógica, ferramentas e código para projetos com muitas partes que precisam conversar entre si.</p></article>
          <article><span>SITES</span><h3>Da ideia à interface.</h3><p>Landing pages, produtos completos e experiências responsivas quando qualidade visual e implementação precisam andar juntas.</p></article>
          <article><span>BACKEND</span><h3>Da regra ao serviço.</h3><p>APIs, integrações, persistência e estrutura de aplicação para fluxos que pedem consistência e manutenção.</p></article>
        </div>
      </section>

      <section className="taff-release-close">
        <div><span>PRISM TAFF 2.0</span><h2>Quando o projeto<br />fica sério.</h2></div>
        <div><p>Escolha o TAFF quando a tarefa exigir mais contexto, mais decisões e uma execução ponta a ponta. Para dúvidas curtas, os modelos menores continuam sendo a escolha mais eficiente.</p><div className="taff-release-close__actions"><Link to="/codex">Abrir no Codex →</Link><Link to="/modelos">Voltar aos modelos</Link></div></div>
      </section>
    </main>
  </div>;
}

export default function PrismDetail({ type }) {
  const { id } = useParams();
  const items = type === 'models' ? modelItems : infoItems;
  const item = items.find((entry) => entry.id === id) || (type === 'models' && id === 'taff-2-0' ? modelItems.find((entry) => entry.id === 'taff') : null);
  if (type === 'models' && item?.id === 'taff') return <TaffReleasePage item={item} />;
  if (!item) return <main className="detail-page"><Link to={type === 'models' ? '/modelos' : '/informacoes'}>Voltar</Link><h1>Não encontrado.</h1></main>;
  return <div className="detail-page brutal-detail">
    <header className="detail-nav"><Link className="detail-brand" to="/">PRISM IA</Link><Link className="detail-back" to={type === 'models' ? '/modelos' : '/informacoes'}>← voltar</Link></header>
    <main className="detail-main">
      <div className="detail-index">{item.n} / {type === 'models' ? item.level : 'INFORMAÇÃO'}</div>
      <h1>{item.title || item.name}</h1>
      <p className="detail-summary">{item.summary}</p>
      <div className="detail-rule" />
      <p className="detail-body">{item.body}</p>
      <Link className="detail-next" to={type === 'models' ? '/modelos' : '/informacoes'}>Ver todos →</Link>
    </main>
  </div>;
}
