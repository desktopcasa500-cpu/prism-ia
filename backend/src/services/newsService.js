/** Prism IA — notícias de IA buscadas de verdade na web e atualizadas automaticamente a cada 2 dias. */
import { pool } from '../db/pool.js';
import { searchWeb, webSearchConfigured } from './webSearch.js';

export const NEWS_REFRESH_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 dias
const MAX_ITEMS = 8;
const QUERIES = [
  'novo modelo de inteligência artificial lançamento',
  'Anthropic Claude atualização',
  'OpenAI atualização produto',
  'chip inferência inteligência artificial infraestrutura',
];

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function categoryFor(query, source) {
  const s = `${query} ${source}`.toLowerCase();
  if (s.includes('anthropic') || s.includes('claude')) return 'MODELOS / ANTHROPIC';
  if (s.includes('openai') || s.includes('gpt')) return 'MODELOS / OPENAI';
  if (s.includes('chip') || s.includes('infra')) return 'INFRAESTRUTURA';
  return 'MODELOS / IA';
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
    .replace('.', '');
}

/**
 * Busca notícias reais na web e monta a lista normalizada usada pela Landing.
 * Não usa nenhum LLM: só formata o que a busca retornou, para nunca inventar fatos.
 */
async function fetchFreshNewsFromWeb() {
  const collected = [];
  for (const query of QUERIES) {
    try {
      const results = await searchWeb(query, { count: 3, freshness: 'pw' });
      for (const item of results) {
        if (!item.title || !item.url) continue;
        if (collected.some((existing) => existing.source_url === item.url)) continue;
        collected.push({
          category: categoryFor(query, item.source),
          title: item.title,
          description: item.description || '',
          source: item.source || hostnameOf(item.url),
          source_url: item.url,
          image: item.thumbnail || null,
          published_at: null,
        });
      }
    } catch (error) {
      console.warn('Prism news: falha ao buscar', query, error?.message);
    }
    if (collected.length >= MAX_ITEMS) break;
  }
  return collected.slice(0, MAX_ITEMS);
}

export async function refreshNewsFromWeb() {
  if (!webSearchConfigured()) {
    await pool.query('INSERT INTO news_refresh_log (status, items_count, error) VALUES ($1, $2, $3)', ['skipped', 0, 'BRAVE_SEARCH_API_KEY não configurada']);
    return { status: 'skipped', reason: 'search_not_configured' };
  }
  try {
    const items = await fetchFreshNewsFromWeb();
    if (!items.length) {
      await pool.query('INSERT INTO news_refresh_log (status, items_count, error) VALUES ($1, $2, $3)', ['empty', 0, null]);
      return { status: 'empty' };
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM news_items');
      let position = 0;
      for (const item of items) {
        await client.query(
          `INSERT INTO news_items (category, title, description, source, source_url, image, published_at, position)
           VALUES ($1, $2, $3, $4, $5, $6, now(), $7)`,
          [item.category, item.title, item.description, item.source, item.source_url, item.image, position],
        );
        position += 1;
      }
      await client.query('INSERT INTO news_refresh_log (status, items_count, error) VALUES ($1, $2, $3)', ['ok', items.length, null]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return { status: 'ok', count: items.length };
  } catch (error) {
    await pool.query('INSERT INTO news_refresh_log (status, items_count, error) VALUES ($1, $2, $3)', ['error', 0, String(error?.message || error).slice(0, 500)]);
    return { status: 'error', error: error?.message };
  }
}

export async function getStoredNews() {
  const result = await pool.query('SELECT category, title, description, source, source_url, image, published_at FROM news_items ORDER BY position ASC LIMIT $1', [MAX_ITEMS]);
  return result.rows.map((row) => ({
    category: row.category,
    title: row.title,
    description: row.description,
    source: row.source,
    sourceUrl: row.source_url,
    image: row.image,
    date: row.published_at ? new Date(row.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '') : '',
  }));
}

export async function getLastRefresh() {
  const result = await pool.query('SELECT status, items_count, error, created_at FROM news_refresh_log ORDER BY created_at DESC LIMIT 1');
  return result.rows[0] || null;
}

export async function shouldRefreshNews() {
  const last = await getLastRefresh();
  if (!last) return true;
  const elapsed = Date.now() - new Date(last.created_at).getTime();
  return elapsed >= NEWS_REFRESH_INTERVAL_MS;
}

export function newsUpdatedLabel(row) {
  return row?.created_at ? new Date(row.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '') : todayLabel();
}
