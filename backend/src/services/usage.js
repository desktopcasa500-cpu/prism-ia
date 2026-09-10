import { pool } from '../db/pool.js';
import { DEFAULT_TIMEZONE, normalizeTimeZone, nextWeeklyReset, startOfLocalDay, startOfLocalWeek } from './timezone.js';

export const USAGE_DAY_MS = 24 * 60 * 60 * 1000;
export const USAGE_WINDOW_HOURS = 24;
export const MIN_TOP_UP_CENTS = 500;
const EXTRA_REQUEST_COST_CENTS = 1;

export const PLAN_DAILY_CREDITS = Object.freeze({ 0: 5, 1: 30, 2: 700, 3: 2000, 4: 6000 });
export const PLAN_WEEKLY_CREDITS = Object.freeze({ 0: 100, 1: 500, 2: 3000, 3: 10000, 4: 30000 });

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
export function getDailyCredits(plan) { return PLAN_DAILY_CREDITS[normalizePlanRank(plan)]; }
export function getWeeklyCredits(plan) { return PLAN_WEEKLY_CREDITS[normalizePlanRank(plan)]; }
export function canUseExtraFunds(plan) { return normalizePlanRank(plan) >= 2; }
export function percentUsed(used, limit) { if (!Number.isFinite(limit) || limit <= 0) return 100; return Math.min(100, Math.max(0, Math.round((Number(used || 0) / limit) * 10000) / 100)); }

function dailyResetAt(now, oldestUsageAt) {
  if (oldestUsageAt) {
    const candidate = new Date(oldestUsageAt).getTime() + USAGE_DAY_MS;
    if (candidate > now.getTime()) return new Date(candidate);
  }
  return new Date(now.getTime() + USAGE_DAY_MS);
}

function snapshot(plan, timezone, dailyUsed, weeklyUsed, lockedUntil = null, now = new Date(), oldestDailyUsage = null, walletBalanceCents = 0) {
  const zone = normalizeTimeZone(timezone || DEFAULT_TIMEZONE);
  const dailyLimit = getDailyCredits(plan);
  const weeklyLimit = getWeeklyCredits(plan);
  const lockDate = lockedUntil ? new Date(lockedUntil) : null;
  const activeLock = lockDate && lockDate.getTime() > now.getTime() ? lockDate.toISOString() : null;
  const dailySafe = Math.max(0, Number(dailyUsed || 0));
  const weeklySafe = Math.max(0, Number(weeklyUsed || 0));
  const dailyReset = dailyResetAt(now, oldestDailyUsage);
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
    canUseExtraFunds: canUseExtraFunds(plan),
    extraFundsBalanceCents: Math.max(0, Number(walletBalanceCents || 0)),
    extraFundsMinimumCents: MIN_TOP_UP_CENTS,
  };
}

