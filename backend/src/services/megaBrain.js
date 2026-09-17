import { runOrchestration } from './orchestrator.js';

const TIMEOUT = 60_000;
const MAX_INPUT = 24_000;
const MAX_ADVISORY = 12_000;

const key = {
  openai: () => process.env.OPENAI_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,
  gemini: () => process.env.GEMINI_API_KEY,
};

const emit = (onProgress, type, data = {}) => onProgress?.({ type, timestamp: Date.now(), ...data });

async function request(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      throw new Error(String(data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`).slice(0, 1600));
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Tempo limite do conselho MegaBrain excedido.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const textFromOpenAI = (data) => String(data?.choices?.[0]?.message?.content || data?.output_text || '').trim();
const textFromAnthropic = (data) => (Array.isArray(data?.content) ? data.content : []).filter((item) => item?.type === 'text').map((item) => item.text).join('').trim();
const textFromGemini = (data) => (data?.candidates?.[0]?.content?.parts || []).filter((part) => part?.text).map((part) => part.text).join('').trim();

async function consultOpenAI(prompt) {
  const data = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.openai()}` },
    body: JSON.stringify({
      model: process.env.MEGABRAIN_OPENAI_MODEL || 'gpt-5.6-sol',
      messages: [
        { role: 'system', content: 'Você é o analista OpenAI do Prism MegaBrain. Analise a tarefa como engenheiro de software sênior. Encontre riscos, arquitetura, falhas prováveis e um plano de execução verificável. Não finja executar ferramentas.' },
        { role: 'user', content: prompt },
      ],
      reasoning_effort: 'high',
    }),
  });
  return textFromOpenAI(data);
}

async function consultAnthropic(prompt) {
  const data = await request('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key.anthropic(), 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.MEGABRAIN_ANTHROPIC_MODEL || 'claude-opus-5',
      max_tokens: Number(process.env.MEGABRAIN_ANTHROPIC_MAX_TOKENS || 12000),
      system: 'Você é o analista Anthropic do Prism MegaBrain. Faça uma revisão rigorosa da tarefa, procurando casos extremos, bugs, detalhes de implementação, segurança e qualidade. Não finja executar ferramentas.',
      messages: [{ role: 'user', content: prompt }],
      thinking: { type: 'adaptive' },
      output_config: { effort: 'max' },
    }),
  });
  return textFromAnthropic(data);
}

async function consultGemini(prompt) {
  const model = process.env.MEGABRAIN_GEMINI_MODEL || 'gemini-3.8-flash';
  const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key.gemini())}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: 'Você é o analista Gemini do Prism MegaBrain. Concentre-se em raciocínio sistêmico, depuração, código, integração de ferramentas e validação. Não finja executar ferramentas.' }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
  });
  return textFromGemini(data);
}

const ADVISORS = [
  { provider: 'openai', model: () => process.env.MEGABRAIN_OPENAI_MODEL || 'gpt-5.6-sol', enabled: key.openai, run: consultOpenAI },
  { provider: 'anthropic', model: () => process.env.MEGABRAIN_ANTHROPIC_MODEL || 'claude-opus-5', enabled: key.anthropic, run: consultAnthropic },
  { provider: 'gemini', model: () => process.env.MEGABRAIN_GEMINI_MODEL || 'gemini-3.8-flash', enabled: key.gemini, run: consultGemini },
];

export function isMegaBrainCommand(model, requestedEffort, prompt) {
  return model === 'prism-taff-2.0' && requestedEffort === 'ultracode' && /^\/megabrain(?:\s|$)/i.test(String(prompt || '').trim());
}

export function stripMegaBrainCommand(prompt) {
  return String(prompt || '').trim().replace(/^\/megabrain\s*/i, '').trim();
}

export async function runMegaBrain({ prompt, context = '', userId = null, projectId = null, onProgress }) {
  const cleanPrompt = stripMegaBrainCommand(prompt);
  const task = [
    'TAREFA DO USUÁRIO:',
    cleanPrompt || 'Analise profundamente o projeto e execute a melhor solução ponta a ponta.',
    '',
    'CONTEXTO DISPONÍVEL:',
    String(context || '').slice(-MAX_INPUT),
  ].join('\n');

  emit(onProgress, 'megabrain_start', { message: 'MegaBrain ativado: consultando os modelos de fronteira em paralelo.' });
  const enabled = ADVISORS.filter((advisor) => advisor.enabled());
  const results = await Promise.all(enabled.map(async (advisor) => {
    const started = Date.now();
    emit(onProgress, 'megabrain_provider_start', { provider: advisor.provider, model: advisor.model() });
    try {
      const text = String(await advisor.run(task) || '').slice(0, MAX_ADVISORY);
      emit(onProgress, 'megabrain_provider_complete', { provider: advisor.provider, model: advisor.model(), elapsedMs: Date.now() - started, ok: Boolean(text) });
      return { ...advisor, text };
    } catch (error) {
      emit(onProgress, 'megabrain_provider_error', { provider: advisor.provider, model: advisor.model(), message: error?.message || 'Falha' });
      return { ...advisor, text: '', error: error?.message || 'Falha no modelo.' };
    }
  }));

  const usable = results.filter((item) => item.text);
  const council = usable.length
    ? usable.map((item) => `### ${item.provider.toUpperCase()} — ${item.model()}\n${item.text}`).join('\n\n')
    : 'Nenhum conselheiro MegaBrain respondeu; execute a tarefa diretamente com o agente principal.';

  emit(onProgress, 'megabrain_synthesis_start', { message: 'Consolidando as análises no agente principal.' });
  const synthesisPrompt = [
    'MODO MEGABRAIN: você é o agente principal do Prism Taff 2.0 em Ultracode.',
    'Use as análises abaixo como revisão independente, mas não copie cegamente nenhuma delas.',
    'Resolva a tarefa ponta a ponta com ferramentas reais, valide as alterações e não invente resultados.',
    'Escolha a solução tecnicamente mais forte e segura depois de comparar as sugestões.',
    '',
    council,
    '',
    'TAREFA ORIGINAL:',
    cleanPrompt || 'Analise profundamente o projeto e execute a melhor solução ponta a ponta.',
  ].join('\n');

  const final = await runOrchestration(synthesisPrompt, 'ultracode', { model: 'prism-taff-2.0' }, context, userId, {
    projectId,
    onProgress,
  });

  emit(onProgress, 'megabrain_done', { advisors: usable.map((item) => `${item.provider}:${item.model()}`), message: 'MegaBrain concluído.' });
  return {
    ...final,
    providers: [...usable.map((item) => `${item.provider}:${item.model()}`), ...(final?.providers || [])],
    megabrain: true,
    advisors: usable.map((item) => ({ provider: item.provider, model: item.model() })),
  };
}
