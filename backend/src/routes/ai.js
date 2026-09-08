import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { getModelProfile, validateThinking, normalizeEffort } from '../services/modelRouter.js';
import { runOrchestration } from '../services/orchestrator.js';
import { MODEL_REQUIREMENTS, PLAN_FEATURES, normalizePlanRank, reserveUsage, releaseUsage, recordTokens } from '../services/usage.js';

const router = Router();
router.use(requireAuth);

const MAX_FILE_CONTENT = 2_000_000;
const PLAN_NAMES = ['Grátis', 'Base', 'Medium', 'Pro', 'Empresarial'];
const ALLOWED_EFFORTS = new Set(['low', 'medium', 'high', 'max', 'ultracode']);
const UNAVAILABLE_MESSAGE = 'Estamos com instabilidade nos servidores. Tente novamente mais tarde.';

function parseArtifacts(text) {
  const artifacts = [];
  const pattern = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match;

  while ((match = pattern.exec(String(text || ''))) !== null) {
    const path = match[1].trim().replace(/^\/+/, '');
    if (!path || path.includes('..') || path.length > 500) continue;
    const content = match[2].replace(/^\n/, '').replace(/\n$/, '');
    if (content.length <= MAX_FILE_CONTENT) artifacts.push({ path, content });
  }

  return artifacts.filter((item, index, array) => array.findIndex((entry) => entry.path === item.path) === index);
}

async function getAccount(userId) {
  const result = await pool.query('SELECT plan FROM users WHERE id=$1', [userId]);
  if (!result.rows.length) return null;
  const plan = result.rows[0].plan || 'free';
  return { plan, rank: normalizePlanRank(plan) };
}

async function authorizeGeneration(userId, model, thinking) {
  if (!Object.prototype.hasOwnProperty.call(MODEL_REQUIREMENTS, model)) return { ok: false, status: 400, code: 'INVALID_MODEL', error: 'Modelo inválido.' };
  const account = await getAccount(userId);
  if (!account) return { ok: false, status: 401, code: 'AUTH_REQUIRED', error: 'Sessão expirada.' };
  const requiredRank = MODEL_REQUIREMENTS[model];
  if (account.rank < requiredRank) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'Este modelo não está disponível no seu plano.', model, requiredPlan: PLAN_NAMES[requiredRank] || 'Pro' };
  if (!validateThinking(model, thinking)) return { ok: false, status: 400, code: 'INVALID_EFFORT', error: 'Nível de pensamento inválido.' };
  if (thinking === 'ultracode' && !PLAN_FEATURES[account.rank]?.ultracode) return { ok: false, status: 403, code: 'PLAN_UPGRADE_REQUIRED', error: 'O modo Ultracode está disponível apenas no plano Empresarial.', model, requiredPlan: 'Empresarial' };
  return { ok: true, ...account };
}

async function loadProjectContext(projectId, userId) {
  if (!projectId) return { project: null, files: [] };
  const project = await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  if (!project.rows.length) throw Object.assign(new Error('Projeto não encontrado'), { status: 404, code: 'PROJECT_NOT_FOUND' });
  const files = await pool.query('SELECT id,path,content,kind,updated_at FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path', [projectId, userId]);
  return { project: project.rows[0], files: files.rows };
}

async function persistArtifacts(projectId, userId, artifacts, onArtifact) {
  if (!projectId || !artifacts.length) return { filesChanged: [], filesCreated: [] };
  const changed = [];
  const created = [];
  for (const artifact of artifacts) {
    const existing = await pool.query('SELECT id FROM project_files WHERE project_id=$1 AND user_id=$2 AND path=$3', [projectId, userId, artifact.path]);
    if (existing.rows.length) {
      await pool.query("UPDATE project_files SET content=$1,kind='file',updated_at=now() WHERE id=$2 AND user_id=$3", [artifact.content, existing.rows[0].id, userId]);
      changed.push(artifact.path);
    } else {
      await pool.query("INSERT INTO project_files(project_id,user_id,path,content,kind) VALUES($1,$2,$3,$4,'file')", [projectId, userId, artifact.path, artifact.content]);
      created.push(artifact.path);
    }
    onArtifact?.({ path: artifact.path, content: artifact.content, action: existing.rows.length ? 'updated' : 'created' });
  }
  await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [projectId, userId]);
  return { filesChanged: changed, filesCreated: created };
}

