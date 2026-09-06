import { pool } from '../db/pool.js';

export const USAGE_WINDOW_MS = 5 * 60 * 60 * 1000;
export const USAGE_WINDOW_HOURS = 5;

// Request quotas are intentionally configuration-driven. The current defaults
// preserve the previous plan capacity while changing the product semantics
// from "credits" to a rolling five-hour usage window.
export const PLAN_LIMITS = {
  0: Number(process.env.PRISM_FREE_WINDOW_LIMIT || 5),
  1: Number(process.env.PRISM_BASE_WINDOW_LIMIT || 30),
  2: Number(process.env.PRISM_MEDIUM_WINDOW_LIMIT || 700),
  3: Number(process.env.PRISM_PRO_WINDOW_LIMIT || 2000),
  4: Number(process.env.PRISM_ENTERPRISE_WINDOW_LIMIT || 6000),
};

const PLAN_RANK = {
  free: 0, 'Grátis': 0,
  base: 1, Base: 1,
  medium: 2, Medium: 2,
  pro: 3, Pro: 3,
  enterprise: 4, Empresarial: 4,
};

export const MODEL_REQUIREMENTS = {
  'prism-nano-1.0': 0,
  'prism-mini-1.0': 0,
  'prism-edge-1.0': 2,
  'prism-tex-1.5': 2,
  'prism-taff-1.0': 3,
  'prism-taff-2.0': 3,
};

export function normalizePlanRank(plan) {
  return PLAN_RANK[plan] ?? 0;
}

export function getPlanLimit(plan) {
  const limit = PLAN_LIMITS[normalizePlanRank(plan)];
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
}

function windowStart() {
  return new Date(Date.now() - USAGE_WINDOW_MS);
}

export function percentUsed(used, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((Number(used || 0) / limit) * 100)));
}

export async function getUsage(userId) {
  const result = await pool.query(
    `SELECT u.plan,
            COALESCE(SUM(greatest(usage.units, 0)), 0)::int AS used,
            MAX(usage.created_at) AS last_used_at
       FROM users u
       LEFT JOIN usage ON usage.user_id = u.id
                       AND usage.created_at >= $2
      WHERE u.id = $1
      GROUP BY u.id, u.plan`,
    [userId, windowStart()],
  );

  if (!result.rows.length) return null;
  const row = result.rows[0];
  const limit = getPlanLimit(row.plan);
  const used = Number(row.used || 0);
  const percentage = percentUsed(used, limit);
  const resetsAt = new Date(Date.now() + USAGE_WINDOW_MS);
  return {
    plan: row.plan,
    windowHours: USAGE_WINDOW_HOURS,
    used,
    limit,
    percentage,
    remaining: Math.max(0, limit - used),
    resetsAt: resetsAt.toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
  };
}

export async function reserveUsage(userId, model) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize reservations for the same account so two simultaneous sends
    // cannot pass the quota check together.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(userId)]);

    const userResult = await client.query('SELECT plan FROM users WHERE id=$1 FOR SHARE', [userId]);
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'AUTH_REQUIRED', status: 401 };
    }

    const plan = userResult.rows[0].plan;
    const limit = getPlanLimit(plan);
    const start = windowStart();
    const current = await client.query(
      'SELECT COUNT(*)::int AS used FROM usage WHERE user_id=$1 AND created_at >= $2',
      [userId, start],
    );
    const used = Number(current.rows[0]?.used || 0);

    if (used >= limit) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'USAGE_LIMIT_REACHED',
        status: 429,
        usage: {
          plan,
          windowHours: USAGE_WINDOW_HOURS,
          used,
          limit,
          percentage: 100,
          remaining: 0,
          // Exact rolling reset is oldest usage timestamp + window.
          resetsAt: new Date(Date.now() + USAGE_WINDOW_MS).toISOString(),
        },
      };
    }

    await client.query(
      `INSERT INTO usage (user_id, model, provider, tokens, units, created_at)
       VALUES ($1, $2, NULL, 0, 1, now())`,
      [userId, model || null],
    );
    await client.query('COMMIT');

    return {
      ok: true,
      usage: {
        plan,
        windowHours: USAGE_WINDOW_HOURS,
        used: used + 1,
        limit,
        percentage: percentUsed(used + 1, limit),
        remaining: Math.max(0, limit - used - 1),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function recordTokens(userId, model, provider, tokens) {
  const amount = Number.isFinite(Number(tokens)) ? Math.max(0, Math.floor(Number(tokens))) : 0;
  if (!amount) return;
  await pool.query(
    `UPDATE usage
        SET tokens=$1, provider=$2
      WHERE id = (
        SELECT id FROM usage
         WHERE user_id=$3 AND model IS NOT DISTINCT FROM $4
         ORDER BY created_at DESC
         LIMIT 1
      )`,
    [amount, provider || null, userId, model || null],
  );
}

export async function getUsagePercent(userId) {
  const usage = await getUsage(userId);
  return usage?.percentage ?? 0;
}
