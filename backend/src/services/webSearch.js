/** Prism IA — busca real na web (Brave Search API) usada por Skills e pelo refresh de notícias. */

const BRAVE_KEY = () => process.env.BRAVE_SEARCH_API_KEY;
const SEARCH_TIMEOUT = 10_000;

function isConfigured() {
  return Boolean(BRAVE_KEY());
}

async function request(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': BRAVE_KEY() },
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = new Error(`Brave Search retornou ${response.status}: ${detail.slice(0, 300)}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Busca na web excedeu o tempo limite.');
      timeoutError.code = 'SEARCH_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca na web e retorna resultados normalizados: título, url, descrição, data (quando disponível).
 * @param {string} query
 * @param {{ count?: number, freshness?: 'pd'|'pw'|'pm'|'py' }} options
 */
export async function searchWeb(query, options = {}) {
  const clean = String(query || '').trim().slice(0, 400);
  if (!clean) throw new Error('Consulta de busca vazia.');
  if (!isConfigured()) {
    const error = new Error('Busca na web não está configurada neste ambiente (BRAVE_SEARCH_API_KEY ausente).');
    error.code = 'SEARCH_NOT_CONFIGURED';
    throw error;
  }
  const count = Math.min(Math.max(Number(options.count) || 6, 1), 20);
  const params = new URLSearchParams({ q: clean, count: String(count) });
  if (options.freshness) params.set('freshness', options.freshness);
  const data = await request(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`);
  const results = Array.isArray(data?.web?.results) ? data.web.results : [];
  return results.slice(0, count).map((item) => ({
    title: String(item?.title || '').slice(0, 300),
    url: item?.url || '',
    description: String(item?.description || '').replace(/<[^>]+>/g, '').slice(0, 600),
    source: item?.meta_url?.hostname || item?.profile?.name || '',
    age: item?.age || item?.page_age || null,
    thumbnail: item?.thumbnail?.src || item?.meta_url?.favicon || null,
  }));
}

export function webSearchConfigured() {
  return isConfigured();
}
