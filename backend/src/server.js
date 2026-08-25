import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const distDir = path.join(rootDir, 'dist');

// Keep the API under Express, but serve the production Vite build from the same
// Render web service. This avoids needing a second frontend service.
app.use(express.static(distDir, { index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(distDir, 'index.html'), (error) => {
    if (error) next(error);
  });
});

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`Prism IA listening on ${host}:${port}`);
});
