/** Prism IA — geração resiliente, roteamento por modelo e fallback. */
import { getModelProfile, normalizeEffort } from './modelRouter.js';

const PROVIDER_TIMEOUT = 45_000;
const GEMINI_KEY = () => process.env.GEMINI_API_KEY;
const GROQ_KEY = () => process.env.GROQ_API_KEY;
const OPENROUTER_KEY = () => process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_NVIDIA_API_KEY;

function effortInstruction(effort) {
  const map = {
    low: 'Responda de forma direta e rápida. Não complique tarefas simples.',
    medium: 'Analise o pedido com cuidado e entregue uma resposta completa sem raciocínio desnecessariamente longo.',
    high: 'Faça uma análise técnica mais profunda antes de responder. Verifique detalhes e casos de erro.',
    max: 'Priorize precisão, arquitetura, consistência e revisão. Resolva o problema de ponta a ponta.',
    ultracode: 'Atue como um engenheiro sênior. Planeje, implemente mentalmente, revise e entregue a melhor solução possível. Para código, considere segurança, edge cases, manutenção e integração.',
  };
  return map[effort] || map.medium;
}

function systemPrompt(model, effort) {
  const profile = getModelProfile(model);
  return [
    'Você é a Prism IA, uma assistente de inteligência artificial geral e uma engenheira de software quando o pedido envolve tecnologia.',
    'Responda ao que o usuário realmente pediu. Não transforme perguntas comuns em tarefas de programação.',
    'Não diga que não pode responder só porque o pedido não é código. Responda normalmente a perguntas gerais, explicações, escrita, matemática e planejamento.',
    'Quando houver código, entregue código utilizável e explique somente o necessário.',
    'Nunca invente resultados de ferramentas, arquivos, execução ou integrações que não foram realmente executados.',
    `Modelo lógico: ${model}. Perfil: ${profile.description}.`,
    effortInstruction(effort),
  ].join('\n');
}

async function request(url, options, timeout = PROVIDER_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`;
      throw new Error(String(detail).slice(0, 500));
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('tempo limite do provedor excedido');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildInput(prompt, context = '') {
  const cleanContext = String(context || '').slice(-30_000);
  return cleanContext
    ? `Contexto recente da conversa:\n${cleanContext}\n\nPedido atual:\n${prompt}`
    : prompt;
}

async function callGemini(prompt, model, effort) {
  const key = GEMINI_KEY();
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const geminiModel = process.env.GEMINI_MODEL || getModelProfile(model).gemini || 'gemini-3.6-flash';
  const data = await request(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(model, effort) }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: effort === 'low' ? 0.35 : 0.2 },
      }),
    },
  );
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || '').join('') || '';
  return { provider: 'gemini', text, tokens: Number(data?.usageMetadata?.totalTokenCount || 0) };
}

async function callGroq(prompt, model, effort) {
  const key = GROQ_KEY();
  if (!key) throw new Error('GROQ_API_KEY não configurada');
  const groqModel = process.env.GROQ_MODEL || (model === 'prism-nano-1.0' ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b');
  const reasoning = ['low', 'medium', 'high'].includes(effort) ? effort : 'high';
  const data = await request('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: groqModel,
      messages: [
        { role: 'system', content: systemPrompt(model, effort) },
        { role: 'user', content: prompt },
      ],
      temperature: effort === 'low' ? 0.35 : 0.2,
      reasoning_effort: reasoning,
    }),
  });
  return { provider: 'groq', text: data?.choices?.[0]?.message?.content || '', tokens: Number(data?.usage?.total_tokens || 0) };
}

async function callOpenRouter(prompt, model, effort) {
  const key = OPENROUTER_KEY();
  if (!key) throw new Error('OPENROUTER_API_KEY não configurada');
  const openRouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b';
  const data = await request('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': process.env.APP_URL || 'https://prism-ia.app',
      'X-Title': 'Prism IA',
    },
    body: JSON.stringify({
      model: openRouterModel,
      messages: [
        { role: 'system', content: systemPrompt(model, effort) },
        { role: 'user', content: prompt },
      ],
      temperature: effort === 'low' ? 0.35 : 0.2,
    }),
  });
  return { provider: 'openrouter', text: data?.choices?.[0]?.message?.content || '', tokens: Number(data?.usage?.total_tokens || 0) };
}

function usable(results) {
  return results.filter((item) => item?.text?.trim()).sort((a, b) => b.text.length - a.text.length);
}

export async function runOrchestration(prompt, effort = 'medium', profile = null, context = '') {
  const model = profile?.model || profile?.id || 'prism-mini-1.0';
  const normalizedEffort = normalizeEffort(effort);
  const input = buildInput(prompt, context);
  const tasks = [callGemini(input, model, normalizedEffort)];
  if (normalizedEffort !== 'low' || model !== 'prism-nano-1.0') tasks.push(callGroq(input, model, normalizedEffort));
  if (normalizedEffort === 'ultracode' || model === 'prism-taff-2.0') tasks.push(callOpenRouter(input, model, normalizedEffort));

  const settled = await Promise.allSettled(tasks);
  const results = usable(settled.filter((item) => item.status === 'fulfilled').map((item) => item.value));
  const errors = settled.filter((item) => item.status === 'rejected').map((item) => item.reason?.message || 'provedor indisponível');

  if (!results.length) {
    const configured = [GEMINI_KEY(), GROQ_KEY(), OPENROUTER_KEY()].filter(Boolean).length;
    throw new Error(configured ? `Nenhum provedor respondeu: ${errors.join(' | ')}` : 'Nenhuma chave de IA está configurada no backend.');
  }

  // Prefer a single strong answer instead of synthesizing two long answers; this reduces
  // latency and prevents a second provider failure from turning a valid answer into an error.
  const best = results[0];
  return {
    text: best.text.trim(),
    tokens: results.reduce((sum, item) => sum + item.tokens, 0),
    providers: results.map((item) => item.provider),
    errors,
    model,
    effort: normalizedEffort,
  };
}
