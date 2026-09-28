import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { pool } from './db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.DATABASE || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL);
}

function databaseHost() {
  const raw = process.env.DATABASE_URL || process.env.DATABASE || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
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
        console.error(`Não foi possível resolver o host PostgreSQL "${host}". Verifique se DATABASE_URL aponta para a connection string correta do PostgreSQL e se o serviço consegue alcançar o banco.`);
      }
      throw error;
    }
  }
}

const server = app.listen(port, host, () => console.log(`Prism IA listening on ${host}:${port}`));

let shuttingDown = false;

ensureDatabase().catch((error) => {
  console.error('Banco permanece indisponível após a inicialização:', {
    code: error?.code || 'DATABASE_UNAVAILABLE',
    host: databaseHost(),
  });
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Recebido ${signal}; encerrando Prism IA.`);
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
