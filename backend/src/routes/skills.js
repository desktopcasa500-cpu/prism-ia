import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { executeSkill, listSkills } from '../services/skills.js';
import { MODEL_REQUIREMENTS, PLAN_FEATURES, normalizePlanRank, reserveUsage, releaseUsage, recordTokens } from '../services/usage.js';
import { pool } from '../db/pool.js';

const router = Router();
router.use(requireAuth);

router.get('/', (_req, res) => {
  res.json({ skills: listSkills() });
});

router.post('/:skillId/run', async (req, res, next) => {
  let reservation = null;
  try {
    const skillId = String(req.params.skillId || '');
    const account = await pool.query('SELECT plan FROM users WHERE id=$1', [req.userId]);
    if (!account.rows.length) return res.status(401).json({ error: 'Conta não encontrada.', code: 'AUTH_REQUIRED' });
    const skillModel = listSkills().find((skill) => skill.id === skillId)?.model;
    if (!skillModel || MODEL_REQUIREMENTS[skillModel] === undefined) return res.status(404).json({ error: 'Skill não encontrada.', code: 'SKILL_NOT_FOUND' });
    const rank = normalizePlanRank(account.rows[0].plan);
    const required = MODEL_REQUIREMENTS[skillModel];
    if (rank < required) return res.status(403).json({ error: 'Esta Skill requer um plano superior.', code: 'PLAN_UPGRADE_REQUIRED', requiredPlan: ['Grátis','Base','Medium','Pro','Empresarial'][required] || 'Pro' });
    if (skillModel === 'prism-taff-2.0' && !PLAN_FEATURES[rank]?.ultracode) return res.status(403).json({ error: 'Esta Skill requer acesso ao Ultracode.', code: 'PLAN_UPGRADE_REQUIRED', requiredPlan: 'Empresarial' });
    reservation = await reserveUsage(req.userId, skillModel);
    if (!reservation.ok) return res.status(reservation.status || 429).json({ error: 'O limite de uso foi atingido.', code: reservation.code, usage: reservation.usage });
    const result = await executeSkill(skillId, req.body?.input, { userId: req.userId });
    await recordTokens(reservation.reservationId, result?.providers?.[0] || null, Number(result?.tokens || 0));
    reservation = null;
    res.json({
      skill: skillId,
      result: {
        text: result?.text || '',
        tokens: result?.tokens || 0,
        providers: result?.providers || [],
        mode: result?.mode || null,
        errors: result?.errors || [],
      },
    });
  } catch (error) {
    if (reservation?.reservationId) await releaseUsage(reservation.reservationId).catch(() => {});
    if (error?.code === 'SKILL_NOT_FOUND') return res.status(404).json({ error: error.message });
    if (error?.code === 'SKILL_TIMEOUT') return res.status(504).json({ error: error.message });
    if (error?.message?.includes('não configurada')) return res.status(503).json({ error: error.message });
    next(error);
  }
});

export default router;
