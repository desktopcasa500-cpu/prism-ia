import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { modelItems } from '../content/prismTexts.js';
import PrismIcon from '../components/PrismIcon.jsx';

const MODELS = [
  { id: 'nano', route: '/modelos/nano', name: 'Prism Nano 1.0A', providers: ['NVIDIA · GPT-OSS 20B'], required: 0 },
  { id: 'mini', route: '/modelos/mini', name: 'Prism Mini 1.0A', providers: ['NVIDIA · Llama 3.3 Nemotron Super', 'Groq · GPT-OSS 20B'], required: 0 },
  { id: 'edge', route: '/modelos/edge', name: 'Prism Edge 1.0A', providers: ['NVIDIA · Llama 3.1', 'Groq · GPT-OSS 20B (revisão)'], required: 2 },
  { id: 'tex', route: '/modelos/tex', name: 'Prism Tex 1.5A', providers: ['NVIDIA · Qwen 2.5 Code', 'Groq · Qwen 3 32B'], required: 2 },
  { id: 'taff', route: '/prism-taff', name: 'Prism Taff 2.0', providers: ['NVIDIA · Kimi K3', 'Groq · GPT-OSS 120B', 'OpenCode Zen · Big Pickle'], required: 3 },
];

const PLANS = {
  'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2,
  Pro: 3, pro: 3, Empresarial: 4, enterprise: 4,
};

function Header() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';

  return <header className="site-header">
    <Link to="/" className="site-brand"><span className="site-mark" />PRISM IA</Link>
    <nav>
      <Link to="/informacoes">Informações</Link>
      <Link className="active" to="/modelos">Modelos</Link>
      <Link to="/termos">Termos</Link>
    </nav>
    {user
      ? <Link to="/chat" className="site-account"><span>{label.slice(0, 2).toUpperCase()}</span>{label}</Link>
      : <Link to="/login" className="site-login">Login</Link>}
  </header>;
}

function ProviderWindow({ model, locked }) {
  return <span className="model-provider-window">
    <span className="model-provider-window__top">
      <PrismIcon name="layers" size={11} />
      <span>{locked ? 'PLANO SUPERIOR' : 'PROVEDORES'}</span>
    </span>
    <span className="model-provider-window__body">
      {model.providers.map((provider) => <span className="model-provider-chip" key={provider}>{provider}</span>)}
    </span>
  </span>;
}

export default function Models() {
  const { user } = useAuth();
  const entitlement = PLANS[user?.plan] ?? 0;

  return <div className="editorial-page brutal-library">
    <Header />
    <main>
      <section className="page-intro models-intro">
        <div className="eyebrow">03 / MODELOS</div>
        <h1>Uma rota para<br />cada tipo de<br /><em>trabalho.</em></h1>
        <p className="lead">Os nomes Prism representam configurações de orquestração. Abra qualquer modelo para entender exatamente para que ele foi pensado.</p>
      </section>

      <section className="library-list model-library">
        {modelItems.map((item) => {
          const model = MODELS.find((entry) => entry.id === item.id);
          const locked = model ? entitlement < model.required : false;
          const route = model?.route || `/modelos/${item.id}`;
          const name = item.id === 'tex' ? 'Prism Tex 1.5A' : item.name;

          return <Link to={route} className="library-row model-library-row" key={item.id}>
            <span>{item.n}</span>
            <div className="model-library-copy"><h2>{name}</h2><p>{item.summary}</p></div>
            {model && <ProviderWindow model={model} locked={locked} />}
            <small className={locked ? 'model-library-lock' : ''}>{locked ? 'BLOQUEADO' : item.level}</small>
            <b aria-hidden="true">↗</b>
          </Link>;
        })}
      </section>

      <section className="ultra">
        <span>ULTRACODE</span>
        <h2>Três motores.<br />Uma resposta.</h2>
        <p>Ultracode é o nível mais alto de orquestração: raciocínio, geração e validação acontecem simultaneamente antes da síntese final.</p>
      </section>
    </main>
  </div>;
}
