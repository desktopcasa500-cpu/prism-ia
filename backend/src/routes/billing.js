import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWallet, simulateTopUp } from '../services/usage.js';
import { createCheckoutSession, createPortalSession, stripeStatus, configuredPlanPriceIds } from '../services/stripe.js';

const router = Router();
router.use(requireAuth);

const PLANS = {
  Base: { price: 'R$8/mês', rank: 1 },
  Medium: { price: 'R$30/mês', rank: 2 },
  Pro: { price: 'R$90/mês', rank: 3 },
  Empresarial: { price: 'R$140/mês', rank: 4 },
};

router.get('/status', (_req, res) => res.json({ ...stripeStatus(), prices: Object.keys(PLANS) }));
router.get('/plans', (_req, res) => res.json({ plans: Object.entries(PLANS).map(([name, info]) => ({ name, ...info, configured: Boolean(configuredPlanPriceIds()[name]) })) }));
router.get('/wallet', async (req, res, next) => { try { const wallet = await getWallet(req.userId); if (!wallet) return res.status(404).json({ error: 'Conta não encontrada.' }); res.json(wallet); } catch (error) { next(error); } });
router.post('/top-up/simulated', async (req, res, next) => { try { const result = await simulateTopUp(req.userId, req.body?.amountCents); if (!result.ok) return res.status(result.status || 400).json(result); res.json({ ...result, simulated: true }); } catch (error) { next(error); } });

router.post('/checkout', async (req, res, next) => {
  try {
    const plan = String(req.body?.plan || '').trim();
    if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) return res.status(400).json({ error: 'Plano inválido.', code: 'INVALID_PLAN' });
    const result = await createCheckoutSession({ plan, customerEmail: req.user?.email || req.body?.customerEmail, successUrl: req.body?.successUrl, cancelUrl: req.body?.cancelUrl, userId: req.userId });
    if (!result.ok) return res.status(result.status || 503).json(result);
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/portal', async (req, res, next) => {
  try {
    const result = await createPortalSession({ userId: req.userId, returnUrl: req.body?.returnUrl || process.env.APP_URL || '' });
    if (!result.ok) return res.status(result.status || 503).json(result);
    res.json(result);
  } catch (error) { next(error); }
});

export default router;
