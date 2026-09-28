import 'dotenv/config';
import app from './app.js';
import { pool } from './db/pool.js';
import { ensureDatabase } from './db/bootstrap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

let server = null;
let shuttingDown = false;

try {
  await ensureDatabase();
  server = app.listen(port, host, () => console.log(`Prism IA listening on ${host}:${port}`));
} catch (error) {
  console.error('Banco indisponível; servidor não foi iniciado:', {
    code: error?.code || 'DATABASE_UNAVAILABLE',
    message: error?.message || 'DATABASE_UNAVAILABLE',
  });
  process.exitCode = 1;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Recebido ${signal}; encerrando Prism IA.`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref?.();
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end().catch(() => {});
    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error('Falha durante shutdown:', error);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException').catch(() => process.exit(1));
});
