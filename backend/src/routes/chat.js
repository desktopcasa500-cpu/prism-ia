import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { runOrchestration } from '../services/orchestrator.js';
import { normalizeEffort, validateThinking } from '../services/modelRouter.js';
import { getUsage, getDailyUsage, reserveUsage, releaseUsage, recordTokens, MODEL_REQUIREMENTS, normalizePlanRank, PLAN_FEATURES } from '../services/usage.js';

const router = Router();
const ALLOWED_EFFORTS = new Set(['low', 'medium', 'high', 'max', 'ultracode']);
const ALLOWED_MODELS = new Set(Object.keys(MODEL_REQUIREMENTS));
const ALLOWED_SURFACES = new Set(['home', 'codex']);
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_HISTORY_MESSAGES = 24;
const MAX_ATTACHMENTS = 20;
const PLAN_NAMES = ['Grátis', 'Base', 'Medium', 'Pro', 'Empresarial'];
const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade nos servidores. Tente novamente mais tarde.';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.use(requireAuth);
function cleanText(value, max = MAX_MESSAGE_LENGTH) { return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : ''; }
function surfaceOf(value) { const surface = cleanText(value, 20).toLowerCase(); return ALLOWED_SURFACES.has(surface) ? surface : 'home'; }
function validUuid(value) { return UUID_RE.test(String(value || '')); }
async function getUserPlan(userId) { const result = await pool.query('SELECT plan FROM users WHERE id=$1', [userId]); if (!result.rows.length) return null; const plan = result.rows[0].plan || 'free'; const rank = normalizePlanRank(plan); return { plan, rank, label: PLAN_NAMES[rank] || 'Grátis' }; }
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
async function ownsSession(sessionId, userId, surface = null) {
  if (!validUuid(sessionId)) return null;
  const result = await pool.query('SELECT id,title,surface FROM sessions WHERE id=$1 AND user_id=$2', [sessionId, userId]);
  if (!result.rows.length) return null;
  if (surface && result.rows[0].surface !== surface) return null;
  return result.rows[0];
}
async function loadHistory(sessionId, userId) {
  const result = await pool.query('SELECT role,content FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT $3', [sessionId, userId, MAX_HISTORY_MESSAGES]);
  return result.rows.reverse().map((message) => `${message.role}: ${message.content}`).join('\n');
}
async function loadAttachmentContext(ids, userId) {
  const rawIds = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
  const safeIds = [...new Set(rawIds.filter(validUuid))].slice(0, MAX_ATTACHMENTS);
  if (!safeIds.length) return { ids: [], context: '', attachments: [] };
  const result = await pool.query('SELECT id,name,mime_type,size_bytes,content FROM uploads WHERE user_id=$1 AND id = ANY($2::uuid[]) ORDER BY created_at ASC', [userId, safeIds]);
  const attachments = result.rows.map((row) => ({ id: row.id, name: row.name, mime_type: row.mime_type, size_bytes: Number(row.size_bytes || 0) }));
  const contextParts = [];
  for (const row of result.rows) {
    const ext = row.name.split('.').pop()?.toLowerCase();
    if (row.content && ['txt','md','json','csv','js','ts','jsx','tsx','html','css','py','java','go','rs','sql'].includes(ext)) {
      contextParts.push(`ANEXO: ${row.name}\n${Buffer.from(row.content).toString('utf8').slice(0, 120_000)}`);
    } else contextParts.push(`ANEXO: ${row.name} (${row.mime_type || 'arquivo'}, ${Number(row.size_bytes || 0)} bytes).`);
  }
  return { ids: result.rows.map((row) => row.id), context: contextParts.join('\n\n').slice(0, 180_000), attachments };
}
function sessionTitle(current, content) { return current !== 'Nova conversa' ? current : cleanText(content, 64).replace(/\s+/g, ' ') || 'Nova conversa'; }
function messageMetadata(extra = {}) { return JSON.stringify(extra); }
function diffUsage(before, after) { return Math.max(0, Number(after?.percentage || 0) - Number(before?.percentage || 0)); }

