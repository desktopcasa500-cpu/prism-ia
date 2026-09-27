const REQUESTED_EFFORTS = Object.freeze(['low', 'medium', 'high', 'max', 'ultracode']);
const EXECUTION_EFFORTS = Object.freeze(['low', 'medium', 'high']);

export const MODEL_PROFILES = Object.freeze({
  'prism-nano-1.0': {
    effort: REQUESTED_EFFORTS,
    tier: 'fast',
    description: 'Rápido e econômico.',
    providers: { nvidia: 'nvidia/nemotron-3.5-lightning-30b-a3b' },
  },
  'prism-mini-1.0': {
    effort: REQUESTED_EFFORTS,
    tier: 'general',
    description: 'Uso geral, pensamento e correção.',
    providers: {
      nvidia: 'nvidia/nemotron-3-ultra-550b-a55b',
      groq: 'openai/gpt-oss-20b',
    },
  },
  'prism-edge-1.0': {
    effort: REQUESTED_EFFORTS,
    tier: 'reasoning',
    description: 'Análise e revisão profunda.',
    providers: {
      nvidia: 'nvidia/nemotron-3.5-lightning-30b-a3b',
      groq: 'openai/gpt-oss-20b',
    },
  },
  'prism-tex-1.5': {
    effort: REQUESTED_EFFORTS,
    tier: 'code',
    description: 'Código, documentação e arquitetura.',
    providers: {
      nvidia: 'moonshotai/kimi-k3',
      groq: 'openai/gpt-oss-120b',
    },
  },
  'prism-taff-1.0': {
    effort: REQUESTED_EFFORTS,
    tier: 'advanced',
    description: 'Projetos complexos, raciocínio e debugging.',
    providers: {
      nvidia: 'nvidia/nemotron-3-ultra-550b-a55b',
      groq: 'openai/gpt-oss-120b',
    },
  },
  'prism-taff-2.0': {
    effort: REQUESTED_EFFORTS,
    tier: 'ultra',
    description: 'Orquestração máxima e MegaBrain.',
    providers: {
      nvidia: 'moonshotai/kimi-k3',
      groq: 'openai/gpt-oss-120b',
      opencode: 'big-pickle',
    },
  },
});

export function isKnownModel(model) {
  return Object.prototype.hasOwnProperty.call(MODEL_PROFILES, model);
}

export function getModelProfile(model = 'prism-mini-1.0') {
  return MODEL_PROFILES[model] || MODEL_PROFILES['prism-mini-1.0'];
}

export function isValidRequestedEffort(effort) {
  return REQUESTED_EFFORTS.includes(String(effort || '').toLowerCase());
}

export function normalizeRequestedEffort(effort = 'medium') {
  const value = String(effort || '').trim().toLowerCase();
  return isValidRequestedEffort(value) ? value : 'medium';
}

/**
 * Backward-compatible helper used by older route code.
 * It intentionally maps max/ultracode to the highest executable provider mode.
 */
export function normalizeEffort(effort = 'medium') {
  const requested = normalizeRequestedEffort(effort);
  return requested === 'max' || requested === 'ultracode' ? 'high' : requested;
}

export function validateThinking(model, effort) {
  if (!isKnownModel(model)) return false;
  const requested = normalizeRequestedEffort(effort);
  return MODEL_PROFILES[model].effort.includes(requested);
}

export function resolveExecutionEffort(requestedEffort = 'medium', supportedEfforts = EXECUTION_EFFORTS) {
  const requested = normalizeEffort(requestedEffort);
  const supported = EXECUTION_EFFORTS.filter((level) => supportedEfforts.includes(level));
  if (!supported.length) return 'medium';
  if (supported.includes(requested)) return requested;

  const target = EXECUTION_EFFORTS.indexOf(requested);
  return [...supported].sort(
    (a, b) => Math.abs(EXECUTION_EFFORTS.indexOf(a) - target) - Math.abs(EXECUTION_EFFORTS.indexOf(b) - target),
  )[0];
}

export function getProviderEffort(provider, requestedEffort) {
  return resolveExecutionEffort(
    requestedEffort,
    {
      nvidia: EXECUTION_EFFORTS,
      groq: EXECUTION_EFFORTS,
      opencode: EXECUTION_EFFORTS,
      openrouter: EXECUTION_EFFORTS,
    }[provider] || EXECUTION_EFFORTS,
  );
}

export const REQUESTED_EFFORT_LEVELS = REQUESTED_EFFORTS;
export const EXECUTION_EFFORT_LEVELS = EXECUTION_EFFORTS;
