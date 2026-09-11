import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { executeSkill, listSkills } from '../services/skills.js';

const router = Router();
router.use(requireAuth);

router.get('/', (_req, res) => {
  res.json({ skills: listSkills() });
});

router.post('/:skillId/run', async (req, res, next) => {
  try {
    const result = await executeSkill(req.params.skillId, req.body?.input, { userId: req.userId });
    res.json({
      skill: req.params.skillId,
      result: {
        text: result?.text || '',
        tokens: result?.tokens || 0,
        providers: result?.providers || [],
        mode: result?.mode || null,
        errors: result?.errors || [],
      },
    });
  } catch (error) {
    if (error?.code === 'SKILL_NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error?.code === 'SKILL_TIMEOUT') return res.status(504).json({ error: error.message });
    if (error?.message?.includes('não configurada')) return res.status(503).json({ error: error.message });
    next(error);
  }
});

export default router;
