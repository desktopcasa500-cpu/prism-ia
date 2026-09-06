import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runParallelOrchestration } from '../services/parallelOrchestrator.js';
import { normalizeEffort } from '../services/modelRouter.js';
import { getUsage, reserveUsage, recordTokens, MODEL_REQUIREMENTS, normalizePlanRank, PLAN_FEATURES } from '../services/usage.js';

const router = Router();
router.use(requireAuth);
const ALLOWED_PROVIDERS = new Set(['anthropic', 'openai', 'gemini']);
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_MODELS = 3;

router.post('/', async (req, res, next) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  const content = typeof req.body?.content === 'string' ? req.body.content.replace(/\u0000/g, '').trim() : '';
  const effort = normalizeEffort(String(req.body?.effort || 'medium'));
  const context = String(req.body?.context || '').slice(-30_000);
  const requestedModels = Array.isArray(req.body?.models)
    ? req.body.models.filter((item) => item && ALLOWED_PROVIDERS.has(String(item.provider)) && String(item.model || '').length <= 100).slice(0, MAX_MODELS)
    : [];
  const mcpServerIds = Array.isArray(req.body?.mcpServerIds) ? req.body.mcpServerIds.map(String).slice(0, 32) : [];

  if (!sessionId || !content) return res.status(400).json({ error: 'Sessão e mensagem são obrigatórias.' });
  if (content.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ error: 'Mensagem muito longa.' });
  if (!requestedModels.length) return res.status(400).json({ error: 'Selecione pelo menos um modelo.' });

  try {
    const owns = await pool.query('SELECT id,title FROM sessions WHERE id=$1 AND user_id=$2', [sessionId, req.userId]);
    if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.' });

    const user = await pool.query('SELECT plan FROM users WHERE id=$1', [req.userId]);
    if (!user.rows.length) return res.status(401).json({ error: 'Conta não encontrada.' });
    const rank = normalizePlanRank(user.rows[0].plan);
    if (effort === 'ultracode' && !PLAN_FEATURES[rank]?.ultracode) {
      return res.status(403).json({ error: 'O modo Ultracode está disponível apenas no plano Empresarial.', code: 'PLAN_UPGRADE_REQUIRED', requiredPlan: 'Empresarial' });
    }
    const unavailable = requestedModels.find((entry) => {
      const required = MODEL_REQUIREMENTS[String(entry.model)];
      return required === undefined || rank < required;
    });
    if (unavailable) {
      const required = MODEL_REQUIREMENTS[String(unavailable.model)];
      return res.status(403).json({
        error: 'Um dos modelos selecionados não está disponível no seu plano.',
        code: 'PLAN_UPGRADE_REQUIRED',
        model: unavailable.model,
        requiredPlan: ['Grátis', 'Base', 'Medium', 'Pro', 'Empresarial'][required] || 'Pro',
      });
    }

    const reservation = await reserveUsage(req.userId, 'parallel');
    if (!reservation.ok) return res.status(429).json({ error: 'O limite de uso desta janela foi atingido.', code: reservation.code, usage: reservation.usage });

    const previous = await pool.query(
      'SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 24',
      [sessionId, req.userId],
    );
    const history = previous.rows.reverse().map((message) => `${message.role}: ${message.content}`).join('\n');
    const effectiveContext = [history, context].filter(Boolean).join('\n').slice(-30_000);

    await pool.query(
      `INSERT INTO messages (session_id,user_id,role,content,effort,model_id)
       VALUES ($1,$2,'user',$3,$4,'parallel')`,
      [sessionId, req.userId, content, effort],
    );
    const title = owns.rows[0].title === 'Nova conversa' ? content.replace(/\s+/g, ' ').slice(0, 64) || 'Nova conversa' : owns.rows[0].title;
    await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3', [title, sessionId, req.userId]);

    const result = await runParallelOrchestration({
      prompt: content,
      context: effectiveContext,
      effort,
      userId: req.userId,
      requestedModels,
      mcpServerIds,
    });
    const saved = [];
    let totalTokens = 0;
    for (const item of (result.results || [])) {
      if (item.status !== 'fulfilled' || !item.text) continue;
      const tokens = Number.isFinite(Number(item.tokens)) ? Math.max(0, Number(item.tokens)) : 0;
      totalTokens += tokens;
      const row = await pool.query(
        `INSERT INTO messages (session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata)
         VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9)
         RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`,
        [sessionId, req.userId, item.text, effort, tokens, item.provider, item.model, item.thinking_summary || '', JSON.stringify({ tools_used: item.tools_used || [], elapsed_ms: item.elapsed_ms || 0 })],
      );
      saved.push(row.rows[0]);
    }
    await recordTokens(reservation.reservationId, 'parallel', totalTokens);

    const usage = await getUsage(req.userId);
    res.json({ sessionId, results: result.results || [], saved, mcp_errors: result.mcp_errors || [], elapsed_ms: result.elapsed_ms || 0, usage });
  } catch (error) {
    next(error);
  }
});

export default router;
