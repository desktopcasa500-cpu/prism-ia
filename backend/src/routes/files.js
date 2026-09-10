import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
const MAX_CONTENT = 2_000_000;

async function ownsProject(projectId, userId) {
  const result = await pool.query('SELECT id FROM projects WHERE id=$1 AND user_id=$2', [projectId, userId]);
  return result.rows.length > 0;
}

router.get('/project/:projectId', async (req, res, next) => {
  try {
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
    const path = String(req.body?.path || '').trim().replace(/^\/+/, '');
    const content = String(req.body?.content ?? '');
    const kind = req.body?.kind === 'folder' ? 'folder' : 'file';
    if (!projectId || !path) return res.status(400).json({ error: 'Projeto e caminho são obrigatórios' });
    if (path.includes('..') || path.length > 500) return res.status(400).json({ error: 'Caminho inválido' });
    if (content.length > MAX_CONTENT) return res.status(413).json({ error: 'Arquivo muito grande' });
    if (!await ownsProject(projectId, req.userId)) return res.status(404).json({ error: 'Projeto não encontrado' });
    const result = await pool.query(
      `INSERT INTO project_files(project_id,user_id,path,content,kind) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content, kind=EXCLUDED.kind, updated_at=now()
       RETURNING id,path,content,kind,created_at,updated_at`,
      [projectId, req.userId, path, content, kind],
    );
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [projectId, req.userId]);
    res.status(201).json({ file: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const path = String(req.body?.path || '').trim().replace(/^\/+/, '');
    const content = String(req.body?.content ?? '');
    if (!path || path.includes('..') || content.length > MAX_CONTENT) return res.status(400).json({ error: 'Dados de arquivo inválidos' });
    const result = await pool.query(
      `UPDATE project_files SET path=$1,content=$2,updated_at=now()
       WHERE id=$3 AND user_id=$4
       RETURNING id,project_id,path,content,kind,created_at,updated_at`,
      [path, content, req.params.id, req.userId],
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [result.rows[0].project_id, req.userId]);
    res.json({ file: result.rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM project_files WHERE id=$1 AND user_id=$2 RETURNING id,project_id', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [result.rows[0].project_id, req.userId]);
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
