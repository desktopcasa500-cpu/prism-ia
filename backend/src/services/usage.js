import { pool } from '../db/pool.js';
import { DEFAULT_TIMEZONE, normalizeTimeZone, nextWeeklyReset, startOfLocalDay, startOfLocalWeek } from './timezone.js';

export const USAGE_DAY_MS = 24 * 60 * 60 * 1000;
export const USAGE_WEEK_MS = 7 * USAGE_DAY_MS;
export const USAGE_WINDOW_HOURS = 24;

export const PLAN_DAILY_CREDITS = {
  0: Number(process.env.PRISM_FREE_DAILY_CREDITS || 100),
  1: Number(process.env.PRISM_BASE_DAILY_CREDITS || 500),
  2: Number(process.env.PRISM_MEDIUM_DAILY_CREDITS || 3000),
  3: Number(process.env.PRISM_PRO_DAILY_CREDITS || 10000),
  4: Number(process.env.PRISM_ENTERPRISE_DAILY_CREDITS || 30000),
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
export function getDailyCredits(plan) { const value = PLAN_DAILY_CREDITS[normalizePlanRank(plan)]; return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1; }
export function getWeeklyCredits(plan) { return getDailyCredits(plan) * 7; }

function snapshot(plan, timezone, dailyUsed, weeklyUsed, lockedUntil = null, now = new Date()) {
  const zone = normalizeTimeZone(timezone || DEFAULT_TIMEZONE);
  const dailyLimit = getDailyCredits(plan);
  const weeklyLimit = getWeeklyCredits(plan);
  const lockDate = lockedUntil ? new Date(lockedUntil) : null;
  const activeLock = lockDate && lockDate.getTime() > now.getTime() ? lockDate.toISOString() : null;
  const dailySafe = Math.max(0, Number(dailyUsed || 0));
  const weeklySafe = Math.max(0, Number(weeklyUsed || 0));
  const dailyReset = new Date(startOfLocalDay(new Date(now.getTime() + USAGE_DAY_MS), zone));
  const weeklyReset = nextWeeklyReset(now, zone);
  return {
    plan,
    planRank: normalizePlanRank(plan),
    timezone: zone,
    windowHours: USAGE_WINDOW_HOURS,
    used: dailySafe,
    limit: dailyLimit,
    percentage: percentUsed(dailySafe, dailyLimit),
    remaining: Math.max(0, dailyLimit - dailySafe),
    resetsAt: dailyReset.toISOString(),
    daily: { used: dailySafe, limit: dailyLimit, remaining: Math.max(0, dailyLimit - dailySafe), percentage: percentUsed(dailySafe, dailyLimit), resetsAt: dailyReset.toISOString() },
    weekly: { used: weeklySafe, limit: weeklyLimit, remaining: Math.max(0, weeklyLimit - weeklySafe), percentage: percentUsed(weeklySafe, weeklyLimit), resetsAt: weeklyReset.toISOString() },
    lockedUntil: activeLock,
    canUseExtraFunds: normalizePlanRank(plan) >= 3,
  };
}

export function percentUsed(used, limit) { if (!Number.isFinite(limit) || limit <= 0) return 100; return Math.min(100, Math.max(0, Math.round((Number(used || 0) / limit) * 10000) / 100)); }

export async function getUsage(userId) {
  const result = await pool.query(
    `SELECT u.plan, u.timezone, u.weekly_locked_until,
            COALESCE(SUM(CASE WHEN us.created_at >= $2 THEN greatest(us.units, 0) ELSE 0 END), 0)::int AS daily_used,
            COALESCE(SUM(greatest(us.units, 0)), 0)::int AS weekly_used,
            MAX(us.created_at) AS latest_usage_at
       FROM users u
       LEFT JOIN usage us ON us.user_id = u.id AND us.created_at >= $3 AND COALESCE(us.units, 0) > 0
      WHERE u.id = $1
      GROUP BY u.id, u.plan, u.timezone, u.weekly_locked_until`,
    async () => {},
  );
  return null;
}

export async function getUsage(userId) {
  const userResult = await pool.query('SELECT plan, timezone, weekly_locked_until FROM users WHERE id=$1', [userId]);
  if (!userResult.rows.length) return null;
  const row = userResult.rows[0];
  const timezone = normalizeTimeZone(row.timezone);
  const dailyStart = startOfLocalDay(new Date(), timezone);
  const weeklyStart = startOfLocalWeek(new Date(), timezone);
  const usageResult = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN created_at >= $2 THEN greatest(units, 0) ELSE 0 END), 0)::int AS daily_used,
            COALESCE(SUM(CASE WHEN created_at >= $3 THEN greatest(units, 0) ELSE 0 END), 0)::int AS weekly_used,
            MAX(created_at) AS latest_usage_at
       FROM usage WHERE user_id=$1`,
    [userId, dailyStart, weeklyStart],
  );
  const usage = usageResult.rows[0] || {};
  return { ...snapshot(row.plan, timezone, Number(usage.daily_used || 0), Number(usage.weekly_used || 0), row.weekly_locked_until), lastUsedAt: usage.latest_usage_at ? new Date(usage.latest_usage_at).toISOString() : null };
}

export async function getDailyUsage(userId, days = 35) {
  const safeDays = Math.min(120, Math.max(7, Math.floor(Number(days) || 35)));
  const userResult = await pool.query('SELECT timezone FROM users WHERE id=$1', [userId]);
  if (!userResult.rows.length) return { days: [], totalTokens: 0, activeDays: 0, maxDailyTokens: 0, windowDays: safeDays };
  const timezone = normalizeTimeZone(userResult.rows[0].timezone);
  const dayStart = startOfLocalDay(new Date(), timezone);
  const result = await pool.query(
    `WITH days AS (
       SELECT generate_series($2::timestamptz - (($3 - 1) * interval '1 day'), $2::timestamptz, interval '1 day') AS day_start
     )
     SELECT days.day_start,
            COALESCE(SUM(greatest(us.tokens, 0)), 0)::bigint AS tokens,
            COALESCE(SUM(greatest(us.units, 0)), 0)::int AS requests
       FROM days
       LEFT JOIN usage us ON us.user_id=$1 AND us.created_at >= days.day_start AND us.created_at < days.day_start + interval '1 day'
      GROUP BY days.day_start ORDER BY days.day_start ASC`,
    [userId, dayStart, safeDays],
  );
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const daysData = result.rows.map((row) => ({ day: formatter.format(new Date(row.day_start)), tokens: Math.max(0, Number(row.tokens || 0)), requests: Math.max(0, Number(row.requests || 0)), active: Number(row.tokens || 0) > 0 || Number(row.requests || 0) > 0 }));
  return { days: daysData, totalTokens: daysData.reduce((sum, day) => sum + day.tokens, 0), activeDays: daysData.reduce((sum, day) => sum + (day.active ? 1 : 0), 0), maxDailyTokens: daysData.reduce((max, day) => Math.max(max, day.tokens), 0), windowDays: safeDays, timezone };
}

export async function reserveUsage(userId, model) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(userId)]);
    const userResult = await client.query('SELECT plan, timezone, weekly_locked_until FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!userResult.rows.length) { await client.query('ROLLBACK'); return { ok: false, code: 'AUTH_REQUIRED', status: 401 }; }
    const { plan, timezone: storedTimezone, weekly_locked_until: existingLock } = userResult.rows[0];
    const timezone = normalizeTimeZone(storedTimezone);
    const rank = normalizePlanRank(plan);
    const now = new Date();
    const lockTime = existingLock ? new Date(existingLock) : null;
    const weeklyStart = startOfLocalWeek(now, timezone);
    const dailyStart = startOfLocalDay(now, timezone);

    if (lockTime && lockTime.getTime() > now.getTime()) {
      const currentWeekly = await client.query('SELECT COALESCE(SUM(greatest(units, 0)), 0)::int AS used FROM usage WHERE user_id=$1 AND created_at >= $2', [userId, weeklyStart]);
      const currentDaily = await client.query('SELECT COALESCE(SUM(greatest(units, 0)), 0)::int AS used FROM usage WHERE user_id=$1 AND created_at >= $2', [userId, dailyStart]);
      await client.query('ROLLBACK');
      return { ok: false, code: 'WEEKLY_USAGE_LOCKED', status: 429, usage: snapshot(plan, timezone, Number(currentDaily.rows[0]?.used || 0), Number(currentWeekly.rows[0]?.used || 0), lockTime, now), canUseExtraFunds: rank >= 3 };
    }
    if (lockTime && lockTime.getTime() <= now.getTime()) await client.query('UPDATE users SET weekly_locked_until=NULL WHERE id=$1', [userId]);

    const dailyLimit = getDailyCredits(plan);
    const weeklyLimit = getWeeklyCredits(plan);
    const daily = await client.query('SELECT COALESCE(SUM(greatest(units, 0)), 0)::int AS used FROM usage WHERE user_id=$1 AND created_at >= $2', [userId, dailyStart]);
    const weekly = await client.query('SELECT COALESCE(SUM(greatest(units, 0)), 0)::int AS used FROM usage WHERE user_id=$1 AND created_at >= $2', [userId, weeklyStart]);
    const dailyUsed = Number(daily.rows[0]?.used || 0);
    const weeklyUsed = Number(weekly.rows[0]?.used || 0);

    if (weeklyUsed >= weeklyLimit) {
      const until = nextWeeklyReset(now, timezone);
      await client.query('UPDATE users SET weekly_locked_until=$2 WHERE id=$1', [userId, until]);
      const usage = snapshot(plan, timezone, dailyUsed, weeklyUsed, until, now);
      await client.query('COMMIT');
      return { ok: false, code: 'WEEKLY_USAGE_LOCKED', status: 429, usage, canUseExtraFunds: rank >= 3 };
    }
    if (dailyUsed >= dailyLimit) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'DAILY_CREDITS_EXHAUSTED', status: 429, usage: snapshot(plan, timezone, dailyUsed, weeklyUsed, null, now), canUseExtraFunds: false };
    }

    const inserted = await client.query('INSERT INTO usage (user_id, model, provider, tokens, units, created_at) VALUES ($1, $2, NULL, 0, 1, now()) RETURNING id', [userId, model || null]);
    await client.query('COMMIT');
    return { ok: true, reservationId: inserted.rows[0]?.id || null, usage: snapshot(plan, timezone, dailyUsed + 1, weeklyUsed + 1, null, now) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

export async function releaseUsage(reservationId) {
  if (!reservationId) return false;
  const result = await pool.query('UPDATE usage SET units=0 WHERE id=$1 AND COALESCE(units, 0) > 0 RETURNING id', [reservationId]);
  return Boolean(result.rows.length);
}

export async function recordTokens(reservationId, provider, tokens) {
  if (!reservationId) return;
  const amount = Number.isFinite(Number(tokens)) ? Math.max(0, Math.floor(Number(tokens))) : 0;
  await pool.query('UPDATE usage SET tokens=$1, provider=$2 WHERE id=$3', [amount, provider || null, reservationId]);
}

export async function getUsagePercent(userId) { const usage = await getUsage(userId); return usage?.daily?.percentage ?? usage?.percentage ?? 0; }

export async function getWallet(userId) {
  const result = await pool.query('SELECT plan, wallet_balance_cents, weekly_locked_until FROM users WHERE id=$1', [userId]);
  if (!result.rows.length) return null;
  return { plan: result.rows[0].plan, balanceCents: Math.max(0, Number(result.rows[0].wallet_balance_cents || 0)), lockedUntil: result.rows[0].weekly_locked_until ? new Date(result.rows[0].weekly_locked_until).toISOString() : null, canUseExtraFunds: normalizePlanRank(result.rows[0].plan) >= 3, minimumTopUpCents: 500 };
}

export async function simulateTopUp(userId, amountCents) {
  const amount = Math.floor(Number(amountCents));
  if (!Number.isFinite(amount) || amount < 500) return { ok: false, code: 'MIN_TOP_UP', status: 400, minimumTopUpCents: 500 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT plan FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!user.rows.length) { await client.query('ROLLBACK'); return { ok: false, code: 'AUTH_REQUIRED', status: 401 }; }
    if (normalizePlanRank(user.rows[0].plan) < 3) { await client.query('ROLLBACK'); return { ok: false, code: 'TOP_UP_NOT_AVAILABLE', status: 403 }; }
    const updated = await client.query('UPDATE users SET wallet_balance_cents=wallet_balance_cents+$2, weekly_locked_until=NULL WHERE id=$1 RETURNING wallet_balance_cents, weekly_locked_until', [userId, amount]);
    await client.query('COMMIT');
    return { ok: true, balanceCents: Number(updated.rows[0].wallet_balance_cents || 0), lockedUntil: updated.rows[0].weekly_locked_until };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
