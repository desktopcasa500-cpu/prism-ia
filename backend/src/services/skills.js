import { runOrchestration } from './orchestrator.js';

const MAX_SKILL_INPUT = 16_000;

const SKILLS = new Map([
  ['code-review', {
    id: 'code-review',
    name: 'Revisão de código',
    description: 'Analisa código, encontra riscos e sugere correções objetivas.',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'medium',
    run: async ({ input }) => runOrchestration(`Atue como revisor de código. Analise o conteúdo abaixo. Aponte bugs, riscos de segurança, problemas de arquitetura e melhorias. Não invente problemas.\n\n${input}`, 'medium'),
  }],
  ['project-plan', {
    id: 'project-plan',
    name: 'Planejamento de projeto',
    description: 'Transforma uma ideia em arquitetura, etapas e critérios técnicos.',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'medium',
    run: async ({ input }) => runOrchestration(`Crie um plano técnico executável para o projeto abaixo. Inclua arquitetura, estrutura de arquivos, etapas, riscos e critérios de conclusão.\n\n${input}`, 'medium'),
  }],
  ['ultracode-review', {
    id: 'ultracode-review',
    name: 'Ultracode Review',
    description: 'Revisão aprofundada usando a execução Ultracode disponível.',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'ultracode',
    run: async ({ input }) => runOrchestration(`Faça uma revisão técnica aprofundada do conteúdo abaixo. Priorize correção, segurança, arquitetura, performance e pontos de falha. Entregue mudanças concretas.\n\n${input}`, 'ultracode'),
  }],
]);

function validateInput(skill, input) {
  if (typeof input !== 'string') throw new Error('A entrada da Skill deve ser texto.');
  const value = input.trim();
  if (value.length < skill.input.minLength) throw new Error('A entrada da Skill está vazia.');
  if (value.length > skill.input.maxLength) throw new Error(`A entrada excede o limite de ${skill.input.maxLength} caracteres.`);
  return value;
}

export function listSkills() {
  return [...SKILLS.values()].map(({ run, ...metadata }) => metadata);
}

export async function executeSkill(skillId, input, context = {}) {
  const skill = SKILLS.get(skillId);
  if (!skill) {
    const error = new Error('Skill não encontrada.');
    error.code = 'SKILL_NOT_FOUND';
    throw error;
  }

  const value = validateInput(skill, input);
  const timeoutMs = Math.min(Math.max(Number(context.timeoutMs) || 60_000, 5_000), 120_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await Promise.race([
      skill.run({ input: value, userId: context.userId }),
      new Promise((_, reject) => {
        const error = new Error('A execução da Skill excedeu o tempo limite.');
        error.code = 'SKILL_TIMEOUT';
        controller.signal.addEventListener('abort', () => reject(error), { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
