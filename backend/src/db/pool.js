import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

export function requirePool() {
  if (!pool) {
    const error = new Error('Banco de dados não configurado. Defina DATABASE_URL (ou POSTGRES_URL) nas variáveis de ambiente da Vercel.');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }
  return pool;
}
