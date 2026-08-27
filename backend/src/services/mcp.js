import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { pool } from '../db/pool.js';

const MCP_TIMEOUT = 35_000;
const MAX_TOOL_RESULT = 30_000;
const MAX_TOOLS_PER_SERVER = 128;

function encryptionKey() {
  const configured = String(process.env.MCP_ENCRYPTION_KEY || '').trim();
  if (!configured) throw new Error('MCP_ENCRYPTION_KEY não configurada');
  return crypto.createHash('sha256').update(configured).digest();
}

export function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(value) {
  if (!value) return '';
  const [ivPart, tagPart, dataPart] = String(value).split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Credencial MCP inválida');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}

function isPrivateIp(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return false;
}

async function assertSafeUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error('Endpoint MCP inválido'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Endpoint MCP deve usar HTTP ou HTTPS');
  if (url.username || url.password) throw new Error('Credenciais não podem ficar embutidas na URL');
  if (url.protocol === 'http:' && process.env.NODE_ENV === 'production' && process.env.MCP_ALLOW_HTTP !== 'true') {
    throw new Error('Endpoints HTTP não são permitidos em produção');
  }
  if (process.env.MCP_ALLOW_PRIVATE_HOSTS !== 'true') {
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateIp(hostname)) {
      throw new Error('Endpoint MCP local ou privado bloqueado');
    }
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true }).catch((error) => {
      if (error?.code === 'ENOTFOUND' || error?.code === 'EAI_AGAIN') throw new Error('Não foi possível resolver o endpoint MCP');
      throw error;
    });
    if (addresses.some((entry) => isPrivateIp(entry.address))) throw new Error('Endpoint MCP resolve para endereço privado');
  }
  return url;
}

function withTimeout(promise, ms = MCP_TIMEOUT) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Servidor MCP demorou demais para responder')), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function shortId(id) {
  return String(id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'server';
}

function sanitizeToolName(name) {
  const clean = String(name || 'tool').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return clean || 'tool';
}

function toolDefinition(server, tool) {
  const modelName = `mcp_${shortId(server.id)}_${sanitizeToolName(tool.name)}`.slice(0, 64);
  return {
    modelName,
    serverId: server.id,
    serverName: server.name,
    toolName: tool.name,
    description: String(tool.description || `Ferramenta ${tool.name} do MCP ${server.name}`).slice(0, 1000),
    inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : { type: 'object', properties: {} },
  };
}

function normalizeToolResult(result) {
  const content = Array.isArray(result?.content) ? result.content : [];
  const parts = content.map((item) => {
    if (item?.type === 'text') return String(item.text || '');
    if (item?.type === 'resource' && item.resource) return JSON.stringify(item.resource);
    return JSON.stringify(item);
  }).filter(Boolean);
  return { text: parts.join('\n').slice(0, MAX_TOOL_RESULT), isError: Boolean(result?.isError) };
}

async function connectServer(server) {
  const url = await assertSafeUrl(server.endpoint_url);
  const token = decryptSecret(server.auth_token_encrypted);
  const authProvider = token ? { token: async () => token } : undefined;
  let transport;
  const client = new Client({ name: 'prism-ia', version: '1.1.1' });

  try {
    transport = new StreamableHTTPClientTransport(url, authProvider ? { authProvider } : {});
    await withTimeout(client.connect(transport));
    return { client, transport, transportName: 'streamable-http' };
  } catch (streamableError) {
    await client.close().catch(() => {});
    const fallbackClient = new Client({ name: 'prism-ia', version: '1.1.1' });
    const fallbackTransport = new SSEClientTransport(url, authProvider ? { authProvider } : {});
    try {
      await withTimeout(fallbackClient.connect(fallbackTransport));
      return { client: fallbackClient, transport: fallbackTransport, transportName: 'sse' };
    } catch (sseError) {
      await fallbackClient.close().catch(() => {});
      throw new Error(`MCP indisponível: ${streamableError?.message || 'HTTP'}; fallback SSE: ${sseError?.message || 'falhou'}`.slice(0, 1000));
    }
  }
}

async function listAllTools(client) {
  const tools = [];
  let cursor;
  do {
    const result = await withTimeout(client.listTools(cursor ? { cursor } : undefined));
    if (Array.isArray(result?.tools)) tools.push(...result.tools);
    cursor = result?.nextCursor || undefined;
    if (tools.length >= MAX_TOOLS_PER_SERVER) break;
  } while (cursor);
  return tools.slice(0, MAX_TOOLS_PER_SERVER);
}

export async function probeMcpServer(server) {
  const connection = await connectServer(server);
  try {
    const tools = await listAllTools(connection.client);
    return { ok: true, transport: connection.transportName, tools: tools.map((tool) => ({ name: tool.name, description: tool.description || '', inputSchema: tool.inputSchema || { type: 'object' } })) };
  } finally {
    await connection.client.close().catch(() => {});
  }
}

export async function createMcpExecutionContext(userId) {
  const saved = await pool.query(
    `SELECT id, name, endpoint_url, auth_token_encrypted, enabled
       FROM mcp_servers
      WHERE user_id = $1 AND enabled = TRUE
      ORDER BY created_at ASC`,
    [userId],
  );

  const builtIn = [];
  const githubToken = process.env.GITHUB_MCP_TOKEN || process.env.GITHUB_TOKEN;
  if (githubToken) {
    builtIn.push({
      id: 'builtin-github',
      name: 'GitHub',
      endpoint_url: process.env.GITHUB_MCP_URL || 'https://api.githubcopilot.com/mcp/',
      auth_token_encrypted: encryptSecret(githubToken),
      enabled: true,
      builtin: true,
    });
  }

  const servers = [...saved.rows, ...builtIn];
  const settled = await Promise.allSettled(servers.map(async (server) => ({ server, connection: await connectServer(server) })));
  const connections = [];
  const registry = new Map();
  const errors = [];

  await Promise.all(settled.map(async (entry) => {
    if (entry.status === 'rejected') {
      errors.push({ server: 'MCP', message: entry.reason?.message || 'Falha ao conectar ao MCP' });
      return;
    }
    const { server, connection } = entry.value;
    try {
      const rawTools = await listAllTools(connection.client);
      const tools = rawTools.map((tool) => toolDefinition(server, tool));
      tools.forEach((tool) => registry.set(tool.modelName, { ...tool, client: connection.client }));
      connections.push(connection);
    } catch (error) {
      errors.push({ server: server.name, message: error?.message || 'Falha ao descobrir ferramentas MCP' });
      await connection.client.close().catch(() => {});
    }
  }));

  async function execute(modelName, args = {}) {
    const tool = registry.get(modelName);
    if (!tool) throw new Error(`Ferramenta MCP não encontrada: ${modelName}`);
    const result = await withTimeout(tool.client.callTool({ name: tool.toolName, arguments: args && typeof args === 'object' ? args : {} }));
    return normalizeToolResult(result);
  }

  async function close() {
    await Promise.allSettled(connections.map((connection) => connection.client.close()));
  }

  return { tools: [...registry.values()].map(({ client, ...tool }) => tool), execute, close, errors };
}

export async function getMcpServers(userId) {
  const result = await pool.query(
    `SELECT id, name, endpoint_url, enabled, created_at, updated_at
       FROM mcp_servers
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
}
