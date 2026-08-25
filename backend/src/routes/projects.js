import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, name, created_at, updated_at FROM projects WHERE user_id=$1 ORDER BY updated_at DESC', [req.userId]);
    res.json({ projects: result.rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name || 'Novo projeto').trim().slice(0, 120) || 'Novo projeto';
    const result = await pool.query('INSERT INTO projects(user_id,name) VALUES($1,$2) RETURNING *', [req.userId, name]);
    res.status(201).json({ project: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/:projectId/files', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, path, content, mime_type, version, created_at, updated_at FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path', [req.params.projectId, req.userId]);
    res.json({ files: result.rows });
  } catch (error) { next(error); }
});

router.put('/:projectId/files', async (req, res, next) => {
  try {
    const filePath = String(req.body?.path || '').trim().replace(/^\/+/, '');
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const mimeType = String(req.body?.mime_type || '').slice(0, 120) || null;
    if (!filePath || filePath.includes('..')) return res.status(400).json({ error: 'Caminho de arquivo inválido' });
    const project = await pool.query('SELECT id FROM projects WHERE id=$1 AND user_id=$2', [req.params.projectId, req.userId]);
    if (!project.rows.length) return res.status(404).json({ error: 'Projeto não encontrado' });
    const result = await pool.query(`INSERT INTO project_files(project_id,user_id,path,content,mime_type) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content,mime_type=EXCLUDED.mime_type,version=project_files.version+1,updated_at=now() RETURNING *`, [req.params.projectId, req.userId, filePath, content, mimeType]);
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [req.params.projectId, req.userId]);
    res.json({ file: result.rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:projectId/files', async (req, res, next) => {
  try {
    const filePath = String(req.body?.path || '').trim();
    if (!filePath) return res.status(400).json({ error: 'Caminho de arquivo obrigatório' });
    const result = await pool.query('DELETE FROM project_files WHERE project_id=$1 AND user_id=$2 AND path=$3 RETURNING id,path', [req.params.projectId, req.userId, filePath]);
    if (!result.rows.length) return res.status(404).json({ error: 'Arquivo não encontrado' });
    await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [req.params.projectId, req.userId]);
    res.json({ deleted: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
