/** Prism IA — orquestração por modelo, Skills e ferramentas MCP reais. */
import { getModelProfile, normalizeEffort } from './modelRouter.js';
import { createMcpExecutionContext } from './mcp.js';
import { skillToolDefinitions } from './skills.js';

const PROVIDER_TIMEOUT = 45_000;
const MAX_TOOL_ROUNDS = 8;
const MAX_CONTEXT = 30_000;
const GEMINI_KEY = () => process.env.GEMINI_API_KEY;
const GROQ_KEY = () => process.env.GROQ_API_KEY;
const OPENROUTER_KEY = () => process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_NVIDIA_API_KEY;

function effortInstruction(effort) {
  return ({
    low: 'Responda de forma direta e rápida. Não complique tarefas simples.',
    medium: 'Analise o pedido com cuidado e entregue uma resposta completa sem raciocínio desnecessariamente longo.',
    high: 'Faça uma análise técnica mais profunda antes de responder. Verifique detalhes e casos de erro.',
    max: 'Priorize precisão, arquitetura, consistência e revisão. Resolva o problema de ponta a ponta.',
    ultracode: 'Atue como um engenheiro sênior. Planeje, implemente, revise e entregue a melhor solução possível. Para código, considere segurança, edge cases, manutenção e integração.',
  })[effort] || 'Analise o pedido com cuidado e entregue uma resposta completa.';
}

function systemPrompt(model, effort, hasTools, toolKinds) {
  const profile = getModelProfile(model);
  const toolInstruction = hasTools
    ? `Ferramentas reais disponíveis: ${toolKinds.join(', ')}. Use Skills para trabalhos especializados e MCP para dados ou ações externas. Não diga que uma ação foi feita sem executar a ferramenta e obter um resultado.`
    : 'Nenhuma ferramenta externa está disponível nesta execução. Não invente integrações.';
  return [
    'Você é a Prism IA, uma assistente geral e engenheira de software quando o pedido envolve tecnologia.',
    'Responda ao objetivo do usuário sem transformar tudo em programação.',
    'Quando houver código, entregue código utilizável e preserve a arquitetura existente quando ela for relevante.',
    'Nunca invente resultados de ferramentas, arquivos, execuções ou integrações.',
    `Modelo lógico: ${model}. Perfil: ${profile.description}.`,
    effortInstruction(effort),
    toolInstruction,
  ].join('\n');
}

