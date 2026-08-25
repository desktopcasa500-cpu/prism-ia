import { aiNews } from '../data/aiNews';
import './prism-news.css';

export default function PrismNews() {
  return (
    <section className="prism-news" aria-labelledby="prism-news-title">
      <div className="prism-news__head">
        <span>04 / SINAL</span>
        <h2 id="prism-news-title">O que está acontecendo na IA.</h2>
        <p>Notícias verificadas sobre modelos, infraestrutura, chips e sistemas de IA. Sem manchetes inventadas.</p>
      </div>
      <div className="prism-news__grid">
        {aiNews.map((item, index) => (
          <article className="prism-news__card" key={item.title}>
            <div className="prism-news__image-wrap">
              <img src={item.image} alt="" className="prism-news__image" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="prism-news__content">
              <div className="prism-news__meta"><span>{item.category}</span><time>{item.date}</time></div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">Fonte: {item.source} <span>↗</span></a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
