import { Router } from 'express';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { buildProject } from '../services/buildService.js';

const router = Router();
const downloadSecret = String(process.env.PRISM_BUILD_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'change-this-build-secret');
const buildCache = new Map();
const BUILD_TTL_MS = 60 * 60 * 1000;

function signDownload(buildId, userId, expiresAt) {
  const payload = `${buildId}.${userId}.${expiresAt}`;
  const sig = crypto.createHmac('sha256', downloadSecret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

function verifyDownload(token, buildId) {
  try {
    const value = Buffer.from(String(token || ''), 'base64url').toString('utf8');
    const [id, userId, expiresAt, sig] = value.split('.');
    if (id !== buildId || !userId || !sig || Number(expiresAt) <= Date.now()) return null;
    const payload = `${id}.${userId}.${expiresAt}`;
    const expected = crypto.createHmac('sha256', downloadSecret).update(payload).digest('hex');
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
    return userId;
  } catch {
    return null;
  }
}

async function loadProject(projectId, userId) {
  const project = await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  if (!project.rows.length) throw Object.assign(new Error('Projeto não encontrado.'), { code: 'PROJECT_NOT_FOUND', status: 404 });
  const files = await pool.query("SELECT path,content,kind FROM project_files WHERE project_id=$1 AND user_id=$2 AND kind='file' ORDER BY path", [projectId, userId]);
  if (!files.rows.length) throw Object.assign(new Error('O projeto não possui arquivos.'), { code: 'NO_PROJECT_FILES', status: 422 });
  return { project: project.rows[0], files: files.rows };
}

function targetOf(value) {
  const target = String(value || '').trim().toLowerCase();
  if (target === 'jar' || target === 'java' || target === 'java-jar') return 'jar';
  if (target === 'win32-x64' || target === 'windows' || target === 'exe' || target === 'win') return 'win32-x64';
  return '';
}

function cleanup() {
  const now = Date.now();
  for (const [id, item] of buildCache) {
    if (item.expiresAt <= now) {
      fs.rm(item.tempDir, { recursive: true, force: true }).catch(() => {});
      buildCache.delete(id);
    }
  }
}
setInterval(cleanup, 60_000).unref();

router.get('/:id/download', async (req, res) => {
  try {
    const userId = verifyDownload(req.query?.token, req.params.id);
    if (!userId) return res.status(401).json({ error: 'Token de download inválido ou expirado.', code: 'BUILD_DOWNLOAD_UNAUTHORIZED' });
    const row = await pool.query('SELECT filename,output_path,status,expires_at FROM builds WHERE id=$1 AND user_id=$2', [req.params.id, userId]);
    if (!row.rows.length) return res.status(404).json({ error: 'Build não encontrado.', code: 'BUILD_NOT_FOUND' });
    if (row.rows[0].status !== 'completed') return res.status(409).json({ error: 'Este build não foi concluído.', code: 'BUILD_NOT_READY' });
    if (new Date(row.rows[0].expires_at).getTime() <= Date.now()) return res.status(410).json({ error: 'O download expirou. Gere novamente.', code: 'BUILD_EXPIRED' });
    const cached = buildCache.get(req.params.id);
    const filePath = cached?.outputPath || row.rows[0].output_path;
    await fs.access(filePath);
    return res.download(filePath, row.rows[0].filename);
  } catch (error) {
    return res.status(404).json({ error: error?.message || 'Arquivo não encontrado.', code: 'BUILD_FILE_NOT_FOUND' });
  }
});

router.use(requireAuth);

router.post('/', async (req, res) => {
  let build = null;
  const target = targetOf(req.body?.target);
  const projectId = String(req.body?.projectId || '').trim();
  if (!projectId) return res.status(400).json({ error: 'Projeto não informado.', code: 'PROJECT_REQUIRED' });
  if (!target) return res.status(400).json({ error: 'Destino de compilação não suportado. Use "jar" ou "win32-x64".', code: 'TARGET_UNSUPPORTED' });

  try {
    const { project, files } = await loadProject(projectId, req.userId);
    build = await buildProject({ projectName: project.name, files, target });
    const expiresAt = Date.now() + BUILD_TTL_MS;
    buildCache.set(build.buildId, { userId: req.userId, projectId, tempDir: build.tempDir, outputPath: build.outputPath, filename: build.filename, expiresAt });
    await pool.query(
      "INSERT INTO builds(id,user_id,project_id,platform,filename,status,output_path,expires_at) VALUES($1,$2,$3,$4,$5,'completed',$6,to_timestamp($7/1000.0))",
      [build.buildId, req.userId, projectId, target, build.filename, build.outputPath, expiresAt],
    );
    const token = signDownload(build.buildId, req.userId, expiresAt);
    return res.json({
      ok: true,
      buildId: build.buildId,
      target,
      filename: build.filename,
      size: build.size,
      expiresAt: new Date(expiresAt).toISOString(),
      downloadPath: `/api/builds/${build.buildId}/download?token=${encodeURIComponent(token)}`,
      details: build.details,
    });
  } catch (error) {
    if (build?.tempDir) await fs.rm(build.tempDir, { recursive: true, force: true }).catch(() => {});
    const code = error?.code || 'BUILD_FAILED';
    const status = Number.isInteger(error?.status) ? error.status : code === 'BUILD_TIMEOUT' ? 504 : 422;
    try {
      await pool.query(
        "INSERT INTO builds(user_id,project_id,platform,filename,status,error_message) VALUES($1,$2,$3,$4,'failed',$5)",
        [req.userId, projectId, target, target === 'jar' ? 'prism-app.jar' : 'prism-app.exe', String(error?.message || code).slice(0, 1000)],
      );
    } catch {}
    return res.status(status).json({ error: error?.message || 'Não foi possível criar o artefato.', code });
  }
});

export default router;
