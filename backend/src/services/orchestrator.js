/** Prism IA — orquestrador paralelo */

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_NVIDIA_API_KEY;

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY não configurada');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini erro ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { provider: 'gemini', text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '', tokens: data?.usageMetadata?.totalTokenCount ?? 0 };
}

async function callGroq(prompt) {
  if (!GROQ_KEY) throw new Error('GROQ_API_KEY não configurada');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Groq erro ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { provider: 'groq', text: data?.choices?.[0]?.message?.content ?? '', tokens: data?.usage?.total_tokens ?? 0 };
}

async function callNvidiaOpenRouter(prompt) {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_NVIDIA_API_KEY não configurada');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_KEY}` },
    body: JSON.stringify({ model: 'nvidia/llama-3.1-nemotron-70b-instruct', messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`NVIDIA/OpenRouter erro ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { provider: 'nvidia', text: data?.choices?.[0]?.message?.content ?? '', tokens: data?.usage?.total_tokens ?? 0 };
}

async function raceAllSettled(tasks) {
  const results = await Promise.allSettled(tasks);
  const ok = [], errors = [];
  for (const r of results) r.status === 'fulfilled' ? ok.push(r.value) : errors.push(r.reason?.message ?? String(r.reason));
  return { ok, errors };
}

function synthesize(results) {
  if (!results.length) return { text: '', tokens: 0, providers: [] };
  const best = results.reduce((a, b) => b.text.length > a.text.length ? b : a);
  return { text: best.text, tokens: results.reduce((s, r) => s + (r.tokens || 0), 0), providers: results.map(r => r.provider) };
}

export async function runMedium(prompt) {
  const { ok, errors } = await raceAllSettled([callGemini(prompt), callGroq(prompt)]);
  if (!ok.length) throw new Error(`Todos os provedores falharam: ${errors.join(' | ')}`);
  return { ...synthesize(ok), mode: 'medium', errors };
}

export async function runUltracode(prompt) {
  const { ok, errors } = await raceAllSettled([callGemini(prompt), callGroq(prompt), callNvidiaOpenRouter(prompt)]);
  if (!ok.length) throw new Error(`Todos os provedores falharam: ${errors.join(' | ')}`);
  return { ...synthesize(ok), mode: 'ultracode', errors };
}

export function runOrchestration(prompt, effort = 'medium') {
  return effort === 'ultracode' ? runUltracode(prompt) : runMedium(prompt);
}