function buildProjectPrompt(prompt, project, files) {
  const fileContext = files.filter((file) => file.kind !== 'folder').map((file) => `FILE: ${file.path}\n${String(file.content || '').slice(0, 120_000)}`).join('\n\n').slice(-120_000);
  return [
    'Você está operando dentro do Prism Codex sobre um projeto real.',
    'Analise primeiro os arquivos fornecidos. Preserve o que já funciona e faça somente as alterações necessárias.',
    'Quando precisar criar ou modificar arquivos, devolva cada arquivo completo usando exatamente <file path="CAMINHO">CONTEUDO</file>.',
    'Não diga que executou comandos, testes, commits ou ferramentas se isso não ocorreu de fato.',
    'Se não houver executor de terminal disponível, não simule execução. Priorize alterações de arquivos verificáveis.',
    `Projeto: ${project.name} (${project.id})`,
    `Arquivos atuais:\n${fileContext || '(nenhum arquivo ainda)'}`,
    `Pedido do usuário:\n${prompt}`,
  ].join('\n\n');
}

async function executeGeneration({ model, thinking, prompt, context, projectId, userId, onPhase, onArtifact }) {
  const workspace = await loadProjectContext(projectId, userId);
  onPhase?.({ phase: 'analyzing', label: 'Analisando o projeto', detail: `${workspace.files.filter((file) => file.kind !== 'folder').length} arquivos no workspace` });
  const agentPrompt = workspace.project ? buildProjectPrompt(prompt, workspace.project, workspace.files) : prompt;
  onPhase?.({ phase: 'planning', label: 'Planejando', detail: 'Definindo a implementação antes de editar' });

  const result = await runOrchestration(agentPrompt, thinking, { ...getModelProfile(model), id: model }, context, userId, { mcpServerIds: undefined });
  if (result?.status === 'unavailable') return result;

  onPhase?.({ phase: 'writing', label: 'Escrevendo arquivos', detail: 'Recebendo os arquivos produzidos pelo agente' });
  const artifacts = parseArtifacts(result.text);
  const persisted = await persistArtifacts(projectId, userId, artifacts, onArtifact);
  onPhase?.({ phase: 'reviewing', label: 'Revisando', detail: 'Verificando arquivos e resultados produzidos' });
  onPhase?.({ phase: 'updating', label: 'Atualizando o workspace', detail: `${artifacts.length} arquivo(s) recebido(s)` });

  const cleanedText = String(result.text || '')
    .replace(/<file\s+path=["'][^"']+["']\s*>[\s\S]*?<\/file>/gi, '')
    .replace(/<prism:summary>([\s\S]*?)<\/prism:summary>/gi, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    model,
    thinking,
    ...result,
    text: cleanedText || (artifacts.length ? 'Alterações aplicadas ao projeto real.' : result.text),
    project_id: projectId,
    files_changed: persisted.filesChanged,
    files_created: persisted.filesCreated,
  };
}

function readGenerationInput(req) {
  const model = String(req.body?.model || 'prism-mini-1.0').trim();
  const rawThinking = String(req.body?.thinking || 'medium').trim().toLowerCase();
  return { model, rawThinking, thinking: normalizeEffort(rawThinking), prompt: String(req.body?.prompt || '').trim(), context: String(req.body?.context || '').slice(-30_000), projectId: req.body?.projectId ? String(req.body.projectId) : null };
}