async function request(url, options, timeout = PROVIDER_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`;
      throw new Error(String(detail).slice(0, 1000));
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('tempo limite do provedor excedido');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildInput(prompt, context = '') {
  const cleanPrompt = String(prompt || '').slice(0, MAX_CONTEXT);
  const cleanContext = String(context || '').slice(-MAX_CONTEXT);
  return cleanContext ? `Contexto recente da conversa:\n${cleanContext}\n\nPedido atual:\n${cleanPrompt}` : cleanPrompt;
}

function sanitizeOpenAiSchema(schema, depth = 0) {
  if (!schema || typeof schema !== 'object' || depth > 8) return { type: 'object', properties: {} };
  if (Array.isArray(schema)) return schema.slice(0, 50).map((item) => sanitizeOpenAiSchema(item, depth + 1));
  const out = {};
  for (const key of ['type', 'description', 'format', 'enum', 'required']) {
    if (schema[key] !== undefined) out[key] = Array.isArray(schema[key]) ? schema[key].slice(0, 50) : schema[key];
  }
  if (schema.properties && typeof schema.properties === 'object') {
    out.properties = {};
    for (const [key, value] of Object.entries(schema.properties).slice(0, 100)) out.properties[String(key).slice(0, 80)] = sanitizeOpenAiSchema(value, depth + 1);
  }
  if (schema.items) out.items = sanitizeOpenAiSchema(schema.items, depth + 1);
  if (!out.type) out.type = out.properties ? 'object' : 'string';
  if (out.type === 'object' && !out.properties) out.properties = {};
  return out;
}

function geminiSchema(schema, depth = 0) {
  const clean = sanitizeOpenAiSchema(schema, depth);
  const out = { type: String(clean.type || 'object').toUpperCase() };
  if (clean.description) out.description = String(clean.description).slice(0, 1000);
  if (Array.isArray(clean.enum)) out.enum = clean.enum.slice(0, 100);
  if (clean.format) out.format = clean.format;
  if (Array.isArray(clean.required) && clean.required.length) out.required = clean.required.slice(0, 100);
  if (clean.type === 'object' || clean.properties) {
    out.properties = {};
    for (const [key, value] of Object.entries(clean.properties || {})) out.properties[key] = geminiSchema(value, depth + 1);
  }
  if (clean.items) out.items = geminiSchema(clean.items, depth + 1);
  return out;
}

function toolDefinitions(execution) {
  const mcp = execution.mcpTools.map((tool) => ({ ...tool, kind: 'mcp' }));
  const skills = execution.skillTools.map((tool) => ({ ...tool, kind: 'skill', serverName: 'Prism Skills' }));
  return [...mcp, ...skills];
}

function openAiTools(tools) {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.modelName,
      description: String(tool.description || tool.toolName || tool.skillId).slice(0, 1000),
      parameters: sanitizeOpenAiSchema(tool.inputSchema),
    },
  }));
}

function geminiTools(tools) {
  return [{
    functionDeclarations: tools.map((tool) => ({
      name: tool.modelName,
      description: String(tool.description || tool.toolName || tool.skillId).slice(0, 1000),
      parameters: geminiSchema(tool.inputSchema),
    })),
  }];
}

function geminiToolCalls(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .filter((part) => part?.functionCall?.name)
    .map((part) => ({ id: part.functionCall.id, name: part.functionCall.name, arguments: part.functionCall.args || {} }));
}

function geminiParts(data) {
  return Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
}

function toolByName(tools, name) {
  return tools.find((tool) => tool.modelName === name);
}

async function executeTool(tool, args, execution) {
  if (!tool) return { text: '', error: 'Ferramenta desconhecida' };
  if (tool.kind === 'skill') {
    const { executeSkill } = await import('./skills.js');
    const result = await executeSkill(tool.skillId, typeof args?.input === 'string' ? args.input : '', { userId: execution.userId, timeoutMs: 150_000 });
    return { text: String(result?.text || '').slice(0, 30_000), isError: false, nestedTools: Array.isArray(result?.tools_used) ? result.tools_used : [] };
  }
  const result = await execution.mcp.execute(tool.modelName, args);
  return { text: result.text || '', isError: Boolean(result.isError), nestedTools: [] };
}

async function callGemini(prompt, model, effort, execution, tools) {
  const key = GEMINI_KEY();
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const profile = getModelProfile(model);
  const geminiModel = process.env.GEMINI_MODEL || profile.gemini || profile.defaultModel || 'gemini-3.6-flash';
  const declaredTools = tools.length ? geminiTools(tools) : undefined;
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const toolsUsed = [];
  let totalTokens = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(model, effort, Boolean(tools.length), tools.length ? ['Skills', 'MCP'] : []) }] },
        contents,
        ...(declaredTools ? { tools: declaredTools } : {}),
        generationConfig: { temperature: effort === 'low' ? 0.35 : 0.2 },
      }),
    });
    totalTokens += Number(data?.usageMetadata?.totalTokenCount || 0);
    const calls = geminiToolCalls(data);
    if (!calls.length) return { provider: 'gemini', text: geminiParts(data).map((part) => part?.text || '').join(''), tokens: totalTokens, toolsUsed };

    contents.push({ role: 'model', parts: geminiParts(data) });
    const responses = [];
    for (const call of calls) {
      const tool = toolByName(tools, call.name);
      try {
        const result = await executeTool(tool, call.arguments, execution);
        if (tool) toolsUsed.push({ kind: tool.kind, server: tool.serverName, tool: tool.toolName || tool.skillId });
        if (result.nestedTools?.length) toolsUsed.push(...result.nestedTools.map((item) => ({ ...item, via: tool?.skillId || 'skill' })));
        responses.push({ name: call.name, id: call.id, response: { result: result.text, isError: Boolean(result.isError) } });
      } catch (error) {
        if (tool) toolsUsed.push({ kind: tool.kind, server: tool.serverName, tool: tool.toolName || tool.skillId, error: true });
        responses.push({ name: call.name, id: call.id, response: { error: error?.message || 'Falha na ferramenta' } });
      }
    }
    contents.push({ role: 'user', parts: responses.map((item) => ({ functionResponse: { name: item.name, ...(item.id ? { id: item.id } : {}), response: item.response } })) });
  }
  throw new Error('O modelo excedeu o limite de etapas de ferramentas');
}

async function callOpenAiCompatible(url, key, provider, prompt, model, effort, execution, tools, providerModel, extraHeaders = {}) {
  const messages = [
    { role: 'system', content: systemPrompt(model, effort, Boolean(tools.length), tools.length ? ['Skills', 'MCP'] : []) },
    { role: 'user', content: prompt },
  ];
  const declaredTools = tools.length ? openAiTools(tools) : undefined;
  const toolsUsed = [];
  let totalTokens = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
      body: JSON.stringify({
        model: providerModel,
        messages,
        ...(declaredTools ? { tools: declaredTools, tool_choice: 'auto' } : {}),
        temperature: effort === 'low' ? 0.35 : 0.2,
        ...(provider === 'groq' ? { reasoning_effort: ['low', 'medium', 'high'].includes(effort) ? effort : 'high' } : {}),
      }),
    });
    totalTokens += Number(data?.usage?.total_tokens || 0);
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error(`${provider} retornou uma resposta inválida`);
    messages.push(message);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) return { provider, text: message.content || '', tokens: totalTokens, toolsUsed };

    for (const call of calls) {
      const tool = toolByName(tools, call?.function?.name);
      let args = {};
      try { args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { args = {}; }
      let content;
      try {
        const result = await executeTool(tool, args, execution);
        if (tool) toolsUsed.push({ kind: tool.kind, server: tool.serverName, tool: tool.toolName || tool.skillId });
        if (result.nestedTools?.length) toolsUsed.push(...result.nestedTools.map((item) => ({ ...item, via: tool?.skillId || 'skill' })));
        content = JSON.stringify({ result: result.text || '', isError: Boolean(result.isError) });
      } catch (error) {
        if (tool) toolsUsed.push({ kind: tool.kind, server: tool.serverName, tool: tool.toolName || tool.skillId, error: true });
        content = JSON.stringify({ error: error?.message || 'Falha na ferramenta' });
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }
  throw new Error(`${provider} excedeu o limite de etapas de ferramentas`);
}

async function callGroq(prompt, model, effort, execution, tools) {
  const key = GROQ_KEY();
  if (!key) throw new Error('GROQ_API_KEY não configurada');
  const profile = getModelProfile(model);
  const providerModel = process.env.GROQ_MODEL || profile.groqModel || (model === 'prism-nano-1.0' ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b');
  return callOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions', key, 'groq', prompt, model, effort, execution, tools, providerModel);
}

async function callOpenRouter(prompt, model, effort, execution, tools) {
  const key = OPENROUTER_KEY();
  if (!key) throw new Error('OPENROUTER_API_KEY não configurada');
  const profile = getModelProfile(model);
  const providerModel = process.env.OPENROUTER_MODEL || profile.openrouterModel || 'openai/gpt-oss-120b';
  return callOpenAiCompatible('https://openrouter.ai/api/v1/chat/completions', key, 'openrouter', prompt, model, effort, execution, tools, providerModel, {
    'HTTP-Referer': process.env.APP_URL || 'https://prism-ia.app',
    'X-Title': 'Prism IA',
  });
}

export async function runOrchestration(prompt, effort = 'medium', profile = null, context = '', userId = null, options = {}) {
  const model = profile?.model || profile?.id || 'prism-mini-1.0';
  const normalizedEffort = normalizeEffort(effort);
  const input = buildInput(prompt, context);
  const mcp = userId ? await createMcpExecutionContext(userId) : { tools: [], errors: [], execute: async () => { throw new Error('MCP indisponível'); }, close: async () => {} };
  const skillTools = options.enableSkills === false ? [] : skillToolDefinitions();
  const tools = toolDefinitions({ mcpTools: mcp.tools, skillTools });
  const execution = { userId, mcp, mcpTools: mcp.tools, skillTools };
  const providers = [];
  const providerErrors = [];

  try {
    if (GEMINI_KEY()) providers.push({ name: 'gemini', call: callGemini });
    if (GROQ_KEY() && (normalizedEffort !== 'low' || model !== 'prism-nano-1.0')) providers.push({ name: 'groq', call: callGroq });
    if (OPENROUTER_KEY() && (normalizedEffort === 'ultracode' || model === 'prism-taff-2.0')) providers.push({ name: 'openrouter', call: callOpenRouter });

    for (const provider of providers) {
      try {
        const result = await provider.call(input, model, normalizedEffort, execution, tools);
        if (result?.text?.trim()) {
          return {
            text: result.text.trim(),
            tokens: Number(result.tokens || 0),
            providers: [result.provider],
            tools_used: Array.isArray(result.toolsUsed) ? result.toolsUsed : [],
            mcp_errors: mcp.errors,
            provider_errors: providerErrors,
            model,
            effort: normalizedEffort,
          };
        }
        providerErrors.push(`${provider.name}: resposta vazia`);
      } catch (error) {
        providerErrors.push(`${provider.name}: ${error?.message || 'indisponível'}`);
      }
    }

    if (!providers.length) throw new Error('Nenhuma chave de IA está configurada no backend.');
    throw new Error(`Nenhum provedor respondeu: ${providerErrors.join(' | ')}`);
  } finally {
    await mcp.close().catch(() => {});
  }
}
