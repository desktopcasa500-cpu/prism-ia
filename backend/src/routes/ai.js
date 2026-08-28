import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { getModelProfile, validateThinking, normalizeEffort } from '../services/modelRouter.js';
import { runOrchestration } from '../services/orchestrator.js';

const router = Router();
router.use(requireAuth);

const MAX_FILE_CONTENT = 2_000_000;

function parseArtifacts(text) {
  const artifacts = [];
  const pattern = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match;

  while ((match = pattern.exec(String(text || '')) !== null)) {
    const path = match[1].trim().replace(/^\/+/, '');
    if (!path || path.includes('..') || path.length > 500) continue;

    const content = match[2].replace(/^\n/, '').replace(/\n$/, '');
    if (content.length <= MAX_FILE_CONTENT) {
      artifacts.push({ path, content });
    }
  }

  return artifacts.filter(
    (item, index, array) => array.findIndex((entry) => entry.path === item.path) === index,
  );
}

async function loadProjectContext(projectId, userId) {
  if (!projectId) return { project: null, files: [] };

  const project = await pool.query(
    'SELECT id,name FROM projects WHERE id=$1 AND user_id=$2',
    [projectId, userId],
  );

  if (!project.rows.length) {
    throw Object.assign(new Error('Projeto não encontrado'), { status: 404 });
  }

  const files = await pool.query(
    'SELECT id,path,content,kind,updated_at FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path',
    [projectId, userId],
  );

  return { project: project.rows[0], files: files.rows };
}

async function persistArtifacts(projectId, userId, artifacts, onArtifact) {
  if (!projectId || !artifacts.length) {
    return { filesChanged: [], filesCreated: [] };
  }

  const changed = [];
  const created = [];

  for (const artifact of artifacts) {
    const existing = await pool.query(
      'SELECT id FROM project_files WHERE project_id=$1 AND user_id=$2 AND path=$3',
      [projectId, userId, artifact.path],
    );

    if (existing.rows.length) {
      await pool.query(
        "UPDATE project_files SET content=$1,kind='file',updated_at=now() WHERE id=$2 AND user_id=$3",
        [artifact.content, existing.rows[0].id, userId],
      );
      changed.push(artifact.path);
    } else {
      await pool.query(
        "INSERT INTO project_files(project_id,user_id,path,content,kind) VALUES($1,$2,$3,$4,'file')",
        [projectId, userId, artifact.path, artifact.content],
      );
      created.push(artifact.path);
    }

    onArtifact?.({
      path: artifact.path,
      content: artifact.content,
      action: existing.rows.length ? 'updated' : 'created',
    });
  }

  await pool.query(
    'UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2',
    [projectId, userId],
  );

  return { filesChanged: changed, filesCreated: created };
}

function buildProjectPrompt(prompt, project, files) {
  const fileContext = files
    .filter((file) => file.kind !== 'folder')
    .map((file) => `FILE: ${file.path}\n${String(file.content || '').slice(0, 120_000)}`)
    .join('\n\n')
    .slice(-120_000);

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

async function executeGeneration({
  model,
  thinking,
  prompt,
  context,
  projectId,
  userId,
  onPhase,
  onArtifact,
}) {
  const workspace = await loadProjectContext(projectId, userId);

  onPhase?.({
    phase: 'analyzing',
    label: 'Analisando o projeto',
    detail: `${workspace.files.filter((file) => file.kind !== 'folder').length} arquivos no workspace`,
  });

  const agentPrompt = workspace.project
    ? buildProjectPrompt(prompt, workspace.project, workspace.files)
    : prompt;

  onPhase?.({
    phase: 'planning',
    label: 'Planejando',
    detail: 'Definindo a implementação antes de editar',
  });

  const result = await runOrchestration(
    agentPrompt,
    thinking,
    { ...getModelProfile(model), id: model },
    context,
    userId,
  );

  onPhase?.({
    phase: 'writing',
    label: 'Escrevendo arquivos',
    detail: 'Recebendo os arquivos produzidos pelo agente',
  });

  const artifacts = parseArtifacts(result.text);
  const persisted = await persistArtifacts(projectId, userId, artifacts, onArtifact);

  onPhase?.({
    phase: 'reviewing',
    label: 'Revisando',
    detail: 'Verificando arquivos e resultados produzidos',
  });

  onPhase?.({
    phase: 'updating',
    label: 'Atualizando o workspace',
    detail: `${artifacts.length} arquivo(s) recebido(s)`,
  });

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

router.post('/generate', async (req, res) => {
  try {
    const model = req.body?.model || 'prism-mini-1.0';
    const thinking = normalizeEffort(req.body?.thinking || 'medium');
    const prompt = String(req.body?.prompt || '').trim();
    const context = String(req.body?.context || '').slice(-30_000);
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;

    if (!prompt) return res.status(400).json({ error: 'Prompt vazio' });
    if (prompt.length > 50_000) return res.status(413).json({ error: 'Pedido muito longo' });
    if (!validateThinking(model, thinking)) {
      return res.status(400).json({ error: 'Configuração de modelo inválida' });
    }

    const result = await executeGeneration({
      model,
      thinking,
      prompt,
      context,
      projectId,
      userId: req.userId,
    });

    return res.json(result);
  } catch (error) {
    console.error('AI generation error:', error);
    const message = error?.message || 'O serviço de IA não respondeu.';
    return res
      .status(error?.status || (/não está configurada|Nenhuma chave/i.test(message) ? 503 : 502))
      .json({ error: message });
  }
});

router.post('/generate/stream', async (req, res) => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed) res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 1500);

  const send = (payload) => {
    if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const model = req.body?.model || 'prism-mini-1.0';
    const thinking = normalizeEffort(req.body?.thinking || 'medium');
    const prompt = String(req.body?.prompt || '').trim();
    const context = String(req.body?.context || '').slice(-30_000);
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;

    if (!prompt) throw Object.assign(new Error('Prompt vazio'), { status: 400 });
    if (prompt.length > 50_000) throw Object.assign(new Error('Pedido muito longo'), { status: 413 });
    if (!validateThinking(model, thinking)) {
      throw Object.assign(new Error('Configuração de modelo inválida'), { status: 400 });
    }

    send({ type: 'phase', phase: 'received', label: 'Pedido recebido', detail: 'Preparando o agente' });

    const startedAt = Date.now();
    const result = await executeGeneration({
      model,
      thinking,
      prompt,
      context,
      projectId,
      userId: req.userId,
      onPhase: (phase) => send({ type: 'phase', ...phase, elapsedMs: Date.now() - startedAt }),
      onArtifact: (artifact) => send({ type: 'artifact', ...artifact, elapsedMs: Date.now() - startedAt }),
    });

    send({
      type: 'phase',
      phase: 'completed',
      label: 'Concluído',
      detail: 'O workspace recebeu o resultado do agente',
      elapsedMs: Date.now() - startedAt,
    });
    send({ type: 'result', data: result });
  } catch (error) {
    console.error('AI streaming generation error:', error);
    send({ type: 'error', message: error?.message || 'O serviço de IA não respondeu.' });
  } finally {
    closed = true;
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
