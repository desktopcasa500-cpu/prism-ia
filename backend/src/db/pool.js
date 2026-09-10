import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

const missingDatabaseError = () => {
  const error = new Error('Banco de dados não configurado. Defina DATABASE_URL, POSTGRES_URL ou POSTGRES_PRISMA_URL no ambiente do serviço.');
  error.code = 'DATABASE_NOT_CONFIGURED';
  return error;
};

export const pool = connectionString
  ? new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30_000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 8_000),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : {
      query: async () => { throw missingDatabaseError(); },
      connect: async () => { throw missingDatabaseError(); },
    };
