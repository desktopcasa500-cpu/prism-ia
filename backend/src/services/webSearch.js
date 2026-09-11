/** Prism IA — busca real na web. Google pode ser usado quando configurado; Brave permanece como fallback. */

const BRAVE_KEY = () => process.env.BRAVE_SEARCH_API_KEY;
const GOOGLE_KEY = () => process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_CX = () => process.env.GOOGLE_CSE_ID || process.env.GOOGLE_SEARCH_ENGINE_ID;
const SEARCH_TIMEOUT = 10_000;

function googleConfigured() { return Boolean(GOOGLE_KEY() && GOOGLE_CX()); }
function braveConfigured() { return Boolean(BRAVE_KEY()); }
function isConfigured() { return googleConfigured() || braveConfigured(); }

async function request(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const error = new Error(`Pesquisa retornou ${response.status}: ${detail.slice(0, 300)}`);
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
  } finally { clearTimeout(timer); }
}

function normalizeGoogle(data, count) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.slice(0, count).map((item) => ({
    title: String(item?.title || '').slice(0, 300),
    url: item?.link || '',
    description: String(item?.snippet || '').replace(/<[^>]+>/g, '').slice(0, 600),
    source: item?.displayLink || '',
    age: null,
    thumbnail: item?.pagemap?.cse_thumbnail?.[0]?.src || null,
  }));
}

function normalizeBrave(data, count) {
  const items = Array.isArray(data?.web?.results) ? data.web.results : [];
  return items.slice(0, count).map((item) => ({
    title: String(item?.title || '').slice(0, 300),
    url: item?.url || '',
    description: String(item?.description || '').replace(/<[^>]+>/g, '').slice(0, 600),
    source: item?.meta_url?.hostname || item?.profile?.name || '',
    age: item?.age || item?.page_age || null,
    thumbnail: item?.thumbnail?.src || item?.meta_url?.favicon || null,
  }));
}

async function searchGoogle(query, count) {
  const params = new URLSearchParams({ key: GOOGLE_KEY(), cx: GOOGLE_CX(), q: query, num: String(Math.min(count, 10)), hl: 'pt-BR' });
  const data = await request(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
  return normalizeGoogle(data, count);
}

async function searchBrave(query, count, freshness) {
  const params = new URLSearchParams({ q: query, count: String(count) });
  if (freshness) params.set('freshness', freshness);
  const data = await request(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, { 'X-Subscription-Token': BRAVE_KEY() });
  return normalizeBrave(data, count);
}

export async function searchWeb(query, options = {}) {
  const clean = String(query || '').trim().slice(0, 400);
  if (!clean) throw new Error('Consulta de busca vazia.');
  if (!isConfigured()) {
    const error = new Error('Busca na web não está configurada neste ambiente. Defina GOOGLE_SEARCH_API_KEY + GOOGLE_CSE_ID ou BRAVE_SEARCH_API_KEY.');
    error.code = 'SEARCH_NOT_CONFIGURED';
    throw error;
  }
  const count = Math.min(Math.max(Number(options.count) || 6, 1), 20);
  if (googleConfigured()) {
    try { return await searchGoogle(clean, count); }
    catch (error) {
      if (!braveConfigured()) throw error;
      console.warn('Google Search failed, falling back to Brave:', error?.message || error);
    }
  }
  return searchBrave(clean, count, options.freshness);
}

export function webSearchConfigured() { return isConfigured(); }
