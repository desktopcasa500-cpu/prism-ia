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
