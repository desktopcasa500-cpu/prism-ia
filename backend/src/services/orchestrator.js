/** Prism IA — orquestração multi-provider com fallback seguro. */
import { getModelProfile, normalizeEffort } from './modelRouter.js';
import { createMcpExecutionContext } from './mcp.js';
import { skillToolDefinitions } from './skills.js';
import { searchWeb, webSearchConfigured } from './webSearch.js';

const WEB_SEARCH_TOOL_NAME = 'prism_web_search';

function webSearchToolDefinition() {
  return {
    modelName: WEB_SEARCH_TOOL_NAME,
    serverId: 'prism-native', serverName: 'Prism Web Search', toolName: 'web_search', kind: 'native',
    description: 'Busca informação atual na internet (Google/web). Use sempre que o pedido envolver fatos recentes, notícias, preços, eventos, versões de produtos ou qualquer coisa que possa ter mudado após o treinamento do modelo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termos de busca, curtos e diretos.' },
      },
      required: ['query'],
    },
  };
}

const PROVIDER_TIMEOUT = 12_000;
const MCP_BOOT_TIMEOUT = 7_000;
const MAX_TOOL_ROUNDS = 8;
const MAX_CONTEXT = 30_000;
const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade nos servidores. Tente novamente mais tarde.';

const GEMINI_KEY = () => process.env.GEMINI_API_KEY;
const GROQ_KEY = () => process.env.GROQ_API_KEY;
const OPENROUTER_KEY = () => process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_NVIDIA_API_KEY;
const NVIDIA_NIM_KEY = () => process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY;
const NVIDIA_NIM_BASE = () => String(process.env.NVIDIA_NIM_BASE_URL || process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');

function effortInstruction(effort) {
  return ({
    low: 'Responda de forma direta e rápida. Não complique tarefas simples.',
    medium: 'Analise o pedido com cuidado e entregue uma resposta completa sem raciocínio desnecessariamente longo.',
    high: 'Faça uma análise técnica mais profunda antes de responder. Verifique detalhes e casos de erro.',
    max: 'Priorize precisão, arquitetura, consistência e revisão. Resolva o problema de ponta a ponta.',
    ultracode: 'Atue como um engenheiro sênior. Planeje, implemente, revise e entregue a melhor solução possível. Para código, considere segurança, edge cases, manutenção e integração.',
  })[effort] || 'Analise o pedido com cuidado e entregue uma resposta completa.';
}

function needsExternalTool(prompt) {
  return /\b(mcp|use o mcp|use mcp|github|gitHub|pesquise|pesquisa|busque|busca(r)?|procure|consulte|consulta|dados externos|servidor|reposit[oó]rio|repo|issues?|pull requests?|arquivos? do projeto|banco de dados|database|not[ií]cia|not[ií]cias|hoje|atual(mente)?|recente|essa semana|esse m[eê]s|pre[cç]o (atual|de)|cota[cç][ãa]o|vers[ãa]o mais recente|[uú]ltima vers[ãa]o|o que (est[aá]|houve) (de novo|acontecendo)|na internet|no google)\b/i.test(String(prompt || ''));
}

function systemPrompt(model, effort, hasTools, toolKinds, requireExternalTool = false) {
  const profile = getModelProfile(model);
  const toolInstruction = hasTools
    ? [
        `Ferramentas reais disponíveis: ${toolKinds.join(', ')}.`,
        'Use Skills para trabalhos especializados, busca na web para informação atual da internet, e MCP para dados ou ações externas.',
        'Se existir uma ferramenta (busca na web, MCP ou Skill) que corresponda ao pedido, USE-A antes de responder. Não substitua uma ferramenta disponível por memória, suposição ou uma resposta genérica.',
        'Para perguntas sobre fatos recentes, notícias, preços atuais, versões de produtos ou qualquer coisa que possa ter mudado, use a busca na web em vez de responder apenas com conhecimento prévio.',
        requireExternalTool ? 'Este pedido indica uma necessidade de dado externo ou ação externa. Você DEVE chamar pelo menos uma ferramenta compatível antes de produzir a resposta final.' : '',
        'Não diga que uma ação ou busca foi feita sem executar a ferramenta e obter um resultado real.',
      ].filter(Boolean).join('\n')
    : 'Nenhuma ferramenta externa está disponível nesta execução. Não invente integrações, buscas ou resultados.';
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

async function request(url, options, deadline = Date.now() + PROVIDER_TIMEOUT) {
  const remaining = Math.max(1, deadline - Date.now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`;
      const error = new Error(String(detail).slice(0, 1000));
      error.status = response.status;
      error.providerStatus = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('tempo limite do provedor excedido');
      timeoutError.code = 'PROVIDER_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function withTimeout(task, ms, message) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(message);
          error.code = 'MCP_BOOT_TIMEOUT';
          reject(error);
        }, ms);
      }),
    ]);
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
  const native = webSearchConfigured() ? [webSearchToolDefinition()] : [];
  return [...native, ...mcp, ...skills];
}

function openAiTools(tools) {
  return tools.map((tool) => ({ type: 'function', function: {
    name: tool.modelName,
    description: String(tool.description || tool.toolName || tool.skillId).slice(0, 1000),
    parameters: sanitizeOpenAiSchema(tool.inputSchema),
  } }));
}

function geminiTools(tools) {
  return [{ functionDeclarations: tools.map((tool) => ({
    name: tool.modelName,
    description: String(tool.description || tool.toolName || tool.skillId).slice(0, 1000),
    parameters: geminiSchema(tool.inputSchema),
  })) }];
}

function geminiToolCalls(data) {
  return (data?.candidates?.[0]?.content?.parts || [])
    .filter((part) => part?.functionCall?.name)
    .map((part) => ({ id: part.functionCall.id, name: part.functionCall.name, arguments: part.functionCall.args || {} }));
}

function geminiParts(data) {
  return Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];
}

function toolByName(tools, name) { return tools.find((tool) => tool.modelName === name); }

function toolKindLabels(tools) {
  const labels = [];
  if (tools.some((tool) => tool.kind === 'native')) labels.push('Busca na web');
  if (tools.some((tool) => tool.kind === 'mcp')) labels.push('MCP');
  if (tools.some((tool) => tool.kind === 'skill')) labels.push('Skills');
  return labels;
}

async function executeTool(tool, args, execution) {
  if (!tool) return { text: '', isError: true };
  if (tool.kind === 'native' && tool.modelName === WEB_SEARCH_TOOL_NAME) {
    try {
      const results = await searchWeb(typeof args?.query === 'string' ? args.query : '', { count: 6 });
      if (!results.length) return { text: 'Nenhum resultado encontrado para essa busca.', isError: false, nestedTools: [] };
      const formatted = results.map((item, index) => `${index + 1}. ${item.title}\n${item.description}\nFonte: ${item.source || item.url}\nURL: ${item.url}`).join('\n\n');
      return { text: formatted.slice(0, 12_000), isError: false, nestedTools: [] };
    } catch (error) {
      return { text: `Falha na busca: ${error?.message || 'erro desconhecido'}`, isError: true, nestedTools: [] };
    }
  }
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
  const requireTool = needsExternalTool(prompt) && tools.some((tool) => tool.kind === 'mcp' || tool.kind === 'native');
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const toolsUsed = [];
  let totalTokens = 0;
  const deadline = Date.now() + PROVIDER_TIMEOUT;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(model, effort, Boolean(tools.length), tools.length ? toolKindLabels(tools) : [], requireTool) }] },
        contents,
        ...(declaredTools ? { tools: declaredTools } : {}),
        generationConfig: { temperature: effort === 'low' ? 0.35 : 0.2 },
      }),
    }, deadline);
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
    { role: 'system', content: systemPrompt(model, effort, Boolean(tools.length), tools.length ? toolKindLabels(tools) : [], needsExternalTool(prompt) && tools.some((tool) => tool.kind === 'mcp' || tool.kind === 'native')) },
    { role: 'user', content: prompt },
  ];
  const declaredTools = tools.length ? openAiTools(tools) : undefined;
  const requireTool = needsExternalTool(prompt) && tools.some((tool) => tool.kind === 'mcp' || tool.kind === 'native');
  const toolsUsed = [];
  let totalTokens = 0;
  const deadline = Date.now() + PROVIDER_TIMEOUT;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
      body: JSON.stringify({
        model: providerModel,
        messages,
        ...(declaredTools ? { tools: declaredTools, tool_choice: requireTool ? 'required' : 'auto' } : {}),
        temperature: effort === 'low' ? 0.35 : 0.2,
        ...(provider === 'groq' ? { reasoning_effort: ['low', 'medium', 'high'].includes(effort) ? effort : 'high' } : {}),
      }),
    }, deadline);
    totalTokens += Number(data?.usage?.total_tokens || 0);
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error(`${provider} retornou uma resposta inválida`);
    messages.push(message);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) return { provider, text: message.content || '', tokens: totalTokens, toolsUsed };
    for (const call of calls) {
      const tool = toolByName(tools, call?.function?.name);
      let args = {};
      try { args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch {}
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
    'HTTP-Referer': process.env.APP_URL || 'https://prism-ia.app', 'X-Title': 'Prism IA',
  });
}

async function callNvidiaNim(prompt, model, effort, execution, tools) {
  const key = NVIDIA_NIM_KEY();
  if (!key) throw new Error('NVIDIA_NIM_API_KEY não configurada');
  const profile = getModelProfile(model);
  const providerModel = process.env.NVIDIA_NIM_MODEL || process.env.NIM_MODEL || profile.nvidiaModel || profile.defaultModel || 'meta/llama-3.1-70b-instruct';
  return callOpenAiCompatible(`${NVIDIA_NIM_BASE()}/chat/completions`, key, 'nvidia-nim', prompt, model, effort, execution, tools, providerModel, {
    Accept: 'application/json',
  });
}

function buildProviders(model, effort) {
  const available = [];
  if (GEMINI_KEY()) available.push({ name: 'gemini', call: callGemini });
  if (GROQ_KEY() && (effort !== 'low' || model !== 'prism-nano-1.0')) available.push({ name: 'groq', call: callGroq });
  if (OPENROUTER_KEY() && (effort === 'ultracode' || model === 'prism-taff-2.0')) available.push({ name: 'openrouter', call: callOpenRouter });
  if (NVIDIA_NIM_KEY()) available.push({ name: 'nvidia-nim', call: callNvidiaNim });

  const priority = model === 'prism-taff-2.0' || effort === 'ultracode'
    ? ['nvidia-nim', 'openrouter', 'gemini', 'groq']
    : effort === 'low'
      ? ['groq', 'gemini', 'nvidia-nim', 'openrouter']
      : ['gemini', 'groq', 'nvidia-nim', 'openrouter'];

  return available.sort((a, b) => priority.indexOf(a.name) - priority.indexOf(b.name));
}

export async function runOrchestration(prompt, effort = 'medium', profile = null, context = '', userId = null, options = {}) {
  const model = profile?.model || profile?.id || 'prism-mini-1.0';
  const normalizedEffort = normalizeEffort(effort);
  const input = buildInput(prompt, context);

  let mcp = { tools: [], errors: [], execute: async () => { throw new Error('MCP indisponível'); }, close: async () => {} };
  if (userId) {
    try {
      mcp = await withTimeout(
        createMcpExecutionContext(userId, { serverIds: options.mcpServerIds }),
        MCP_BOOT_TIMEOUT,
        'MCP demorou demais para inicializar',
      );
    } catch (error) {
      mcp = { tools: [], errors: [{ server: 'MCP', message: 'MCP temporariamente indisponível' }], execute: async () => { throw new Error('MCP indisponível'); }, close: async () => {} };
      console.warn('Prism MCP bootstrap failed:', { code: error?.code, message: error?.message });
    }
  }

  const skillTools = options.enableSkills === false ? [] : skillToolDefinitions();
  const tools = toolDefinitions({ mcpTools: mcp.tools, skillTools });
  const execution = { userId, mcp, mcpTools: mcp.tools, skillTools };
  const providers = buildProviders(model, normalizedEffort);
  const providerErrors = [];

  try {
    if (!providers.length) {
      console.error(JSON.stringify({ event: 'prism_no_provider_configured', timestamp: new Date().toISOString(), model, effort: normalizedEffort }));
      return {
        status: 'unavailable',
        message: UNAVAILABLE_MESSAGE,
        providers: [],
        provider_errors: [{ reason: 'no_provider_configured' }],
        model,
        effort: normalizedEffort,
        mcp_errors: mcp.errors,
      };
    }

    for (const provider of providers) {
      const startedAt = Date.now();
      try {
        const result = await provider.call(input, model, normalizedEffort, execution, tools);
        if (result?.text?.trim()) {
          return {
            status: 'ok',
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
        providerErrors.push({ provider: provider.name, reason: 'empty_response', elapsedMs: Date.now() - startedAt });
      } catch (error) {
        providerErrors.push({
          provider: provider.name,
          reason: error?.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'provider_error',
          status: Number(error?.status || 0) || undefined,
          elapsedMs: Date.now() - startedAt,
        });
      }
    }

    console.error(JSON.stringify({
      event: 'prism_provider_fallback_exhausted',
      timestamp: new Date().toISOString(),
      model,
      effort: normalizedEffort,
      configuredProviders: providers.map((item) => item.name),
      failures: providerErrors,
    }));

    return {
      status: 'unavailable',
      message: UNAVAILABLE_MESSAGE,
      providers: [],
      provider_errors: providerErrors,
      model,
      effort: normalizedEffort,
      mcp_errors: mcp.errors,
    };
  } finally {
    await mcp.close().catch(() => {});
  }
}
