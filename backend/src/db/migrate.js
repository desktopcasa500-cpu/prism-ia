import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await pool.query(sql);
  console.log('Migração concluída.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
