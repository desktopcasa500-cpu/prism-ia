import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { acquireTrafficSlot, trafficSnapshot, trafficStatusMessage } from '../services/traffic.js';

function isGenerationRequest(req) {
  if (req.method !== 'POST') return false;
  return /\/api\/chat\/sessions\/[^/]+\/messages$/.test(req.originalUrl || req.path || '') || /\/api\/ai\/generate(?:\/stream)?$/.test(req.originalUrl || req.path || '');
}

async function resolvePlan(req) {
  try {
    const secret = process.env.JWT_SECRET;
    const header = req.headers.authorization || '';
    if (!secret || !header.startsWith('Bearer ')) return 'free';
    const payload = jwt.verify(header.slice(7).trim(), secret, { algorithms: ['HS256'] });
    if (!payload?.sub) return 'free';
    const result = await pool.query('SELECT plan FROM users WHERE id=$1', [payload.sub]);
    return result.rows[0]?.plan || 'free';
  } catch {
    return 'free';
  }
}

export async function trafficGate(req, res, next) {
  if (!isGenerationRequest(req)) return next();
  const plan = await resolvePlan(req);
  const result = await acquireTrafficSlot(plan);
  if (!result.ok) {
    const retryAfter = Math.max(30, Number(result.traffic?.etaMinutes || 1) * 60);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(result.status || 503).json({ error: result.error, code: result.code, traffic: result.traffic });
  }
  res.setHeader('X-Prism-Traffic-Level', result.traffic.level);
  res.setHeader('X-Prism-Traffic-RPM', String(result.traffic.rpm));
  res.setHeader('X-Prism-Traffic-Limit', String(result.traffic.rpmLimit));
  const warning = trafficStatusMessage(result.traffic);
  if (warning) res.setHeader('X-Prism-Traffic-Warning', warning);
  let released = false;
  const release = () => { if (released) return; released = true; result.release?.(); };
  res.on('finish', release);
  res.on('close', release);
  req.on('aborted', release);
  return next();
}

export function trafficStatus() { return trafficSnapshot(); }
