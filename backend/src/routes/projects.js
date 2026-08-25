import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req,res,next)=>{
 try {
  const result = await pool.query('SELECT id,name,created_at,updated_at FROM projects WHERE user_id=$1 ORDER BY updated_at DESC', [req.userId]);
  res.json({projects:result.rows});
 } catch(e){next(e)}
});

router.post('/', async(req,res,next)=>{
 try {
  const name=String(req.body?.name||'Novo projeto').slice(0,120);
  const result=await pool.query('INSERT INTO projects(user_id,name) VALUES($1,$2) RETURNING *',[req.userId,name]);
  res.status(201).json({project:result.rows[0]});
 }catch(e){next(e)}
});

export default router;
