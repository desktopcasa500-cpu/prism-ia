/** Prism IA — geração resiliente, roteamento por modelo e execução real de ferramentas MCP. */
import { getModelProfile, normalizeEffort } from './modelRouter.js';
import { createMcpExecutionContext } from './mcp.js';

const PROVIDER_TIMEOUT = 45_000;
const MAX_TOOL_ROUNDS = 8;
const GEMINI_KEY = () => process.env.GEMINI_API_KEY;
const GROQ_KEY = () => process.env.GROQ_API_KEY;
const OPENROUTER_KEY = () => process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_NVIDIA_API_KEY;

function effortInstruction(effort) {
  const map = {
    low: 'Responda de forma direta e rápida. Não complique tarefas simples.',
    medium: 'Analise o pedido com cuidado e entregue uma resposta completa sem raciocínio desnecessariamente longo.',
    high: 'Faça uma análise técnica mais profunda antes de responder. Verifique detalhes e casos de erro.',
    max: 'Priorize precisão, arquitetura, consistência e revisão. Resolva o problema de ponta a ponta.',
    ultracode: 'Atue como um engenheiro sênior. Planeje, implemente mentalmente, revise e entregue a melhor solução possível. Para código, considere segurança, edge cases, manutenção e integração.',
  };
  return map[effort] || map.medium;
}

function systemPrompt(model, effort, hasMcpTools) {
  const profile = getModelProfile(model);
  const mcpInstruction = hasMcpTools
    ? [
        'Existem ferramentas MCP reais conectadas a este workspace.',
        'Use uma ferramenta MCP sempre que ela for necessária para obter dados atuais, ler arquivos externos, consultar serviços ou executar uma ação solicitada pelo usuário.',
        'Não invente o resultado de uma integração. Só diga que uma ação foi concluída quando a ferramenta retornar sucesso.',
        'Quando uma ferramenta MCP resolver parte do pedido, use o resultado como fonte de verdade para a resposta.',
      ].join('\n')
    : 'Nenhuma ferramenta MCP está disponível nesta conversa. Não finja que existe uma integração ativa.';
  return [
    'Você é a Prism IA, uma assistente de inteligência artificial geral e uma engenheira de software quando o pedido envolve tecnologia.',
    'Responda ao que o usuário realmente pediu. Não transforme perguntas comuns em tarefas de programação.',
    'Não diga que não pode responder só porque o pedido não é código. Responda normalmente a perguntas gerais, explicações, escrita, matemática e planejamento.',
    'Quando houver código, entregue código utilizável e explique somente o necessário.',
    'Nunca invente resultados de ferramentas, arquivos, execução ou integrações que não foram realmente executados.',
    `Modelo lógico: ${model}. Perfil: ${profile.description}.`,
    effortInstruction(effort),
    mcpInstruction,
  ].join('\n');
}

async function request(url, options, timeout = PROVIDER_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || data?.message || raw || `HTTP ${response.status}`;
      throw new Error(String(detail).slice(0, 700));
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
  const cleanContext = String(context || '').slice(-30_000);
  return cleanContext
    ? `Contexto recente da conversa:\n${cleanContext}\n\nPedido atual:\n${prompt}`
    : prompt;
}

function openAiTools(mcpTools) {
  return mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.modelName,
      description: tool.description,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

function geminiTools(mcpTools) {
  return [{
    functionDeclarations: mcpTools.map((tool) => ({
      name: tool.modelName,
      description: tool.description,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    })),
  }];
}

function getToolCallsFromGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.filter((part) => part?.functionCall?.name).map((part) => ({
    id: part.functionCall.id,
    name: part.functionCall.name,
    arguments: part.functionCall.args || {},
  }));
}

function geminiParts(data) {
  return data?.candidates?.[0]?.content?.parts || [];
}

async function callGemini(prompt, model, effort, mcp) {
  const key = GEMINI_KEY();
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const geminiModel = process.env.GEMINI_MODEL || getModelProfile(model).gemini || 'gemini-3.6-flash';
  const tools = openAiTools(mcp.tools).length ? geminiTools(mcp.tools) : undefined;
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const toolsUsed = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(model, effort, Boolean(tools)) }] },
          contents,
          ...(tools ? { tools } : {}),
          generationConfig: { temperature: effort === 'low' ? 0.35 : 0.2 },
        }),
      },
    );

    const calls = getToolCallsFromGemini(data);
    if (!calls.length) {
      const text = geminiParts(data).map((part) => part?.text || '').join('');
      return { provider: 'gemini', text, tokens: Number(data?.usageMetadata?.totalTokenCount || 0), toolsUsed };
    }

    const modelParts = geminiParts(data);
    contents.push({ role: 'model', parts: modelParts });
    const responses = [];
    for (const call of calls) {
      const tool = mcp.tools.find((item) => item.modelName === call.name);
      if (!tool) {
        responses.push({ name: call.name, id: call.id, response: { error: 'Ferramenta MCP desconhecida' } });
        continue;
      }
      try {
        const result = await mcp.execute(call.name, call.arguments);
        toolsUsed.push({ server: tool.serverName, tool: tool.toolName });
        responses.push({ name: call.name, id: call.id, response: { result: result.text || '', isError: result.isError } });
      } catch (error) {
        toolsUsed.push({ server: tool.serverName, tool: tool.toolName, error: true });
        responses.push({ name: call.name, id: call.id, response: { error: error?.message || 'Falha na ferramenta MCP' } });
      }
    }
    contents.push({
      role: 'user',
      parts: responses.map((item) => ({
        functionResponse: {
          name: item.name,
          ...(item.id ? { id: item.id } : {}),
          response: item.response,
        },
      })),
    });
  }

  throw new Error('O modelo excedeu o limite de etapas de ferramentas MCP');
}

