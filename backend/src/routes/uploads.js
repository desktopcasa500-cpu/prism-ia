import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const allowed = new Set(['pdf', 'zip', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'md', 'txt']);

router.post('/analyze', async (req, res) => {
  const file = req.body?.file;

  if (!file?.name) {
    return res.status(400).json({ error: 'Arquivo não informado' });
  }

  const ext = file.name.includes('.')
    ? file.name.split('.').pop().toLowerCase()
    : '';

  if (!allowed.has(ext)) {
    return res.status(415).json({ error: 'Tipo de arquivo não suportado' });
  }

  return res.json({
    file: file.name,
    type: ext,
    status: 'ready',
    capabilities: [
      'code-analysis',
      'bug-detection',
      'project-understanding'
    ]
  });
});

export default router;
