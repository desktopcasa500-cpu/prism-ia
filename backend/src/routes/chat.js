import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runOrchestration } from '../services/orchestrator.js';

const router = Router();
router.use(requireAuth);

router.get('/sessions', async (req, res) => {
  const result = await pool.query('SELECT id, title, created_at FROM sessions WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
  res.json({ sessions: result.rows });
});

router.post('/sessions', async (req, res) => {
  const title = req.body?.title || 'Nova conversa';
  const result = await pool.query('INSERT INTO sessions (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at', [req.userId, title]);
  res.status(201).json({ session: result.rows[0] });
});

router.get('/sessions/:id/messages', async (req, res) => {
  const owns = await pool.query('SELECT id FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
  const result = await pool.query('SELECT id, role, content, effort, tokens_used, created_at FROM messages WHERE session_id = $1 ORDER BY created_at ASC', [req.params.id]);
  res.json({ messages: result.rows });
});

router.post('/sessions/:id/messages', async (req, res) => {
  const { content, effort = 'medium' } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: 'Mensagem vazia' });
  const owns = await pool.query('SELECT id FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
  if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
  await pool.query('INSERT INTO messages (session_id, user_id, role, content, effort) VALUES ($1, $2, $3, $4, $5)', [req.params.id, req.userId, 'user', content, effort]);
  try {
    const result = await runOrchestration(content, effort);
    const saved = await pool.query(`INSERT INTO messages (session_id, user_id, role, content, effort, tokens_used) VALUES ($1, $2, 'assistant', $3, $4, $5) RETURNING id, role, content, effort, tokens_used, created_at`, [req.params.id, req.userId, result.text, effort, result.tokens]);
    res.json({ message: saved.rows[0], providers_used: result.providers, provider_errors: result.errors });
  } catch (err) {
    res.status(502).json({ error: 'Falha na orquestração de IA', detail: err.message });
  }
});

export default router;