async function runAndSave({ session, userId, content, model, effort, clientRequestId = null, attachmentIds = [], charge = true, retryOf = null }) {
  let reservation = null;
  try {
    const before = await getUsage(userId);
    if (charge) {
      reservation = await reserveUsage(userId, model);
      if (!reservation.ok) return { error: reservation, before, after: before };
    }
    const attachments = await loadAttachmentContext(attachmentIds, userId);
    const history = await loadHistory(session.id, userId);
    const attachmentContext = attachments.context ? `\n\nARQUIVOS ANEXADOS:\n${attachments.context}` : '';
    const result = await runOrchestration(content, effort, { model }, `${history}${attachmentContext}`, userId);
    if (result?.status === 'unavailable') {
      if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
      reservation = null;
      return { unavailable: true, before, after: before };
    }
    const tokens = Number.isFinite(Number(result?.tokens)) ? Math.max(0, Math.floor(Number(result.tokens))) : 0;
    const providers = Array.isArray(result?.providers) ? result.providers : [];
    if (reservation?.reservationId) { await recordTokens(reservation.reservationId, providers[0] || null, tokens); reservation = null; }
    const after = charge ? await getUsage(userId) : before;
    const consumed = charge ? diffUsage(before, after) : 0;
    const metadata = {
      ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
      attachment_ids: attachments.ids,
      attachments,
      charged: charge,
      usage_consumed_percent: consumed,
      usage_after_percent: Number(after?.percentage || before?.percentage || 0),
      retry_of: retryOf,
      providers_used: providers,
      tools_used: Array.isArray(result?.tools_used) ? result.tools_used : [],
    };
    const userResult = await pool.query('INSERT INTO messages(session_id,user_id,role,content,effort,model_id,metadata) VALUES($1,$2,\'user\',$3,$4,$5,$6) RETURNING id,role,content,effort,model_id,metadata,created_at', [session.id, userId, content, effort, model, messageMetadata(metadata)]);
    const assistantResult = await pool.query(`INSERT INTO messages(session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata) VALUES($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9) RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`, [session.id, userId, String(result.text || '').trim() || 'Resposta concluída.', effort, tokens, providers[0] || null, model, 'Resposta gerada e revisada.', messageMetadata(metadata)]);
    await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3', [sessionTitle(session.title, content), session.id, userId]);
    return { userMessage: userResult.rows[0], message: assistantResult.rows[0], usage: after, before, consumed, providers, tools: metadata.tools_used, attachments: attachments.attachments };
  } catch (error) {
    if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
    throw error;
  }
}

router.get('/usage', async (req, res, next) => { try { const usage = await getUsage(req.userId); if (!usage) return res.status(404).json({ error: 'Conta não encontrada.' }); res.json(usage); } catch (error) { next(error); } });
router.get('/usage/history', async (req, res, next) => { try { res.json(await getDailyUsage(req.userId, req.query?.days)); } catch (error) { next(error); } });
router.get('/usage/account', async (req, res, next) => { try { const usage = await getUsage(req.userId); if (!usage) return res.status(404).json({ error: 'Conta não encontrada.' }); res.json({ usage }); } catch (error) { next(error); } });

router.get('/sessions', async (req, res, next) => {
  try {
    const surface = surfaceOf(req.query?.surface);
    const result = await pool.query('SELECT id,title,surface,created_at,updated_at FROM sessions WHERE user_id=$1 AND surface=$2 ORDER BY updated_at DESC,created_at DESC', [req.userId, surface]);
    res.json({ sessions: result.rows });
  } catch (error) { next(error); }
});

router.post('/sessions', async (req, res, next) => {
  try {
    const surface = surfaceOf(req.body?.surface);
    const title = cleanText(req.body?.title, 120).replace(/\s+/g, ' ') || 'Nova conversa';
    const result = await pool.query('INSERT INTO sessions(user_id,title,surface) VALUES($1,$2,$3) RETURNING id,title,surface,created_at,updated_at', [req.userId, title, surface]);
    res.status(201).json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/sessions/:id', async (req, res, next) => {
  try {
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de sessão inválido.', code: 'INVALID_SESSION_ID' });
    const title = cleanText(req.body?.title, 120).replace(/\s+/g, ' ');
    if (!title) return res.status(400).json({ error: 'O título não pode ficar vazio.' });
    const result = await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,title,surface,created_at,updated_at', [title, req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.' });
    res.json({ session: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/sessions/:id/messages', async (req, res, next) => {
  try {
    const surface = req.query?.surface ? surfaceOf(req.query.surface) : null;
    const session = await ownsSession(req.params.id, req.userId, surface);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada.' });
    const result = await pool.query('SELECT id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at FROM messages WHERE session_id=$1 AND user_id=$2 ORDER BY created_at ASC', [req.params.id, req.userId]);
    res.json({ messages: result.rows, surface: session.surface });
  } catch (error) { next(error); }
});

router.delete('/sessions/:id', async (req, res, next) => { try { if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de sessão inválido.', code: 'INVALID_SESSION_ID' }); const result = await pool.query('DELETE FROM sessions WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.userId]); if (!result.rows.length) return res.status(404).json({ error: 'Sessão não encontrada.' }); res.status(204).end(); } catch (error) { next(error); } });

