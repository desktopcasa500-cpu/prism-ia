/** Prism IA — agentic multi-provider orchestration v2. */
import { getModelProfile, normalizeEffort } from './modelRouter.js';
import { createMcpExecutionContext } from './mcp.js';
import { skillToolDefinitions, executeSkill } from './skills.js';
import { searchWeb, webSearchConfigured } from './webSearch.js';
import { createAgentWorkspace, runWorkspaceCommand, buildWorkspace, agentToolDefinitions } from './agentRuntime.js';

const PROVIDER_TIMEOUT = 20_000;
const MCP_BOOT_TIMEOUT = 8_000;
const MAX_TOOL_ROUNDS = 8;
const MAX_CONTEXT = 30_000;
const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade nos provedores de IA. Tente novamente mais tarde.';
const WEB_SEARCH_TOOL_NAME = 'prism_web_search';

const env = {
  openai: () => process.env.OPENAI_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,
  gemini: () => process.env.GEMINI_API_KEY,
  groq: () => process.env.GROQ_API_KEY,
  openrouter: () => process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_NVIDIA_API_KEY,
  nvidia: () => process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY,
};

function emit(execution, type, data = {}) {
  try { execution?.onProgress?.({ type, timestamp: Date.now(), ...data }); } catch {}
}

function toolDef(modelName, serverId, serverName, toolName, description, inputSchema, kind = 'native') {
  return { modelName, serverId, serverName, toolName, kind, description: String(description || '').slice(0, 1000), inputSchema };
}

function nativeTools() {
  const tools = [
    ...agentToolDefinitions(),
    toolDef(WEB_SEARCH_TOOL_NAME, 'prism-native', 'Prism Web Search', 'web_search', 'Busca informação atual na internet. Use quando o pedido depender de fatos recentes, notícias, preços, versões ou pesquisa externa.', { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }),
  ];
  return webSearchConfigured() ? tools : tools.filter((tool) => tool.modelName !== WEB_SEARCH_TOOL_NAME);
}

function toolsFor(execution) {
  const mcp = (execution.mcpTools || []).map((tool) => ({ ...tool, kind: 'mcp' }));
  const skills = (execution.skillTools || []).map((tool) => ({ ...tool, kind: 'skill', serverName: 'Prism Skills' }));
  return [...nativeTools(), ...mcp, ...skills];
}

function sanitizeSchema(schema, depth = 0) {
  if (!schema || typeof schema !== 'object' || depth > 8) return { type: 'object', properties: {} };
  const out = {};
  for (const key of ['type', 'description', 'format', 'enum', 'required']) if (schema[key] !== undefined) out[key] = schema[key];
  if (schema.properties) out.properties = Object.fromEntries(Object.entries(schema.properties).slice(0, 100).map(([key, value]) => [key.slice(0, 80), sanitizeSchema(value, depth + 1)]));
  if (schema.items) out.items = sanitizeSchema(schema.items, depth + 1);
  if (!out.type) out.type = out.properties ? 'object' : 'string';
  if (out.type === 'object' && !out.properties) out.properties = {};
  return out;
}

function anthropicSchema(schema) {
  return sanitizeSchema(schema);
}

function geminiSchema(schema) {
  const clean = sanitizeSchema(schema);
  const out = { type: String(clean.type || 'object').toUpperCase() };
  if (clean.description) out.description = String(clean.description).slice(0, 1000);
  if (clean.enum) out.enum = clean.enum;
  if (clean.required?.length) out.required = clean.required;
  if (clean.properties) out.properties = Object.fromEntries(Object.entries(clean.properties).map(([key, value]) => [key, geminiSchema(value)]));
  if (clean.items) out.items = geminiSchema(clean.items);
  return out;
}

function toolKinds(tools) {
  return [...new Set(tools.map((tool) => tool.kind === 'native' ? (tool.modelName === WEB_SEARCH_TOOL_NAME ? 'web' : 'runtime') : tool.kind))];
}

function needExternal(prompt) {
  return /\b(pesquise|pesquisa|busque|procure|internet|google|github|repo|reposit[oó]rio|issue|pull request|mcp|execute|execut[eá]|rode|rodar|compile|compil[eá]|zip|\.exe|\.jar|\.zip|build|deploy|arquivo|projeto|tool|ferramenta)\b/i.test(String(prompt || ''));
}

