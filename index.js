import express from 'express';
import app from './backend/src/app.js';
import { ensureDatabase } from './backend/src/db/bootstrap.js';

// Keep Express visible in this entrypoint so Vercel's Express detector
// recognizes the application and deploys it as a single Node.js Function.
const server = express();
server.use(async (_req, res, next) => {
  try {
    await ensureDatabase();
    return next();
  } catch (error) {
    console.error('Database bootstrap failed:', { code: error?.code, message: error?.message });
    if (res.headersSent) return undefined;
    return res.status(503).json({ error: 'Banco de dados temporariamente indisponível.', code: 'DATABASE_UNAVAILABLE' });
  }
});
server.use(app);

export default server;
