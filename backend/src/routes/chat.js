import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runOrchestration } from '../services/orchestrator.js';
import { normalizeEffort, validateThinking } from '../services/modelRouter.js';
import { getUsage, getDailyUsage, reserveUsage, releaseUsage, recordTokens, MODEL_REQUIREMENTS, normalizePlanRank, PLAN_FEATURES } from '../services/usage.js';

const router = Router();
router.use(requireAuth);

const SURFACES = new Set(['home', 'codex']);
const EFFORTS = new Set(['low', 'medium', 'high', 'max', 'ultracode']);
const PLAN_NAMES = ['Grátis', 'Base', 'Medium', 'Pro', 'Empresarial'];
const MAX_MESSAGE = 20_000;
const MAX_HISTORY = 24;
const MAX_ATTACHMENTS = 20;
const MAX_CONTEXT = 180_000;
const TEXT_FILES = new Set(['txt', 'md', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'go', 'rs', 'sql']);

const clean = (value, max = MAX_MESSAGE) => typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : '';
const surface = (value) => SURFACES.has(clean(value, 20).toLowerCase()) ? clean(value, 20).toLowerCase() : 'home';
const metadata = (value) => { if (!value) return {}; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch { return {}; } };
const requestKey = (value) => clean(value, 120).replace(/[^a-zA-Z0-9._:-]/g, '');
const titleFor = (current, text) => current && current !== 'Nova conversa' ? current : clean(text, 64).replace(/\s+/g, ' ') || 'Nova conversa';

async function account(userId) {
  const result = await pool.query('SELECT plan FROM users WHERE id=$1', [userId]);
  if (!result.rows.length) return null;
  const plan = result.rows[0].plan || 'free';
  return { plan, rank: normalizePlanRank(plan) };
}

async function authorize(userId, model, requestedEffort) {
  const user = await account(userId);
  if (!user) return { ok: false, status: 401, code: 'AUTH_REQUIRED', error: 'Sessão expirada.' };
  if (!Object.prototype.hasOwnProperty.call(MODEL_REQUIREMENTS, model)) return { ok: false, status: 400, code: 'INVALID_MODEL', error: 'Modelo inválido.' };
  const required = MODEL_REQUIREMENTS[model];
  if (user.rank < required) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'Este modelo não está disponível no seu plano.', requiredPlan: PLAN_NAMES[required] || 'Pro', model };
  if (!EFFORTS.has(requestedEffort) || !validateThinking(model, requestedEffort)) return { ok: false, status: 400, code: 'INVALID_EFFORT', error: 'Nível de pensamento inválido.' };
  if (requestedEffort === 'ultracode' && !PLAN_FEATURES[user.rank]?.ultracode) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'Ultracode está disponível apenas no plano Empresarial.', requiredPlan: 'Empresarial', model };
  return { ok: true, effort: normalizeEffort(requestedEffort), requestedEffort, ...user };
}

async function getSession(id, userId, expectedSurface = null) {
  const result = await pool.query('SELECT id,title,surface,created_at,updated_at FROM sessions WHERE id=$1 AND user_id=$2', [id, userId]);
  const session = result.rows[0];
  return session && (!expectedSurface || session.surface === expectedSurface) ? session : null;
}

async function history(sessionId, userId) {
  const result = await pool.query('SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3', [sessionId, userId, MAX_HISTORY]);
  return result.rows.reverse().map((row) => `${row.role}: ${row.content}`).join('\n');
}

async function attachments(ids, userId) {
  const safe = Array.isArray(ids) ? [...new Set(ids.map(String).filter(Boolean))].slice(0, MAX_ATTACHMENTS) : [];
  if (!safe.length) return { ids: [], items: [], context: '' };
  const result = await pool.query('SELECT id,name,mime_type,size_bytes,content FROM uploads WHERE user_id=$1 AND id=ANY($2::uuid[]) ORDER BY created_at ASC', [userId, safe]);
  const items = result.rows.map((row) => ({ id: row.id, name: row.name, mime_type: row.mime_type, size_bytes: Number(row.size_bytes || 0) }));
  const context = result.rows.map((row) => {
    const ext = String(row.name).split('.').pop()?.toLowerCase() || '';
    if (row.content && TEXT_FILES.has(ext)) return `ANEXO: ${row.name}\n${Buffer.from(row.content).toString('utf8').slice(0, 120_000)}`;
    return `ANEXO: ${row.name} (${row.mime_type || 'arquivo'}, ${Number(row.size_bytes || 0)} bytes)`;
  }).join('\n\n').slice(0, MAX_CONTEXT);
  return { ids: result.rows.map((row) => row.id), items, context };
}

