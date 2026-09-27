import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pool } from '../db/pool.js';

const MAX_FILES = 500;
const MAX_FILE_BYTES = 2_000_000;
const SKIP = new Set(['.git','node_modules','.prism-classes']);

function safePath(root, absolute) {
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  if (!relative || relative.includes('..') || relative.startsWith('.git/')) return null;
  return relative;
}

async function collect(root, current = root, out = [], state = { incomplete: false, truncated: false }) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.prism-build-')) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await collect(root, absolute, out, state);
    } else if (entry.isFile()) {
      const relative = safePath(root, absolute);
      if (!relative) continue;
      const stat = await fs.stat(absolute);
      if (stat.size > MAX_FILE_BYTES) {
        state.incomplete = true;
        state.oversized = state.oversized || [];
        state.oversized.push({ path: relative, bytes: stat.size });
        continue;
      }
      if (out.length >= MAX_FILES) { state.truncated = true; state.incomplete = true; break; }
      out.push({ path: relative, content: await fs.readFile(absolute, 'utf8') });
    }
    if (state.truncated) break;
  }
  return { files: out, incomplete: state.incomplete, truncated: state.truncated, oversized: state.oversized || [] };
}

export async function syncWorkspaceToProject(workspace) {
  if (!workspace?.root || !workspace?.projectId || !workspace?.userId) return { synced: 0, removed: 0 };
  const collected = await collect(workspace.root);
  if (collected.truncated) throw Object.assign(new Error('O workspace excedeu o limite de 500 arquivos; a sincronização foi interrompida para evitar perda de arquivos.'), { code: 'TOO_MANY_PROJECT_FILES', status: 422 });
  if (collected.incomplete) {
    const detail = collected.oversized?.length
      ? ` Arquivos acima de 2 MB: ${collected.oversized.slice(0, 5).map((item) => item.path).join(', ')}${collected.oversized.length > 5 ? '…' : ''}.`
      : '';
    throw Object.assign(new Error(`A sincronização foi interrompida porque a coleta do workspace ficou incompleta.${detail}`), { code: 'WORKSPACE_SYNC_INCOMPLETE', status: 422 });
  }
  const files = collected.files;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      await client.query(
        `INSERT INTO project_files(project_id,user_id,path,content,kind,updated_at)
         VALUES($1,$2,$3,$4,'file',now())
         ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content, user_id=EXCLUDED.user_id, kind='file', updated_at=now()`,
        [workspace.projectId, workspace.userId, file.path, file.content],
      );
    }
    const keep = files.map((file) => file.path);
    let removed = 0;
    if (keep.length) {
      const result = await client.query(
        'DELETE FROM project_files WHERE project_id=$1 AND user_id=$2 AND NOT (path = ANY($3::text[]))',
        [workspace.projectId, workspace.userId, keep],
      );
      removed = result.rowCount || 0;
    } else {
      const result = await client.query(
        'DELETE FROM project_files WHERE project_id=$1 AND user_id=$2',
        [workspace.projectId, workspace.userId],
      );
      removed = result.rowCount || 0;
    }
    await client.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [workspace.projectId, workspace.userId]);
    await client.query('COMMIT');
    workspace.files = files.map((file) => ({ ...file, kind: 'file' })).sort((a, b) => a.path.localeCompare(b.path));
    return { synced: files.length, removed };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
