/** Prism IA — orquestrador paralelo com fallback e síntese. */

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_NVIDIA_API_KEY;
const PROVIDER_TIMEOUT = 28_000;
const SYNTHESIS_TIMEOUT = 35_000;

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
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(prompt, timeout = PROVIDER_TIMEOUT) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada');
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
    timeout,
  );
  return { provider: 'gemini', text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '', tokens: data?.usageMetadata?.totalTokenCount ?? 0 };
}

async function callGroq(prompt) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY não configurada');
  const data = await fetchJson('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });
  return { provider: 'groq', text: data?.choices?.[0]?.message?.content ?? '', tokens: data?.usage?.total_tokens ?? 0 };
}

async function callNvidiaOpenRouter(prompt) {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_NVIDIA_API_KEY não configurada');
  const data = await fetchJson('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': process.env.APP_URL || 'https://prism-ia.app',
      'X-Title': 'Prism IA',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });
  return { provider: 'nvidia', text: data?.choices?.[0]?.message?.content ?? '', tokens: data?.usage?.total_tokens ?? 0 };
}

async function raceAllSettled(tasks) {
  const results = await Promise.allSettled(tasks);
  const ok = [], errors = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.text?.trim()) ok.push(result.value);
    else if (result.status === 'rejected') errors.push(result.reason?.message ?? String(result.reason));
  }
  return { ok, errors };
}

function fallbackBest(results) {
  if (!results.length) return { text: '', tokens: 0, providers: [] };
  const best = results.reduce((a, b) => b.text.length > a.text.length ? b : a);
  return {
    text: best.text.trim(),
    tokens: results.reduce((sum, item) => sum + (item.tokens || 0), 0),
    providers: results.map((item) => item.provider),
  };
}

async function synthesize(prompt, results, mode) {
  const fallback = fallbackBest(results);
  if (results.length < 2 || !GEMINI_KEY) return { ...fallback, mode, errors: [] };

  const candidates = results.map((item) => `--- ${item.provider.toUpperCase()} ---\n${item.text.slice(0, 12000)}`).join('\n\n');
  const synthesisPrompt = `Você é o sintetizador da Prism IA.\n\nPedido original:\n${prompt.slice(0, 12000)}\n\nRespostas independentes:\n${candidates}\n\nCrie uma única resposta final. Preserve código útil, corrija contradições e não mencione os provedores, o processo interno ou que houve respostas paralelas. Seja direto e tecnicamente preciso.`;

  try {
    const final = await callGemini(synthesisPrompt, SYNTHESIS_TIMEOUT);
    if (!final.text.trim()) return { ...fallback, mode, errors: ['síntese vazia; fallback aplicado'] };
    return {
      text: final.text.trim(),
      tokens: fallback.tokens + (final.tokens || 0),
      providers: [...fallback.providers, 'synthesizer'],
      mode,
      errors: [],
    };
  } catch (error) {
    return { ...fallback, mode, errors: [`síntese indisponível: ${error.message}`] };
  }
}

export async function runMedium(prompt) {
  const { ok, errors } = await raceAllSettled([callGemini(prompt), callGroq(prompt)]);
  if (!ok.length) throw new Error(`Nenhum motor de IA respondeu. ${errors.join(' | ')}`);
  const result = await synthesize(prompt, ok, 'medium');
  return { ...result, errors: [...errors, ...(result.errors || [])] };
}

export async function runUltracode(prompt) {
  const { ok, errors } = await raceAllSettled([callGemini(prompt), callGroq(prompt), callNvidiaOpenRouter(prompt)]);
  if (!ok.length) throw new Error(`Nenhum motor de IA respondeu. ${errors.join(' | ')}`);
  const result = await synthesize(prompt, ok, 'ultracode');
  return { ...result, errors: [...errors, ...(result.errors || [])] };
}

export function runOrchestration(prompt, effort = 'medium') {
  return effort === 'ultracode' ? runUltracode(prompt) : runMedium(prompt);
}
