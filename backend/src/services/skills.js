import { runOrchestration } from './orchestrator.js';

const MAX_SKILL_INPUT = 16_000;
const MAX_SKILL_OUTPUT = 30_000;

const SKILLS = new Map([
  ['code-review', {
    id: 'code-review',
    name: 'Revisão de código',
    description: 'Analisa código, encontra bugs reais, riscos de segurança, problemas de arquitetura e melhorias objetivas.',
    category: 'Engineering',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'high',
    model: 'prism-tex-1.5',
    buildPrompt: (input) => `Atue como revisor de código sênior. Analise somente o material recebido. Encontre bugs reais e verificáveis, riscos de segurança, problemas de arquitetura, concorrência, performance e manutenção. Para cada problema importante, explique a causa, o impacto e uma correção concreta. Não invente problemas. Se o material estiver correto em algum ponto, diga isso.\n\nMaterial:\n${input}`,
  }],
  ['project-plan', {
    id: 'project-plan',
    name: 'Planejamento de projeto',
    description: 'Transforma uma ideia em arquitetura, estrutura de arquivos, etapas executáveis, riscos e critérios de conclusão.',
    category: 'Planning',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'high',
    model: 'prism-mini-1.0',
    buildPrompt: (input) => `Crie um plano técnico executável para o projeto abaixo. Defina arquitetura, estrutura de arquivos, dependências, etapas em ordem, decisões importantes, riscos, testes e critérios objetivos de conclusão. Evite abstrações vagas.\n\nProjeto:\n${input}`,
  }],
  ['debugging', {
    id: 'debugging',
    name: 'Debugging',
    description: 'Investiga falhas com hipóteses, causa raiz, correção e validação.',
    category: 'Engineering',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'high',
    model: 'prism-taff-1.0',
    buildPrompt: (input) => `Investigue o problema abaixo como engenheiro de software. Separe sintomas, hipóteses, causa raiz provável, evidências disponíveis, correção mínima e correção robusta. Inclua como validar a correção e quais regressões testar. Não presuma fatos que não foram fornecidos.\n\nProblema:\n${input}`,
  }],
  ['frontend-polish', {
    id: 'frontend-polish',
    name: 'Frontend artesanal',
    description: 'Refina interfaces com foco em tipografia, espaçamento, responsividade, acessibilidade e motion discreto.',
    category: 'Web',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'high',
    model: 'prism-tex-1.5',
    buildPrompt: (input) => `Refine a interface descrita abaixo sem trocar sua identidade. Trabalhe tipografia, hierarquia, spacing, layout, responsividade, acessibilidade, estados de interação e motion. Preserve a estética existente e evite padrões genéricos. Entregue mudanças concretas e código quando necessário.\n\nInterface:\n${input}`,
  }],
  ['ultracode-review', {
    id: 'ultracode-review',
    name: 'Ultracode Review',
    description: 'Auditoria aprofundada de código, arquitetura, segurança, performance e pontos de falha.',
    category: 'Advanced',
    input: { type: 'string', minLength: 1, maxLength: MAX_SKILL_INPUT },
    effort: 'ultracode',
    model: 'prism-taff-2.0',
    buildPrompt: (input) => `Faça uma auditoria técnica aprofundada do material abaixo. Priorize correção, segurança, arquitetura, performance, observabilidade, testes, compatibilidade e manutenção. Aponte problemas por severidade e entregue correções concretas. Não invente APIs, comportamentos ou resultados não presentes no material.\n\nMaterial:\n${input}`,
  }],
]);

function validateInput(skill, input) {
  if (typeof input !== 'string') throw new Error('A entrada da Skill deve ser texto.');
  const value = input.trim();
  if (value.length < skill.input.minLength) throw new Error('A entrada da Skill está vazia.');
  if (value.length > skill.input.maxLength) throw new Error(`A entrada excede o limite de ${skill.input.maxLength} caracteres.`);
  return value;
}

function metadata(skill) {
  const { buildPrompt, ...safe } = skill;
  return { ...safe, output: { type: 'string', maxLength: MAX_SKILL_OUTPUT } };
}

export function listSkills() {
  return [...SKILLS.values()].map(metadata);
}

export async function executeSkill(skillId, input, context = {}) {
  const skill = SKILLS.get(skillId);
  if (!skill) {
    const error = new Error('Skill não encontrada.');
    error.code = 'SKILL_NOT_FOUND';
    throw error;
  }

  const value = validateInput(skill, input);
  const timeoutMs = Math.min(Math.max(Number(context.timeoutMs) || 120_000, 10_000), 180_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await Promise.race([
      runOrchestration(skill.buildPrompt(value), skill.effort, { model: skill.model }, '', context.userId, { enableSkills: false }),
      new Promise((_, reject) => {
        const error = new Error('A execução da Skill excedeu o tempo limite.');
        error.code = 'SKILL_TIMEOUT';
        controller.signal.addEventListener('abort', () => reject(error), { once: true });
      }),
    ]);
    return {
      ...result,
      skill: skill.id,
      mode: skill.effort,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function skillToolDefinitions() {
  return [...SKILLS.values()].map((skill) => ({
    modelName: `skill_${skill.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
    serverId: 'prism-skills',
    serverName: 'Prism Skills',
    toolName: skill.id,
    description: `${skill.name}: ${skill.description}`.slice(0, 1000),
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: `Material de entrada para a Skill ${skill.name}.` },
      },
      required: ['input'],
    },
    skillId: skill.id,
  }));
}
