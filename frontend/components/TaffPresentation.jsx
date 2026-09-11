import { useState } from 'react';
import { Link } from 'react-router-dom';
import PrismCodexIntroBrutalist from './PrismCodexIntroBrutalist.jsx';
import { useAuth } from '../lib/auth.jsx';
import { modelItems } from '../content/prismTexts.js';

const TAFF = modelItems.find((item) => item.id === 'taff');

const USE_CASES = [
  { n: '01', title: 'Jogos', body: 'Mecânicas, loops de gameplay e estrutura de projeto prontos para evoluir, não só uma demo estática.' },
  { n: '02', title: 'Sites', body: 'Do layout à responsividade, com componentes reais e organização de projeto pensada para continuar depois do primeiro deploy.' },
  { n: '03', title: 'Backend completo', body: 'Rotas, modelos de dados e integrações — a base de um sistema funcional, não apenas um endpoint isolado.' },
];

function Header() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';
  return <header className="site-header">
    <Link to="/" className="site-brand"><span className="site-mark" />PRISM IA</Link>
    <nav>
      <Link to="/informacoes">Informações</Link>
      <Link to="/modelos">Modelos</Link>
      <Link to="/termos">Termos</Link>
    </nav>
    {user ? <Link to="/chat" className="site-account"><span>{label.slice(0, 2).toUpperCase()}</span>{label}</Link> : <Link to="/login" className="site-login">Login</Link>}
  </header>;
}

export default function TaffPresentation() {
  const { user } = useAuth();
  const [showDemo, setShowDemo] = useState(false);
  const ctaTo = user ? '/chat' : '/register';
  const ctaLabel = user ? 'Usar Prism Taff 2.0' : 'Criar conta e testar';

  return <div className="editorial-page brutal-library taff-page">
    <Header />
    <main>
      <section className="page-intro taff-intro">
        <div className="eyebrow taff-seal">● RELEASE — PRISM TAFF 2.0</div>
        <h1>Pensamento<br/>em <em>velocidade</em><br/>de produção.</h1>
        <p className="lead">{TAFF?.summary}</p>
        <div className="taff-cta-row">
          <Link className="taff-cta-primary" to={ctaTo}>{ctaLabel}</Link>
          <button type="button" className="taff-cta-secondary" onClick={() => setShowDemo(true)}>Ver demonstração</button>
        </div>
      </section>

      <section className="reading taff-about">
        <p>{TAFF?.body}</p>
      </section>

      <section className="feature-list taff-cases">
        {USE_CASES.map((item) => <article key={item.n}>
          <span>{item.n}</span>
          <div><h2>{item.title}</h2><p>{item.body}</p></div>
        </article>)}
      </section>

      <section className="ultra taff-closing">
        <span>DO PEDIDO AO PRODUTO</span>
        <h2>O modelo de<br/>ponta a ponta.</h2>
        <p>Prism Taff 2.0 é o modelo flagship da linha Prism: mais capacidade de processamento, mais camadas de verificação, resultado pronto para revisar e evoluir.</p>
      </section>

      <section className="closing-note taff-final-cta">
        <span>PRÓXIMO PASSO</span>
        <p>Disponível para quem já usa Prism IA e para quem está começando agora.</p>
        <Link to={ctaTo}>{ctaLabel} →</Link>
      </section>
    </main>

    {showDemo && <PrismCodexIntroBrutalist onComplete={() => setShowDemo(false)} />}
  </div>;
}
