import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';

const app = express();
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

app.get('/api/health', (_req, res) => {
  const databaseConfigured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
  res.status(databaseConfigured ? 200 : 503).json({
    ok: databaseConfigured,
    service: 'prism-api',
    database: databaseConfigured ? 'configured' : 'missing',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Endpoint não encontrado' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.message === 'Origem não permitida') return res.status(403).json({ error: 'Origem não permitida' });
  if (err?.code === 'DATABASE_NOT_CONFIGURED') {
    return res.status(503).json({ error: 'Banco de dados não configurado na Vercel. Adicione DATABASE_URL nas Environment Variables.' });
  }
  if (err?.message === 'JWT_SECRET não configurado') {
    return res.status(503).json({ error: 'JWT_SECRET não configurado na Vercel. Adicione JWT_SECRET nas Environment Variables.' });
  }
  return res.status(500).json({ error: 'Erro interno do servidor' });
});

export default app;
