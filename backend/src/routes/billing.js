import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWallet, simulateTopUp } from '../services/usage.js';
import { createCheckoutSession, stripeStatus } from '../services/stripe.js';

const router = Router();
router.use(requireAuth);

router.get('/status', (_req, res) => res.json(stripeStatus()));

router.get('/wallet', async (req, res, next) => {
  try {
    const wallet = await getWallet(req.userId);
    if (!wallet) return res.status(404).json({ error: 'Conta não encontrada.' });
    res.json(wallet);
  } catch (error) { next(error); }
});

router.post('/top-up/simulated', async (req, res, next) => {
  try {
    const result = await simulateTopUp(req.userId, req.body?.amountCents);
    if (!result.ok) return res.status(result.status || 400).json(result);
    res.json({ ...result, simulated: true });
  } catch (error) { next(error); }
});

router.post('/checkout', async (req, res, next) => {
  try {
    const result = await createCheckoutSession({
      priceId: req.body?.priceId,
      customerEmail: req.user?.email || req.body?.customerEmail,
      successUrl: req.body?.successUrl,
      cancelUrl: req.body?.cancelUrl,
      metadata: { userId: req.userId, ...(req.body?.metadata || {}) },
    });
    if (!result.ok) return res.status(result.status || 503).json(result);
    res.json(result);
  } catch (error) { next(error); }
});

export default router;
