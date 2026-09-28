import pg from 'pg';

const { Pool } = pg;

function firstEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return { name, value };
  }
  return { name: null, value: '' };
}

const database = firstEnv(
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'DATABASE',
);

const databaseEnv = database.name;
const connectionString = database.value || null;

const missingDatabaseError = () => {
  const error = new Error(
    'Banco de dados não configurado. Defina DATABASE_URL (preferencial) ou uma das variáveis PostgreSQL suportadas.',
  );
  error.code = 'DATABASE_NOT_CONFIGURED';
  return error;
};

function envNumber(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

const isServerless = process.env.VERCEL === '1'
  || Boolean(process.env.VERCEL_URL)
  || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

const poolMax = envNumber('DB_POOL_MAX', isServerless ? 2 : 10, 1, 50);
const connectionTimeoutMillis = envNumber('DB_CONNECTION_TIMEOUT_MS', 8_000, 1_000, 30_000);
const idleTimeoutMillis = envNumber('DB_IDLE_TIMEOUT_MS', isServerless ? 15_000 : 30_000, 1_000, 120_000);

function requiresSsl(connection) {
  try {
    const url = new URL(connection);
    const sslMode = String(url.searchParams.get('sslmode') || '').toLowerCase();
    return Boolean(
      process.env.NODE_ENV === 'production'
        || isServerless
        || /(^|\\.)neon\.tech$/i.test(url.hostname)
        || ['require', 'verify-ca', 'verify-full'].includes(sslMode),
    );
  } catch {
    return process.env.NODE_ENV === 'production' || isServerless;
  }
}

const useSsl = requiresSsl(connectionString);

export { databaseEnv, connectionString };

export const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: poolMax,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      allowExitOnIdle: true,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      application_name: 'prism-ia',
    })
  : {
      query: async () => { throw missingDatabaseError(); },
      connect: async () => { throw missingDatabaseError(); },
      end: async () => {},
    };

if (connectionString && typeof pool.on === 'function') {
  pool.on('error', (error) => {
    console.error('Prism DB pool error:', {
      code: error?.code || 'POOL_ERROR',
      message: error?.message || 'Erro inesperado no pool PostgreSQL.',
    });
  });
}
