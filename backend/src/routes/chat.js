import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runOrchestration } from '../services/orchestrator.js';
import { normalizeEffort, validateThinking } from '../services/modelRouter.js';
import { getUsage, getDailyUsage, reserveUsage, releaseUsage, recordTokens, MODEL_REQUIREMENTS, normalizePlanRank, PLAN_FEATURES } from '../services/usage.js';

const router = Router();
const ALLOWED_EFFORTS = new Set(['low', 'medium', 'high', 'max', 'ultracode']);
const ALLOWED_MODELS = new Set(Object.keys(MODEL_REQUIREMENTS));
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_HISTORY_MESSAGES = 24;
const PLAN_NAMES = ['Grátis', 'Base', 'Medium', 'Pro', 'Empresarial'];
const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade nos servidores. Tente novamente mais tarde.';

router.use(requireAuth);

function cleanText(value, max = MAX_MESSAGE_LENGTH) {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : '';
}

async function getUserPlan(userId) {
  const result = await pool.query('SELECT plan FROM users WHERE id=$1', [userId]);
  if (!result.rows.length) return null;
  const plan = result.rows[0].plan || 'free';
  return { plan, rank: normalizePlanRank(plan), label: PLAN_NAMES[normalizePlanRank(plan)] || 'Grátis' };
}

async function authorizeModel(userId, model, effort) {
  const account = await getUserPlan(userId);
  if (!account) return { ok: false, status: 401, code: 'AUTH_REQUIRED', error: 'Conta não encontrada.' };
  const requiredRank = MODEL_REQUIREMENTS[model];
  if (requiredRank === undefined) return { ok: false, status: 400, code: 'INVALID_MODEL', error: 'Modelo inválido.' };
  if (account.rank < requiredRank) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'Este modelo não está disponível no seu plano.', model, requiredPlan: PLAN_NAMES[requiredRank] || 'Pro' };
  const normalizedEffort = normalizeEffort(effort);
  if (!validateThinking(model, normalizedEffort)) return { ok: false, status: 400, code: 'INVALID_EFFORT', error: 'Nível de pensamento inválido.' };
  if (normalizedEffort === 'ultracode' && !PLAN_FEATURES[account.rank]?.ultracode) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'O modo Ultracode está disponível apenas no plano Empresarial.', requiredPlan: 'Empresarial', model };
  return { ok: true, ...account, effort: normalizedEffort };
}

function sessionTitle(current, content) {
  if (current !== 'Nova conversa') return current;
  return cleanText(content, 64).replace(/\s+/g, ' ') || 'Nova conversa';
}

async function loadHistory(sessionId, userId) {
  const result = await pool.query(
    `SELECT role, content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3`,
    [sessionId, userId, MAX_HISTORY_MESSAGES],
  );
  return result.rows.reverse().map((message) => `${message.role}: ${message.content}`).join('\n');
}

router.get('/usage', async (req, res, next) => {
  try {
    const usage = await getUsage(req.userId);
    if (!usage) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json(usage);
  } catch (error) { next(error); }
});

router.get('/usage/history', async (req, res, next) => {
  try {
    const history = await getDailyUsage(req.userId, req.query?.days);
    res.json(history);
  } catch (error) { next(error); }
});

