import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptSecret, getMcpServers, probeMcpServer } from '../services/mcp.js';

const router = Router();
router.use(requireAuth);

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function normalizeEndpoint(value) {
  return String(value || '').trim().slice(0, 2048);
}

function builtinGithubServer() {
  const token = process.env.GITHUB_MCP_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) return null;
  return {
    id: 'builtin-github',
    name: 'GitHub',
    endpoint_url: process.env.GITHUB_MCP_URL || 'https://api.githubcopilot.com/mcp/',
    auth_token_encrypted: encryptSecret(token),
    enabled: true,
    builtin: true,
  };
}

async function ownsServer(id, userId) {
  const result = await pool.query(
    'SELECT id, name, endpoint_url, auth_token_encrypted, enabled, created_at, updated_at FROM mcp_servers WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return result.rows[0] || null;
}

async function resolveServer(id, userId) {
  if (id === 'builtin-github') return builtinGithubServer();
  return ownsServer(id, userId);
}

router.get('/', async (req, res, next) => {
  try {
    const servers = await getMcpServers(req.userId);
    const github = builtinGithubServer();
    res.json({
      servers: [
        ...(github ? [{ id: github.id, name: github.name, endpoint_url: github.endpoint_url, enabled: true, builtin: true }] : []),
        ...servers.map((server) => ({ ...server, builtin: false })),
      ],
    });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = normalizeName(req.body?.name);
    const endpointUrl = normalizeEndpoint(req.body?.endpoint_url);
    const token = String(req.body?.token || '').trim();
    if (name.length < 2) return res.status(400).json({ error: 'Dê um nome ao servidor MCP.' });
    if (!endpointUrl) return res.status(400).json({ error: 'Informe o endpoint MCP.' });

    const candidate = {
      id: 'pending',
      name,
      endpoint_url: endpointUrl,
      auth_token_encrypted: token ? encryptSecret(token) : null,
      enabled: true,
    };

    let probe;
    try {
      probe = await probeMcpServer(candidate);
    } catch (error) {
      return res.status(422).json({ error: error?.message || 'Não foi possível conectar ao servidor MCP.' });
    }

    const result = await pool.query(
      `INSERT INTO mcp_servers (user_id, name, endpoint_url, auth_token_encrypted, enabled)
       VALUES ($1, $2, $3, $4, TRUE)
       ON CONFLICT (user_id, name) DO UPDATE SET
         endpoint_url = EXCLUDED.endpoint_url,
         auth_token_encrypted = EXCLUDED.auth_token_encrypted,
         enabled = TRUE,
         updated_at = now()
       RETURNING id, name, endpoint_url, enabled, created_at, updated_at`,
      [req.userId, name, endpointUrl, candidate.auth_token_encrypted],
    );

    res.status(201).json({ server: result.rows[0], transport: probe.transport, tool_count: probe.tools.length, tools: probe.tools });
  } catch (error) { next(error); }
});

router.post('/:id/test', async (req, res, next) => {
  try {
    const server = await resolveServer(req.params.id, req.userId);
    if (!server) return res.status(404).json({ error: 'Servidor MCP não encontrado.' });
    const result = await probeMcpServer(server);
    res.json({ ok: true, server: result.server, transport: result.transport, tool_count: result.tools.length, tools: result.tools });
  } catch (error) {
    res.status(422).json({ ok: false, error: error?.message || 'Falha ao testar o servidor MCP.' });
  }
});

router.get('/:id/tools', async (req, res, next) => {
  try {
    const server = await resolveServer(req.params.id, req.userId);
    if (!server) return res.status(404).json({ error: 'Servidor MCP não encontrado.' });
    const result = await probeMcpServer(server);
    res.json({ server: result.server, transport: result.transport, tools: result.tools });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const existing = await ownsServer(req.params.id, req.userId);
    if (!existing) return res.status(404).json({ error: 'Servidor MCP não encontrado.' });
    const name = req.body?.name === undefined ? existing.name : normalizeName(req.body.name);
    const endpointUrl = req.body?.endpoint_url === undefined ? existing.endpoint_url : normalizeEndpoint(req.body.endpoint_url);
    const tokenProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'token');
    const encryptedToken = tokenProvided ? (String(req.body?.token || '').trim() ? encryptSecret(String(req.body.token).trim()) : null) : existing.auth_token_encrypted;
    const enabled = req.body?.enabled === undefined ? existing.enabled : Boolean(req.body.enabled);
    if (name.length < 2 || !endpointUrl) return res.status(400).json({ error: 'Nome e endpoint MCP são obrigatórios.' });

    if (enabled) {
      try {
        await probeMcpServer({ ...existing, name, endpoint_url: endpointUrl, auth_token_encrypted: encryptedToken, enabled: true });
      } catch (error) {
        return res.status(422).json({ error: error?.message || 'O servidor MCP não respondeu.' });
      }
    }

    const result = await pool.query(
      `UPDATE mcp_servers
          SET name = $1, endpoint_url = $2, auth_token_encrypted = $3, enabled = $4, updated_at = now()
        WHERE id = $5 AND user_id = $6
      RETURNING id, name, endpoint_url, enabled, created_at, updated_at`,
      [name, endpointUrl, encryptedToken, enabled, existing.id, req.userId],
    );
    res.json({ server: result.rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM mcp_servers WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Servidor MCP não encontrado.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
