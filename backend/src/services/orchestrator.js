/** Prism IA — orquestração por modelo, esforço e fallback. */
import { getModelProfile } from './modelRouter.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_NVIDIA_API_KEY;
const PROVIDER_TIMEOUT = 28_000;
const SYNTHESIS_TIMEOUT = 35_000;

const effortInstructions = {
  low: 'Responda de forma curta e objetiva. Priorize velocidade.',
  medium: 'Analise o pedido e entregue uma solução equilibrada.',
  high: 'Faça uma análise cuidadosa, considere edge cases e valide a solução.',
  max: 'Raciocine profundamente, revise a solução e priorize robustez e segurança.',
  ultracode: 'Atue como engenheiro sênior. Planeje, implemente, revise e otimize a solução antes de responder.',
};

async function fetchJson(url, options, timeout = PROVIDER_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${data?.error?.message || data?.error || raw || 'resposta inválida'}`);
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('tempo limite do provedor excedido');
    throw error;
  } finally { clearTimeout(timer); }
}

function buildPrompt(prompt, effort, context = '') {
  const instruction = effortInstructions[effort] || effortInstructions.medium;
  return `Você é a Prism IA, uma assistente de engenharia de software.\n${instruction}\nNão invente APIs, arquivos ou resultados que não foram fornecidos. Quando estiver trabalhando em código, produza código executável e explique decisões apenas quando necessário.\n\nContexto da conversa:\n${context.slice(-24_000)}\n\nPedido atual:\n${prompt.slice(0, 20_000)}`;
}

async function callGemini(prompt, model, timeout = PROVIDER_TIMEOUT) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada');
  const data = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  }, timeout);
  return { provider: 'gemini', text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '', tokens: data?.usageMetadata?.totalTokenCount ?? 0 };
}

async function callGroq(prompt, model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile') {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY não configurada');
  const data = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
  });
  return { provider: 'groq', text: data?.choices?.[0]?.message?.content ?? '', tokens: data?.usage?.total_tokens ?? 0 };
}

async function callOpenRouter(prompt, model) {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY não configurada');
  const data = await fetchJson('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}`, 'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173', 'X-Title': 'Prism IA' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2 }),
  });
  return { provider: 'openrouter', text: data?.choices?.[0]?.message?.content ?? '', tokens: data?.usage?.total_tokens ?? 0 };
}

async function race(tasks) {
  const results = await Promise.allSettled(tasks);
  const ok = results.filter(r => r.status === 'fulfilled' && r.value?.text?.trim()).map(r => r.value);
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message || String(r.reason));
  return { ok, errors };
}

function fallbackBest(results) {
  if (!results.length) return { text: '', tokens: 0, providers: [] };
  const best = results.reduce((a, b) => b.text.length > a.text.length ? b : a);
  return { text: best.text.trim(), tokens: results.reduce((sum, item) => sum + (item.tokens || 0), 0), providers: results.map(item => item.provider) };
}

async function synthesize(prompt, results, effort) {
  const fallback = fallbackBest(results);
  if (results.length < 2 || !GEMINI_KEY) return { ...fallback, effort, errors: [] };
  const candidates = results.map(item => `--- ${item.provider.toUpperCase()} ---\n${item.text.slice(0, 12_000)}`).join('\n\n');
  try {
    const final = await callGemini(`Você é o revisor final da Prism IA.\nPedido:\n${prompt.slice(0, 12_000)}\n\nRespostas candidatas:\n${candidates}\n\nUna as melhores partes, corrija contradições e entregue somente a resposta final. Não mencione provedores ou o processo interno.`, 'gemini-2.0-flash', SYNTHESIS_TIMEOUT);
    if (!final.text.trim()) return { ...fallback, effort, errors: ['síntese vazia'] };
    return { text: final.text.trim(), tokens: fallback.tokens + (final.tokens || 0), providers: [...fallback.providers, 'synthesizer'], effort, errors: [] };
  } catch (error) { return { ...fallback, effort, errors: [`síntese indisponível: ${error.message}`] }; }
}

export async function runOrchestration(prompt, effort = 'medium', model = 'prism-mini-1.0', context = '') {
  const profile = getModelProfile(model);
  const finalPrompt = buildPrompt(prompt, effort, context);
  const tasks = [];
  if (profile.providers.includes('gemini')) tasks.push(callGemini(finalPrompt, profile.defaultModel));
  if (profile.providers.includes('groq')) tasks.push(callGroq(finalPrompt));
  if (profile.providers.includes('openrouter')) tasks.push(callOpenRouter(finalPrompt, profile.defaultModel));
  const { ok, errors } = await race(tasks);
  if (!ok.length) throw new Error(`Nenhum motor de IA respondeu. ${errors.join(' | ')}`);
  return synthesize(prompt, ok, effort).then(result => ({ ...result, model, errors: [...errors, ...(result.errors || [])] }));
}
