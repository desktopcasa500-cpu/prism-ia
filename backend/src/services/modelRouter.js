export const MODEL_PROFILES = {
  'prism-nano-1.0': { effort: ['low','medium'], description: 'Respostas rápidas e econômicas' },
  'prism-mini-1.0': { effort: ['low','medium','high'], description: 'Uso geral e programação diária' },
  'prism-tex-1.5': { effort: ['medium','high','max'], description: 'Código, documentação e arquitetura' },
  'prism-taff-1.0': { effort: ['high','max','ultracode'], description: 'Projetos complexos' },
  'prism-taff-2.0': { effort: ['max','ultracode'], description: 'Ultra Code com múltiplos motores' }
};

export function getModelProfile(model = 'prism-mini-1.0') {
  return MODEL_PROFILES[model] || MODEL_PROFILES['prism-mini-1.0'];
}

export function validateThinking(model, effort) {
  return getModelProfile(model).effort.includes(effort);
}
