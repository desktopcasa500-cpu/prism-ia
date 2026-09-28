import 'dotenv/config';
import { migrateDatabase } from './bootstrap.js';
import { pool } from './pool.js';

try {
  await migrateDatabase();
  console.log('Migração do banco concluída com sucesso.');
} catch (error) {
  console.error('Erro na migração:', {
    code: error?.code || 'DATABASE_MIGRATION_FAILED',
    message: error?.message || String(error),
  });
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
