const ALL_EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];

export const MODEL_PROFILES = {
  'prism-nano-1.0': {
    effort: ALL_EFFORTS,
    description: 'Rápido e econômico',
    providers: ['gemini', 'groq'],
    defaultModel: process.env.GEMINI_NANO_MODEL || 'gemini-3.5-flash-lite',
    groqModel: process.env.GROQ_NANO_MODEL || 'openai/gpt-oss-20b',
  },
  'prism-mini-1.0': {
    effort: ALL_EFFORTS,
    description: 'Uso geral e programação diária',
    providers: ['gemini', 'groq'],
    defaultModel: process.env.GEMINI_MINI_MODEL || 'gemini-3.6-flash',
    groqModel: process.env.GROQ_MINI_MODEL || 'openai/gpt-oss-20b',
  },
  'prism-tex-1.5': {
    effort: ALL_EFFORTS,
    description: 'Código, documentação e arquitetura',
    providers: ['gemini', 'groq'],
    defaultModel: process.env.GEMINI_TEX_MODEL || 'gemini-3.6-flash',
    groqModel: process.env.GROQ_TEX_MODEL || 'openai/gpt-oss-120b',
  },
  'prism-taff-1.0': {
    effort: ALL_EFFORTS,
    description: 'Projetos complexos',
    providers: ['gemini', 'groq', 'openrouter'],
    defaultModel: process.env.GEMINI_TAFF_MODEL || 'gemini-3.1-pro-preview',
    groqModel: process.env.GROQ_TAFF_MODEL || 'openai/gpt-oss-120b',
    openrouterModel: process.env.OPENROUTER_TAFF_MODEL || 'openai/gpt-oss-120b',
  },
  'prism-taff-2.0': {
    effort: ALL_EFFORTS,
    description: 'Ultra Code com múltiplos motores',
    providers: ['gemini', 'groq', 'openrouter'],
    defaultModel: process.env.GEMINI_TAFF2_MODEL || 'gemini-3.1-pro-preview',
    groqModel: process.env.GROQ_TAFF2_MODEL || 'openai/gpt-oss-120b',
    openrouterModel: process.env.OPENROUTER_TAFF2_MODEL || 'openai/gpt-oss-120b',
  },
};

export function getModelProfile(model = 'prism-mini-1.0') {
  return MODEL_PROFILES[model] || MODEL_PROFILES['prism-mini-1.0'];
}

export function validateThinking(model, effort) {
  return ALL_EFFORTS.includes(effort) && getModelProfile(model).effort.includes(effort);
}
