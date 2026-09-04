import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runOrchestration } from '../services/orchestrator.js';
import { runParallelOrchestration } from '../services/parallelOrchestrator.js';

const router = Router();
const ALLOWED_EFFORTS = new Set(['low', 'medium', 'high', 'max', 'ultracode']);
const ALLOWED_MODELS = new Set(['prism-nano-1.0', 'prism-mini-1.0', 'prism-tex-1.5', 'prism-taff-1.0', 'prism-taff-2.0']);
const ALLOWED_PROVIDERS = new Set(['anthropic', 'openai', 'gemini']);
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_PARALLEL_MODELS = 3;
router.use(requireAuth);

router.get('/sessions', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, title, created_at, updated_at FROM sessions WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC', [req.userId]);
    res.json({ sessions: result.rows });
  } catch (error) { next(error); }
});

router.post('/sessions', async (req, res, next) => {
  try {
    const title = String(req.body?.title || 'Nova conversa').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Nova conversa';
    const result = await pool.query('INSERT INTO sessions (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at', [req.userId, title]);
    res.status(201).json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/sessions/:id', async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!title) return res.status(400).json({ error: 'O título não pode ficar vazio.' });
    const result = await pool.query('UPDATE sessions SET title=$1, updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,title,created_at,updated_at', [title, req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/sessions/:id/messages', async (req, res, next) => {
  try {
    const owns = await pool.query('SELECT id FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    const result = await pool.query('SELECT id, role, content, effort, tokens_used, provider, model_id, thinking_summary, metadata, created_at FROM messages WHERE session_id = $1 AND user_id = $2 ORDER BY created_at ASC', [req.params.id, req.userId]);
    res.json({ messages: result.rows });
  } catch (error) { next(error); }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post('/parallel', async (req, res, next) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const effort = String(req.body?.effort || 'medium');
    const requested = Array.isArray(req.body?.models) ? req.body.models.slice(0, MAX_PARALLEL_MODELS) : [];
    const serverIds = Array.isArray(req.body?.mcpServerIds) ? req.body.mcpServerIds : [];
    const context = String(req.body?.context || '').slice(-30_000);

    if (!sessionId) return res.status(400).json({ error: 'Sessão inválida.' });
    if (!content) return res.status(400).json({ error: 'Mensagem vazia' });
    if (content.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ error: 'Mensagem muito longa' });
    if (!ALLOWED_EFFORTS.has(effort)) return res.status(400).json({ error: 'Nível de pensamento inválido' });

    const session = await pool.query('SELECT id, title FROM sessions WHERE id=$1 AND user_id=$2', [sessionId, req.userId]);
    if (!session.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });

    const models = requested.filter((entry) => entry && ALLOWED_PROVIDERS.has(String(entry.provider)) && String(entry.model || '').length < 160);
    if (!models.length) return res.status(400).json({ error: 'Selecione pelo menos um provedor.' });

    await pool.query('INSERT INTO messages (session_id,user_id,role,content,effort) VALUES ($1,$2,\'user\',$3,$4)', [sessionId, req.userId, content, effort]);
    const title = session.rows[0].title === 'Nova conversa' ? content.replace(/\s+/g, ' ').slice(0, 64) || 'Nova conversa' : session.rows[0].title;
    await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3', [title, sessionId, req.userId]);

    const parallel = await runParallelOrchestration({
      prompt: content,
      context,
      effort,
      userId: req.userId,
      requestedModels: models,
      mcpServerIds: serverIds,
    });

    const saved = [];
    for (const item of parallel.results || []) {
      if (item.status !== 'fulfilled' || !item.text) continue;
      const result = await pool.query(`INSERT INTO messages
        (session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata)
        VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9)
        RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`, [
        sessionId, req.userId, item.text, effort, Number(item.tokens || 0), item.provider, item.model, item.thinking_summary || '', JSON.stringify({ tools_used: item.tools_used || [], elapsed_ms: item.elapsed_ms || 0 }),
      ]);
      saved.push(result.rows[0]);
    }

    res.json({
      results: parallel.results || [],
      saved,
      mcp_errors: parallel.mcp_errors || [],
      elapsed_ms: parallel.elapsed_ms || 0,
    });
  } catch (error) { next(error); }
});

router.post('/sessions/:id/messages', async (req, res, next) => {
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  const effort = req.body?.effort || 'medium';
  const model = req.body?.model || 'prism-mini-1.0';
  if (!content) return res.status(400).json({ error: 'Mensagem vazia' });
  if (content.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ error: 'Mensagem muito longa' });
  if (!ALLOWED_EFFORTS.has(effort)) return res.status(400).json({ error: 'Nível de pensamento inválido' });
  if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Modelo inválido' });

  try {
    const owns = await pool.query('SELECT id, title FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada' });
    const previous = await pool.query('SELECT role, content FROM messages WHERE session_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 16', [req.params.id, req.userId]);
    const conversationContext = previous.rows.reverse().map((message) => `${message.role}: ${message.content}`).join('\n');
    await pool.query('INSERT INTO messages (session_id, user_id, role, content, effort) VALUES ($1, $2, $3, $4, $5)', [req.params.id, req.userId, 'user', content, effort]);
    const title = owns.rows[0].title === 'Nova conversa' ? content.replace(/\s+/g, ' ').slice(0, 64) || 'Nova conversa' : owns.rows[0].title;
    await pool.query('UPDATE sessions SET title = $1, updated_at = now() WHERE id = $2 AND user_id = $3', [title, req.params.id, req.userId]);
    let result;
    try { result = await runOrchestration(content, effort, { model }, conversationContext, req.userId); }
    catch (error) {
      console.error('Orchestration error:', error);
      const missingKeys = /não configurada/i.test(error?.message || '');
      return res.status(missingKeys ? 503 : 502).json({ error: missingKeys ? 'Os motores de IA ainda não estão configurados no backend.' : 'O serviço de geração não respondeu. Tente novamente.' });
    }
    const text = typeof result?.text === 'string' ? result.text.trim() : '';
    if (!text) return res.status(502).json({ error: 'O serviço de geração retornou uma resposta vazia.' });
    const saved = await pool.query(`INSERT INTO messages (session_id, user_id, role, content, effort, tokens_used, provider, model_id, thinking_summary, metadata)
      VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, role, content, effort, tokens_used, provider, model_id, thinking_summary, metadata, created_at`, [
      req.params.id, req.userId, text, effort, Number.isFinite(result.tokens) ? result.tokens : 0, Array.isArray(result.providers) ? result.providers[0] : null, model, 'Resposta gerada e revisada.', JSON.stringify({ tools_used: result.tools_used || [] }),
    ]);
    res.json({ message: saved.rows[0], providers_used: Array.isArray(result.providers) ? result.providers : [], tools_used: Array.isArray(result.tools_used) ? result.tools_used : [], mcp_errors: Array.isArray(result.mcp_errors) ? result.mcp_errors : [], model, effort });
  } catch (error) { next(error); }
});

export default router;
