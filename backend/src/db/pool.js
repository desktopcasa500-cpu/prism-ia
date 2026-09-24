import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

const missingDatabaseError = () => {
  const error = new Error('DATABASE_URL não configurada. Configure DATABASE_URL nas Environment Variables do serviço.');
  error.code = 'DATABASE_NOT_CONFIGURED';
  return error;
};

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
      connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 10000),
    })
  : {
      query: async () => { throw missingDatabaseError(); },
      connect: async () => { throw missingDatabaseError(); },
    };
