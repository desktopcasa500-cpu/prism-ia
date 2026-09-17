import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pool } from '../db/pool.js';

const TTL = 60 * 60 * 1000;
const SECRET = String(process.env.PRISM_BUILD_DOWNLOAD_SECRET || process.env.JWT_SECRET || 'change-this-build-secret');

function sign(buildId, userId, expiresAt) {
  const payload = `${buildId}.${userId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function safeName(value) { return String(value || 'prism-project').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'prism-project'; }

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (chunk) => { out += chunk.toString(); });
    child.stderr.on('data', (chunk) => { err += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve({ out, err }) : reject(Object.assign(new Error(String(err || out || `Processo terminou com ${code}`).slice(-5000)), { code: 'ARCHIVE_FAILED' })));
  });
}

export async function zipWorkspace(workspace) {
  if (!workspace?.root || !workspace?.project?.name) throw Object.assign(new Error('Workspace inválido para ZIP.'), { code: 'WORKSPACE_REQUIRED' });
  const buildId = crypto.randomUUID();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `prism-zip-${buildId}-`));
  const filename = `${safeName(workspace.project.name)}.zip`;
  const outputPath = path.join(tempDir, filename);
  try {
    if (process.platform === 'win32') {
      const command = `Compress-Archive -Path * -DestinationPath "${outputPath.replace(/"/g, '`"')}" -Force`;
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], workspace.root);
    } else {
      await run('zip', ['-qr', outputPath, '.'], workspace.root);
    }
    const stat = await fs.stat(outputPath);
    const expiresAt = Date.now() + TTL;
    await pool.query("INSERT INTO builds(id,user_id,project_id,platform,filename,status,output_path,expires_at) VALUES($1,$2,$3,'zip',$4,'completed',$5,to_timestamp($6/1000.0))", [buildId, workspace.userId, workspace.projectId, filename, outputPath, expiresAt]);
    return { ok: true, buildId, filename, size: stat.size, expiresAt: new Date(expiresAt).toISOString(), downloadPath: `/api/builds/${buildId}/download?token=${encodeURIComponent(sign(buildId, workspace.userId, expiresAt))}` };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
