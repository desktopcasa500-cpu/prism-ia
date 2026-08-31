import { Link, useParams } from 'react-router-dom';
import { infoItems, modelItems } from '../content/prismTexts.js';

export default function PrismDetail({ type }) {
  const { id } = useParams();
  const items = type === 'models' ? modelItems : infoItems;
  const item = items.find((entry) => entry.id === id);
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
