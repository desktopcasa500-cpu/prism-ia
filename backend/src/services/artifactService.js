import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { zipSync } from 'fflate';
import { pool } from '../db/pool.js';

const TTL = 60 * 60 * 1000;
const SECRET = String(process.env.PRISM_BUILD_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'change-this-build-secret');
const SKIP_DIRS = new Set(['node_modules','.git','.prism-classes']);

function sign(buildId, userId, expiresAt) {
  const payload = `${buildId}.${userId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}
function safeName(value) { return String(value || 'prism-project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'prism-project'; }
async function collectFiles(root, current = root, out = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.prism-build-') || SKIP_DIRS.has(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await collectFiles(root, absolute, out);
    else if (entry.isFile()) {
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      const data = await fs.readFile(absolute);
      out.push([relative, data]);
    }
    if (out.length > 10_000) throw Object.assign(new Error('Projeto grande demais para ZIP.'), { code: 'TOO_MANY_ARCHIVE_FILES' });
  }
  return out;
}

export async function zipWorkspace(workspace) {
  if (!workspace?.root || !workspace?.project?.name) throw Object.assign(new Error('Workspace inválido para ZIP.'), { code: 'WORKSPACE_REQUIRED' });
  const buildId = crypto.randomUUID();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `prism-zip-${buildId}-`));
  const filename = `${safeName(workspace.project.name)}.zip`;
  const outputPath = path.join(tempDir, filename);
  try {
    const files = await collectFiles(workspace.root);
    const archive = zipSync(Object.fromEntries(files), { level: 6 });
    await fs.writeFile(outputPath, Buffer.from(archive));
    const stat = await fs.stat(outputPath);
    if (!stat.size) throw Object.assign(new Error('O ZIP foi produzido vazio.'), { code: 'EMPTY_ARCHIVE' });
    const expiresAt = Date.now() + TTL;
    await pool.query("INSERT INTO builds(id,user_id,project_id,platform,filename,status,output_path,expires_at) VALUES($1,$2,$3,'zip',$4,'completed',$5,to_timestamp($6/1000.0))", [buildId, workspace.userId, workspace.projectId, filename, outputPath, expiresAt]);
    return { ok: true, buildId, filename, size: stat.size, files: files.length, expiresAt: new Date(expiresAt).toISOString(), downloadPath: `/api/builds/${buildId}/download?token=${encodeURIComponent(sign(buildId, workspace.userId, expiresAt))}` };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
