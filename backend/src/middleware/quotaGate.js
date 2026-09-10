import jwt from 'jsonwebtoken';
import { getUsage, MODEL_REQUIREMENTS, normalizePlanRank } from '../services/usage.js';
import { pool } from '../db/pool.js';

function isGenerationRequest(req) {
  if (req.method !== 'POST') return false;
  return /\/api\/chat\/sessions\/[^/]+\/messages$/.test(req.originalUrl || '') || /\/api\/ai\/generate(?:\/stream)?$/.test(req.originalUrl || '');
}

async function userIdFromToken(req) {
  try {
    const secret = process.env.JWT_SECRET;
    const header = req.headers.authorization || '';
    if (!secret || !header.startsWith('Bearer ')) return null;
    const payload = jwt.verify(header.slice(7).trim(), secret, { algorithms: ['HS256'] });
    return typeof payload?.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function quotaGate(req, res, next) {
  if (!isGenerationRequest(req)) return next();
  const model = String(req.body?.model || '').trim();
  const requiredRank = MODEL_REQUIREMENTS[model];
  if (requiredRank === undefined || requiredRank < 2) return next();
  const userId = await userIdFromToken(req);
  if (!userId) return next();
  const account = await pool.query('SELECT plan FROM users WHERE id=$1', [userId]);
  if (!account.rows.length || normalizePlanRank(account.rows[0].plan) < requiredRank) return next();
  const usage = await getUsage(userId);
  if (!usage) return next();
  const dailyBlocked = Number(usage.daily?.remaining || 0) <= 0;
  const weeklyBlocked = Number(usage.weekly?.remaining || 0) <= 0;
  const canContinueWeekly = usage.canUseExtraFunds === true && Number(usage.extraFundsBalanceCents || 0) >= 1;
  if (dailyBlocked || (weeklyBlocked && !canContinueWeekly)) {
    return res.status(403).json({
      error: 'Adicione créditos para usar este modelo',
      code: 'MODEL_QUOTA_REQUIRED',
      requiredAction: 'upgrade',
      model,
      usage,
    });
  }
  return next();
}
