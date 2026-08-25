export const MODEL_PROFILES = {
  'prism-nano-1.0': {
    effort: ['low', 'medium'],
    description: 'Rápido e econômico',
    providers: ['gemini'],
    defaultModel: process.env.GEMINI_NANO_MODEL || 'gemini-2.0-flash',
  },
  'prism-mini-1.0': {
    effort: ['low', 'medium', 'high'],
    description: 'Uso geral e programação diária',
    providers: ['gemini', 'groq'],
    defaultModel: process.env.GEMINI_MINI_MODEL || 'gemini-2.0-flash',
  },
  'prism-tex-1.5': {
    effort: ['medium', 'high', 'max'],
    description: 'Código, documentação e arquitetura',
    providers: ['gemini', 'groq'],
    defaultModel: process.env.GEMINI_TEX_MODEL || 'gemini-2.0-flash',
  },
  'prism-taff-1.0': {
    effort: ['high', 'max', 'ultracode'],
    description: 'Projetos complexos',
    providers: ['gemini', 'groq', 'openrouter'],
    defaultModel: process.env.OPENROUTER_TAFF_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct',
  },
  'prism-taff-2.0': {
    effort: ['max', 'ultracode'],
    description: 'Ultra Code com múltiplos motores',
    providers: ['gemini', 'groq', 'openrouter'],
    defaultModel: process.env.OPENROUTER_TAFF2_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct',
  },
};

export function getModelProfile(model = 'prism-mini-1.0') {
  return MODEL_PROFILES[model] || MODEL_PROFILES['prism-mini-1.0'];
}

export function validateThinking(model, effort) {
  return getModelProfile(model).effort.includes(effort);
}
