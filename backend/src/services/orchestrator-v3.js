import { getModelProfile, normalizeEffort } from './modelRouter.js';
import { createMcpExecutionContext } from './mcp.js';
import { skillToolDefinitions, executeSkill } from './skills-v2.js';
import { searchWeb, webSearchConfigured } from './webSearch.js';
import { createAgentWorkspace, executeAgentTool, agentToolDefinitions } from './agentRuntime-v3.js';

const TIMEOUT = 25_000;
const MCP_TIMEOUT = 8_000;
const MAX_ROUNDS = 10;
const MAX_CONTEXT = 30_000;
const WEB = 'prism_web_search';
const keys = {
  openai: () => process.env.OPENAI_API_KEY,
  anthropic: () => process.env.ANTHROPIC_API_KEY,
  gemini: () => process.env.GEMINI_API_KEY,
  groq: () => process.env.GROQ_API_KEY,
  openrouter: () => process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_NVIDIA_API_KEY,
  nvidia: () => process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY,
};

const emit = (execution, type, data = {}) => execution?.onProgress?.({ type, timestamp: Date.now(), ...data });
const webTool = () => ({ modelName: WEB, serverId: 'prism-native', serverName: 'Prism Web Search', toolName: 'web_search', kind: 'native', description: 'Busca informação atual na internet.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } });
const cleanSchema = (schema) => {
  if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
  const out = {};
  for (const key of ['type', 'description', 'format', 'enum', 'required']) if (schema[key] !== undefined) out[key] = schema[key];
  if (schema.properties) out.properties = Object.fromEntries(Object.entries(schema.properties).slice(0, 100).map(([key, value]) => [key, cleanSchema(value)]));
  if (schema.items) out.items = cleanSchema(schema.items);
  if (!out.type) out.type = out.properties ? 'object' : 'string';
  if (out.type === 'object' && !out.properties) out.properties = {};
  return out;
};
const geminiSchema = (schema) => {
  const clean = cleanSchema(schema); const out = { type: String(clean.type || 'object').toUpperCase() };
  if (clean.description) out.description = clean.description; if (clean.enum) out.enum = clean.enum; if (clean.required?.length) out.required = clean.required;
  if (clean.properties) out.properties = Object.fromEntries(Object.entries(clean.properties).map(([key, value]) => [key, geminiSchema(value)])); if (clean.items) out.items = geminiSchema(clean.items); return out;
};
const openAiTools = (tools) => tools.map((tool) => ({ type: 'function', function: { name: tool.modelName, description: tool.description, parameters: cleanSchema(tool.inputSchema) } }));
const anthropicTools = (tools) => tools.map((tool) => ({ name: tool.modelName, description: tool.description, input_schema: cleanSchema(tool.inputSchema) }));
const geminiTools = (tools) => [{ functionDeclarations: tools.map((tool) => ({ name: tool.modelName, description: tool.description, parameters: geminiSchema(tool.inputSchema) })) }];
const needsTool = (prompt) => /\b(pesquise|pesquisa|busque|procure|internet|google|github|repo|reposit[oó]rio|issue|pull request|mcp|execute|execut[eá]|rode|rodar|compile|compil[eá]|zip|\.exe|\.jar|\.zip|build|arquivo|projeto|ferramenta)\b/i.test(String(prompt || ''));

function systemPrompt(model, effort, tools, prompt) {
  const profile = getModelProfile(model);
  return [
    'Você é a Prism IA, uma assistente geral e agente de software.',
    'Resolva o objetivo ponta a ponta e valide o que fizer.',
    'Nunca invente uma execução, arquivo, busca, compilação ou resultado.',
    'Use ferramentas reais quando elas forem úteis. Quando o usuário pedir pesquisa, execução, alteração de projeto ou build, prefira ferramentas reais.',
    `Modelo Prism: ${model}. Perfil: ${profile.description}. Esforço: ${effort}.`,
    tools.length ? `Ferramentas disponíveis: ${tools.map((tool) => tool.toolName || tool.modelName).join(', ')}.` : 'Nenhuma ferramenta externa está disponível.',
    needsTool(prompt) ? 'Este pedido provavelmente requer ferramentas reais; use a ferramenta adequada antes da resposta final.' : '',
  ].filter(Boolean).join('\n');
}

async function request(url, options, deadline = Date.now() + TIMEOUT) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - Date.now()));
  try {
    const response = await fetch(url, { ...options, signal: controller.signal }); const raw = await response.text(); let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) { const error = new Error(String(data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`).slice(0, 2000)); error.status = response.status; throw error; }
    return data;
  } catch (error) { if (error?.name === 'AbortError') throw Object.assign(new Error('Tempo limite do provedor excedido.'), { code: 'PROVIDER_TIMEOUT' }); throw error; }
  finally { clearTimeout(timer); }
}

async function executeTool(tool, args, execution) {
  emit(execution, 'tool_start', { tool: tool?.toolName || tool?.modelName, kind: tool?.kind });
  try {
    if (!tool) throw Object.assign(new Error('Ferramenta não encontrada.'), { code: 'TOOL_NOT_FOUND' });
    if (tool.modelName === WEB) {
      const results = await searchWeb(String(args?.query || ''), { count: 6 });
      const text = results.length ? results.map((item, index) => `${index + 1}. ${item.title}\n${item.description}\n${item.url}`).join('\n\n') : 'Nenhum resultado encontrado.';
      emit(execution, 'tool_complete', { tool: tool.toolName, kind: tool.kind, ok: true });
      return { text: text.slice(0, 12_000), used: [{ kind: 'native', tool: tool.toolName }] };
    }
    if (tool.kind === 'skill') {
      const result = await executeSkill(tool.skillId, String(args?.input || ''), { userId: execution.userId, projectId: execution.projectId, onProgress: execution.onProgress });
      emit(execution, 'tool_complete', { tool: tool.skillId, kind: 'skill', ok: result?.status !== 'unavailable' });
      return { text: String(result?.text || '').slice(0, 30_000), used: [{ kind: 'skill', tool: tool.skillId }] };
    }
    if (tool.kind === 'native' && String(tool.modelName).startsWith('prism_')) {
      const result = await executeAgentTool(tool.modelName, args, execution.workspace);
      if (result?.downloadPath || result?.filename) emit(execution, 'artifact', { filename: result.filename, downloadPath: result.downloadPath || '' });
      if (result?.stdout || result?.stderr) emit(execution, 'command_output', { stream: result.stderr ? 'stderr' : 'stdout', text: String(result.stderr || result.stdout).slice(-4000) });
      emit(execution, 'tool_complete', { tool: tool.toolName, kind: tool.kind, ok: result?.ok !== false });
      return { text: JSON.stringify(result).slice(-30_000), used: [{ kind: 'runtime', tool: tool.toolName }] };
    }
    const result = await execution.mcp.execute(tool.modelName, args); emit(execution, 'tool_complete', { tool: tool.toolName, kind: 'mcp', ok: !result?.isError });
    return { text: String(result?.text || '').slice(0, 30_000), used: [{ kind: 'mcp', tool: tool.toolName || tool.modelName }] };
  } catch (error) { emit(execution, 'tool_complete', { tool: tool?.toolName || tool?.modelName, kind: tool?.kind, ok: false, error: error?.message || 'Falha' }); return { text: error?.message || 'Falha na ferramenta.', used: [{ kind: tool?.kind || 'unknown', tool: tool?.toolName || tool?.modelName, error: true }] }; }
}

async function callOpenAICompatible({ provider, key, model, prompt, effort, tools, execution, url, headers = {} }) {
  const messages = [{ role: 'system', content: systemPrompt(model, effort, tools, prompt) }, { role: 'user', content: prompt }]; const declarations = tools.length ? openAiTools(tools) : undefined; const used = []; let tokens = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    emit(execution, 'provider_round', { provider, round: round + 1 });
    const data = await request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...headers }, body: JSON.stringify({ model, messages, ...(declarations ? { tools: declarations, tool_choice: needsTool(prompt) ? 'auto' : 'auto' } : {}), ...(provider === 'groq' ? { reasoning_effort: effort === 'low' ? 'low' : effort === 'high' ? 'high' : 'medium' } : {}) }) });
    tokens += Number(data?.usage?.total_tokens || 0); const message = data?.choices?.[0]?.message; if (!message) throw new Error(`${provider} retornou resposta inválida.`); messages.push(message);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : []; if (!calls.length) return { provider, text: String(message.content || ''), tokens, used };
    for (const call of calls) { const tool = tools.find((item) => item.modelName === call?.function?.name); let args = {}; try { args = JSON.parse(call?.function?.arguments || '{}'); } catch {} const result = await executeTool(tool, args, execution); used.push(...result.used); messages.push({ role: 'tool', tool_call_id: call.id, content: result.text }); }
  }
  throw new Error(`${provider} atingiu o limite de ferramentas.`);
}

async function callAnthropic(prompt, model, effort, tools, execution) {
  const messages = [{ role: 'user', content: prompt }]; const declarations = tools.length ? anthropicTools(tools) : undefined; const used = []; let tokens = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    emit(execution, 'provider_round', { provider: 'anthropic', round: round + 1 });
    const body = { model, max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 16000), system: systemPrompt(execution.model, effort, tools, prompt), messages, ...(declarations ? { tools: declarations } : {}) };
    if (['high','max','ultracode'].includes(effort) && /claude-(opus|sonnet)/i.test(model)) body.thinking = { type: 'adaptive' };
    const data = await request('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': keys.anthropic(), 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
    tokens += Number(data?.usage?.input_tokens || 0) + Number(data?.usage?.output_tokens || 0); const content = Array.isArray(data?.content) ? data.content : []; const toolUses = content.filter((item) => item?.type === 'tool_use');
    if (!toolUses.length) return { provider: 'anthropic', text: content.filter((item) => item?.type === 'text').map((item) => item.text).join(''), tokens, used };
    messages.push({ role: 'assistant', content }); const results = [];
    for (const call of toolUses) { const tool = tools.find((item) => item.modelName === call.name); const result = await executeTool(tool, call.input || {}, execution); used.push(...result.used); results.push({ type: 'tool_result', tool_use_id: call.id, content: result.text }); }
    messages.push({ role: 'user', content: results });
  }
  throw new Error('Anthropic atingiu o limite de ferramentas.');
}

async function callGemini(prompt, model, effort, tools, execution) {
  const contents = [{ role: 'user', parts: [{ text: prompt }] }]; const declarations = tools.length ? geminiTools(tools) : undefined; const used = []; let tokens = 0;
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    emit(execution, 'provider_round', { provider: 'gemini', round: round + 1 });
    const data = await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(keys.gemini())}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(execution.model, effort, tools, prompt) }] }, contents, ...(declarations ? { tools: declarations } : {}), generationConfig: { temperature: effort === 'low' ? 0.35 : 0.2 } }) });
    tokens += Number(data?.usageMetadata?.totalTokenCount || 0); const parts = data?.candidates?.[0]?.content?.parts || []; const calls = parts.filter((part) => part?.functionCall?.name); if (!calls.length) return { provider: 'gemini', text: parts.filter((part) => part?.text).map((part) => part.text).join(''), tokens, used };
    contents.push({ role: 'model', parts }); const responses = [];
    for (const call of calls) { const tool = tools.find((item) => item.modelName === call.functionCall.name); const result = await executeTool(tool, call.functionCall.args || {}, execution); used.push(...result.used); responses.push({ functionResponse: { name: call.functionCall.name, response: { result: result.text, isError: Boolean(result.text === '') } } }); }
    contents.push({ role: 'user', parts: responses });
  }
  throw new Error('Gemini atingiu o limite de ferramentas.');
}

function providers(model, effort) {
  const list=[];
  if(keys.anthropic())list.push({name:'anthropic',model:process.env.ANTHROPIC_MODEL||'claude-sonnet-4-6'});
  if(keys.openai())list.push({name:'openai',model:process.env.OPENAI_MODEL||'gpt-5.6',url:'https://api.openai.com/v1/chat/completions'});
  if(keys.gemini())list.push({name:'gemini',model:process.env.GEMINI_MODEL||getModelProfile(model).gemini||'gemini-3.6-flash'});
  if(keys.groq())list.push({name:'groq',model:process.env.GROQ_MODEL||'openai/gpt-oss-120b',url:'https://api.groq.com/openai/v1/chat/completions'});
  if(keys.openrouter())list.push({name:'openrouter',model:process.env.OPENROUTER_MODEL||'openai/gpt-oss-120b',url:'https://openrouter.ai/api/v1/chat/completions',headers:{'HTTP-Referer':process.env.APP_URL||'https://prism-ia.app','X-Title':'Prism IA'}});
  if(keys.nvidia())list.push({name:'nvidia-nim',model:process.env.NVIDIA_NIM_MODEL||process.env.NIM_MODEL||'meta/llama-3.1-70b-instruct',url:`${String(process.env.NVIDIA_NIM_BASE_URL||process.env.NIM_BASE_URL||'https://integrate.api.nvidia.com/v1').replace(/\/$/,'')}/chat/completions`});
  const priority=(model==='prism-taff-2.0'||effort==='ultracode')?['anthropic','openai','gemini','groq','nvidia-nim','openrouter']:['gemini','openai','anthropic','groq','nvidia-nim','openrouter'];
  return list.sort((a,b)=>priority.indexOf(a.name)-priority.indexOf(b.name));
}

export async function runOrchestration(prompt,effort='medium',profile=null,context='',userId=null,options={}){
  const model=profile?.model||profile?.id||'prism-mini-1.0';const normalizedEffort=normalizeEffort(effort);const input=String(context||'').slice(-MAX_CONTEXT)+`\n\nPedido atual:\n${String(prompt||'').slice(0,MAX_CONTEXT)}`;const execution={userId,projectId:options.projectId,onProgress:options.onProgress,model};let workspace=null;let mcp={tools:[],errors:[],execute:async()=>{throw new Error('MCP indisponível.')},close:async()=>{}};
  try{
    emit(execution,'start',{stage:'prepare',message:'Preparando contexto e ferramentas.'});
    if(userId&&options.projectId){emit(execution,'workspace_start',{projectId:options.projectId});workspace=await createAgentWorkspace({projectId:options.projectId,userId});execution.workspace=workspace;emit(execution,'workspace_ready',{files:workspace.files.length});}
    if(userId){emit(execution,'mcp_start',{message:'Conectando MCPs e integrações.'});try{mcp=await Promise.race([createMcpExecutionContext(userId,{serverIds:options.mcpServerIds}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('MCP_TIMEOUT')),MCP_TIMEOUT))]);emit(execution,'mcp_ready',{tools:mcp.tools.length});}catch(error){emit(execution,'mcp_error',{message:error.message});}}
    execution.mcp=mcp;execution.mcpTools=mcp.tools;execution.skillTools=options.enableSkills===false?[]:skillToolDefinitions();const tools=[...agentToolDefinitions().map((tool)=>({...tool,kind:'native'})),...(webSearchConfigured()?[webTool()]:[]),...mcp.tools.map((tool)=>({...tool,kind:'mcp'})),...execution.skillTools.map((tool)=>({...tool,kind:'skill',serverName:'Prism Skills'}))];emit(execution,'tools_ready',{count:tools.length});
    const list=providers(model,normalizedEffort);if(!list.length)return{status:'unavailable',message:'Nenhum provedor de IA configurado.',providers:[],tools_used:[],model,effort:normalizedEffort};emit(execution,'providers_ready',{providers:list.map((item)=>item.name)});
    const errors=[];
    for(const provider of list){const started=Date.now();try{emit(execution,'provider_start',{provider:provider.name,model:provider.model});let result;if(provider.name==='anthropic')result=await callAnthropic(input,provider.model,normalizedEffort,tools,execution);else if(provider.name==='gemini')result=await callGemini(input,provider.model,normalizedEffort,tools,execution);else result=await callOpenAICompatible({provider:provider.name,key:keys[provider.name==='nvidia-nim'?'nvidia':provider.name](),model:provider.model,prompt:input,effort:normalizedEffort,tools,execution,url:provider.url,headers:provider.headers});if(result?.text?.trim()){emit(execution,'provider_complete',{provider:result.provider,elapsedMs:Date.now()-started});emit(execution,'finalizing',{message:'Revisando a resposta.'});return{status:'ok',text:result.text.trim(),tokens:Number(result.tokens||0),providers:[result.provider],tools_used:result.used||[],mcp_errors:mcp.errors,provider_errors:errors,model,effort:normalizedEffort};}errors.push({provider:provider.name,reason:'empty_response',elapsedMs:Date.now()-started);}catch(error){errors.push({provider:provider.name,reason:error?.code||'provider_error',message:String(error?.message||'').slice(0,500),elapsedMs:Date.now()-started});emit(execution,'provider_error',{provider:provider.name,message:error?.message||'Falha no provedor.'});}}
    return{status:'unavailable',message:'Todos os provedores configurados falharam.',providers:[],provider_errors:errors,mcp_errors:mcp.errors,model,effort:normalizedEffort,tools_used:[]};
  }finally{await mcp.close().catch(()=>{});await workspace?.cleanup?.();emit(execution,'done');}
}