async function saveTurn({ session, userId, prompt, model, requestedEffort, result, files, requestId }) {
  const usage = await getUsage(userId);
  const tokens = Math.max(0, Math.floor(Number(result?.tokens || 0)));
  const providers = Array.isArray(result?.providers) ? result.providers : [];
  const tools = Array.isArray(result?.tools_used) ? result.tools_used : [];
  const meta = JSON.stringify({
    client_request_id: requestId || undefined,
    attachment_ids: files.ids,
    attachments: files.items,
    requested_effort: requestedEffort,
    execution_effort: normalizeEffort(requestedEffort),
    usage_after_percent: Number(usage?.percentage || 0),
    providers_used: providers,
    tools_used: tools,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userMessage = await client.query(`INSERT INTO messages(session_id,user_id,role,content,effort,model_id,metadata) VALUES($1,$2,'user',$3,$4,$5,$6) RETURNING id,role,content,effort,model_id,metadata,created_at`, [session.id, userId, prompt, requestedEffort, model, meta]);
    const assistantMessage = await client.query(`INSERT INTO messages(session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata) VALUES($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9) RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`, [session.id, userId, String(result.text || '').trim() || 'Resposta concluída.', requestedEffort, tokens, providers[0] || null, model, 'Resposta concluída e revisada.', meta]);
    await client.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3', [titleFor(session.title, prompt), session.id, userId]);
    await client.query('COMMIT');
    return { userMessage: userMessage.rows[0], message: assistantMessage.rows[0], usage, tools, attachments: files.items };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
}

router.get('/usage', async (req, res, next) => { try { res.json(await getUsage(req.userId)); } catch (error) { next(error); } });
router.get('/usage/history', async (req, res, next) => { try { res.json(await getDailyUsage(req.userId, req.query?.days)); } catch (error) { next(error); } });
router.get('/usage/account', async (req, res, next) => { try { res.json({ usage: await getUsage(req.userId) }); } catch (error) { next(error); } });

router.get('/sessions', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id,title,surface,created_at,updated_at FROM sessions WHERE user_id=$1 AND surface=$2 ORDER BY updated_at DESC,created_at DESC', [req.userId, surface(req.query?.surface)]);
    res.json({ sessions: result.rows });
  } catch (error) { next(error); }
});

router.post('/sessions', async (req, res, next) => {
  try {
    const result = await pool.query('INSERT INTO sessions(user_id,title,surface) VALUES($1,$2,$3) RETURNING id,title,surface,created_at,updated_at', [req.userId, clean(req.body?.title, 120).replace(/\s+/g, ' ') || 'Nova conversa', surface(req.body?.surface)]);
    res.status(201).json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/sessions/:id', async (req, res, next) => {
  try {
    const title = clean(req.body?.title, 120).replace(/\s+/g, ' ');
    if (!title) return res.status(400).json({ error: 'Título inválido.', code: 'INVALID_TITLE' });
    const result = await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,title,surface,created_at,updated_at', [title, req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.', code: 'SESSION_NOT_FOUND' });
    res.json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/sessions/:id/messages', async (req, res, next) => {
  try {
    const session = await getSession(req.params.id, req.userId, req.query?.surface ? surface(req.query.surface) : null);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada.', code: 'SESSION_NOT_FOUND' });
    const result = await pool.query('SELECT id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at ASC', [req.params.id, req.userId]);
    res.json({ messages: result.rows, surface: session.surface });
  } catch (error) { next(error); }
});

router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.', code: 'SESSION_NOT_FOUND' });
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post('/sessions/:id/messages', async (req, res, next) => {
  const prompt = clean(req.body?.content);
  const model = clean(req.body?.model, 80) || 'prism-mini-1.0';
  const requestedEffort = clean(req.body?.effort, 20).toLowerCase() || 'medium';
  const clientRequestId = requestKey(req.body?.clientRequestId);
  const attachmentIds = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds : [];
  if (!prompt && !attachmentIds.length) return res.status(400).json({ error: 'Mensagem vazia.', code: 'EMPTY_MESSAGE' });
  if (!EFFORTS.has(requestedEffort)) return res.status(400).json({ error: 'Nível de pensamento inválido.', code: 'INVALID_EFFORT' });

  let reservation = null;
  try {
    const session = await getSession(req.params.id, req.userId, 'home');
    if (!session) return res.status(404).json({ error: 'Conversa não encontrada.', code: 'SESSION_NOT_FOUND' });
    if (clientRequestId) {
      const duplicate = await pool.query(`SELECT id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at FROM messages WHERE user_id=$1 AND role='assistant' AND metadata->>'client_request_id'=$2 ORDER BY created_at DESC LIMIT 1`, [req.userId, clientRequestId]);
      if (duplicate.rows[0]) return res.json({ message: duplicate.rows[0], usage: await getUsage(req.userId), duplicate: true });
    }
    const access = await authorize(req.userId, model, requestedEffort);
    if (!access.ok) return res.status(access.status).json(access);
    const before = await getUsage(req.userId);
    reservation = await reserveUsage(req.userId, model);
    if (!reservation.ok) return res.status(reservation.status || 429).json({ error: 'O limite de uso foi atingido.', code: reservation.code, usage: reservation.usage });
    const files = await attachments(attachmentIds, req.userId);
    const context = await history(session.id, req.userId);
    const attachmentContext = files.context ? `\n\nARQUIVOS ANEXADOS:\n${files.context}` : '';
    const effectivePrompt = prompt || 'Analise os arquivos anexados e responda com base neles.';
    const result = await runOrchestration(effectivePrompt, access.effort, { model }, `${context}${attachmentContext}`, req.userId);
    if (result?.status === 'unavailable') {
      await releaseUsage(reservation.reservationId).catch(() => {}); reservation = null;
      return res.status(503).json({ error: 'Serviço de IA temporariamente indisponível.', code: 'AI_UNAVAILABLE' });
    }
    await recordTokens(reservation.reservationId, result?.providers?.[0] || null, Number(result?.tokens || 0)); reservation = null;
    const saved = await saveTurn({ session, userId: req.userId, prompt: effectivePrompt, model, requestedEffort, result, files, requestId: clientRequestId });
    const usage = saved.usage || await getUsage(req.userId);
    return res.status(201).json({ ...saved, usage, consumed: Math.max(0, Number(usage?.percentage || 0) - Number(before?.percentage || 0)) });
  } catch (error) {
    if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
    next(error);
  }
});

export default router;
