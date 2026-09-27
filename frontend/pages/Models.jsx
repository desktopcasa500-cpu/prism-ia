import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { modelItems } from '../content/prismTexts.js';
import PrismIcon from '../components/PrismIcon.jsx';

const MODELS = [
  { id: 'nano', route: '/modelos/nano', name: 'Prism Nano 1.0A', providers: ['NVIDIA · Nemotron Lightning 30B'], required: 0 },
  { id: 'mini', route: '/modelos/mini', name: 'Prism Mini 1.0A', providers: ['NVIDIA · Nemotron Ultra 550B', 'Groq · GPT-OSS 20B'], required: 0 },
  { id: 'edge', route: '/modelos/edge', name: 'Prism Edge 1.0A', providers: ['NVIDIA · Nemotron Lightning 30B', 'Groq · GPT-OSS 20B'], required: 2 },
  { id: 'tex', route: '/modelos/tex', name: 'Prism Tex 1.5A', providers: ['NVIDIA · Kimi K3', 'Groq · GPT-OSS 120B'], required: 2 },
  { id: 'taff', route: '/modelos/taff-2-0', name: 'Prism Taff 2.0', providers: ['NVIDIA · Kimi K3', 'Groq · GPT-OSS 120B', 'OpenCode Zen · Big Pickle'], required: 3 },
];

const EXTERNAL_MODELS = [
  { provider: 'Anthropic', mark: 'A', model: 'Claude Fable 5.1', id: 'claude-fable-5-1', kind: 'Raciocínio / agentes', note: 'Long-horizon agentic work', url: 'https://platform.claude.com/docs/en/models/overview' },
  { provider: 'Anthropic', mark: 'A', model: 'Claude Opus 5.5', id: 'claude-opus-5-5', kind: 'Coding / agentes', note: 'Long-running coding and knowledge work', url: 'https://platform.claude.com/docs/en/models/overview' },
  { provider: 'Anthropic', mark: 'A', model: 'Claude Sonnet 5', id: 'claude-sonnet-5', kind: 'Geral / coding', note: 'Speed and intelligence balance', url: 'https://platform.claude.com/docs/en/models/overview' },
  { provider: 'Anthropic', mark: 'A', model: 'Claude Haiku 4.5', id: 'claude-haiku-4-5', kind: 'Velocidade', note: 'Fast, lower-latency workloads', url: 'https://platform.claude.com/docs/en/models/overview' },

  { provider: 'OpenAI', mark: 'O', model: 'GPT-6 Astra', id: 'gpt-6-astra', kind: 'Raciocínio / coding', note: 'Complex end-to-end work', url: 'https://developers.openai.com/api/docs/models' },
  { provider: 'OpenAI', mark: 'O', model: 'GPT-6 Sol', id: 'gpt-6-sol', kind: 'Agentes / coding', note: 'Complex coding and agentic workflows', url: 'https://developers.openai.com/api/docs/models' },
  { provider: 'OpenAI', mark: 'O', model: 'GPT-6 Luna', id: 'gpt-6-luna', kind: 'Alta escala', note: 'Focused, high-volume tasks', url: 'https://developers.openai.com/api/docs/models' },

  { provider: 'Google', mark: 'G', model: 'Gemini 3.8 Flash', id: 'gemini-3.8-flash', kind: 'Software / agentes', note: 'Long-horizon software engineering', url: 'https://ai.google.dev/gemini-api/docs/models' },
  { provider: 'Google', mark: 'G', model: 'Gemini 3.8 Live', id: 'gemini-3.8-live', kind: 'Voz / tempo real', note: 'Low-latency live dialogue', url: 'https://ai.google.dev/gemini-api/docs/models' },
  { provider: 'Google', mark: 'G', model: 'Gemini 3.8 Live Extended Thinking', id: 'gemini-3.8-live-extended-thinking', kind: 'Voz / raciocínio', note: 'High-reasoning live interaction', url: 'https://ai.google.dev/gemini-api/docs/models' },
  { provider: 'Google', mark: 'G', model: 'Gemini 3.7 Flash', id: 'gemini-3.7-flash', kind: 'Coding / agentes', note: 'Reliable multi-step execution', url: 'https://ai.google.dev/gemini-api/docs/models' },
  { provider: 'Google', mark: 'G', model: 'Nano Banana 2', id: 'gemini-3.1-flash-image', kind: 'Imagem', note: 'Generation and editing', url: 'https://ai.google.dev/gemini-api/docs/models' },

  { provider: 'Mistral', mark: 'M', model: 'Mistral Medium 3.5', id: 'mistral-medium-3.5', kind: 'Multimodal / agentes', note: 'Frontier-class model for agentic and coding use', url: 'https://docs.mistral.ai/models' },
  { provider: 'Mistral', mark: 'M', model: 'Mistral Small 4', id: 'mistral-small-4', kind: 'Geral / reasoning', note: 'Instruct, reasoning and coding in one model', url: 'https://docs.mistral.ai/models' },
  { provider: 'Mistral', mark: 'M', model: 'Mistral Large 3', id: 'mistral-large-3', kind: 'Multimodal', note: 'Open-weight general-purpose model', url: 'https://docs.mistral.ai/models' },
  { provider: 'Mistral', mark: 'M', model: 'Codestral', id: 'codestral', kind: 'Código', note: 'Code generation and completion', url: 'https://docs.mistral.ai/models' },
  { provider: 'Mistral', mark: 'M', model: 'OCR 4.1', id: 'mistral-ocr-4-1', kind: 'Documentos / OCR', note: 'Structured document understanding', url: 'https://docs.mistral.ai/models' },
  { provider: 'Mistral', mark: 'M', model: 'Voxtral Mini Transcribe 2', id: 'voxtral-mini-transcribe-2', kind: 'Áudio', note: 'Efficient transcription', url: 'https://docs.mistral.ai/models' },

  { provider: 'xAI', mark: 'X', model: 'Grok 4.7', id: 'grok-4.7', kind: 'Coding / agentes', note: 'Agentic tool calling and configurable reasoning', url: 'https://docs.x.ai/developers/models' },
  { provider: 'xAI', mark: 'X', model: 'Grok Imagine Image 2.0', id: 'grok-imagine-image-2.0', kind: 'Imagem', note: 'Generation and editing', url: 'https://docs.x.ai/developers/models' },
  { provider: 'xAI', mark: 'X', model: 'Grok Imagine Video 1.5', id: 'grok-imagine-video-1.5', kind: 'Vídeo', note: 'Video generation', url: 'https://docs.x.ai/developers/models' },

  { provider: 'Meta', mark: 'L', model: 'Llama 4 Scout', id: 'llama-4-scout', kind: 'Multimodal / open-weight', note: '10M context; efficient deployment', url: 'https://ai.meta.com/llama/get-started/' },
  { provider: 'Meta', mark: 'L', model: 'Llama 4 Maverick', id: 'llama-4-maverick', kind: 'Multimodal / open-weight', note: 'Fast multimodal responses', url: 'https://ai.meta.com/llama/get-started/' },
  { provider: 'Meta', mark: 'L', model: 'Llama Guard 4', id: 'llama-guard-4', kind: 'Segurança', note: 'Protection model for Llama 4', url: 'https://ai.meta.com/llama/get-started/' },

  { provider: 'DeepSeek', mark: 'D', model: 'DeepSeek V4.1 Flash', id: 'deepseek-flash', kind: 'Multimodal / agentes', note: '1M context and thinking modes', url: 'https://api-docs.deepseek.com/quick_start/pricing' },
  { provider: 'DeepSeek', mark: 'D', model: 'DeepSeek V4 Pro', id: 'deepseek-v4-pro', kind: 'Raciocínio / coding', note: '1M context and tool calls', url: 'https://api-docs.deepseek.com/quick_start/pricing' },
];

