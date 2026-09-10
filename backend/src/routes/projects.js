import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, created_at, updated_at FROM projects WHERE user_id=$1 ORDER BY updated_at DESC',
      [req.userId],
    );
    res.json({ projects: result.rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name || 'Novo projeto').trim().slice(0, 120) || 'Novo projeto';
    const result = await pool.query(
      'INSERT INTO projects(user_id,name) VALUES($1,$2) RETURNING id,name,created_at,updated_at',
      [req.userId, name],
    );
    res.status(201).json({ project: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await pool.query(
      'SELECT id,name,created_at,updated_at FROM projects WHERE id=$1 AND user_id=$2',
      [req.params.id, req.userId],
    );
    if (!project.rows.length) return res.status(404).json({ error: 'Projeto não encontrado' });
    const files = await pool.query(
      'SELECT id,path,content,kind,created_at,updated_at FROM project_files WHERE project_id=$1 AND user_id=$2 ORDER BY path',
      [req.params.id, req.userId],
    );
    res.json({ project: project.rows[0], files: files.rows });
  } catch (error) { next(error); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: 'Nome inválido' });
    const result = await pool.query(
      'UPDATE projects SET name=$1, updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,name,created_at,updated_at',
      [name, req.params.id, req.userId],
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Projeto não encontrado' });
    res.json({ project: result.rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM projects WHERE id=$1 AND user_id=$2 RETURNING id', [req.params.id, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Projeto não encontrado' });
    res.status(204).end();
  } catch (error) { next(error); }
});

export default router;
