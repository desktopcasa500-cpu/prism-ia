import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/analyze', async (req, res) => {
  const file = req.body?.file;
  if (!file?.name) return res.status(400).json({ error: 'Arquivo não informado' });

  const allowed = ['pdf', 'zip', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json'];
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!allowed.includes(ext)) return res.status(415).json({ error: 'Tipo de arquivo não suportado' });

  res.json({
    file: file.name,
    status: 'queued',
    message: 'Arquivo preparado para análise do Prism Codex'
  });
});

export default router;
