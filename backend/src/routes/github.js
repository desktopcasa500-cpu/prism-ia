import { Router } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { encryptToken, getUserToken, githubRequest, isGithubConfigured } from '../services/githubMcp.js';

const router = Router();

router.get('/callback', async (req, res) => {
  try {
    const state = JSON.parse(Buffer.from(String(req.query.state || ''), 'base64url').toString('utf8'));
    const code = String(req.query.code || '');
    if (!state.userId || !state.nonce || !code) return res.status(400).send('OAuth inválido');
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }) });
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) return res.status(502).send('Não foi possível obter o token do GitHub');
    const githubUser = await githubRequest(tokenData.access_token, '/user');
    await pool.query(`INSERT INTO github_connections(user_id,github_user_id,access_token_encrypted,scope) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET github_user_id=EXCLUDED.github_user_id,access_token_encrypted=EXCLUDED.access_token_encrypted,scope=EXCLUDED.scope,updated_at=now()`, [state.userId, String(githubUser.id), encryptToken(tokenData.access_token), tokenData.scope || 'repo read:user user:email']);
    res.redirect(process.env.FRONTEND_ORIGIN || '/configuracoes');
  } catch (error) { console.error(error); res.status(500).send('Falha na conexão com GitHub'); }
});

router.use(requireAuth);

router.get('/status', async (req, res, next) => {
  try { const result = await pool.query('SELECT github_user_id, scope, created_at FROM github_connections WHERE user_id=$1', [req.userId]); res.json({ configured: isGithubConfigured(), connected: Boolean(result.rows.length), connection: result.rows[0] || null }); } catch (error) { next(error); }
});

router.get('/connect', (req, res) => {
  if (!isGithubConfigured()) return res.status(503).json({ error: 'GitHub OAuth não configurado no backend' });
  const state = Buffer.from(JSON.stringify({ userId: req.userId, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID, redirect_uri: `${process.env.APP_URL || 'http://localhost:3000'}/api/github/callback`, scope: 'repo read:user user:email', state });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/repositories', async (req, res, next) => {
  try { const token = await getUserToken(req.userId); res.json({ repositories: await githubRequest(token, '/user/repos?per_page=100&sort=updated') }); } catch (error) { next(error); }
});

router.get('/repositories/:owner/:repo/files/*', async (req, res, next) => {
  try { const token = await getUserToken(req.userId); const path = req.params[0] || ''; res.json(await githubRequest(token, `/repos/${encodeURIComponent(req.params.owner)}/${encodeURIComponent(req.params.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`)); } catch (error) { next(error); }
});

router.put('/repositories/:owner/:repo/files/*', async (req, res, next) => {
  try {
    const token = await getUserToken(req.userId); const path = req.params[0] || ''; const content = String(req.body?.content || '');
    if (!path || path.includes('..')) return res.status(400).json({ error: 'Caminho inválido' });
    let existing = null; try { existing = await githubRequest(token, `/repos/${req.params.owner}/${req.params.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`); } catch {}
    const payload = { message: String(req.body?.message || `Prism Codex: atualiza ${path}`).slice(0, 200), content: Buffer.from(content).toString('base64') };
    if (existing?.sha) payload.sha = existing.sha;
    res.json(await githubRequest(token, `/repos/${req.params.owner}/${req.params.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', body: JSON.stringify(payload) }));
  } catch (error) { next(error); }
});

router.post('/repositories/:owner/:repo/branches', async (req, res, next) => {
  try { const token = await getUserToken(req.userId); const base = String(req.body?.base || 'main'); const branch = String(req.body?.branch || '').trim(); if (!branch) return res.status(400).json({ error: 'Branch obrigatória' }); const ref = await githubRequest(token, `/repos/${req.params.owner}/${req.params.repo}/git/ref/heads/${encodeURIComponent(base)}`); res.status(201).json(await githubRequest(token, `/repos/${req.params.owner}/${req.params.repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref.object.sha }) })); } catch (error) { next(error); }
});

export default router;
