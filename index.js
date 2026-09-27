import express from 'express';
import app from './backend/src/app.js';

// Keep a direct Express import in the Vercel entrypoint so the platform
// recognizes this file as the Express backend entrypoint.
if (typeof express !== 'function') {
  throw new Error('Express não foi carregado corretamente.');
}

export default app;
