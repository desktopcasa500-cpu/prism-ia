const STRIPE_ENABLED = String(process.env.PRISM_STRIPE_ENABLED || 'false').toLowerCase() === 'true';

let stripeClientPromise = null;

async function getStripe() {
  if (!STRIPE_ENABLED || !process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClientPromise) {
    stripeClientPromise = import('stripe').then(({ default: Stripe }) => new Stripe(process.env.STRIPE_SECRET_KEY));
  }
  return stripeClientPromise;
}

export function stripeStatus() {
  return {
    enabled: STRIPE_ENABLED && Boolean(process.env.STRIPE_SECRET_KEY),
    ready: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

export async function createCheckoutSession({ priceId, customerEmail, successUrl, cancelUrl, metadata = {} }) {
  const stripe = await getStripe();
  if (!stripe) return { ok: false, code: 'STRIPE_INACTIVE', status: 503 };
  if (!priceId || !customerEmail || !successUrl || !cancelUrl) return { ok: false, code: 'INVALID_CHECKOUT', status: 400 };
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
  return { ok: true, id: session.id, url: session.url };
}