router.post('/sessions/:id/messages', async (req, res, next) => {
  const content = cleanText(req.body?.content);
  const model = cleanText(req.body?.model, 80) || 'prism-mini-1.0';
  const effort = normalizeEffort(cleanText(req.body?.effort, 20) || 'medium');
  const clientRequestId = cleanText(req.body?.clientRequestId, 120).replace(/[^a-zA-Z0-9._:-]/g, '');
  const attachmentIds = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds : [];
  if (!content) return res.status(400).json({ error: 'Mensagem vazia.', code: 'EMPTY_MESSAGE' });
  if (!ALLOWED_EFFORTS.has(effort)) return res.status(400).json({ error: 'Nível de pensamento inválido.', code: 'INVALID_EFFORT' });
  if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Modelo inválido.', code: 'INVALID_MODEL' });
  if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de sessão inválido.', code: 'INVALID_SESSION_ID' });
  let reservation = null;
  try {
    const session = await ownsSession(req.params.id, req.userId, 'home');
    if (!session) return res.status(404).json({ error: 'Conversa do Home não encontrada.', code: 'SESSION_NOT_FOUND' });
    if (clientRequestId) {
      const existing = await pool.query("SELECT id,content,effort,model_id,metadata,created_at FROM messages WHERE user_id=$1 AND role='assistant' AND metadata->>'client_request_id'=$2 ORDER BY created_at DESC LIMIT 1", [req.userId, clientRequestId]);
      if (existing.rows[0]) return res.json({ message: existing.rows[0], usage: await getUsage(req.userId), duplicate: true, charged: Boolean(existing.rows[0].metadata?.charged) });
    }
    const authorization = await authorizeModel(req.userId, model, effort);
    if (!authorization.ok) return res.status(authorization.status).json(authorization);
    const before = await getUsage(req.userId);
    reservation = await reserveUsage(req.userId, model);
    if (!reservation.ok) return res.status(reservation.status || 429).json({ error: reservation.code === 'DAILY_CREDITS_EXHAUSTED' ? 'Os créditos diários acabaram. Eles serão renovados amanhã.' : 'O limite de uso foi atingido.', code: reservation.code, usage: reservation.usage });
    const attachments = await loadAttachmentContext(attachmentIds, req.userId);
    const history = await loadHistory(session.id, req.userId);
    const attachmentContext = attachments.context ? `\n\nARQUIVOS ANEXADOS:\n${attachments.context}` : '';
    await pool.query('INSERT INTO messages(session_id,user_id,role,content,effort,model_id,metadata) VALUES($1,$2,\'user\',$3,$4,$5,$6)', [session.id, req.userId, content, effort, model, messageMetadata({ ...(clientRequestId ? { client_request_id: clientRequestId } : {}), attachment_ids: attachments.ids, attachments, charged: true })]);
    const result = await runOrchestration(content, effort, { model }, `${history}${attachmentContext}`, req.userId);
    if (result?.status === 'unavailable') { await releaseUsage(reservation.reservationId).catch(() => {}); reservation = null; await pool.query("DELETE FROM messages WHERE session_id=$1 AND user_id=$2 AND role='user' AND metadata->>'client_request_id'=$3", [session.id, req.userId, clientRequestId]).catch(() => {}); return res.status(503).json({ status: 'unavailable', message: UNAVAILABLE_MESSAGE }); }
    const tokens = Number.isFinite(Number(result?.tokens)) ? Math.max(0, Math.floor(Number(result.tokens))) : 0;
    const providers = Array.isArray(result?.providers) ? result.providers : [];
    const tools = Array.isArray(result?.tools_used) ? result.tools_used : [];
    await recordTokens(reservation.reservationId, providers[0] || null, tokens); reservation = null;
    const usage = await getUsage(req.userId);
    const consumed = diffUsage(before, usage);
    const metadata = messageMetadata({ ...(clientRequestId ? { client_request_id: clientRequestId } : {}), attachment_ids: attachments.ids, attachments: attachments.attachments, charged: true, usage_consumed_percent: consumed, usage_after_percent: Number(usage?.percentage || 0), tools_used: tools, providers_used: providers });
    const saved = await pool.query(`INSERT INTO messages(session_id,user_id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata) VALUES($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9) RETURNING id,role,content,effort,tokens_used,provider,model_id,thinking_summary,metadata,created_at`, [session.id, req.userId, String(result.text || '').trim() || 'Resposta concluída.', effort, tokens, providers[0] || null, model, 'Resposta gerada e revisada.', metadata]);
    await pool.query('UPDATE sessions SET title=$1,updated_at=now() WHERE id=$2 AND user_id=$3', [sessionTitle(session.title, content), session.id, req.userId]);
    res.json({ message: saved.rows[0], usage, consumed, charged: true, tools_used: tools, attachments: attachments.attachments, providers_used: providers });
  } catch (error) {
    if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
    console.error('Prism chat generation error:', { code: error?.code, status: error?.status, message: error?.message });
    if (error?.code === 'PROVIDER_CONFIGURATION') return res.status(503).json({ status: 'unavailable', message: UNAVAILABLE_MESSAGE });
    return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível concluir a resposta.', code: error?.code || 'GENERATION_FAILED' });
  }
});

