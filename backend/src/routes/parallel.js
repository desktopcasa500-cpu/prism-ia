import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runParallelOrchestration } from '../services/parallelOrchestrator.js';

const router = Router();
router.use(requireAuth);
const ALLOWED = new Set(['anthropic', 'openai', 'gemini']);
const MAX_MESSAGE_LENGTH = 20_000;

router.post('/', async (req, res, next) => {
  const sessionId = String(req.body?.sessionId || '');
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const effort = String(req.body?.effort || 'medium');
  const context = String(req.body?.context || '').slice(-30_000);
  const requestedModels = Array.isArray(req.body?.models) ? req.body.models.filter((item) => ALLOWED.has(item?.provider)).slice(0, 6) : [];
  const mcpServerIds = Array.isArray(req.body?.mcpServerIds) ? req.body.mcpServerIds.map(String).slice(0, 32) : [];

  if (!sessionId || !content) return res.status(400).json({ error: 'Sessão e mensagem são obrigatórias.' });
  if (content.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ error: 'Mensagem muito longa.' });

  try {
    const owns = await pool.query('SELECT id,title FROM sessions WHERE id=$1 AND user_id=$2', [sessionId, req.userId]);
    if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.' });

    const previous = await pool.query('SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 16', [sessionId, req.userId]);
    const history = previous.rows.reverse().map((message) => `${message.role}: ${message.content}`).join('\n');
    const effectiveContext = [history, context].filter(Boolean).join('\n');

    await pool.query('INSERT INTO messages (session_id,user_id,role,content,effort) VALUES ($1,$2,\'user\',$3,$4)', [sessionId, req.userId, content, effort]);
    const title = owns.rows[0].title === 'Nova conversa' ? content.replace(/\s+/g, ' ').slice(0, 64) || 'Nova conversa' : owns.rows[0].title;
    await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3', [title, sessionId, req.userId]);

    const result = await runParallelOrchestration({ prompt: content, context: effectiveContext, effort, userId: req.userId, requestedModels, mcpServerIds });
    const saved = [];
    for (const item of result.results.filter((entry) => entry.status === 'fulfilled' && entry.text)) {
      const row = await pool.query(`INSERT INTO messages (session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata)
        VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9)
        RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`, [
        sessionId, req.userId, item.text, effort, item.tokens, item.provider, item.model, item.thinking_summary || '', JSON.stringify({ tools_used: item.tools_used || [], elapsed_ms: item.elapsed_ms || 0 }),
      ]);
      saved.push(row.rows[0]);
    }

    return res.json({ sessionId, results: result.results, saved, mcp_errors: result.mcp_errors, elapsed_ms: result.elapsed_ms });
  } catch (error) { next(error); }
});

export default router;
