import { lookup } from 'node:dns/promises';
import net from 'node:net';

/** Real web search/fetch with keyed search providers plus a keyless public fallback. */

const BRAVE_KEY = () => process.env.BRAVE_SEARCH_API_KEY;
const GOOGLE_KEY = () => process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_CX = () => process.env.GOOGLE_CSE_ID || process.env.GOOGLE_SEARCH_ENGINE_ID;
const SEARCH_TIMEOUT = 10_000;
const FETCH_TIMEOUT = 15_000;
const MAX_PAGE_BYTES = 1_500_000;

function googleConfigured() { return Boolean(GOOGLE_KEY() && GOOGLE_CX()); }
function braveConfigured() { return Boolean(BRAVE_KEY()); }

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value) {
  return decodeHtml(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

async function request(url, headers = {}, timeout = SEARCH_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: controller.signal,
    });
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
  const params = new URLSearchParams({
    key: GOOGLE_KEY(),
    cx: GOOGLE_CX(),
    q: query,
    num: String(Math.min(count, 10)),
    hl: 'pt-BR',
  });
  const data = await request(`https://www.googleapis.com/customsearch/v1?${params.toString()}`);
  return normalizeGoogle(data, count);
}

async function searchBrave(query, count, freshness) {
  const params = new URLSearchParams({ q: query, count: String(count) });
  if (freshness) params.set('freshness', freshness);
  const data = await request(
    `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    { 'X-Subscription-Token': BRAVE_KEY() },
  );
  return normalizeBrave(data, count);
}

async function searchDuckDuckGo(query, count) {
  const url = `https://html.duckduckgo.com/html/?${new URLSearchParams({ q: query, kl: 'br-pt' }).toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': 'PrismIA/1.0 (+https://prism-ia.app)' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`DuckDuckGo retornou ${response.status}`);
    const html = await response.text();
    const results = [];
    const chunks = html.split(/<div[^>]+class=["'][^"']*result[^"']*["'][^>]*>/i).slice(1);
    for (const chunk of chunks) {
      if (results.length >= count) break;
      const href = chunk.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["']/i)?.[1]
        || chunk.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*result__a[^"']*["']/i)?.[1];
      const title = chunk.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1];
      const description = chunk.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1];
      if (!href || !title) continue;
      results.push({
        title: stripHtml(title).slice(0, 300),
        url: decodeHtml(href),
        description: stripHtml(description || '').slice(0, 600),
        source: (() => { try { return new URL(decodeHtml(href)).hostname; } catch { return ''; } })(),
        age: null,
        thumbnail: null,
      });
    }
    return results;
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('Busca DuckDuckGo excedeu o tempo limite.'), { code: 'SEARCH_TIMEOUT' });
    throw error;
  } finally { clearTimeout(timer); }
}

function assertSafePublicHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw Object.assign(new Error('URL privada ou local bloqueada.'), { code: 'PRIVATE_URL_BLOCKED' });
  }
  const addresses = [];
  if (net.isIP(host)) addresses.push(host);
  if (!addresses.length) return lookup(host, { all: true }).then((records) => records.map((record) => record.address));
  return Promise.resolve(addresses);
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || a === 0;
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:');
  }
  return true;
}

async function safeUrl(value) {
  const parsed = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('Somente URLs HTTP/HTTPS são permitidas.'), { code: 'INVALID_URL' });
  }
  if (parsed.username || parsed.password) {
    throw Object.assign(new Error('URLs com credenciais embutidas são bloqueadas.'), { code: 'INVALID_URL' });
  }
  const addresses = await assertSafePublicHost(parsed.hostname);
  if (addresses.some(isPrivateAddress)) {
    throw Object.assign(new Error('URL privada ou de rede interna bloqueada.'), { code: 'PRIVATE_URL_BLOCKED' });
  }
  return parsed;
}

async function readResponseBody(response) {
  const reader = response.body?.getReader?.();
  if (!reader) return String(await response.text()).slice(0, MAX_PAGE_BYTES);
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PAGE_BYTES) {
      await reader.cancel().catch(() => {});
      throw Object.assign(new Error('Página excede o limite de leitura.'), { code: 'PAGE_TOO_LARGE' });
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchWebPage(value) {
  let parsed = await safeUrl(value);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const response = await fetch(parsed, {
        redirect: 'manual',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
          'User-Agent': 'PrismIA/1.0 (+https://prism-ia.app)',
        },
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirecionamento sem destino.');
        parsed = await safeUrl(new URL(location, parsed).toString());
        continue;
      }
      if (!response.ok) throw new Error(`A página retornou HTTP ${response.status}.`);
      const raw = await readResponseBody(response);
      const contentType = String(response.headers.get('content-type') || '');
      const text = contentType.includes('text/html') ? stripHtml(raw) : raw.trim();
      return {
        url: parsed.toString(),
        contentType,
        text: text.slice(0, 120_000),
      };
    } catch (error) {
      if (error?.name === 'AbortError') throw Object.assign(new Error('Abertura da página excedeu o tempo limite.'), { code: 'WEB_FETCH_TIMEOUT' });
      throw error;
    } finally { clearTimeout(timer); }
  }
  throw new Error('Redirecionamentos demais.');
}

export async function searchWeb(query, options = {}) {
  const clean = String(query || '').trim().slice(0, 400);
  if (!clean) throw new Error('Consulta de busca vazia.');
  const count = Math.min(Math.max(Number(options.count) || 6, 1), 20);

  if (googleConfigured()) {
    try { return await searchGoogle(clean, count); }
    catch (error) {
      if (!braveConfigured()) console.warn('Google Search falhou; tentando DuckDuckGo:', error?.message || error);
    }
  }
  if (braveConfigured()) {
    try { return await searchBrave(clean, count, options.freshness); }
    catch (error) { console.warn('Brave Search falhou; tentando DuckDuckGo:', error?.message || error); }
  }
  return searchDuckDuckGo(clean, count);
}

export function webSearchConfigured() { return true; }
