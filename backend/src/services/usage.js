import { pool } from '../db/pool.js';

export const USAGE_WINDOW_MS = 5 * 60 * 60 * 1000;
export const USAGE_WINDOW_HOURS = 5;

// Configuration is deliberately environment-driven. The defaults preserve the
// previous plan capacity while the public product language uses a rolling
// usage window rather than message-priced "credits".
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

export const PLAN_FEATURES = {
  0: { label: 'Grátis', ultracode: false },
  1: { label: 'Base', ultracode: false },
  2: { label: 'Medium', ultracode: false },
  3: { label: 'Pro', ultracode: false },
  4: { label: 'Empresarial', ultracode: true },
};

export function normalizePlanRank(plan) { return PLAN_RANK[plan] ?? 0; }

export function getPlanLimit(plan) {
  const limit = PLAN_LIMITS[normalizePlanRank(plan)];
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
}

function windowStart() { return new Date(Date.now() - USAGE_WINDOW_MS); }

export function percentUsed(used, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((Number(used || 0) / limit) * 100)));
}

function usageSnapshot(plan, used, oldestUsageAt = null) {
  const limit = getPlanLimit(plan);
  const safeUsed = Math.max(0, Number(used || 0));
  const oldest = oldestUsageAt ? new Date(oldestUsageAt).getTime() : null;
  const resetsAt = oldest ? new Date(oldest + USAGE_WINDOW_MS) : new Date(Date.now() + USAGE_WINDOW_MS);
  return {
    plan,
    planRank: normalizePlanRank(plan),
    windowHours: USAGE_WINDOW_HOURS,
    used: safeUsed,
    limit,
    percentage: percentUsed(safeUsed, limit),
    remaining: Math.max(0, limit - safeUsed),
    resetsAt: resetsAt.toISOString(),
  };
}

export async function getUsage(userId) {
  const result = await pool.query(
    `SELECT u.plan,
            COALESCE(SUM(greatest(us.units, 0)), 0)::int AS used,
            MAX(us.created_at) AS latest_usage_at,
            MIN(us.created_at) AS oldest_usage_at
       FROM users u
       LEFT JOIN usage us ON us.user_id = u.id
                         AND us.created_at >= $2
                         AND COALESCE(us.units, 0) > 0
      WHERE u.id = $1
      GROUP BY u.id, u.plan`,
    [userId, windowStart()],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    ...usageSnapshot(row.plan, Number(row.used || 0), row.oldest_usage_at),
    lastUsedAt: row.latest_usage_at ? new Date(row.latest_usage_at).toISOString() : null,
  };
}

export async function getDailyUsage(userId, days = 35) {
  const safeDays = Math.min(120, Math.max(7, Math.floor(Number(days) || 35)));
  const result = await pool.query(
    `SELECT gs.day::date AS day,
            COALESCE(SUM(greatest(us.tokens, 0)), 0)::bigint AS tokens,
            COALESCE(SUM(greatest(us.units, 0)), 0)::int AS requests
       FROM generate_series(current_date - ($2 - 1), current_date, interval '1 day') AS gs(day)
       LEFT JOIN usage us
         ON us.user_id = $1
        AND us.created_at >= gs.day
        AND us.created_at < gs.day + interval '1 day'
      GROUP BY gs.day
      ORDER BY gs.day ASC`,
    [userId, safeDays],
  );

  const daysData = result.rows.map((row) => ({
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day),
    tokens: Math.max(0, Number(row.tokens || 0)),
    requests: Math.max(0, Number(row.requests || 0)),
    active: Number(row.tokens || 0) > 0 || Number(row.requests || 0) > 0,
  }));
  const totalTokens = daysData.reduce((sum, day) => sum + day.tokens, 0);
  const activeDays = daysData.reduce((sum, day) => sum + (day.active ? 1 : 0), 0);
  const maxDailyTokens = daysData.reduce((max, day) => Math.max(max, day.tokens), 0);

  return {
    days: daysData,
    totalTokens,
    activeDays,
    maxDailyTokens,
    windowDays: safeDays,
  };
}

export async function reserveUsage(userId, model) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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
      'SELECT COALESCE(SUM(greatest(units, 0)), 0)::int AS used, MIN(created_at) AS oldest_usage_at FROM usage WHERE user_id=$1 AND created_at >= $2 AND COALESCE(units, 0) > 0',
      [userId, start],
    );
    const used = Number(current.rows[0]?.used || 0);

    if (used >= limit) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'USAGE_LIMIT_REACHED',
        status: 429,
        usage: usageSnapshot(plan, used, current.rows[0]?.oldest_usage_at),
      };
    }

    const inserted = await client.query(
      `INSERT INTO usage (user_id, model, provider, tokens, units, created_at)
       VALUES ($1, $2, NULL, 0, 1, now())
       RETURNING id`,
      [userId, model || null],
    );
    await client.query('COMMIT');

    return {
      ok: true,
      reservationId: inserted.rows[0]?.id || null,
      usage: usageSnapshot(plan, used + 1, current.rows[0]?.oldest_usage_at || new Date()),
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseUsage(reservationId) {
  if (!reservationId) return false;
  const result = await pool.query(
    'UPDATE usage SET units=0 WHERE id=$1 AND COALESCE(units, 0) > 0 RETURNING id',
    [reservationId],
  );
  return Boolean(result.rows.length);
}

export async function recordTokens(reservationId, provider, tokens) {
  if (!reservationId) return;
  const amount = Number.isFinite(Number(tokens)) ? Math.max(0, Math.floor(Number(tokens))) : 0;
  await pool.query('UPDATE usage SET tokens=$1, provider=$2 WHERE id=$3', [amount, provider || null, reservationId]);
}

export async function getUsagePercent(userId) {
  const usage = await getUsage(userId);
  return usage?.percentage ?? 0;
}