router.get('/sessions', async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT id,title,created_at,updated_at FROM sessions WHERE user_id=$1 ORDER BY updated_at DESC, created_at DESC`, [req.userId]);
    res.json({ sessions: result.rows });
  } catch (error) { next(error); }
});

router.post('/sessions', async (req, res, next) => {
  try {
    const title = cleanText(req.body?.title, 120).replace(/\s+/g, ' ') || 'Nova conversa';
    const result = await pool.query('INSERT INTO sessions (user_id,title) VALUES ($1,$2) RETURNING id,title,created_at,updated_at', [req.userId, title]);
    res.status(201).json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/sessions/:id', async (req, res, next) => {
  try {
    const title = cleanText(req.body?.title, 120).replace(/\s+/g, ' ');
    if (!title) return res.status(400).json({ error: 'O título não pode ficar vazio.' });
    const result = await pool.query(`UPDATE sessions SET title=$1, updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,title,created_at,updated_at`, [title, req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/sessions/:id/messages', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT m.id,m.role,m.content,m.effort,m.tokens_used,m.provider,m.model_id,m.thinking_summary,m.metadata,m.created_at
         FROM messages m JOIN sessions s ON s.id=m.session_id AND s.user_id=m.user_id
        WHERE m.session_id=$1 AND m.user_id=$2 ORDER BY m.created_at ASC`,
      [req.params.id, req.userId],
    );
    if (!result.rows.length) {
      const owns = await pool.query('SELECT id FROM sessions WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
      if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.' });
    }
    res.json({ messages: result.rows });
  } catch (error) { next(error); }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post('/sessions/:id/messages', async (req, res, next) => {
  const content = cleanText(req.body?.content);
  const model = cleanText(req.body?.model, 80) || 'prism-mini-1.0';
  const effort = normalizeEffort(cleanText(req.body?.effort, 20) || 'medium');

  if (!content) return res.status(400).json({ error: 'Mensagem vazia.', code: 'EMPTY_MESSAGE' });
  if (typeof req.body?.content === 'string' && req.body.content.length > MAX_MESSAGE_LENGTH) return res.status(413).json({ error: 'Mensagem muito longa.', code: 'MESSAGE_TOO_LONG' });
  if (!ALLOWED_EFFORTS.has(effort)) return res.status(400).json({ error: 'Nível de pensamento inválido.', code: 'INVALID_EFFORT' });
  if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Modelo inválido.', code: 'INVALID_MODEL' });

  let reservation = null;
  try {
    const owns = await pool.query('SELECT id,title FROM sessions WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (!owns.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.', code: 'SESSION_NOT_FOUND' });

    const authorization = await authorizeModel(req.userId, model, effort);
    if (!authorization.ok) return res.status(authorization.status).json({ ...authorization, status: undefined });

    reservation = await reserveUsage(req.userId, model);
    if (!reservation.ok) {
      if (reservation.code === 'AUTH_REQUIRED') return res.status(401).json({ error: 'Sessão expirada.', code: reservation.code });
      return res.status(429).json({ error: 'O limite de uso desta janela foi atingido.', code: reservation.code, usage: reservation.usage });
    }

    const conversationContext = await loadHistory(req.params.id, req.userId);
    await pool.query(`INSERT INTO messages (session_id,user_id,role,content,effort,model_id) VALUES ($1,$2,'user',$3,$4,$5)`, [req.params.id, req.userId, content, effort, model]);
    await pool.query(`UPDATE sessions SET title=$1, updated_at=now() WHERE id=$2 AND user_id=$3`, [sessionTitle(owns.rows[0].title, content), req.params.id, req.userId]);

    const result = await runOrchestration(content, effort, { model }, conversationContext, req.userId);

    if (result?.status === 'unavailable') {
      await releaseUsage(reservation.reservationId).catch(() => {});
      return res.status(503).json({ status: 'unavailable', message: UNAVAILABLE_MESSAGE });
    }

    const text = typeof result?.text === 'string' ? result.text.trim() : '';
    if (!text) {
      await releaseUsage(reservation.reservationId).catch(() => {});
      return res.status(502).json({ error: 'O serviço de geração retornou uma resposta vazia.', code: 'EMPTY_GENERATION' });
    }

    const tokens = Number.isFinite(Number(result?.tokens)) ? Math.max(0, Number(result.tokens)) : 0;
    const providers = Array.isArray(result?.providers) ? result.providers : [];
    const tools = Array.isArray(result?.tools_used) ? result.tools_used : [];
    await recordTokens(reservation.reservationId, providers[0] || null, tokens);

    const saved = await pool.query(
      `INSERT INTO messages (session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata)
       VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`,
      [req.params.id, req.userId, text, effort, tokens, providers[0] || null, model, 'Resposta gerada e revisada.', JSON.stringify({ tools_used: tools })],
    );

    const usage = await getUsage(req.userId);
    res.json({ message: saved.rows[0], providers_used: providers, tools_used: tools, mcp_errors: Array.isArray(result?.mcp_errors) ? result.mcp_errors : [], model, effort, usage });
  } catch (error) {
    if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
    console.error('Prism chat generation error:', { code: error?.code, status: error?.status, message: error?.message });
    if (error?.code === 'PROVIDER_CONFIGURATION') return res.status(503).json({ status: 'unavailable', message: UNAVAILABLE_MESSAGE });
    if (error?.status === 401) return res.status(401).json({ error: 'Sessão expirada.', code: 'AUTH_REQUIRED' });
    return res.status(502).json({ error: 'Não foi possível concluir a resposta. Tente novamente.', code: 'GENERATION_FAILED' });
  }
});

export default router;
