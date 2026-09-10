import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const MAX_CONTENT = 2_000_000;
const MAX_PATH = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validUuid(value) { return UUID_RE.test(String(value || '')); }
function normalizePath(value) { return String(value || '').replace(/[\u0000\r\n]/g, '').trim().replace(/^\/+/, ''); }

async function ownsProject(projectId, userId) {
  if (!validUuid(projectId)) return false;
  const result = await pool.query('SELECT id FROM projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  return result.rows.length > 0;
}

router.get('/project/:projectId', async (req, res, next) => {
  try {
    if (!validUuid(req.params.projectId)) return res.status(400).json({ error: 'Identificador de projeto inválido.', code: 'INVALID_PROJECT_ID' });
    if (!await ownsProject(req.params.projectId, req.userId)) return res.status(404).json({ error: 'Projeto não encontrado' });
    const result = await pool.query(
      'SELECT id,path,content,kind,created_at,updated_at FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path',
      [req.params.projectId, req.userId],
    );
    res.json({ files: result.rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const projectId = String(req.body?.projectId || '');
    const filePath = normalizePath(req.body?.path);
    const content = String(req.body?.content ?? '').replace(/\u0000/g, '');
    const kind = req.body?.kind === 'folder' ? 'folder' : 'file';
    if (!validUuid(projectId)) return res.status(400).json({ error: 'Identificador de projeto inválido.', code: 'INVALID_PROJECT_ID' });
    if (!filePath) return res.status(400).json({ error: 'Caminho do arquivo é obrigatório' });
    if (filePath.includes('..') || filePath.length > MAX_PATH) return res.status(400).json({ error: 'Caminho inválido' });
    if (content.length > MAX_CONTENT) return res.status(413).json({ error: 'Arquivo muito grande' });
    if (!await ownsProject(projectId, req.userId)) return res.status(404).json({ error: 'Projeto não encontrado' });
    const result = await pool.query(
      `INSERT INTO project_files(project_id,user_id,path,content,kind) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content, kind=EXCLUDED.kind, updated_at=now()
       RETURNING id,path,content,kind,created_at,updated_at`,
      [projectId, req.userId, filePath, content, kind],
    );
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [projectId, req.userId]);
    res.status(201).json({ file: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de arquivo inválido.', code: 'INVALID_FILE_ID' });
    const filePath = normalizePath(req.body?.path);
    const content = String(req.body?.content ?? '').replace(/\u0000/g, '');
    if (!filePath || filePath.includes('..') || filePath.length > MAX_PATH || content.length > MAX_CONTENT) return res.status(400).json({ error: 'Dados de arquivo inválidos' });
    const result = await pool.query(
      `UPDATE project_files SET path=$1,content=$2,updated_at=now()
       WHERE id=$3 AND user_id=$4
       RETURNING id,project_id,path,content,kind,created_at,updated_at`,
      [filePath, content, req.params.id, req.userId],
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [result.rows[0].project_id, req.userId]);
    res.json({ file: result.rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!validUuid(req.params.id)) return res.status(400).json({ error: 'Identificador de arquivo inválido.', code: 'INVALID_FILE_ID' });
    const result = await pool.query('DELETE FROM project_files WHERE id=$1 AND user_id=$2 RETURNING id,project_id', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [result.rows[0].project_id, req.userId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
