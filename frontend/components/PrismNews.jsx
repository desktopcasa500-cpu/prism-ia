import { useEffect, useState } from 'react';
import { aiNews } from '../data/aiNews';
import { api } from '../lib/api.js';
import './prism-news.css';

export default function PrismNews() {
  // aiNews (arquivo estático) é usado só como fallback visual até a primeira
  // busca automática rodar no backend, ou se a API falhar por algum motivo.
  const [news, setNews] = useState(aiNews);
  const [updatedLabel, setUpdatedLabel] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await api.get('/news');
        if (!alive) return;
        if (Array.isArray(result?.items) && result.items.length) setNews(result.items);
        if (result?.updatedLabel) setUpdatedLabel(result.updatedLabel);
      } catch {
        // Mantém o fallback estático em silêncio; a landing nunca deve ficar vazia por causa disso.
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section className="prism-news" aria-labelledby="prism-news-title">
      <div className="prism-news__head">
        <span>04 / SINAL</span>
        <div>
          <h2 id="prism-news-title">O que está acontecendo na IA.</h2>
          <p>Uma leitura editorial de modelos, infraestrutura, chips e produto. Cada item aponta para a fonte original. Atualiza automaticamente a cada 2 dias.</p>
        </div>
        <span className="prism-news__updated">{updatedLabel ? `ATUALIZADO / ${updatedLabel}` : 'ATUALIZADO AUTOMATICAMENTE'}</span>
      </div>
      <div className="prism-news__grid">
        {news.map((item, index) => (
          <article className="prism-news__card" key={item.title}>
            <div className="prism-news__image-wrap">
              <img
                src={item.image}
                alt=""
                className="prism-news__image"
                loading={index > 1 ? 'lazy' : 'eager'}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                  event.currentTarget.parentElement.classList.add('is-missing');
                }}
              />
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
