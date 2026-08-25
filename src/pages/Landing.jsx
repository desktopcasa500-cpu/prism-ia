import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const features = [
  ['Vibe Coding & IDE integrada', 'Projeto visível em tempo real, árvore de arquivos e diffs de código sem tirar o foco da tarefa.'],
  ['Prism Codex', 'Chat completo com métricas de sessões, mensagens, tokens consumidos, dias ativos, streaks e heatmap.'],
  ['Prism Home', 'Uma experiência minimalista focada em código para quem quer objetividade e pouca interface entre a ideia e a execução.'],
  ['Effort Slider', 'Controle do esforço computacional aplicado a cada tarefa, do padrão ao máximo desempenho com Ultracode.'],
  ['Modo Ultracode', 'Execução paralela em três motores para projetos exigentes, com síntese automática das respostas.'],
];

const models = [
  ['01', 'Prism Nano 1.0A', 'O nível mais leve. Respostas rápidas, dúvidas pontuais e trechos simples de código.'],
  ['02', 'Prism Mini 1.0A', 'Mais contexto para prototipagem rápida e tarefas curtas de programação.'],
  ['03', 'Prism Edge 1.0A', 'Equilíbrio entre velocidade e raciocínio para programação em várias etapas.'],
  ['04', 'Prism Tex 1.0A', 'Geração e revisão de texto técnico, documentação e explicações de arquitetura.'],
  ['05', 'Prism Taff 2.0', 'Flagship da plataforma, com raciocínio, geração e validação trabalhando em paralelo.'],
];

const plans = [
  ['01', 'Grátis', 'R$ 0', 'Acesso limitado aos modelos Mini e Nano.'],
  ['02', 'Base', 'R$ 8/mês', 'Cota inicial para uso casual.'],
  ['03', 'Medium', 'R$ 30/mês', 'Cota expandida, modelos Edge e Tex.'],
  ['04', 'Pro', 'R$ 90/mês', 'Alto volume para desenvolvedores ativos.'],
  ['05', 'Empresarial', 'R$ 140/mês', 'Ultracode, orquestração paralela total e prioridade de servidores.'],
];

function initials(user) {
  const source = user?.name || user?.email || 'P';
  return source.trim().slice(0, 2).toUpperCase();
}

