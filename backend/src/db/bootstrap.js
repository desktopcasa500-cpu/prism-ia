import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

let readyPromise = null;

function databaseConfigured() {
  return Boolean(
    process.env.DATABASE_URL
      || process.env.DATABASE
      || process.env.POSTGRES_URL
      || process.env.POSTGRES_PRISMA_URL,
  );
}

function databaseHost() {
  const raw = process.env.DATABASE_URL
    || process.env.DATABASE
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_PRISMA_URL
    || '';
  try { return new URL(raw).hostname; } catch { return 'desconhecido'; }
}

async function runSchemaMigration() {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  const attempts = Math.min(5, Math.max(1, Number(process.env.DB_STARTUP_ATTEMPTS || 3)));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT pg_advisory_lock(hashtext($1))', ['prism-ia-schema']);
        try {
          await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
          await client.query(schema);
          await client.query('SELECT 1');
        } finally {
          await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['prism-ia-schema']).catch(() => {});
        }
      } finally {
        client.release();
      }
      return;
    } catch (error) {
      lastError = error;
      const transient = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error?.code);
      if (!transient || attempt >= attempts) break;
      const delay = Math.min(4000, 500 * 2 ** (attempt - 1));
      console.error(`Banco indisponível (tentativa ${attempt}/${attempts}, código ${error.code}); nova tentativa em ${delay}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Banco de dados indisponível.');
}

export function ensureDatabase() {
  if (!databaseConfigured()) {
    return Promise.resolve({ configured: false, host: null });
  }
  if (!readyPromise) {
    readyPromise = runSchemaMigration()
      .then(() => ({ configured: true, host: databaseHost() }))
      .catch((error) => {
        readyPromise = null;
        throw error;
      });
  }
  return readyPromise;
}
