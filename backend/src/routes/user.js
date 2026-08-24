import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, name, plan, created_at FROM users WHERE id = $1',
    [req.userId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({ user: result.rows[0] });
});

router.get('/me/stats', async (req, res) => {
  const [sessions, messages, tokens] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1', [req.userId]),
    pool.query('SELECT COUNT(*)::int AS count FROM messages WHERE user_id = $1', [req.userId]),
    pool.query('SELECT COALESCE(SUM(tokens_used), 0)::int AS total FROM messages WHERE user_id = $1', [req.userId]),
  ]);
  res.json({
    sessions: sessions.rows[0].count,
    messages: messages.rows[0].count,
    total_tokens: tokens.rows[0].total,
  });
});

export default router;