export default function Landing() {
  const { user } = useAuth();
  const profileLabel = user?.name || user?.email?.split('@')[0] || 'Perfil';

  return (
    <div className="pixel-landing">
      <header className="pixel-nav">
        <Link className="pixel-brand" to="/" aria-label="Prism IA">
          <span className="pixel-logo" aria-hidden="true" />
          <span>PRISM IA</span>
        </Link>
        <nav className="pixel-navlinks" aria-label="Navegação principal">
          <a href="#informacoes">Informações</a>
          <a href="#modelos">Modelos</a>
          <a href="#termos">Termos</a>
        </nav>
        {user ? (
          <Link className="pixel-profile" to="/chat" aria-label="Abrir perfil">
            <span className="pixel-avatar">{initials(user)}</span>
            <span>{profileLabel}</span>
          </Link>
        ) : (
          <Link className="pixel-login" to="/login">Login</Link>
        )}
      </header>

      <main>
        <section className="pixel-hero" aria-labelledby="hero-title">
          <div className="pixel-hero-main">
            <div className="pixel-kicker">PRISM IA / ENGENHARIA DE SOFTWARE / 01</div>
            <h1 id="hero-title" className="pixel-title">
              <span>ENGENHARIA</span>
              <span>DE SOFTWARE</span>
              <span className="accent">COM IA.</span>
            </h1>
            <p className="pixel-hero-copy">
              Orquestração paralela de IA para gerar código, arquitetura e documentação com múltiplos motores trabalhando na mesma tarefa.
            </p>
            <div className="pixel-hero-actions">
              <Link className="pixel-cta" to={user ? '/chat' : '/register'}>{user ? 'Abrir plataforma' : 'Criar conta grátis'}</Link>
              <a className="pixel-cta secondary" href="#informacoes">Conhecer a Prism</a>
            </div>
          </div>
          <aside className="pixel-hero-side">
            <div className="pixel-side-copy">
              <strong>PRISM / SISTEMA</strong>
              Uma camada de orquestração que reúne raciocínio, geração, validação e otimização em um único fluxo.
            </div>
            <div className="pixel-grid-art" aria-label="Composição gráfica pixelada da Prism IA" />
          </aside>
        </section>

        <section id="informacoes" className="pixel-section">
          <div className="pixel-section-head">
            <div className="pixel-section-index">02 / INFORMAÇÕES</div>
            <div className="pixel-section-title">Prism IA — Engenharia de software com orquestração paralela de IA</div>
          </div>
          <div className="pixel-info-grid">
            <div className="pixel-copy">
              <h2>Uma plataforma construída para fazer software.</h2>
              <p>A Prism IA é uma plataforma de desenvolvimento que combina, em tempo real, as respostas de múltiplos motores de inteligência artificial para gerar código, arquitetura e documentação técnica com mais velocidade e consistência do que o uso isolado de um único modelo.</p>
              <p>Em vez de depender de uma única IA, a Prism IA envia sua solicitação em paralelo para diferentes motores especializados — um cuida do raciocínio e planejamento de arquitetura, outro da geração de código em alta velocidade, e um terceiro da validação, otimização e revisão de segurança. Um módulo sintetizador consolida essas respostas em um resultado único.</p>
              <div className="pixel-list">
                {features.map(([title, description]) => (
                  <article key={title}><b>{title}</b><p>{description}</p></article>
                ))}
              </div>
            </div>
            <div className="pixel-side-stack">
              <div className="pixel-side-card"><h3>Planos</h3><p>Escolha a cota de processamento que combina com a sua frequência de uso. O nível de esforço e a quantidade de motores usados alteram o consumo.</p></div>
              <div className="pixel-side-card"><h3>Orquestração</h3><p>Uma solicitação pode ser dividida entre planejamento, código e validação. O sintetizador compara as respostas antes de apresentar o resultado.</p></div>
              <div className="pixel-side-card"><h3>Dados</h3><p>As contas são isoladas. Histórico, mensagens, tokens e métricas pertencem ao usuário autenticado correspondente.</p></div>
            </div>
          </div>
          <div className="pixel-plans">
            {plans.map(([number, name, price, description], index) => (
              <article className={`pixel-plan ${index === 4 ? 'featured' : ''}`} key={name}>
                <small>{number} / PLANO</small><h3>{name}</h3><div className="pixel-price">{price}</div><p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="modelos" className="pixel-section">
          <div className="pixel-section-head">
            <div className="pixel-section-index">03 / MODELOS</div>
            <div className="pixel-section-title">Conheça os modelos da Prism IA</div>
          </div>
          <div className="pixel-models">
            {models.map(([number, name, description]) => (
              <article className="pixel-model" key={name}>
                <span className="pixel-model-number">{number}</span>
                <h3>{name}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="pixel-copy">
            <p><strong>Modo Ultracode.</strong> Não é um modelo separado, e sim um modo de execução. Ele ativa os três motores simultaneamente com máximo esforço computacional para projetos grandes ou críticos.</p>
            <p><strong>Effort Slider.</strong> Permite escolher quanto poder de processamento paralelo será usado. Mais esforço tende a produzir respostas mais elaboradas, porém mais lentas e com maior consumo de créditos.</p>
          </div>
        </section>

        <section id="termos" className="pixel-section">
          <div className="pixel-section-head">
            <div className="pixel-section-index">04 / TERMOS</div>
            <div className="pixel-section-title">Termos técnicos e roteamento</div>
          </div>
          <div className="pixel-terms">
            <div className="pixel-term-nav">
              <div>ROTEAMENTO</div><div>MOTORES</div><div>OPENROUTER</div><div>CRÉDITOS</div>
            </div>
            <div className="pixel-term-body">
              <h2>Como funciona o roteamento.</h2>
              <p><strong>Importante:</strong> a Prism IA não treina seus próprios modelos de linguagem. A plataforma funciona como uma camada de orquestração sobre APIs de terceiros: recebe sua solicitação, decide para quais motores externos enviá-la e combina as respostas recebidas.</p>
              <p>Os modelos Prism — Nano, Mini, Edge, Tex e Taff — são perfis de roteamento. Cada perfil define quais motores externos são chamados, em que ordem, com que peso e com qual nível de esforço.</p>
              <ul>
                <li><strong>Google Gemini</strong> Planejamento de arquitetura, raciocínio conceitual e estruturação de contexto.</li>
                <li><strong>Groq</strong> Geração de código em alta velocidade e refatoração usando os modelos disponibilizados pela plataforma.</li>
                <li><strong>NVIDIA NIM</strong> Acesso via OpenRouter para validação, otimização e revisão de segurança.</li>
                <li><strong>Roteamento</strong> Decide para cada solicitação quais motores serão chamados. Nos níveis avançados, eles podem trabalhar em paralelo e ter suas respostas sintetizadas.</li>
                <li><strong>OpenRouter</strong> Serviço intermediário que oferece acesso a diferentes modelos e provedores por uma API unificada.</li>
                <li><strong>Créditos e tokens</strong> Cada chamada consome uma cota de tokens. Mais motores em paralelo e maior esforço significam maior consumo de créditos.</li>
              </ul>
              <p>A disponibilidade e o comportamento dos motores externos podem mudar conforme seus provedores atualizam os próprios sistemas. A Prism IA trata isso com filas de requisição, limites de uso e isolamento de dados por usuário.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="pixel-footer">
        <span>PRISM IA / ENGENHARIA DE SOFTWARE COM ORQUESTRAÇÃO PARALELA</span>
        <span><Link to={user ? '/chat' : '/login'}>{user ? 'Abrir plataforma' : 'Login'}</Link> / 2026</span>
      </footer>
    </div>
  );
}