const PLANS = {
  'Grátis': 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2,
  Pro: 3, pro: 3, Empresarial: 4, enterprise: 4,
};

const PROVIDERS = ['Todos', 'Anthropic', 'OpenAI', 'Google', 'Mistral', 'xAI', 'Meta', 'DeepSeek'];

function Header() {
  const { user } = useAuth();
  const label = user?.name || user?.email?.split('@')[0] || 'Perfil';

  return <header className="site-header">
    <Link to="/" className="site-brand"><img src="/prism-logo.svg" alt="" />PRISM IA</Link>
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

function ProviderCard({ model }) {
  return <a className="external-model-card" href={model.url} target="_blank" rel="noreferrer">
    <div className="external-model-card__top">
      <span className="external-model-card__mark">{model.mark}</span>
      <span className="external-model-card__provider">{model.provider}</span>
    </div>
    <div>
      <h3>{model.model}</h3>
      <code>{model.id}</code>
    </div>
    <p>{model.note}</p>
    <div className="external-model-card__meta"><span>{model.kind}</span><b>Site oficial ↗</b></div>
  </a>;
}

export default function Models() {
  const { user } = useAuth();
  const entitlement = PLANS[user?.plan] ?? 0;
  const [provider, setProvider] = useState('Todos');
  const [query, setQuery] = useState('');

  const visibleModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return EXTERNAL_MODELS.filter((item) => (provider === 'Todos' || item.provider === provider)
      && (!normalized || [item.model, item.id, item.provider, item.kind].some((value) => value.toLowerCase().includes(normalized))));
  }, [provider, query]);

  return <div className="editorial-page brutal-library">
    <Header />
    <main>
      <section className="page-intro models-intro">
        <div className="eyebrow">03 / MODELOS</div>
        <h1>Uma rota para<br />cada tipo de<br /><em>trabalho.</em></h1>
        <p className="lead">Os nomes Prism representam configurações de orquestração. Abaixo, o catálogo externo foi conferido nas documentações oficiais dos principais provedores para deixar claro o ecossistema em que a Prism pode operar.</p>
        <div className="model-catalog-status"><span>CATÁLOGO EXTERNO</span><strong>VERIFICADO EM 27 SET 2026</strong><small>Os modelos externos abaixo são referência de catálogo e não significam que cada API já esteja conectada à Prism.</small></div>
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

      <section className="external-models">
        <div className="external-models__head">
          <div>
            <span className="eyebrow">CATÁLOGO / PROVEDORES</span>
            <h2>Modelos reais.<br /><em>Fontes reais.</em></h2>
          </div>
          <p>Selecione um provedor ou procure pelo nome do modelo. Os cartões abrem a documentação oficial correspondente.</p>
        </div>
        <div className="external-models__controls">
          <label><PrismIcon name="search" size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar modelo, ID ou provedor" /></label>
          <div className="external-models__filters" aria-label="Filtrar por provedor">{PROVIDERS.map((item) => <button type="button" className={provider === item ? 'active' : ''} key={item} onClick={() => setProvider(item)}>{item}</button>)}</div>
        </div>
        <div className="external-models__grid">
          {visibleModels.map((model) => <ProviderCard key={`${model.provider}-${model.id}`} model={model} />)}
        </div>
        {!visibleModels.length && <div className="external-models__empty">Nenhum modelo encontrado para esse filtro.</div>}
      </section>

      <section className="ultra">
        <span>ULTRACODE</span>
        <h2>Três motores.<br />Uma resposta.</h2>
        <p>Ultracode é o nível mais alto de orquestração: raciocínio, geração e validação acontecem simultaneamente antes da síntese final.</p>
      </section>
    </main>
  </div>;
}
