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

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}

function databaseHost() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
  try { return new URL(raw).hostname; } catch { return 'desconhecido'; }
}

async function ensureDatabase() {
  if (!databaseConfigured()) {
    console.warn('DATABASE_URL não configurada; o serviço será iniciado sem recursos dependentes do banco.');
    return;
  }

  const schema = await fs.readFile(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
  const attempts = Math.max(1, Number(process.env.DB_STARTUP_ATTEMPTS || 5));

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
      await pool.query(schema);
      await pool.query('SELECT 1');
      console.log('PostgreSQL conectado e schema verificado.');
      return;
    } catch (error) {
      const host = databaseHost();
      const transient = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code);
      if (transient && attempt < attempts) {
        const delay = Math.min(10_000, 1000 * 2 ** (attempt - 1));
        console.error(`Banco indisponível (tentativa ${attempt}/${attempts}, host ${host}, código ${error.code}). Nova tentativa em ${delay}ms.`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (error?.code === 'ENOTFOUND') {
        console.error(`Não foi possível resolver o host PostgreSQL "${host}". Em Render, verifique se DATABASE_URL usa a Internal Database URL da instância Postgres correta e se o serviço e o banco estão no mesmo workspace/região.`);
      }
      throw error;
    }
  }
}

const server = app.listen(port, host, () => console.log(`Prism IA listening on ${host}:${port}`));

let resetJobTimer = null;
let newsJobTimer = null;
let shuttingDown = false;
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

ensureDatabase()
  .then(async () => {
    await runResetJob();
    await runNewsJob();
    resetJobTimer = setInterval(runResetJob, 60_000);
    resetJobTimer.unref?.();
    newsJobTimer = setInterval(runNewsJob, 60 * 60 * 1000);
    newsJobTimer.unref?.();
  })
  .catch((error) => {
    console.error('Banco permanece indisponível após as tentativas de inicialização:', error);
  });

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Recebido ${signal}; encerrando Prism IA.`);
  if (resetJobTimer) clearInterval(resetJobTimer);
  if (newsJobTimer) clearInterval(newsJobTimer);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref?.();
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error('Falha durante shutdown:', error);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});