router.post('/generate', async (req, res) => {
  let reservation = null;
  try {
    const input = readGenerationInput(req);
    if (!input.prompt) return res.status(400).json({ error: 'Prompt vazio', code: 'EMPTY_PROMPT' });
    if (input.prompt.length > 50_000) return res.status(413).json({ error: 'Pedido muito longo', code: 'PROMPT_TOO_LONG' });
    if (!ALLOWED_EFFORTS.has(input.rawThinking)) return res.status(400).json({ error: 'Nível de pensamento inválido.', code: 'INVALID_EFFORT' });
    const authorization = await authorizeGeneration(req.userId, input.model, input.thinking);
    if (!authorization.ok) return res.status(authorization.status).json(authorization);

    reservation = await reserveUsage(req.userId, input.model);
    if (!reservation.ok) return res.status(reservation.status || 429).json({ error: 'O limite de uso desta janela foi atingido.', code: reservation.code, usage: reservation.usage });

    const result = await executeGeneration({ ...input, userId: req.userId });
    if (result?.status === 'unavailable') {
      await releaseUsage(reservation.reservationId).catch(() => {});
      reservation = null;
      return res.status(503).json({ status: 'unavailable', message: UNAVAILABLE_MESSAGE });
    }
    await recordTokens(reservation.reservationId, result.providers?.[0] || null, result.tokens || 0);
    reservation = null;
    return res.json(result);
  } catch (error) {
    if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
    console.error('AI generation error:', { code: error?.code, status: error?.status, message: error?.message });
    const status = error?.status || 502;
    return res.status(status).json(error?.code === 'PROJECT_NOT_FOUND' ? { error: 'Projeto não encontrado.', code: error.code } : { error: 'Não foi possível concluir a geração. Tente novamente.', code: error?.code || 'GENERATION_FAILED' });
  }
});

router.post('/generate/stream', async (req, res) => {
  let reservation = null;
  try {
    const input = readGenerationInput(req);
    if (!input.prompt) return res.status(400).json({ error: 'Prompt vazio', code: 'EMPTY_PROMPT' });
    if (input.prompt.length > 50_000) return res.status(413).json({ error: 'Pedido muito longo', code: 'PROMPT_TOO_LONG' });
    if (!ALLOWED_EFFORTS.has(input.rawThinking)) return res.status(400).json({ error: 'Nível de pensamento inválido.', code: 'INVALID_EFFORT' });

    const authorization = await authorizeGeneration(req.userId, input.model, input.thinking);
    if (!authorization.ok) return res.status(authorization.status).json(authorization);
    reservation = await reserveUsage(req.userId, input.model);
    if (!reservation.ok) return res.status(reservation.status || 429).json({ error: 'O limite de uso desta janela foi atingido.', code: reservation.code, usage: reservation.usage });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let closed = false;
    const heartbeat = setInterval(() => { if (!closed) res.write(`: heartbeat ${Date.now()}\n\n`); }, 1500);
    const send = (payload) => { if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`); };
    const startedAt = Date.now();

    try {
      send({ type: 'phase', phase: 'received', label: 'Pedido recebido', detail: 'Preparando o agente' });
      const result = await executeGeneration({ ...input, userId: req.userId, onPhase: (phase) => send({ type: 'phase', ...phase, elapsedMs: Date.now() - startedAt }), onArtifact: (artifact) => send({ type: 'artifact', ...artifact, elapsedMs: Date.now() - startedAt }) });

      if (result?.status === 'unavailable') {
        await releaseUsage(reservation.reservationId).catch(() => {});
        reservation = null;
        send({ type: 'error', code: 'PROVIDERS_UNAVAILABLE', message: UNAVAILABLE_MESSAGE });
      } else {
        await recordTokens(reservation.reservationId, result.providers?.[0] || null, result.tokens || 0);
        reservation = null;
        send({ type: 'phase', phase: 'completed', label: 'Concluído', detail: 'O workspace recebeu o resultado do agente', elapsedMs: Date.now() - startedAt });
        send({ type: 'result', data: result });
      }
    } catch (error) {
      if (reservation?.reservationId) {
        await releaseUsage(reservation.reservationId).catch(() => {});
        reservation = null;
      }
      send({ type: 'error', code: error?.code || 'GENERATION_FAILED', message: error?.code === 'PROJECT_NOT_FOUND' ? 'Projeto não encontrado.' : UNAVAILABLE_MESSAGE });
    } finally {
      closed = true;
      clearInterval(heartbeat);
      res.end();
    }
  } catch (error) {
    if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
    console.error('AI streaming preparation error:', { code: error?.code, status: error?.status, message: error?.message });
    if (!res.headersSent) return res.status(error?.status || 502).json({ error: error?.message || 'Não foi possível iniciar a execução.', code: error?.code || 'GENERATION_FAILED' });
    res.end();
  }
});

export default router;
