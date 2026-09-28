import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

let readyPromise = null;

function databaseConfigured() {
  return Boolean(
    process.env.DATABASE_URL
      || process.env.POSTGRES_URL
      || process.env.POSTGRES_PRISMA_URL
      || process.env.POSTGRES_URL_NON_POOLING
      || process.env.DATABASE,
  );
}

function databaseHost() {
  const raw = process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_PRISMA_URL
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE
    || '';
  try { return new URL(raw).hostname; } catch { return null; }
}

function isTransientDatabaseError(error) {
  return new Set([
    '08000', '08001', '08003', '08004', '08006',
    '57P01', '57P02', '57P03', '53300',
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND',
  ]).has(String(error?.code || ''));
}

async function readSchema() {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
  return fs.readFile(schemaPath, 'utf8');
}

export async function checkDatabase() {
  if (!databaseConfigured()) {
    const error = new Error('Banco de dados não configurado.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  const result = await pool.query('SELECT current_database() AS database, current_user AS user, now() AS now');
  return {
    configured: true,
    host: databaseHost(),
    database: result.rows[0]?.database || null,
    user: result.rows[0]?.user || null,
    now: result.rows[0]?.now || null,
  };
}

export async function migrateDatabase() {
  if (!databaseConfigured()) {
    const error = new Error('Banco de dados não configurado.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  const schema = await readSchema();
  const attempts = Math.min(5, Math.max(1, Number(process.env.DB_MIGRATION_ATTEMPTS || 3)));
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['prism-ia-schema']);
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
      await client.query(schema);
      await client.query('COMMIT');
      return {
        configured: true,
        host: databaseHost(),
      };
    } catch (error) {
      lastError = error;
      await client?.query('ROLLBACK').catch(() => {});
      const retryable = isTransientDatabaseError(error);
      if (!retryable || attempt >= attempts) break;
      const delay = Math.min(4_000, 500 * 2 ** (attempt - 1));
      console.error('Prism DB migration retry:', {
        attempt,
        maxAttempts: attempts,
        code: error?.code || 'DB_ERROR',
        delayMs: delay,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      client?.release();
    }
  }

  throw lastError || Object.assign(new Error('Migração do banco falhou.'), { code: 'DATABASE_MIGRATION_FAILED' });
}

/**
 * Traditional backend startup path.
 * Vercel calls migrateDatabase() during build and only checks the connection at runtime.
 */
export async function ensureDatabase({ migrate = true } = {}) {
  if (!databaseConfigured()) return { configured: false, host: null };

  if (!migrate) return checkDatabase();

  if (!readyPromise) {
    readyPromise = migrateDatabase()
      .then((result) => ({ ...result, ready: true }))
      .catch((error) => {
        readyPromise = null;
        throw error;
      });
  }

  return readyPromise;
}
