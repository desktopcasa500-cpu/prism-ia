import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { trafficStatus } from '../middleware/trafficGate.js';
import { trafficStatusMessage } from '../services/traffic.js';

const router = Router();
router.use(requireAuth);
router.get('/', (_req, res) => {
  const traffic = trafficStatus();
  res.json({ ...traffic, warning: trafficStatusMessage(traffic) || null, priority: 'Planos pagos recebem prioridade na fila durante picos de tráfego.' });
});

export default router;
