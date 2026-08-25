import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

const missingDatabaseError = () => {
  const error = new Error('DATABASE_URL não configurada. Adicione DATABASE_URL nas Environment Variables da Vercel.');
  error.code = 'DATABASE_NOT_CONFIGURED';
  return error;
};

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : {
      query: async () => { throw missingDatabaseError(); },
      connect: async () => { throw missingDatabaseError(); },
    };
