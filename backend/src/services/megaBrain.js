import { getGroqKeyCandidates, isGroqConfigured } from './groqRouter.js';

const TIMEOUT = 60_000;
const MAX_INPUT = 24_000;
const MAX_ADVISORY = 14_000;

const keys = {
  nvidia: () => process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY,
  groq: () => isGroqConfigured(),
  opencode: () => process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY,
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
    if (!response.ok) throw Object.assign(new Error(String(data?.error?.message || data?.error || raw || `HTTP ${response.status}`).slice(0, 2000)), { status: response.status });
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('Tempo limite do MegaBrain excedido.'), { code: 'MEGABRAIN_TIMEOUT' });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function textFrom(data) {
  return String(data?.choices?.[0]?.message?.content || data?.output_text || '').trim();
}

const ADVISORS = [
  {
    provider: 'nvidia',
    model: 'moonshotai/kimi-k3',
    key: keys.nvidia,
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    headers: {},
  },
  {
    provider: 'groq',
    model: 'openai/gpt-oss-120b',
    key: keys.groq,
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: {},
  },
  {
    provider: 'opencode',
    model: 'big-pickle',
    key: keys.opencode,
    url: 'https://opencode.ai/zen/v1/chat/completions',
    headers: { 'X-Title': 'Prism IA MegaBrain' },
  },
];

function advisorPrompt(task) {
  return [
    'Você é um conselheiro técnico do Prism MegaBrain.',
    'Analise a tarefa como especialista em engenharia de software, arquitetura, debugging e agentes.',
    'Encontre riscos, dependências, falhas prováveis e uma estratégia concreta.',
    'Não finja executar ferramentas. Produza somente análise verificável para outro agente.',
    '',
    task,
  ].join('\n');
}

async function consult(advisor, task, userId = null) {
  const body = {
    model: advisor.model,
    messages: [
      { role: 'system', content: 'Faça uma revisão independente, precisa e técnica. Não invente resultados.' },
      { role: 'user', content: advisorPrompt(task) },
    ],
  };
  if (advisor.provider === 'nvidia') {
    body.temperature = 0.2;
    body.top_p = 0.95;
    body.max_tokens = 16_384;
    body.reasoning_effort = 'max';
  } else if (advisor.provider === 'groq') {
    body.temperature = 0.2;
    body.max_tokens = 16_384;
    body.reasoning_effort = 'high';
  } else {
    body.temperature = 0.2;
    body.max_tokens = 16_384;
  }
  const candidates = advisor.provider === 'groq'
    ? getGroqKeyCandidates(userId || 'anonymous')
    : [{ slot: advisor.provider, key: advisor.key() }];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const data = await request(advisor.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${candidate.key}`, ...advisor.headers },
        body: JSON.stringify(body),
      });
      return textFrom(data);
    } catch (error) {
      lastError = error;
      if (advisor.provider !== 'groq') throw error;
    }
  }

  throw Object.assign(
    new Error('Groq indisponível: as duas chaves do Groq falharam.'),
    { code: 'GROQ_KEYS_FAILED', cause: lastError },
  );
}

export function isMegaBrainCommand(model, requestedEffort, prompt) {
  return model === 'prism-taff-2.0'
    && requestedEffort === 'ultracode'
    && /^\/megabrain(?:\s|$)/i.test(String(prompt || '').trim());
}

export function stripMegaBrainCommand(prompt) {
  return String(prompt || '').trim().replace(/^\/megabrain\s*/i, '').trim();
}

export async function runMegaBrain({ prompt, context = '', userId = null, projectId = null, onProgress }) {
  const cleanPrompt = stripMegaBrainCommand(prompt);
  const task = [
    'TAREFA:',
    cleanPrompt || 'Analise profundamente o projeto e execute a melhor solução ponta a ponta.',
    '',
    'CONTEXTO:',
    String(context || '').slice(-MAX_INPUT),
  ].join('\n');

  emit(onProgress, 'megabrain_start', {
    message: 'MegaBrain ativado: consultando NVIDIA Kimi K3, Groq GPT-OSS 120B e OpenCode Zen Big Pickle.',
  });

  const enabled = ADVISORS.filter((advisor) => Boolean(advisor.key()));
  if (!enabled.length) {
    return {
      status: 'unavailable',
      message: 'MegaBrain exige pelo menos uma API configurada entre NVIDIA, Groq e OpenCode Zen.',
      model: 'prism-taff-2.0',
      effort: 'high',
      providers: [],
      tools_used: [],
      megabrain: true,
    };
  }

  const results = await Promise.all(enabled.map(async (advisor) => {
    const started = Date.now();
    emit(onProgress, 'megabrain_provider_start', { provider: advisor.provider, model: advisor.model });
    try {
      const text = String(await consult(advisor, task, userId) || '').slice(0, MAX_ADVISORY);
      emit(onProgress, 'megabrain_provider_complete', {
        provider: advisor.provider,
        model: advisor.model,
        elapsedMs: Date.now() - started,
        ok: Boolean(text),
      });
      return { ...advisor, text };
    } catch (error) {
      emit(onProgress, 'megabrain_provider_error', {
        provider: advisor.provider,
        model: advisor.model,
        message: error?.message || 'Falha',
      });
      return { ...advisor, text: '', error: error?.message || 'Falha no modelo.' };
    }
  }));

  const usable = results.filter((item) => item.text);
  const council = usable.length
    ? usable.map((item) => `=== ${item.provider.toUpperCase()} / ${item.model} ===\n${item.text}`).join('\n\n')
    : 'Nenhum conselheiro respondeu.';

  emit(onProgress, 'megabrain_synthesis_start', {
    message: 'Conselho consolidado; passando a execução para o Taff 2.0 com as ferramentas reais.',
  });

  return {
    status: 'ok',
    megabrain: true,
    userId,
    projectId,
    enrichedPrompt: [
      'MODO MEGABRAIN DO PRISM TAFF 2.0.',
      'Use o conselho abaixo como revisão independente antes de executar.',
      'Não copie uma recomendação cegamente. Compare as análises, escolha a solução tecnicamente correta e valide tudo com ferramentas reais.',
      '',
      council,
      '',
      'TAREFA ORIGINAL:',
      cleanPrompt || 'Analise profundamente o projeto e execute a melhor solução ponta a ponta.',
    ].join('\n'),
    advisors: usable.map((item) => ({ provider: item.provider, model: item.model })),
    providers: usable.map((item) => `${item.provider}:${item.model}`),
    tools_used: [],
  };
}
