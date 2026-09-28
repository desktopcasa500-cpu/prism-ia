import express from 'express';
import app from './backend/src/app.js';
import { checkDatabase, migrateDatabase } from './backend/src/db/bootstrap.js';

// Keep Express visible in this entrypoint so Vercel's Express detector
// recognizes the application and deploys it as a single Node.js Function.
const server = express();

let initializationPromise = null;

function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      try {
        await checkDatabase();
        return { migrated: false };
      } catch (error) {
        const code = String(error?.code || '');
        const schemaMissing = ['42P01', '42703', '42704'].includes(code)
          || code === 'DATABASE_SCHEMA_MISMATCH';
        if (!schemaMissing) throw error;

        await migrateDatabase();
        await checkDatabase();
        return { migrated: true };
      }
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

server.use(async (_req, res, next) => {
  try {
    await initializeDatabase();
    return next();
  } catch (error) {
    const code = String(error?.code || 'DATABASE_INITIALIZATION_FAILED');
    console.error('Database initialization failed:', {
      code,
      message: error?.message || 'Database initialization failed',
    });
    if (res.headersSent) return undefined;
    return res.status(503).json({
      error: code === 'DATABASE_NOT_CONFIGURED'
        ? 'Banco de dados não configurado.'
        : 'Banco de dados indisponível ou fora de sincronia.',
      code,
    });
  }
});

server.use(app);

export default server;
