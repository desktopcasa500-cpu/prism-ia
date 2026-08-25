import { aiNews } from '../data/aiNews';
import './prism-news.css';

export default function PrismNews() {
  return (
    <section className="prism-news" aria-labelledby="prism-news-title">
      <div className="prism-news__head">
        <span>PRISM / SINAL</span>
        <h2 id="prism-news-title">O que está mudando na computação.</h2>
        <p>Notas editoriais sobre infraestrutura, modelos e sistemas que tornam a IA executável.</p>
      </div>
      <div className="prism-news__grid">
        {aiNews.map((item, index) => (
          <article className="prism-news__card" key={item.title}>
            <div className="prism-news__image-wrap">
              <img src={item.image} alt="" className="prism-news__image" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="prism-news__content">
              <span className="prism-news__category">{item.category}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <button type="button">Ler sinal <span>→</span></button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
