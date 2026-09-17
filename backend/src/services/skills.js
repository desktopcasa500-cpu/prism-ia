const MAX_INPUT = 16_000;
const skills = new Map([
  ['code-review', { name: 'Revisão de código', category: 'Engineering', description: 'Encontra bugs, riscos de segurança, problemas de arquitetura e melhorias verificáveis.', effort: 'high', model: 'prism-tex-1.5', prompt: (input) => `Revise este material como engenheiro sênior. Encontre somente problemas sustentados pelo texto, explique impacto e correção e indique como validar.\n\n${input}` }],
  ['project-plan', { name: 'Planejamento de projeto', category: 'Planning', description: 'Transforma uma ideia em arquitetura, etapas executáveis, testes e critérios de conclusão.', effort: 'high', model: 'prism-mini-1.0', prompt: (input) => `Transforme o projeto abaixo em um plano técnico executável com arquitetura, arquivos, dependências, etapas, riscos, testes e critérios objetivos de conclusão.\n\n${input}` }],
  ['debugging', { name: 'Debugging', category: 'Engineering', description: 'Investiga falhas por evidências, causa raiz, correção e validação.', effort: 'high', model: 'prism-taff-1.0', prompt: (input) => `Investigue o problema abaixo. Separe sintomas, hipóteses, causa raiz provável, evidências, correção e testes de regressão. Não invente fatos.\n\n${input}` }],
  ['frontend-polish', { name: 'Frontend artesanal', category: 'Web', description: 'Refina tipografia, layout, acessibilidade, interação e responsividade.', effort: 'high', model: 'prism-tex-1.5', prompt: (input) => `Refine esta interface sem apagar sua identidade. Trabalhe hierarquia, espaçamento, responsividade, acessibilidade e estados de interação. Entregue mudanças concretas.\n\n${input}` }],
  ['ultracode-review', { name: 'Ultracode Review', category: 'Advanced', description: 'Auditoria profunda de arquitetura, segurança, performance, testes e manutenção.', effort: 'ultracode', model: 'prism-taff-2.0', prompt: (input) => `Faça uma auditoria técnica profunda do material. Priorize correção, segurança, arquitetura, performance, observabilidade, testes e manutenção.\n\n${input}` }],
]);

function cleanInput(value) {
  if (typeof value !== 'string') throw Object.assign(new Error('A entrada da Skill deve ser texto.'), { code: 'SKILL_INPUT_INVALID' });
  const input = value.trim();
  if (!input) throw Object.assign(new Error('A entrada da Skill está vazia.'), { code: 'SKILL_INPUT_EMPTY' });
  if (input.length > MAX_INPUT) throw Object.assign(new Error('A entrada da Skill excede o limite.'), { code: 'SKILL_INPUT_TOO_LARGE' });
  return input;
}

export function listSkills() { return [...skills.entries()].map(([id, skill]) => ({ id, ...skill, output: { type: 'string' } })); }
export async function executeSkill(skillId, value, context = {}) {
  const skill = skills.get(skillId);
  if (!skill) throw Object.assign(new Error('Skill não encontrada.'), { code: 'SKILL_NOT_FOUND' });
  const input = cleanInput(value);
  const { runOrchestration } = await import('./orchestrator.js');
  const result = await runOrchestration(skill.prompt(input), skill.effort, { model: skill.model }, '', context.userId || null, { enableSkills: false, projectId: context.projectId, onProgress: context.onProgress });
  return { ...result, skill: skillId, mode: skill.effort };
}
export function skillToolDefinitions() { return [...skills.entries()].map(([id, skill]) => ({ modelName: `skill_${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`, serverId: 'prism-skills', serverName: 'Prism Skills', toolName: id, skillId: id, kind: 'skill', description: `${skill.name}: ${skill.description}`, inputSchema: { type: 'object', properties: { input: { type: 'string', description: `Material para ${skill.name}.` } }, required: ['input'] } })); }
