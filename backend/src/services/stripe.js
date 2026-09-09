import Stripe from 'stripe';
import { pool } from '../db/pool.js';

const STRIPE_ENABLED = String(process.env.PRISM_STRIPE_ENABLED || 'false').toLowerCase() === 'true';
const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_WEBHOOK_SECRET = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
let stripe = null;

function getStripe() {
  if (!STRIPE_ENABLED || !STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = new Stripe(STRIPE_SECRET_KEY);
  return stripe;
}

const PLAN_PRICE_ENV = { Base: 'PRISM_STRIPE_PRICE_BASE', Medium: 'PRISM_STRIPE_PRICE_MEDIUM', Pro: 'PRISM_STRIPE_PRICE_PRO', Empresarial: 'PRISM_STRIPE_PRICE_ENTERPRISE' };
const PLAN_RANK = { Grátis: 0, free: 0, Base: 1, base: 1, Medium: 2, medium: 2, Pro: 3, pro: 3, Empresarial: 4, enterprise: 4 };

export function planRank(plan) { return PLAN_RANK[plan] ?? 0; }
export function configuredPlanPriceIds() { return Object.fromEntries(Object.entries(PLAN_PRICE_ENV).map(([plan, env]) => [plan, String(process.env[env] || '').trim()])); }
export function planFromPriceId(priceId) {
  const id = String(priceId || '').trim();
  for (const [plan, env] of Object.entries(PLAN_PRICE_ENV)) if (String(process.env[env] || '').trim() === id && id) return plan;
  return null;
}

export function stripeStatus() {
  const prices = configuredPlanPriceIds();
  return { enabled: Boolean(getStripe()), ready: Boolean(STRIPE_SECRET_KEY), webhookReady: Boolean(STRIPE_WEBHOOK_SECRET), plans: Object.fromEntries(Object.entries(prices).map(([plan, priceId]) => [plan, { configured: Boolean(priceId) }])) };
}

export async function createCheckoutSession({ plan, customerEmail, successUrl, cancelUrl, userId }) {
  const client = getStripe();
  if (!client) return { ok: false, code: 'STRIPE_INACTIVE', status: 503, error: 'Stripe não está configurado no servidor.' };
  const priceId = configuredPlanPriceIds()[plan];
  if (!priceId || !customerEmail || !successUrl || !cancelUrl || !userId) return { ok: false, code: 'INVALID_CHECKOUT', status: 400, error: 'Plano, email, URLs e usuário são obrigatórios.' };

  const result = await pool.query('SELECT stripe_customer_id FROM users WHERE id=$1', [userId]);
  let customerId = result.rows[0]?.stripe_customer_id || null;
  if (!customerId) {
    const customer = await client.customers.create({ email: customerEmail, metadata: { prismUserId: String(userId) } });
    customerId = customer.id;
    await pool.query('UPDATE users SET stripe_customer_id=$2 WHERE id=$1', [userId, customerId]);
  }
  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: { prismUserId: String(userId), plan },
    subscription_data: { metadata: { prismUserId: String(userId), plan } },
  });
  return { ok: true, id: session.id, url: session.url, plan, priceId };
}

export async function createPortalSession({ userId, returnUrl }) {
  const client = getStripe();
  if (!client) return { ok: false, code: 'STRIPE_INACTIVE', status: 503, error: 'Stripe não está configurado no servidor.' };
  const result = await pool.query('SELECT stripe_customer_id FROM users WHERE id=$1', [userId]);
  if (!result.rows[0]?.stripe_customer_id) return { ok: false, code: 'STRIPE_CUSTOMER_REQUIRED', status: 409, error: 'A conta ainda não possui uma assinatura Stripe.' };
  const session = await client.billingPortal.sessions.create({ customer: result.rows[0].stripe_customer_id, return_url: returnUrl });
  return { ok: true, url: session.url };
}

function subscriptionPriceId(subscription) { return subscription?.items?.data?.[0]?.price?.id || null; }

async function provisionFromSubscription(subscription, fallbackUserId = null) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const priceId = subscriptionPriceId(subscription);
  const metadataUserId = subscription?.metadata?.prismUserId || fallbackUserId;
  const plan = planFromPriceId(priceId) || subscription?.metadata?.plan || null;
  const status = String(subscription?.status || '').toLowerCase();
  const active = ['active', 'trialing'].includes(status);
  const result = metadataUserId ? await pool.query('SELECT id FROM users WHERE id=$1', [metadataUserId]) : await pool.query('SELECT id FROM users WHERE stripe_customer_id=$1', [customerId]);
  if (!result.rows.length) return;
  const userId = result.rows[0].id;
  await pool.query('UPDATE users SET stripe_customer_id=$2,stripe_subscription_id=$3,stripe_price_id=$4,plan=$5 WHERE id=$1', [userId, customerId || null, subscription.id || null, priceId || null, active && plan ? plan : 'free']);
}

export async function handleStripeWebhook(rawBody, signature) {
  const client = getStripe();
  if (!client) return { ok: false, status: 503, code: 'STRIPE_INACTIVE' };
  if (!STRIPE_WEBHOOK_SECRET) return { ok: false, status: 503, code: 'STRIPE_WEBHOOK_SECRET_MISSING' };
  let event;
  try { event = client.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET); }
  catch (error) { return { ok: false, status: 400, code: 'STRIPE_WEBHOOK_INVALID', error: error.message }; }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (session.metadata?.prismUserId) await pool.query('UPDATE users SET stripe_customer_id=$2,stripe_subscription_id=$3 WHERE id=$1', [session.metadata.prismUserId, customerId || null, subscriptionId || null]);
      if (subscriptionId) await provisionFromSubscription(await client.subscriptions.retrieve(subscriptionId), session.metadata?.prismUserId || null);
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await provisionFromSubscription(event.data.object);
      break;
    case 'invoice.paid':
      if (event.data.object.subscription) await provisionFromSubscription(await client.subscriptions.retrieve(event.data.object.subscription));
      break;
    case 'invoice.payment_failed': {
      const customerId = typeof event.data.object.customer === 'string' ? event.data.object.customer : event.data.object.customer?.id;
      if (customerId) await pool.query("UPDATE users SET plan='free' WHERE stripe_customer_id=$1", [customerId]);
      break;
    }
    default:
      break;
  }
  return { ok: true, eventType: event.type, eventId: event.id };
}