function systemPrompt(model, effort, tools, prompt) {
  const profile = getModelProfile(model);
  const lines = [
    'Você é a Prism IA: assistente geral e agente de execução quando a tarefa exige ferramentas.',
    'Resolva o objetivo ponta a ponta. Não invente resultados de ferramentas.',
    'Quando uma ferramenta real resolver melhor o pedido, use-a antes de responder.',
    'Ao alterar ou executar projetos, valide o resultado e informe claramente o que foi feito.',
    `Modelo lógico: ${model}. Perfil: ${profile.description}. Esforço solicitado: ${effort}.`,
  ];
  if (tools.length) lines.push(`Ferramentas disponíveis: ${toolKinds(tools).join(', ')}.`);
  if (needExternal(prompt)) lines.push('O pedido indica uma possível necessidade externa ou de execução. Prefira a ferramenta adequada em vez de responder apenas com teoria.');
  return lines.join('\n');
}

function buildInput(prompt, context) {
  const p = String(prompt || '').slice(0, MAX_CONTEXT);
  const c = String(context || '').slice(-MAX_CONTEXT);
  return c ? `Contexto recente:\n${c}\n\nPedido atual:\n${p}` : p;
}

async function request(url, options, deadline = Date.now() + PROVIDER_TIMEOUT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      const message = data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`;
      const error = new Error(String(message).slice(0, 2000));
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw Object.assign(new Error('Tempo limite do provedor excedido.'), { code: 'PROVIDER_TIMEOUT' });
    throw error;
  } finally { clearTimeout(timeout); }
}

async function executeTool(tool, args, execution) {
  if (!tool) return { text: 'Ferramenta não encontrada.', isError: true, toolsUsed: [] };
  emit(execution, 'tool_start', { tool: tool.toolName || tool.modelName, kind: tool.kind, label: tool.description });
  try {
    if (tool.modelName === WEB_SEARCH_TOOL_NAME) {
      const results = await searchWeb(String(args?.query || ''), { count: 6 });
      const text = results.length ? results.map((item, i) => `${i + 1}. ${item.title}\n${item.description}\n${item.url}`).join('\n\n') : 'Nenhum resultado encontrado.';
      emit(execution, 'tool_complete', { tool: tool.toolName, kind: tool.kind, ok: true });
      return { text: text.slice(0, 12_000), isError: false, toolsUsed: [{ kind: 'native', tool: tool.toolName }] };
    }
    if (tool.modelName === 'prism_exec') {
      const result = await runWorkspaceCommand({ workspace: execution.workspace, command: args.command, cwd: args.cwd || '.', timeoutMs: args.timeoutMs, onOutput: (chunk) => emit(execution, 'command_output', { stream: chunk.stream, text: chunk.text.slice(-2_000) }) });
      emit(execution, 'tool_complete', { tool: tool.toolName, kind: tool.kind, ok: true });
      return { text: JSON.stringify(result).slice(-24_000), isError: false, toolsUsed: [{ kind: 'runtime', tool: tool.toolName }] };
    }
    if (tool.modelName === 'prism_build') {
      const result = await buildWorkspace({ workspace: execution.workspace, target: String(args?.target || '') });
      emit(execution, 'artifact', { filename: result.filename, downloadPath: result.downloadPath || '' });
      emit(execution, 'tool_complete', { tool: tool.toolName, kind: tool.kind, ok: true });
      return { text: JSON.stringify(result), isError: false, toolsUsed: [{ kind: 'runtime', tool: tool.toolName }] };
    }
    if (tool.modelName === 'prism_verify') {
      const fallback = args?.command || 'node --check .';
      const result = await runWorkspaceCommand({ workspace: execution.workspace, command: fallback, cwd: '.', timeoutMs: 120_000, onOutput: (chunk) => emit(execution, 'command_output', { stream: chunk.stream, text: chunk.text.slice(-2_000) }) });
      emit(execution, 'tool_complete', { tool: tool.toolName, kind: tool.kind, ok: true });
      return { text: JSON.stringify(result), isError: false, toolsUsed: [{ kind: 'runtime', tool: tool.toolName }] };
    }
    if (tool.kind === 'skill') {
      const result = await executeSkill(tool.skillId, String(args?.input || ''), { userId: execution.userId, timeoutMs: 180_000 });
      emit(execution, 'tool_complete', { tool: tool.skillId, kind: 'skill', ok: result?.status !== 'unavailable' });
      return { text: String(result?.text || '').slice(0, 30_000), isError: result?.status === 'unavailable', toolsUsed: [{ kind: 'skill', tool: tool.skillId }] };
    }
    const result = await execution.mcp.execute(tool.modelName, args);
    emit(execution, 'tool_complete', { tool: tool.toolName || tool.modelName, kind: 'mcp', ok: !result?.isError });
    return { text: String(result?.text || '').slice(0, 30_000), isError: Boolean(result?.isError), toolsUsed: [{ kind: 'mcp', tool: tool.toolName || tool.modelName }] };
  } catch (error) {
    emit(execution, 'tool_complete', { tool: tool.toolName || tool.modelName, kind: tool.kind, ok: false, error: error?.message || 'Falha' });
    return { text: error?.message || 'Falha na ferramenta.', isError: true, toolsUsed: [{ kind: tool.kind, tool: tool.toolName || tool.modelName, error: true }] };
  }
}

function openAiTools(tools) {
  return tools.map((tool) => ({ type: 'function', function: { name: tool.modelName, description: tool.description, parameters: sanitizeSchema(tool.inputSchema) } }));
}

function anthropicTools(tools) {
  return tools.map((tool) => ({ name: tool.modelName, description: tool.description, input_schema: anthropicSchema(tool.inputSchema) }));
}

function geminiTools(tools) {
  return [{ functionDeclarations: tools.map((tool) => ({ name: tool.modelName, description: tool.description, parameters: geminiSchema(tool.inputSchema) })) }];
}

async function callOpenAICompatible({ provider, url, key, providerModel, prompt, model, effort, execution, tools, headers = {} }) {
  const messages = [
    { role: 'system', content: systemPrompt(model, effort, tools, prompt) },
    { role: 'user', content: prompt },
  ];
  const declaredTools = tools.length ? openAiTools(tools) : undefined;
  const deadline = Date.now() + PROVIDER_TIMEOUT;
  let tokens = 0;
  const used = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    emit(execution, 'provider_round', { provider, round: round + 1 });
    const data = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...headers }, body: JSON.stringify({ model: providerModel, messages, ...(declaredTools ? { tools: declaredTools, tool_choice: needExternal(prompt) ? 'auto' : 'auto' } : {}), ...(provider === 'groq' ? { reasoning_effort: effort === 'low' ? 'low' : effort === 'high' ? 'high' : 'medium' } : {}) }) }, deadline);
    tokens += Number(data?.usage?.total_tokens || data?.usage?.output_tokens || 0);
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error(`${provider} retornou uma resposta inválida.`);
    messages.push(message);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    if (!calls.length) return { provider, text: String(message.content || ''), tokens, toolsUsed: used };
    for (const call of calls) {
      const tool = tools.find((item) => item.modelName === call?.function?.name);
      let args = {};
      try { args = JSON.parse(call?.function?.arguments || '{}'); } catch { args = {}; }
      const result = await executeTool(tool, args, execution);
      used.push(...result.toolsUsed);
      messages.push({ role: 'tool', tool_call_id: call.id, content: result.text });
    }
  }
  throw new Error(`${provider} atingiu o limite de etapas de ferramenta.`);
}

async function callAnthropic(prompt, model, effort, execution, tools) {
  const key = env.anthropic();
  const providerModel = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const messages = [{ role: 'user', content: prompt }];
  const declaredTools = tools.length ? anthropicTools(tools) : undefined;
  const deadline = Date.now() + PROVIDER_TIMEOUT;
  let tokens = 0;
  const used = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const body = { model: providerModel, max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 16_000), system: systemPrompt(model, effort, tools, prompt), messages, ...(declaredTools ? { tools: declaredTools } : {}) };
    if (['high', 'max', 'ultracode'].includes(effort) && /^(claude-opus-4-6|claude-opus-4-7|claude-opus-4-8|claude-sonnet-4-6|claude-sonnet-5)/.test(providerModel)) body.thinking = { type: 'adaptive' };
    emit(execution, 'provider_round', { provider: 'anthropic', round: round + 1 });
    const data = await request('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) }, deadline);
    tokens += Number(data?.usage?.input_tokens || 0) + Number(data?.usage?.output_tokens || 0);
    const content = Array.isArray(data?.content) ? data.content : [];
    const toolUses = content.filter((item) => item?.type === 'tool_use');
    if (!toolUses.length) return { provider: 'anthropic', text: content.filter((item) => item?.type === 'text').map((item) => item.text).join(''), tokens, toolsUsed: used };
    messages.push({ role: 'assistant', content });
    const toolResults = [];
    for (const call of toolUses) {
      const tool = tools.find((item) => item.modelName === call.name);
      const result = await executeTool(tool, call.input || {}, execution);
      used.push(...result.toolsUsed);
      toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: result.text });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  throw new Error('Anthropic atingiu o limite de etapas de ferramenta.');
}

async function callGemini(prompt, model, effort, execution, tools) {
  const key = env.gemini();
  if (!key) throw new Error('GEMINI_API_KEY não configurada.');
  const profile = getModelProfile(model);
  const providerModel = process.env.GEMINI_MODEL || profile.gemini || 'gemini-3.6-flash';
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const declaredTools = tools.length ? geminiTools(tools) : undefined;
  const deadline = Date.now() + PROVIDER_TIMEOUT;
  let tokens = 0;
  const used = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    emit(execution, 'provider_round', { provider: 'gemini', round: round + 1 });
    const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(providerModel)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(model, effort, tools, prompt) }] }, contents, ...(declaredTools ? { tools: declaredTools } : {}), generationConfig: { temperature: effort === 'low' ? 0.35 : 0.2 } }) }, deadline);
    tokens += Number(data?.usageMetadata?.totalTokenCount || 0);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((part) => part?.functionCall?.name).map((part) => ({ id: part.functionCall.id, name: part.functionCall.name, args: part.functionCall.args || {} }));
    if (!calls.length) return { provider: 'gemini', text: parts.filter((part) => part?.text).map((part) => part.text).join(''), tokens, toolsUsed: used };
    contents.push({ role: 'model', parts });
    const responses = [];
    for (const call of calls) {
      const tool = tools.find((item) => item.modelName === call.name);
      const result = await executeTool(tool, call.args, execution);
      used.push(...result.toolsUsed);
      responses.push({ functionResponse: { name: call.name, response: { result: result.text, isError: Boolean(result.isError) } } });
    }
    contents.push({ role: 'user', parts: responses });
  }
  throw new Error('Gemini atingiu o limite de etapas de ferramenta.');
}

function providerList(model, effort) {
  const candidates = [];
  if (env.openai()) candidates.push({ name: 'openai', model: process.env.OPENAI_MODEL || 'gpt-5.6-terra', call: callOpenAICompatible, url: 'https://api.openai.com/v1/chat/completions' });
  if (env.anthropic()) candidates.push({ name: 'anthropic', model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', call: callAnthropic });
  if (env.gemini()) candidates.push({ name: 'gemini', model: process.env.GEMINI_MODEL || '', call: callGemini });
  if (env.groq()) candidates.push({ name: 'groq', model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', call: callOpenAICompatible, url: 'https://api.groq.com/openai/v1/chat/completions' });
  if (env.openrouter()) candidates.push({ name: 'openrouter', model: process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b', call: callOpenAICompatible, url: 'https://openrouter.ai/api/v1/chat/completions', headers: { 'HTTP-Referer': process.env.APP_URL || 'https://prism-ia.app', 'X-Title': 'Prism IA' } });
  if (env.nvidia()) candidates.push({ name: 'nvidia-nim', model: process.env.NVIDIA_NIM_MODEL || process.env.NIM_MODEL || 'meta/llama-3.1-70b-instruct', call: callOpenAICompatible, url: `${String(process.env.NVIDIA_NIM_BASE_URL || process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '')}/chat/completions` });
  const priority = ['openai', 'anthropic', 'gemini', 'groq', 'nvidia-nim', 'openrouter'];
  if (model === 'prism-taff-2.0' || effort === 'ultracode') priority.unshift('anthropic', 'openai');
  return candidates.sort((a, b) => priority.indexOf(a.name) - priority.indexOf(b.name));
}

export async function runOrchestration(prompt, effort = 'medium', profile = null, context = '', userId = null, options = {}) {
  const model = profile?.model || profile?.id || 'prism-mini-1.0';
  const normalizedEffort = normalizeEffort(effort);
  const input = buildInput(prompt, context);
  const execution = { userId, onProgress: options.onProgress };
  let workspace = null;
  let mcp = { tools: [], errors: [], execute: async () => { throw new Error('MCP indisponível.'); }, close: async () => {} };
  try {
    emit(execution, 'start', { stage: 'prepare', message: 'Preparando contexto e ferramentas.' });
    if (userId && options.projectId) {
      emit(execution, 'workspace_start', { projectId: options.projectId, message: 'Abrindo o workspace do projeto.' });
      workspace = await createAgentWorkspace({ projectId: options.projectId, userId });
      execution.workspace = workspace;
      emit(execution, 'workspace_ready', { files: workspace.files.length });
    }
    if (userId) {
      emit(execution, 'mcp_start', { message: 'Conectando MCPs e integrações.' });
      try {
        mcp = await Promise.race([
          createMcpExecutionContext(userId, { serverIds: options.mcpServerIds }),
          new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('MCP demorou demais para inicializar.'), { code: 'MCP_BOOT_TIMEOUT' })), MCP_BOOT_TIMEOUT)),
        ]);
        emit(execution, 'mcp_ready', { tools: mcp.tools.length });
      } catch (error) {
        mcp = { tools: [], errors: [{ server: 'MCP', message: error.message }], execute: async () => { throw new Error('MCP indisponível.'); }, close: async () => {} };
        emit(execution, 'mcp_error', { message: error.message });
      }
    }
    execution.mcp = mcp;
    execution.mcpTools = mcp.tools;
    execution.skillTools = options.enableSkills === false ? [] : skillToolDefinitions();
    const tools = toolsFor(execution);
    emit(execution, 'tools_ready', { count: tools.length, kinds: toolKinds(tools) });
    const providers = providerList(model, normalizedEffort);
    if (!providers.length) return { status: 'unavailable', message: UNAVAILABLE_MESSAGE, providers: [], provider_errors: [{ reason: 'no_provider_configured' }], model, effort: normalizedEffort, mcp_errors: mcp.errors, tools_used: [] };
    emit(execution, 'providers_ready', { providers: providers.map((item) => item.name) });
    const errors = [];
    for (const provider of providers) {
      const startedAt = Date.now();
      try {
        emit(execution, 'provider_start', { provider: provider.name, model: provider.model, message: `Executando ${provider.name}.` });
        let result;
        if (provider.name === 'anthropic') result = await provider.call(input, model, normalizedEffort, execution, tools);
        else if (provider.name === 'gemini') result = await provider.call(input, model, normalizedEffort, execution, tools);
        else result = await provider.call({ provider: provider.name, url: provider.url, key: env[provider.name === 'nvidia-nim' ? 'nvidia' : provider.name](), providerModel: provider.model, prompt: input, model, effort: normalizedEffort, execution, tools, headers: provider.headers });
        if (result?.text?.trim()) {
          emit(execution, 'provider_complete', { provider: result.provider, elapsedMs: Date.now() - startedAt });
          emit(execution, 'finalizing', { message: 'Revisando e finalizando a resposta.' });
          return { status: 'ok', text: result.text.trim(), tokens: Number(result.tokens || 0), providers: [result.provider], tools_used: result.toolsUsed || [], mcp_errors: mcp.errors, provider_errors: errors, model, effort: normalizedEffort };
        }
        errors.push({ provider: provider.name, reason: 'empty_response', elapsedMs: Date.now() - startedAt });
      } catch (error) {
        errors.push({ provider: provider.name, reason: error?.code === 'PROVIDER_TIMEOUT' ? 'timeout' : 'provider_error', message: String(error?.message || '').slice(0, 500), status: Number(error?.status || 0) || undefined, elapsedMs: Date.now() - startedAt });
        emit(execution, 'provider_error', { provider: provider.name, message: error?.message || 'Falha no provedor.' });
      }
    }
    return { status: 'unavailable', message: UNAVAILABLE_MESSAGE, providers: [], provider_errors: errors, model, effort: normalizedEffort, mcp_errors: mcp.errors, tools_used: [] };
  } finally {
    await mcp.close().catch(() => {});
    await workspace?.cleanup?.();
    emit(execution, 'done');
  }
}
