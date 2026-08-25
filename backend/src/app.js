import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import { pool } from './db/pool.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');

const allowedOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origem não permitida'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', async (_req, res) => {
  const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
  if (!databaseConfigured) {
    return res.status(503).json({ ok: false, service: 'prism-api', database: 'missing' });
  }

  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ ok: true, service: 'prism-api', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed:', error);
    return res.status(503).json({ ok: false, service: 'prism-api', database: 'unreachable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);

app.use(express.static(distPath, { index: false }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.message === 'Origem não permitida') return res.status(403).json({ error: 'Origem não permitida' });
  if (err?.code === 'DATABASE_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Banco de dados não configurado. Adicione DATABASE_URL ao Web Service do backend.' });
  }
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED' || err?.code === 'ECONNRESET') {
    return res.status(503).json({ error: 'Não foi possível conectar ao banco de dados.' });
  }
  if (err?.message === 'JWT_SECRET não configurado') {
    return res.status(503).json({ error: 'JWT_SECRET não configurado. Adicione JWT_SECRET ao Web Service do backend.' });
  }
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

export default app;