async function callOpenAiCompatible(url, key, provider, prompt, model, effort, mcp, providerModel, extraHeaders = {}) {
  const hasTools = Boolean(mcp.tools.length);
  const messages = [
    { role: 'system', content: systemPrompt(model, effort, hasTools) },
    { role: 'user', content: prompt },
  ];
  const tools = hasTools ? openAiTools(mcp.tools) : undefined;
  const toolsUsed = [];
  let totalTokens = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const data = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...extraHeaders },
      body: JSON.stringify({
        model: providerModel,
        messages,
        ...(tools ? { tools, tool_choice: 'auto' } : {}),
        temperature: effort === 'low' ? 0.35 : 0.2,
        ...(provider === 'groq' ? { reasoning_effort: ['low', 'medium', 'high'].includes(effort) ? effort : 'high' } : {}),
      }),
    });
    totalTokens += Number(data?.usage?.total_tokens || 0);
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error(`${provider} retornou uma resposta inválida`);
    const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
    messages.push(message);

    if (!calls.length) {
      return { provider, text: message.content || '', tokens: totalTokens, toolsUsed };
    }

    for (const call of calls) {
      const tool = mcp.tools.find((item) => item.modelName === call?.function?.name);
      let args = {};
      try { args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { args = {}; }
      let content;
      if (!tool) {
        content = JSON.stringify({ error: 'Ferramenta MCP desconhecida' });
      } else {
        try {
          const result = await mcp.execute(call.function.name, args);
          toolsUsed.push({ server: tool.serverName, tool: tool.toolName });
          content = JSON.stringify({ result: result.text || '', isError: result.isError });
        } catch (error) {
          toolsUsed.push({ server: tool.serverName, tool: tool.toolName, error: true });
          content = JSON.stringify({ error: error?.message || 'Falha na ferramenta MCP' });
        }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }

  throw new Error(`${provider} excedeu o limite de etapas de ferramentas MCP`);
}

async function callGroq(prompt, model, effort, mcp) {
  const key = GROQ_KEY();
  if (!key) throw new Error('GROQ_API_KEY não configurada');
  const groqModel = process.env.GROQ_MODEL || (model === 'prism-nano-1.0' ? 'openai/gpt-oss-20b' : 'openai/gpt-oss-120b');
  return callOpenAiCompatible('https://api.groq.com/openai/v1/chat/completions', key, 'groq', prompt, model, effort, mcp, groqModel);
}

async function callOpenRouter(prompt, model, effort, mcp) {
  const key = OPENROUTER_KEY();
  if (!key) throw new Error('OPENROUTER_API_KEY não configurada');
  const openRouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-oss-120b';
  return callOpenAiCompatible(
    'https://openrouter.ai/api/v1/chat/completions',
    key,
    'openrouter',
    prompt,
    model,
    effort,
    mcp,
    openRouterModel,
    {
      'HTTP-Referer': process.env.APP_URL || 'https://prism-ia.app',
      'X-Title': 'Prism IA',
    },
  );
}

function candidateProviders(model, effort) {
  const providers = [];
  if (GEMINI_KEY()) providers.push({ name: 'gemini', call: callGemini });
  if (GROQ_KEY() && (normalizeEffort(effort) !== 'low' || model !== 'prism-nano-1.0')) providers.push({ name: 'groq', call: callGroq });
  if (OPENROUTER_KEY() && (normalizeEffort(effort) === 'ultracode' || model === 'prism-taff-2.0')) providers.push({ name: 'openrouter', call: callOpenRouter });
  return providers;
}

export async function runOrchestration(prompt, effort = 'medium', profile = null, context = '', userId = null) {
  const model = profile?.model || profile?.id || 'prism-mini-1.0';
  const normalizedEffort = normalizeEffort(effort);
  const input = buildInput(prompt, context);
  const mcp = userId ? await createMcpExecutionContext(userId) : { tools: [], errors: [], execute: async () => { throw new Error('MCP indisponível'); }, close: async () => {} };
  const providerErrors = [];

  try {
    for (const provider of candidateProviders(model, normalizedEffort)) {
      try {
        const result = await provider.call(input, model, normalizedEffort, mcp);
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

    const configured = [GEMINI_KEY(), GROQ_KEY(), OPENROUTER_KEY()].filter(Boolean).length;
    if (!configured) throw new Error('Nenhuma chave de IA está configurada no backend.');
    throw new Error(`Nenhum provedor respondeu: ${providerErrors.join(' | ')}`);
  } finally {
    await mcp.close().catch(() => {});
  }
}