router.post('/sessions/:id/messages/:messageId/retry', async (req, res, next) => {
  try {
    if (!validUuid(req.params.id) || !validUuid(req.params.messageId)) return res.status(400).json({ error: 'Identificador inválido.', code: 'INVALID_MESSAGE_ID' });
    const session = await ownsSession(req.params.id, req.userId);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada.', code: 'SESSION_NOT_FOUND' });
    const original = await pool.query('SELECT id,role,content,effort,model_id,metadata FROM messages WHERE id=$1 AND session_id=$2 AND user_id=$3', [req.params.messageId, session.id, req.userId]);
    if (!original.rows.length || original.rows[0].role !== 'user') return res.status(404).json({ error: 'Mensagem do usuário não encontrada.', code: 'USER_MESSAGE_NOT_FOUND' });
    const attachmentIds = Array.isArray(original.rows[0].metadata?.attachment_ids) ? original.rows[0].metadata.attachment_ids : [];
    const model = original.rows[0].model_id || 'prism-mini-1.0';
    const effort = normalizeEffort(original.rows[0].effort || 'medium');
    const authorization = await authorizeModel(req.userId, model, effort);
    if (!authorization.ok) return res.status(authorization.status).json(authorization);
    const result = await runAndSave({ session, userId: req.userId, content: original.rows[0].content, model, effort, attachmentIds, charge: false, retryOf: original.rows[0].id });
    if (result?.error) return res.status(result.error.status || 429).json(result.error);
    if (result?.unavailable) return res.status(503).json({ status: 'unavailable', message: UNAVAILABLE_MESSAGE });
    res.json({ message: result.message, usage: result.usage, consumed: 0, charged: false, retryOf: original.rows[0].id, tools_used: result.tools, attachments: result.attachments, providers_used: result.providers });
  } catch (error) { next(error); }
});

router.patch('/messages/:messageId', async (req, res, next) => {
  try {
    if (!validUuid(req.params.messageId)) return res.status(400).json({ error: 'Identificador de mensagem inválido.', code: 'INVALID_MESSAGE_ID' });
    const content = cleanText(req.body?.content);
    if (!content) return res.status(400).json({ error: 'Mensagem vazia.', code: 'EMPTY_MESSAGE' });
    const current = await pool.query('SELECT m.id,m.session_id,m.role,s.surface FROM messages m JOIN sessions s ON s.id=m.session_id AND s.user_id=m.user_id WHERE m.id=$1 AND m.user_id=$2', [req.params.messageId, req.userId]);
    if (!current.rows.length || current.rows[0].role !== 'user') return res.status(404).json({ error: 'Mensagem não encontrada.', code: 'MESSAGE_NOT_FOUND' });
    await pool.query('DELETE FROM messages WHERE session_id=$1 AND user_id=$2 AND created_at > (SELECT created_at FROM messages WHERE id=$3)', [current.rows[0].session_id, req.userId, req.params.messageId]);
    const result = await pool.query('UPDATE messages SET content=$1 WHERE id=$2 AND user_id=$3 RETURNING id,session_id,role,content,effort,model_id,metadata,created_at', [content, req.params.messageId, req.userId]);
    await pool.query('UPDATE sessions SET updated_at=now() WHERE id=$1 AND user_id=$2', [current.rows[0].session_id, req.userId]);
    res.json({ message: result.rows[0], surface: current.rows[0].surface });
  } catch (error) { next(error); }
});

router.post('/sessions/:id/cancel', async (req, res) => { if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de sessão inválido.', code: 'INVALID_SESSION_ID' }); res.json({ ok: true, requestId: cleanText(req.body?.clientRequestId, 120) || null }); });

export default router;
