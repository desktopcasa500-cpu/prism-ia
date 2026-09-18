import { createMcpExecutionContext } from './mcp.js';
import { normalizeEffort } from './modelRouter.js';
import { getGroqKeyCandidates, isGroqConfigured } from './groqRouter.js';

const REQUEST_TIMEOUT = 90_000;
const MAX_TOOL_ROUNDS = 6;
const MAX_CONTEXT = 30_000;
const PROVIDERS = new Set(['nvidia', 'groq', 'opencode']);
const ENV = {
  nvidia: () => process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY,
  groq: () => isGroqConfigured(),
  opencode: () => process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY,
};
const ENDPOINTS = {
  nvidia: 'https://integrate.api.nvidia.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  opencode: 'https://opencode.ai/zen/v1/chat/completions',
};

function safeText(value, max = 4000) { return String(value || '').slice(0, max); }

function systemPrompt(effort) {
  const instructions = {
    low: 'Seja direto e econômico.',
    medium: 'Analise com cuidado e entregue uma resposta completa.',
    high: 'Aprofunde a análise técnica e revise casos de erro antes da resposta.',
    max: 'Priorize precisão, arquitetura, consistência e revisão ponta a ponta.',
    ultracode: 'Atue como engenheiro principal. Planeje, implemente, revise e considere segurança, edge cases e manutenção.',
  };
  return [
    'Você é o núcleo de raciocínio paralelo do Prism Codex.',
    instructions[effort] || instructions.medium,
    'Use ferramentas MCP quando estiverem disponíveis e forem necessárias.',
    'Nunca invente que executou uma ação externa.',
    'Não revele cadeia de pensamento interna. Forneça apenas conclusões, evidências e resumos de alto nível.',
  ].join('\n');
}

async function request(url, options, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) throw new Error(safeText(data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`));
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('tempo limite do provedor excedido');
    throw error;
  } finally { clearTimeout(timer); }
}

function openAiTools(tools) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.modelName,
      description: tool.description,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

async function executeTool(tool, args, mcp) {
  if (!tool) return { text: 'Ferramenta não encontrada.', isError: true };
  try { return await mcp.execute(tool.modelName, args || {}); }
  catch (error) { return { text: safeText(error?.message || 'Falha na ferramenta MCP'), isError: true }; }
}

async function callProvider(provider, model, effort, input, tools, mcp, userId) {
  const keys = provider === 'groq'
    ? getGroqKeyCandidates(userId || 'anonymous')
    : [{ slot: provider, key: ENV[provider]?.() }];

  if (!keys.length || !keys[0].key) throw new Error(`${provider.toUpperCase()} API não configurada`);
  let lastError = null;

  for (const keyEntry of keys) {
    try {
      const messages = [{ role: 'system', content: systemPrompt(effort) }, { role: 'user', content: input }];
      const declared = openAiTools(tools);
      const toolsUsed = [];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const body = {
          model,
          messages,
          temperature: effort === 'low' ? 0.35 : 0.2,
          ...(declared.length ? { tools: declared, tool_choice: 'auto' } : {}),
        };
    if (provider === 'groq' && effort !== 'low') body.reasoning_effort = effort === 'ultracode' || effort === 'max' ? 'high' : effort;
    if (provider === 'nvidia' && effort === 'ultracode') body.reasoning_effort = 'max';
        const data = await request(ENDPOINTS[provider], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keyEntry.key}`, ...(provider === 'opencode' ? { 'X-Title': 'Prism IA' } : {}) },
          body: JSON.stringify(body),
        });
        const message = data?.choices?.[0]?.message;
        if (!message) throw new Error(`${provider} retornou uma resposta inválida`);
        messages.push(message);
        const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
        if (!calls.length) return {
          text: String(message.content || ''),
          tokens: Number(data?.usage?.total_tokens || 0),
          toolsUsed,
          thinkingSummary: 'Análise concluída.',
        };
        for (const call of calls) {
          const tool = tools.find((entry) => entry.modelName === call?.function?.name);
          let args = {};
          try { args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch {}
          const result = await executeTool(tool, args, mcp);
          if (tool) toolsUsed.push({ server: tool.serverName, tool: tool.toolName, error: Boolean(result.isError) });
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }
      throw new Error(`${provider} excedeu o limite de etapas de ferramentas`);
    } catch (error) {
      lastError = error;
      if (provider !== 'groq') throw error;
    }
  }

  throw Object.assign(
    new Error('Groq indisponível: as duas chaves do Groq falharam.'),
    { code: 'GROQ_KEYS_FAILED', cause: lastError },
  );
}

export async function runParallelOrchestration({
  prompt,
  context = '',
  effort = 'medium',
  userId,
  requestedModels = [],
  mcpServerIds = [],
}) {
  const normalizedEffort = normalizeEffort(effort);
  const selected = requestedModels
    .filter((entry) => entry && PROVIDERS.has(String(entry.provider)) && String(entry.model || '').length <= 120)
    .map((entry) => ({ provider: String(entry.provider), model: String(entry.model) }));
  if (!selected.length) return { results: [], mcp_errors: [], elapsed_ms: 0 };
  const unique = [...new Map(selected.map((item) => [`${item.provider}:${item.model}`, item])).values()];
  const mcp = userId
    ? await createMcpExecutionContext(userId, { serverIds: mcpServerIds })
    : { tools: [], errors: [], execute: async () => ({ text: 'MCP indisponível', isError: true }), close: async () => {} };
  const input = [
    context ? `Contexto recente:\n${String(context).slice(-MAX_CONTEXT)}` : '',
    `Pedido atual:\n${String(prompt).slice(0, MAX_CONTEXT)}`,
  ].filter(Boolean).join('\n\n');
  const started = Date.now();
  try {
    const settled = await Promise.allSettled(unique.map(async (entry) => {
      const result = await callProvider(entry.provider, entry.model, normalizedEffort, input, mcp.tools, mcp, userId);
      return {
        provider: entry.provider,
        model: entry.model,
        status: 'fulfilled',
        text: safeText(result.text, 100_000),
        tokens: Number(result.tokens || 0),
        tools_used: Array.isArray(result.toolsUsed) ? result.toolsUsed : [],
        thinking_summary: safeText(result.thinkingSummary || '', 1000),
        elapsed_ms: Date.now() - started,
      };
    }));
    return {
      results: settled.map((entry, index) => entry.status === 'fulfilled'
        ? entry.value
        : { provider: unique[index].provider, model: unique[index].model, status: 'rejected', text: '', error: safeText(entry.reason?.message || 'Falha no provedor'), tools_used: [], thinking_summary: '', elapsed_ms: Date.now() - started }),
      mcp_errors: Array.isArray(mcp.errors) ? mcp.errors : [],
      elapsed_ms: Date.now() - started,
    };
  } finally {
    await mcp.close().catch(() => {});
  }
}