export async function getUsage(userId) {
  const userResult = await pool.query('SELECT plan, timezone, weekly_locked_until, wallet_balance_cents FROM users WHERE id=$1', [userId]);
  if (!userResult.rows.length) return null;
  const row = userResult.rows[0];
  const timezone = normalizeTimeZone(row.timezone);
  const now = new Date();
  const dailyStart = new Date(now.getTime() - USAGE_DAY_MS);
  const weeklyStart = startOfLocalWeek(now, timezone);
  const usageResult = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN created_at >= $2 THEN greatest(units, 0) ELSE 0 END), 0)::int AS daily_used,
            COALESCE(SUM(CASE WHEN created_at >= $3 THEN greatest(units, 0) ELSE 0 END), 0)::int AS weekly_used,
            MIN(CASE WHEN created_at >= $2 AND greatest(units, 0) > 0 THEN created_at END) AS oldest_daily_usage,
            MAX(created_at) AS latest_usage_at
       FROM usage WHERE user_id=$1`,
    [userId, dailyStart, weeklyStart],
  );
  const usage = usageResult.rows[0] || {};
  return { ...snapshot(row.plan, timezone, Number(usage.daily_used || 0), Number(usage.weekly_used || 0), row.weekly_locked_until, now, usage.oldest_daily_usage, row.wallet_balance_cents), lastUsedAt: usage.latest_usage_at ? new Date(usage.latest_usage_at).toISOString() : null };
}

export async function getDailyUsage(userId, days = 35) {
  const safeDays = Math.min(120, Math.max(7, Math.floor(Number(days) || 35)));
  const userResult = await pool.query('SELECT timezone FROM users WHERE id=$1', [userId]);
  if (!userResult.rows.length) return { days: [], totalTokens: 0, activeDays: 0, maxDailyTokens: 0, windowDays: safeDays };
  const timezone = normalizeTimeZone(userResult.rows[0].timezone);
  const localTodayStart = startOfLocalDay(new Date(), timezone);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
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
    [userId, localTodayStart, safeDays],
  );
  const daysData = result.rows.map((row) => ({ day: formatter.format(new Date(row.day_start)), tokens: Math.max(0, Number(row.tokens || 0)), requests: Math.max(0, Number(row.requests || 0)), active: Number(row.tokens || 0) > 0 || Number(row.requests || 0) > 0 }));
  return { days: daysData, totalTokens: daysData.reduce((sum, day) => sum + day.tokens, 0), activeDays: daysData.reduce((sum, day) => sum + (day.active ? 1 : 0), 0), maxDailyTokens: daysData.reduce((max, day) => Math.max(max, day.tokens), 0), windowDays: safeDays, timezone };
}

export async function reserveUsage(userId, model) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(userId)]);
    const userResult = await client.query('SELECT plan, timezone, weekly_locked_until, wallet_balance_cents FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!userResult.rows.length) { await client.query('ROLLBACK'); return { ok: false, code: 'AUTH_REQUIRED', status: 401 }; }
    const { plan, timezone: storedTimezone, weekly_locked_until: existingLock } = userResult.rows[0];
    const timezone = normalizeTimeZone(storedTimezone);
    const rank = normalizePlanRank(plan);
    const now = new Date();
    const walletBalance = Math.max(0, Number(userResult.rows[0].wallet_balance_cents || 0));
    const lockTime = existingLock ? new Date(existingLock) : null;
    const weeklyStart = startOfLocalWeek(now, timezone);
    const dailyStart = new Date(now.getTime() - USAGE_DAY_MS);
    const dailyLimit = getDailyCredits(plan);
    const weeklyLimit = getWeeklyCredits(plan);
    const usage = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN created_at >= $2 THEN greatest(units, 0) ELSE 0 END), 0)::int AS daily_used,
              COALESCE(SUM(CASE WHEN created_at >= $3 THEN greatest(units, 0) ELSE 0 END), 0)::int AS weekly_used,
              MIN(CASE WHEN created_at >= $2 AND greatest(units, 0) > 0 THEN created_at END) AS oldest_daily_usage
         FROM usage WHERE user_id=$1`,
      [userId, dailyStart, weeklyStart],
    );
    const dailyUsed = Number(usage.rows[0]?.daily_used || 0);
    const weeklyUsed = Number(usage.rows[0]?.weekly_used || 0);
    const oldestDailyUsage = usage.rows[0]?.oldest_daily_usage || null;
    const currentUsage = (lock = null, balance = walletBalance) => snapshot(plan, timezone, dailyUsed, weeklyUsed, lock, now, oldestDailyUsage, balance);

    if (dailyUsed >= dailyLimit) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'DAILY_CREDITS_EXHAUSTED', status: 429, usage: currentUsage(), canUseExtraFunds: false };
    }

    const weeklyLocked = lockTime && lockTime.getTime() > now.getTime();
    if (weeklyLocked && canUseExtraFunds(plan) && walletBalance >= EXTRA_REQUEST_COST_CENTS) {
      const charged = await client.query('UPDATE users SET wallet_balance_cents=wallet_balance_cents-$2, weekly_locked_until=NULL WHERE id=$1 AND wallet_balance_cents >= $2 RETURNING wallet_balance_cents', [userId, EXTRA_REQUEST_COST_CENTS]);
      if (charged.rows.length) {
        const inserted = await client.query('INSERT INTO usage (user_id, model, provider, tokens, units, created_at) VALUES ($1, $2, NULL, 0, 1, now()) RETURNING id', [userId, model || null]);
        await client.query('COMMIT');
        const balance = Number(charged.rows[0].wallet_balance_cents || 0);
        return { ok: true, reservationId: inserted.rows[0]?.id || null, extraFundsUsed: true, usage: snapshot(plan, timezone, dailyUsed + 1, weeklyUsed + 1, null, now, oldestDailyUsage || now, balance) };
      }
    }

    if (weeklyUsed >= weeklyLimit) {
      if (rank >= 2 && walletBalance >= EXTRA_REQUEST_COST_CENTS) {
        const charged = await client.query('UPDATE users SET wallet_balance_cents=wallet_balance_cents-$2, weekly_locked_until=NULL WHERE id=$1 AND wallet_balance_cents >= $2 RETURNING wallet_balance_cents', [userId, EXTRA_REQUEST_COST_CENTS]);
        if (charged.rows.length) {
          const inserted = await client.query('INSERT INTO usage (user_id, model, provider, tokens, units, created_at) VALUES ($1, $2, NULL, 0, 1, now()) RETURNING id', [userId, model || null]);
          await client.query('COMMIT');
          const balance = Number(charged.rows[0].wallet_balance_cents || 0);
          return { ok: true, reservationId: inserted.rows[0]?.id || null, extraFundsUsed: true, usage: snapshot(plan, timezone, dailyUsed + 1, weeklyUsed + 1, null, now, oldestDailyUsage || now, balance) };
        }
      }
      const until = nextWeeklyReset(now, timezone);
      await client.query('UPDATE users SET weekly_locked_until=$2 WHERE id=$1', [userId, until]);
      await client.query('COMMIT');
      return { ok: false, code: 'WEEKLY_USAGE_LOCKED', status: 429, usage: currentUsage(until), canUseExtraFunds: rank >= 2 };
    }

    const inserted = await client.query('INSERT INTO usage (user_id, model, provider, tokens, units, created_at) VALUES ($1, $2, NULL, 0, 1, now()) RETURNING id', [userId, model || null]);
    await client.query('COMMIT');
    return { ok: true, reservationId: inserted.rows[0]?.id || null, usage: snapshot(plan, timezone, dailyUsed + 1, weeklyUsed + 1, null, now, oldestDailyUsage || now, walletBalance) };
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
  return { plan: result.rows[0].plan, balanceCents: Math.max(0, Number(result.rows[0].wallet_balance_cents || 0)), lockedUntil: result.rows[0].weekly_locked_until ? new Date(result.rows[0].weekly_locked_until).toISOString() : null, canUseExtraFunds: canUseExtraFunds(result.rows[0].plan), minimumTopUpCents: MIN_TOP_UP_CENTS, extraRequestCostCents: EXTRA_REQUEST_COST_CENTS };
}

export async function simulateTopUp(userId, amountCents) {
  const amount = Math.floor(Number(amountCents));
  if (!Number.isFinite(amount) || amount < MIN_TOP_UP_CENTS) return { ok: false, code: 'MIN_TOP_UP', status: 400, minimumTopUpCents: MIN_TOP_UP_CENTS };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT plan FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!user.rows.length) { await client.query('ROLLBACK'); return { ok: false, code: 'AUTH_REQUIRED', status: 401 }; }
    if (!canUseExtraFunds(user.rows[0].plan)) { await client.query('ROLLBACK'); return { ok: false, code: 'TOP_UP_NOT_AVAILABLE', status: 403 }; }
    const updated = await client.query('UPDATE users SET wallet_balance_cents=wallet_balance_cents+$2, weekly_locked_until=NULL WHERE id=$1 RETURNING wallet_balance_cents, weekly_locked_until', [userId, amount]);
    await client.query('COMMIT');
    return { ok: true, balanceCents: Number(updated.rows[0].wallet_balance_cents || 0), lockedUntil: updated.rows[0].weekly_locked_until };
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }
}
