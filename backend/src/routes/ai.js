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
  const source = String(text || '');
  const pattern = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match;
  while ((match = pattern.exec(source))) {
    const path = match[1].trim().replace(/^\/+/, '');
    if (!path || path.includes('..') || path.length > 500) continue;
    const content = match[2].replace(/^\n/, '').replace(/\n$/, '');
    if (content.length <= MAX_FILE_CONTENT) artifacts.push({ path, content });
  }
  return artifacts.filter((item, index, list) => list.findIndex((candidate) => candidate.path === item.path) === index);
}

async function loadProjectContext(projectId, userId) {
  if (!projectId) return { project: null, files: [] };
  const project = await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  if (!project.rows.length) {
    const error = new Error('Projeto não encontrado');
    error.status = 404;
    throw error;
  }
  const files = await pool.query(
    'SELECT id,path,content,kind,updated_at FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path',
    [projectId, userId],
  );
  return { project: project.rows[0], files: files.rows };
}

async function persistArtifacts(projectId, userId, artifacts) {
  if (!projectId || !artifacts.length) return { filesChanged: [], filesCreated: [] };
  const changed = [];
  const created = [];
  for (const artifact of artifacts) {
    const existing = await pool.query(
      'SELECT id FROM project_files WHERE project_id=$1 AND user_id=$2 AND path=$3',
      [projectId, userId, artifact.path],
    );
    if (existing.rows.length) {
      await pool.query(
        'UPDATE project_files SET content=$1,kind=\'file\',updated_at=now() WHERE id=$2 AND user_id=$3',
        [artifact.content, existing.rows[0].id, userId],
      );
      changed.push(artifact.path);
    } else {
      await pool.query(
        'INSERT INTO project_files(project_id,user_id,path,content,kind) VALUES($1,$2,$3,$4,\'file\')',
        [projectId, userId, artifact.path, artifact.content],
      );
      created.push(artifact.path);
    }
  }
  await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [projectId, userId]);
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

router.post('/generate', async (req, res) => {
  try {
    const model = req.body?.model || 'prism-mini-1.0';
    const thinking = normalizeEffort(req.body?.thinking || 'medium');
    const prompt = String(req.body?.prompt || '').trim();
    const context = String(req.body?.context || '').slice(-30_000);
    const projectId = req.body?.projectId ? String(req.body.projectId) : null;

    if (!prompt) return res.status(400).json({ error: 'Prompt vazio' });
    if (prompt.length > 50_000) return res.status(413).json({ error: 'Pedido muito longo' });
    if (!validateThinking(model, thinking)) return res.status(400).json({ error: 'Configuração de modelo inválida' });

    const workspace = await loadProjectContext(projectId, req.userId);
    const agentPrompt = workspace.project ? buildProjectPrompt(prompt, workspace.project, workspace.files) : prompt;
    const result = await runOrchestration(
      agentPrompt,
      thinking,
      { ...getModelProfile(model), id: model },
      context,
      req.userId,
    );

    const artifacts = parseArtifacts(result.text);
    const persisted = await persistArtifacts(projectId, req.userId, artifacts);
    const cleanedText = String(result.text || '')
      .replace(/<file\s+path=["'][^"']+["']\s*>[\s\S]*?<\/file>/gi, '')
      .replace(/<prism:summary>([\s\S]*?)<\/prism:summary>/gi, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    res.json({
      model,
      thinking,
      ...result,
      text: cleanedText || (artifacts.length ? 'Alterações aplicadas ao projeto real.' : result.text),
      project_id: projectId,
      files_changed: persisted.filesChanged,
      files_created: persisted.filesCreated,
    });
  } catch (error) {
    console.error('AI generation error:', error);
    const message = error?.message || 'O serviço de IA não respondeu.';
    const status = error?.status || (/não está configurada|Nenhuma chave/i.test(message) ? 503 : 502);
    res.status(status).json({ error: message });
  }
});

export default router;
