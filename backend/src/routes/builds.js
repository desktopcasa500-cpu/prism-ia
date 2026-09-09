import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const router = Router();
router.use(requireAuth);

const buildCache = new Map();
const BUILD_TTL_MS = 30 * 60 * 1000;

function safeName(value, fallback = 'prism-app') {
  return String(value || fallback).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback;
}

function run(command, args, cwd, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(Object.assign(new Error('A compilação excedeu o tempo máximo.'), { code: 'BUILD_TIMEOUT' }));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr });
      reject(Object.assign(new Error(stderr || stdout || `Processo terminou com código ${code}`), { code: 'BUILD_FAILED', exitCode: code }));
    });
  });
}

function cleanupExpired() {
  const now = Date.now();
  for (const [id, value] of buildCache) {
    if (value.expiresAt <= now) {
      fs.rm(value.filePath, { force: true }).catch(() => {});
      buildCache.delete(id);
    }
  }
}
setInterval(cleanupExpired, 60_000).unref();

router.post('/', async (req, res, next) => {
  let tempDir = null;
  try {
    const projectId = String(req.body?.projectId || '').trim();
    const target = String(req.body?.target || 'win32-x64').trim();
    if (!projectId) return res.status(400).json({ error: 'Projeto não informado.', code: 'PROJECT_REQUIRED' });
    if (target !== 'win32-x64') return res.status(400).json({ error: 'Target não suportado.', code: 'TARGET_UNSUPPORTED' });

    const project = await pool.query('SELECT id,name FROM projects WHERE id=$1 AND user_id=$2', [projectId, req.userId]);
    if (!project.rows.length) return res.status(404).json({ error: 'Projeto não encontrado.', code: 'PROJECT_NOT_FOUND' });
    const result = await pool.query('SELECT path,content,kind FROM project_files WHERE project_id=$1 AND user_id=$2 AND kind=\'file\' ORDER BY path', [projectId, req.userId]);
    if (!result.rows.length) return res.status(400).json({ error: 'O projeto não possui arquivos.', code: 'NO_PROJECT_FILES' });

    const files = result.rows;
    const packageFile = files.find((file) => file.path.toLowerCase() === 'package.json');
    let pkg = {};
    if (packageFile) {
      try { pkg = JSON.parse(packageFile.content || '{}'); } catch { pkg = {}; }
    }
    const entry = String(pkg.main || files.find((file) => /(^|\/)index\.js$/i.test(file.path))?.path || '').replace(/^\/+/, '');
    if (!entry) return res.status(422).json({ error: 'Para criar um .exe, o projeto precisa de um entrypoint Node em package.json (main) ou index.js.', code: 'NODE_ENTRYPOINT_REQUIRED' });
    const entryFile = files.find((file) => file.path === entry);
    if (!entryFile) return res.status(422).json({ error: `Entrypoint ${entry} não foi encontrado no projeto.`, code: 'ENTRYPOINT_NOT_FOUND' });

    const buildId = crypto.randomUUID();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `prism-build-${buildId}-`));
    for (const file of files) {
      const destination = path.join(tempDir, file.path);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, String(file.content || ''), 'utf8');
    }

    const outputName = `${safeName(project.rows[0].name)}.exe`;
    const outputPath = path.join(tempDir, outputName);
    const targets = 'node20-win-x64';
    await run(process.platform === 'win32' ? 'pkg.cmd' : 'npx', process.platform === 'win32' ? [entry, '--targets', targets, '--output', outputPath] : ['pkg', entry, '--targets', targets, '--output', outputPath], tempDir);
    const stat = await fs.stat(outputPath);
    if (!stat.size) throw Object.assign(new Error('O executável foi produzido vazio.'), { code: 'EMPTY_BUILD' });

    const expiresAt = Date.now() + BUILD_TTL_MS;
    buildCache.set(buildId, { userId: req.userId, projectId, filePath: outputPath, filename: outputName, expiresAt });
    await pool.query('INSERT INTO builds(id,user_id,project_id,platform,filename,status,output_path,expires_at) VALUES($1,$2,$3,$4,$5,\'completed\',$6,to_timestamp($7/1000.0))', [buildId, req.userId, projectId, target, outputName, outputPath, expiresAt]);
    res.json({ ok: true, buildId, filename: outputName, downloadPath: `/api/builds/${buildId}/download`, expiresAt: new Date(expiresAt).toISOString(), target });
  } catch (error) {
    const code = error?.code || 'BUILD_FAILED';
    console.error('Prism build error:', error);
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    const status = code === 'BUILD_TIMEOUT' ? 504 : 422;
    try {
      const projectId = String(req.body?.projectId || '').trim();
      if (projectId) await pool.query('INSERT INTO builds(user_id,project_id,platform,filename,status,error_message) VALUES($1,$2,$3,$4,\'failed\',$5)', [req.userId, projectId, String(req.body?.target || 'win32-x64'), 'prism-app.exe', String(error?.message || code).slice(0, 500)]);
    } catch {}
    return res.status(status).json({ error: error?.message || 'Não foi possível criar o executável.', code });
  }
});

router.get('/:id/download', async (req, res, next) => {
  try {
    const cached = buildCache.get(req.params.id);
    const row = await pool.query('SELECT filename,output_path,status,expires_at FROM builds WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    if (!row.rows.length) return res.status(404).json({ error: 'Build não encontrado.', code: 'BUILD_NOT_FOUND' });
    if (row.rows[0].status !== 'completed') return res.status(409).json({ error: 'Este build não foi concluído.', code: 'BUILD_NOT_READY' });
    const expiresAt = new Date(row.rows[0].expires_at).getTime();
    if (expiresAt <= Date.now()) return res.status(410).json({ error: 'O download expirou. Gere o executável novamente.', code: 'BUILD_EXPIRED' });
    const filePath = cached?.filePath || row.rows[0].output_path;
    await fs.access(filePath);
    res.download(filePath, row.rows[0].filename);
  } catch (error) { next(error); }
});

export default router;
