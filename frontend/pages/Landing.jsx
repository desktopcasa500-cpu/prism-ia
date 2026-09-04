import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import PrismInstrument from '../components/PrismInstrument.jsx';
import PrismScrollStory from '../components/PrismScrollStory.jsx';
import PrismNews from '../components/PrismNews.jsx';
import '../prism-instrument-landing.css';

const process = [
  ['1', 'Pedido', 'Você descreve o que precisa em linguagem comum, com o nível de detalhe que já tiver.'],
  ['2', 'Roteamento', 'A tarefa é dividida e distribuída entre os motores mais adequados a cada parte dela.'],
  ['3', 'Construção', 'Código, texto e decisões são produzidos dentro do mesmo espaço de trabalho, com histórico.'],
  ['4', 'Revisão', 'O resultado chega pronto para ser lido, testado e ajustado — não como um rascunho a interpretar.'],
];

const surfaces = [
  ['Conversa', 'Chat', 'Peça, refine e continue um raciocínio sem perder o que já foi decidido antes.'],
  ['Projeto', 'Codex', 'Arquivos, alterações e pré-visualização convivem no mesmo lugar em que o código é escrito.'],
  ['Distribuição', 'Roteamento', 'Partes diferentes de uma tarefa podem ser resolvidas por motores diferentes, em paralelo.'],
  ['Entrega', 'Revisão', 'O que sai da Prism é algo para usar — não uma resposta a ser reescrita por você.'],
];

const quickLinks = [
  ['Informações', 'O que existe por trás da Prism e como a plataforma organiza o trabalho.', '/informacoes'],
  ['Modelos', 'Cada modelo Prism e a função que ele cumpre dentro do sistema.', '/modelos'],
  ['Termos', 'Roteamento, motores, créditos, privacidade e limites, sem esconder a mecânica.', '/termos'],
];

function initials(user) {
  const text = user?.name || user?.email || 'P';
  return text.trim().slice(0, 2).toUpperCase();
}

export default function Landing() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';
  const primaryHref = user ? '/chat' : '/login';
  const primaryLabel = user ? 'Abrir a Prism' : 'Entrar e usar a IA';

  return (
    <div className="instrument-landing">
      <header className="lab-nav">
        <Link className="lab-brand" to="/" aria-label="Prism IA">
          <span className="mark" />
          <span>Prism IA</span>
        </Link>
        <nav className="lab-navlinks">
          <Link to="/informacoes">Informações</Link>
          <Link to="/modelos">Modelos</Link>
          <Link to="/termos">Termos</Link>
        </nav>
        {user ? (
          <Link className="lab-profile" to="/chat">
            <span className="lab-avatar">{initials(user)}</span>
            <span>{label}</span>
          </Link>
        ) : (
          <Link className="lab-login" to="/login">Entrar</Link>
        )}
      </header>

      <main>
        <section className="lab-hero">
          <div className="lab-hero-copy">
            <div className="lab-hero-tag">engenharia de software / múltiplos motores de IA</div>
            <h1 className="lab-hero-title">
              A mesma tarefa,<br /><em>vista por vários ângulos.</em>
            </h1>
            <p className="lab-hero-text">
              A Prism divide um pedido entre diferentes motores de IA, cada um resolvendo a parte para a qual é mais indicado, e devolve um resultado único, pronto para revisar.
            </p>
            <div className="lab-hero-actions">
              <Link className="lab-btn lab-btn-primary" to={primaryHref}>{primaryLabel}</Link>
              {!user && <Link className="lab-btn lab-btn-ghost" to="/register">Criar conta</Link>}
            </div>
            <div className="lab-hero-spec">
              <div><b>Superfícies</b>Chat, Codex, Studio</div>
              <div><b>Modo</b>Roteamento paralelo</div>
              <div><b>Saída</b>Revisável desde o início</div>
            </div>
          </div>
          <div className="lab-hero-stage">
            <PrismInstrument className="lab-instrument" />
            <div className="lab-stage-caption">
              <span>índice de refração 1.52</span>
              <span>mova o cursor para inspecionar</span>
            </div>
          </div>
        </section>

        <PrismScrollStory />

        <section className="lab-intro">
          <div className="lab-intro-label">a ideia</div>
          <div className="lab-intro-body">
            <h2>Você descreve o problema. A Prism organiza o trabalho.</h2>
            <p>
              O pedido vira etapas de raciocínio, escrita, código e verificação, e cada etapa é encaminhada ao motor mais indicado para resolvê-la — sem que você precise saber qual é qual.
            </p>
          </div>
        </section>

        <section className="lab-process">
          <div className="lab-process-head">
            <h2>Como um pedido vira entrega</h2>
            <span>quatro etapas, sempre nesta ordem</span>
          </div>
          <div className="lab-process-row">
            {process.map(([n, title, text]) => (
              <div className="lab-process-step" key={n}>
                <span className="num">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lab-surfaces">
          <div className="lab-surfaces-head">
            <h2>Um espaço de trabalho, quatro funções.</h2>
            <p>Nenhuma delas exige abrir outra ferramenta para continuar o que já estava em andamento.</p>
          </div>
          <div className="lab-surfaces-grid">
            {surfaces.map(([tag, title, text]) => (
              <article className="lab-surface-card" key={title}>
                <span className="tag">{tag}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="lab-links">
          {quickLinks.map(([title, text, href]) => (
            <Link to={href} className="lab-link-row" key={title}>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <span className="go">abrir</span>
            </Link>
          ))}
        </div>

        <PrismNews />

        <section className="lab-system">
          <div className="lab-system-copy">
            <h2>Não é uma IA. É um fluxo entre várias.</h2>
            <p>
              Os modelos Prism são perfis de roteamento, não personalidades diferentes. Em tarefas simples, um motor já resolve. Em tarefas complexas, vários trabalham em paralelo e têm suas respostas comparadas antes da entrega.
            </p>
            <Link to="/termos">Entender o roteamento</Link>
          </div>
          <div className="lab-system-diagram">
            <svg>
              <line x1="18%" y1="20%" x2="50%" y2="50%" />
              <line x1="82%" y1="20%" x2="50%" y2="50%" />
              <line x1="18%" y1="80%" x2="50%" y2="50%" />
              <line x1="82%" y1="80%" x2="50%" y2="50%" />
            </svg>
            <div className="node n1">raciocínio</div>
            <div className="node n2">código</div>
            <div className="node n3">verificação</div>
            <div className="node n4">síntese</div>
            <div className="node n-mid">roteador</div>
          </div>
        </section>

        <section className="lab-principle">
          <div className="lab-principle-label">princípio</div>
          <div>
            <h2>Uma ferramenta não precisa parecer uma máquina para fazer trabalho de máquina.</h2>
            <p>
              A interface fica no caminho apenas quando é necessário. Ela mostra o que importa, mantém o projeto acessível e deixa a próxima decisão com quem está trabalhando.
            </p>
          </div>
        </section>

        <section className="lab-close">
          <h2>Pronto para construir?</h2>
          <div className="lab-close-actions">
            <Link className="lab-btn lab-btn-primary" to={primaryHref}>{primaryLabel}</Link>
            {!user && <Link className="lab-btn lab-btn-ghost" to="/register">Criar uma conta</Link>}
          </div>
        </section>
      </main>

      <footer className="lab-footer">
        <span>Prism IA — engenharia de software</span>
        <span><Link to="/informacoes">Informações</Link> · <Link to="/modelos">Modelos</Link> · <Link to="/termos">Termos</Link></span>
      </footer>
    </div>
  );
}
