import { createMcpExecutionContext } from './mcp.js';
import { normalizeEffort } from './modelRouter.js';

const REQUEST_TIMEOUT = 90_000;
const MAX_TOOL_ROUNDS = 6;
const MAX_CONTEXT = 30_000;
const PROVIDERS = new Set(['anthropic', 'openai', 'gemini']);

const ENV = {
  anthropic: () => process.env.ANTHROPIC_API_KEY,
  openai: () => process.env.OPENAI_API_KEY,
  gemini: () => process.env.GEMINI_API_KEY,
};

const DEFAULT_MODELS = {
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-7-sonnet-latest',
  openai: process.env.OPENAI_MODEL || 'gpt-4.1',
  gemini: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
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
    'Você é o núcleo de raciocínio do Prism Codex.',
    instructions[effort] || instructions.medium,
    'Use ferramentas MCP quando uma estiver disponível e for necessária para o pedido.',
    'Nunca invente que executou uma ação externa.',
    'Não revele cadeia de pensamento interna. Forneça somente conclusões, evidências e resumos de alto nível.',
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

function toolDefinitions(mcpTools) {
  return mcpTools.map((tool) => ({
    modelName: tool.modelName,
    name: tool.toolName,
    description: tool.description,
    input_schema: tool.inputSchema || { type: 'object', properties: {} },
  }));
}

function openAiTools(tools) {
  return tools.map((tool) => ({ type: 'function', function: { name: tool.modelName, description: tool.description, parameters: tool.input_schema } }));
}

async function executeTool(tool, args, mcp) {
  if (!tool) return { text: 'Ferramenta não encontrada.', isError: true };
  try { return await mcp.execute(tool.modelName, args || {}); }
  catch (error) { return { text: safeText(error?.message || 'Falha na ferramenta MCP'), isError: true }; }
}

async function callOpenAI(model, effort, input, tools, mcp) {
  const key = ENV.openai();
  if (!key) throw new Error('OPENAI_API_KEY não configurada');
  const declared = openAiTools(tools);
  const messages = [{ role: 'system', content: systemPrompt(effort) }, { role: 'user', content: input }];
  const toolsUsed = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: effort === 'low' ? 0.35 : 0.2, ...(declared.length ? { tools: declared, tool_choice: 'auto' } : {}) }),
    });
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error('OpenAI retornou uma resposta inválida');
    messages.push(message);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) return { text: message.content || '', tokens: Number(data?.usage?.total_tokens || 0), toolsUsed, thinkingSummary: 'Resposta gerada e revisada pelo modelo.' };
    for (const call of calls) {
      const tool = tools.find((entry) => entry.modelName === call?.function?.name);
      let args = {};
      try { args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { args = {}; }
      const result = await executeTool(tool, args, mcp);
      if (tool) toolsUsed.push({ server: tool.serverName, tool: tool.toolName, error: Boolean(result.isError) });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  throw new Error('OpenAI excedeu o limite de etapas de ferramentas');
}

async function callAnthropic(model, effort, input, tools, mcp) {
  const key = ENV.anthropic();
  if (!key) throw new Error('ANTHROPIC_API_KEY não configurada');
  const declared = tools.map((tool) => ({ name: tool.modelName, description: tool.description, input_schema: tool.inputSchema || { type: 'object', properties: {} } }));
  const messages = [{ role: 'user', content: input }];
  const toolsUsed = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: effort === 'low' ? 2048 : 8192, system: systemPrompt(effort), messages, ...(declared.length ? { tools: declared } : {}) }),
    });
    const blocks = Array.isArray(data?.content) ? data.content : [];
    const calls = blocks.filter((block) => block?.type === 'tool_use');
    if (!calls.length) return { text: blocks.filter((block) => block?.type === 'text').map((block) => block.text).join(''), tokens: Number(data?.usage?.input_tokens || 0) + Number(data?.usage?.output_tokens || 0), toolsUsed, thinkingSummary: 'Resposta gerada com análise de alto nível.' };
    messages.push({ role: 'assistant', content: blocks });
    const toolResults = [];
    for (const call of calls) {
      const tool = tools.find((entry) => entry.modelName === call.name);
      const result = await executeTool(tool, call.input, mcp);
      if (tool) toolsUsed.push({ server: tool.serverName, tool: tool.toolName, error: Boolean(result.isError) });
      toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: result.text || '', is_error: Boolean(result.isError) });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  throw new Error('Anthropic excedeu o limite de etapas de ferramentas');
}

function geminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return { type: 'OBJECT', properties: {} };
  const out = { type: String(schema.type || 'object').toUpperCase() };
  if (schema.description) out.description = safeText(schema.description, 1000);
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) { out.properties = {}; for (const [key, value] of Object.entries(schema.properties)) out.properties[key] = geminiSchema(value); }
  if (schema.items) out.items = geminiSchema(schema.items);
  if (schema.required) out.required = schema.required;
  return out;
}

async function callGemini(model, effort, input, tools, mcp) {
  const key = ENV.gemini();
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const declarations = tools.map((tool) => ({ name: tool.modelName, description: tool.description, parameters: geminiSchema(tool.inputSchema) }));
  const contents = [{ role: 'user', parts: [{ text: input }] }];
  const toolsUsed = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(effort) }] }, contents, ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}) }),
    });
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((part) => part?.functionCall?.name);
    if (!calls.length) return { text: parts.map((part) => part?.text || '').join(''), tokens: Number(data?.usageMetadata?.totalTokenCount || 0), toolsUsed, thinkingSummary: 'Resposta gerada e verificada com as ferramentas habilitadas.' };
    contents.push({ role: 'model', parts });
    const results = [];
    for (const call of calls) {
      const tool = tools.find((entry) => entry.modelName === call.functionCall.name);
      const result = await executeTool(tool, call.functionCall.args || {}, mcp);
      if (tool) toolsUsed.push({ server: tool.serverName, tool: tool.toolName, error: Boolean(result.isError) });
      results.push({ functionResponse: { name: call.functionCall.name, response: { result: result.text || '', isError: Boolean(result.isError) } } });
    }
    contents.push({ role: 'user', parts: results });
  }
  throw new Error('Gemini excedeu o limite de etapas de ferramentas');
}

async function callProvider(provider, model, effort, input, tools, mcp) {
  if (provider === 'anthropic') return callAnthropic(model, effort, input, tools, mcp);
  if (provider === 'openai') return callOpenAI(model, effort, input, tools, mcp);
  return callGemini(model, effort, input, tools, mcp);
}

export async function runParallelOrchestration({ prompt, context = '', effort = 'medium', userId, requestedModels = [], mcpServerIds = [] }) {
  const normalizedEffort = normalizeEffort(effort);
  const selected = (requestedModels.length ? requestedModels : [...PROVIDERS].map((provider) => ({ provider, model: DEFAULT_MODELS[provider] })))
    .filter((entry) => PROVIDERS.has(entry.provider))
    .map((entry) => ({ provider: entry.provider, model: String(entry.model || DEFAULT_MODELS[entry.provider]) }));
  const unique = [...new Map(selected.map((item) => [`${item.provider}:${item.model}`, item])).values()];
  const mcp = userId ? await createMcpExecutionContext(userId, { serverIds: mcpServerIds }) : { tools: [], errors: [], execute: async () => ({ text: 'MCP indisponível', isError: true }), close: async () => {} };
  const tools = mcp.tools;
  const input = [context ? `Contexto recente:\n${String(context).slice(-MAX_CONTEXT)}` : '', `Pedido atual:\n${String(prompt).slice(0, MAX_CONTEXT)}`].filter(Boolean).join('\n\n');
  const started = Date.now();
  try {
    const settled = await Promise.allSettled(unique.map(async (entry) => {
      const result = await callProvider(entry.provider, entry.model, normalizedEffort, input, tools, mcp);
      return { provider: entry.provider, model: entry.model, status: 'fulfilled', text: safeText(result.text, 100_000), tokens: Number(result.tokens || 0), tools_used: result.toolsUsed || [], thinking_summary: safeText(result.thinkingSummary || '', 1000), elapsed_ms: Date.now() - started };
    }));
    const results = settled.map((entry, index) => entry.status === 'fulfilled'
      ? entry.value
      : { provider: unique[index].provider, model: unique[index].model, status: 'rejected', text: '', error: safeText(entry.reason?.message || 'Falha no provedor'), tools_used: [], thinking_summary: '', elapsed_ms: Date.now() - started });
    return { results, mcp_errors: mcp.errors, elapsed_ms: Date.now() - started };
  } finally { await mcp.close().catch(() => {}); }
}
