import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { pool } from './db/pool.js';
import { resetExpiredWeeklyLocks } from './services/weeklyUsageReset.js';
import { refreshNewsFromWeb, shouldRefreshNews } from './services/newsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

async function ensureDatabase() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
    console.warn('DATABASE_URL não configurada; recursos de conta ficarão indisponíveis.');
    return;
  }
  const schema = await fs.readFile(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(schema);
  await pool.query('SELECT 1');
  console.log('PostgreSQL conectado e schema verificado.');
}

const server = await ensureDatabase()
  .then(() => app.listen(port, host, () => console.log(`Prism IA listening on ${host}:${port}`)))
  .catch((error) => {
    console.error('Falha ao preparar banco:', error);
    process.exitCode = 1;
    return null;
  });

let resetJobTimer = null;
let newsJobTimer = null;
if (server) {
  const runResetJob = async () => {
    try {
      const resetCount = await resetExpiredWeeklyLocks();
      if (resetCount > 0) console.log(`Reset semanal: ${resetCount} conta(s) desbloqueada(s).`);
    } catch (error) {
      console.error('Falha no reset semanal:', error);
    }
  };
  const runNewsJob = async () => {
    try {
      if (!(await shouldRefreshNews())) return;
      const result = await refreshNewsFromWeb();
      if (result.status === 'ok') console.log(`Notícias atualizadas: ${result.count} item(ns).`);
      else if (result.status === 'error') console.error('Falha ao atualizar notícias:', result.error);
    } catch (error) {
      console.error('Falha no job de notícias:', error);
    }
  };
  await runResetJob();
  await runNewsJob();
  resetJobTimer = setInterval(runResetJob, 60_000);
  resetJobTimer.unref?.();
  // Verifica a cada hora se já passaram os 2 dias do último refresh; o próprio serviço decide se atualiza.
  newsJobTimer = setInterval(runNewsJob, 60 * 60 * 1000);
  newsJobTimer.unref?.();
}

async function shutdown(signal) {
  console.log(`Recebido ${signal}; encerrando Prism IA.`);
  if (resetJobTimer) clearInterval(resetJobTimer);
  if (newsJobTimer) clearInterval(newsJobTimer);
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end().catch(() => {});
  process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});
