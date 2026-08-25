import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const allowed = new Set(['pdf', 'zip', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'md', 'txt', 'png', 'jpg', 'jpeg', 'webp', 'svg']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 10 } });

router.post('/analyze', upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Arquivo não informado' });
    const projectId = req.body?.projectId || null;
    if (projectId) {
      const owns = await pool.query('SELECT id FROM projects WHERE id=$1 AND user_id=$2', [projectId, req.userId]);
      if (!owns.rows.length) return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    const results = [];
    for (const file of req.files) {
      const ext = file.originalname.includes('.') ? file.originalname.split('.').pop().toLowerCase() : '';
      if (!allowed.has(ext)) return res.status(415).json({ error: `Tipo de arquivo não suportado: ${ext || 'desconhecido'}` });
      const stored = await pool.query(`INSERT INTO uploads(user_id,project_id,filename,mime_type,size_bytes,content_bytes,status) VALUES($1,$2,$3,$4,$5,$6,'received') RETURNING id,filename,mime_type,size_bytes,status,created_at`, [req.userId, projectId, file.originalname, file.mimetype, file.size, file.buffer]);

      if (projectId && ['js','ts','jsx','tsx','html','css','json','md','txt','svg'].includes(ext)) {
        const text = file.buffer.toString('utf8');
        await pool.query(`INSERT INTO project_files(project_id,user_id,path,content,mime_type) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id,path) DO UPDATE SET content=EXCLUDED.content,mime_type=EXCLUDED.mime_type,version=project_files.version+1,updated_at=now()`, [projectId, req.userId, file.originalname, text, file.mimetype]);
        await pool.query('UPDATE projects SET updated_at=now() WHERE id=$1 AND user_id=$2', [projectId, req.userId]);
      }
      results.push({ ...stored.rows[0], extension: ext, capabilities: ['code-analysis', 'bug-detection', 'project-understanding'] });
    }
    res.status(201).json({ files: results });
  } catch (error) { next(error); }
});

export default router;
