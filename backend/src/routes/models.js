import { Router } from 'express';
import { MODEL_PROFILES } from '../services/modelRouter.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    models: Object.entries(MODEL_PROFILES).map(([id, data]) => ({ id, ...data }))
  });
});

export default router;
