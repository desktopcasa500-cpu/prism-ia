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

async function shutdown(signal) {
  console.log(`Recebido ${signal}; encerrando Prism IA.`);
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
