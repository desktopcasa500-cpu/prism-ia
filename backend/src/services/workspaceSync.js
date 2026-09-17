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

async function collect(root, current = root, out = []) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.prism-build-')) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await collect(root, absolute, out);
    else if (entry.isFile()) {
      const relative = safePath(root, absolute);
      if (!relative) continue;
      const stat = await fs.stat(absolute);
      if (stat.size > MAX_FILE_BYTES) continue;
      out.push({ path: relative, content: await fs.readFile(absolute, 'utf8') });
      if (out.length >= MAX_FILES) break;
    }
    if (out.length >= MAX_FILES) break;
  }
  return out;
}

export async function syncWorkspaceToProject(workspace) {
  if (!workspace?.root || !workspace?.projectId || !workspace?.userId) return { synced: 0, removed: 0 };
  const files = await collect(workspace.root);
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
