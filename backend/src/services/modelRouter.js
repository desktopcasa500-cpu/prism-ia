const ALL_EFFORTS = ['low', 'medium', 'high', 'max', 'ultracode'];

export const MODEL_PROFILES = {
  'prism-nano-1.0': { effort: ALL_EFFORTS, tier: 'fast', description: 'Rápido e econômico', gemini: 'gemini-3.5-flash-lite' },
  'prism-mini-1.0': { effort: ALL_EFFORTS, tier: 'general', description: 'Uso geral, conversa e programação', gemini: 'gemini-3.6-flash' },
  'prism-tex-1.5': { effort: ALL_EFFORTS, tier: 'code', description: 'Código, documentação e arquitetura', gemini: 'gemini-3.6-flash' },
  'prism-taff-1.0': { effort: ALL_EFFORTS, tier: 'advanced', description: 'Projetos complexos e debugging', gemini: 'gemini-3.6-flash' },
  'prism-taff-2.0': { effort: ALL_EFFORTS, tier: 'ultra', description: 'Orquestração máxima', gemini: 'gemini-3.5-flash' },
};

export function getModelProfile(model = 'prism-mini-1.0') {
  return MODEL_PROFILES[model] || MODEL_PROFILES['prism-mini-1.0'];
}

export function validateThinking(model, effort) {
  return ALL_EFFORTS.includes(effort) && Boolean(getModelProfile(model));
}

export function normalizeEffort(effort = 'medium') {
  return ALL_EFFORTS.includes(effort) ? effort : 'medium';
}
