import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWallet, simulateTopUp, normalizePlanRank } from '../services/usage.js';
import { createCheckoutSession, createPortalSession, stripeStatus, configuredPlanPriceIds } from '../services/stripe.js';
import { pool } from '../db/pool.js';

const router = Router();
router.use(requireAuth);

const PLANS = {
  Base: { price: 'R$8/mês', rank: 1 },
  Medium: { price: 'R$30/mês', rank: 2 },
  Pro: { price: 'R$90/mês', rank: 3 },
  Empresarial: { price: 'R$140/mês', rank: 4 },
};
const BILLING_SIMULATION_ENABLED = process.env.NODE_ENV !== 'production' && process.env.PRISM_BILLING_SIMULATION === 'true';

router.get('/status', (_req, res) => {
  const status = stripeStatus();
  res.json({ ...status, prices: Object.keys(PLANS), billingSimulation: !status.enabled && BILLING_SIMULATION_ENABLED, simulationMessage: !status.enabled ? (BILLING_SIMULATION_ENABLED ? 'A cobrança está em modo de simulação.' : 'A cobrança ainda não está conectada.') : null });
});
router.get('/plans', (_req, res) => res.json({ plans: Object.entries(PLANS).map(([name, info]) => ({ name, ...info, configured: Boolean(configuredPlanPriceIds()[name]) })) }));
router.get('/wallet', async (req, res, next) => { try { const wallet = await getWallet(req.userId); if (!wallet) return res.status(404).json({ error: 'Conta não encontrada.' }); res.json(wallet); } catch (error) { next(error); } });
router.post('/top-up/simulated', async (req, res, next) => {
  try {
    if (!BILLING_SIMULATION_ENABLED) return res.status(503).json({ error: 'A cobrança simulada está desativada neste ambiente.', code: 'BILLING_SIMULATION_DISABLED' });
    const result = await simulateTopUp(req.userId, req.body?.amountCents);
    if (!result.ok) return res.status(result.status || 400).json(result);
    res.json({ ...result, simulated: true, message: 'Fundos simulados adicionados. A cobrança real ainda não está conectada.' });
  } catch (error) { next(error); }
});

router.post('/checkout', async (req, res, next) => {
  try {
    const plan = String(req.body?.plan || '').trim();
    if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) return res.status(400).json({ error: 'Plano inválido.', code: 'INVALID_PLAN' });
    const status = stripeStatus();
    if (!status.enabled) {
      if (!BILLING_SIMULATION_ENABLED) return res.status(503).json({ error: 'A cobrança não está configurada neste ambiente.', code: 'BILLING_NOT_CONFIGURED' });
      const current = await pool.query('SELECT plan FROM users WHERE id=$1', [req.userId]);
      if (!current.rows.length) return res.status(404).json({ error: 'Conta não encontrada.', code: 'AUTH_REQUIRED' });
      if (normalizePlanRank(plan) <= normalizePlanRank(current.rows[0].plan)) return res.json({ ok: true, simulated: true, plan: current.rows[0].plan, billingConnected: false, message: 'Você já está neste plano ou em um plano superior.' });
      await pool.query('UPDATE users SET plan=$2 WHERE id=$1', [req.userId, plan]);
      return res.json({ ok: true, simulated: true, plan, billingConnected: false, message: 'Upgrade simulado com sucesso. A cobrança real ainda não está conectada.' });
    }
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
