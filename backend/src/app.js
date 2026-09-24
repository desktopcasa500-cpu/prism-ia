import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import parallelRoutes from './routes/parallel.js';
import skillsRoutes from './routes/skills.js';
import modelsRoutes from './routes/models.js';
import projectsRoutes from './routes/projects.js';
import projectDownloadRoutes from './routes/projectDownload.js';
import filesRoutes from './routes/files.js';
import uploadsRoutes from './routes/uploads.js';
import aiRoutes from './routes/ai.js';
import mcpRoutes from './routes/mcp.js';
import billingRoutes from './routes/billing.js';
import trafficRoutes from './routes/traffic.js';
import buildRoutes from './routes/builds.js';
import newsRoutes from './routes/news.js';
import { trafficGate } from './middleware/trafficGate.js';
import { quotaGate } from './middleware/quotaGate.js';
import { handleStripeWebhook } from './services/stripe.js';
import { pool } from './db/pool.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');
const allowedOrigins = (process.env.FRONTEND_ORIGIN || process.env.APP_URL || '')
  .split(',').map((value) => value.trim().replace(/\/$/, '')).filter(Boolean);

function sameOrigin(req, origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (allowedOrigins.length) return false;
  return origin === (req.protocol + '://' + req.get('host')).replace(/\/$/, '');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use((req, res, next) => {
  req.requestId = String(req.headers['x-request-id'] || randomUUID()).slice(0, 120);
  res.setHeader('X-Request-Id', req.requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    if (req.path === '/api/health') return;
    if (process.env.PRISM_HTTP_LOGS === 'false') return;
    console.log(JSON.stringify({
      event: 'http_request',
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      elapsedMs: Date.now() - startedAt,
    }));
  });
  next();
});

app.use((req, res, next) => cors({
  origin(origin, callback) {
    if (sameOrigin(req, origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','Stripe-Signature','X-Request-Id'],
})(req, res, next));
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => { const result = await handleStripeWebhook(req.body, req.headers['stripe-signature']); if (!result.ok) return res.status(result.status || 400).json({ error: result.error || 'Webhook inválido.', code: result.code }); return res.json({ received: true, eventType: result.eventType }); });
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
const limitHandler = (_req, res) => res.status(429).json({ error: 'Muitas solicitações. Aguarde um momento e tente novamente.', code: 'IP_RATE_LIMIT' });
const apiLimiter = rateLimit({ windowMs: 60_000, max: Number(process.env.PRISM_IP_RATE_LIMIT || 120), standardHeaders: 'draft-7', legacyHeaders: false, handler: limitHandler });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: Number(process.env.PRISM_AUTH_RATE_LIMIT || 30), standardHeaders: 'draft-7', legacyHeaders: false, handler: (_req, res) => res.status(429).json({ error: 'Muitas tentativas de autenticação. Aguarde alguns minutos.', code: 'AUTH_RATE_LIMIT' }) });
const generationLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.PRISM_GENERATION_RATE_LIMIT || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => !/\/api\/(?:chat\/sessions\/[^/]+\/messages(?:\/stream)?|chat\/parallel|ai\/generate(?:\/stream)?)$/.test(req.path || ''),
  handler: limitHandler,
});
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use(generationLimiter);
app.use(trafficGate);
app.use(quotaGate);
app.get('/api/health', async (_req, res) => { try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected', auth: Boolean(process.env.JWT_SECRET), ai: Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY || process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY || process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY || process.env.OPENROUTER_API_KEY), mcp: Boolean(process.env.MCP_ENCRYPTION_KEY), web: true, stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.PRISM_STRIPE_ENABLED === 'true') }); } catch { res.status(503).json({ ok: false, database: 'unreachable', auth: Boolean(process.env.JWT_SECRET), ai: Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY || process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY || process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY || process.env.OPENROUTER_API_KEY), mcp: Boolean(process.env.MCP_ENCRYPTION_KEY), stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.PRISM_STRIPE_ENABLED === 'true') }); } });
app.use('/api/auth', authRoutes); app.use('/api/user', userRoutes); app.use('/api/chat', chatRoutes); app.use('/api/chat/parallel', parallelRoutes); app.use('/api/skills', skillsRoutes); app.use('/api/models', modelsRoutes); app.use('/api/projects', projectsRoutes); app.use('/api/projects', projectDownloadRoutes); app.use('/api/files', filesRoutes); app.use('/api/uploads', uploadsRoutes); app.use('/api/ai', aiRoutes); app.use('/api/mcp', mcpRoutes); app.use('/api/billing', billingRoutes); app.use('/api/traffic', trafficRoutes); app.use('/api/builds', buildRoutes); app.use('/api/news', newsRoutes);
app.use(express.static(distPath, { index: false }));
app.get('*', (req, res, next) => { if (req.path.startsWith('/api/')) return next(); return res.sendFile(path.join(distPath, 'index.html'), (error) => { if (error) next(error); }); });
app.use((req, res) => res.status(404).json({ error: 'Endpoint não encontrado.', code: 'NOT_FOUND', requestId: req.requestId }));
app.use((err, req, res, _next) => { const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500; const message = status >= 500 ? 'Erro interno do servidor.' : (err?.message || 'Solicitação inválida.'); console.error('Prism API error:', { requestId: req.requestId, method: req.method, path: req.path, status, code: err?.code || 'SERVER_ERROR', message: err?.message || String(err) }); if (res.headersSent) return; res.status(status).json({ error: message, code: err?.code || 'SERVER_ERROR', requestId: req.requestId }); });
export default app;
