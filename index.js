import express from 'express';
import app from './backend/src/app.js';

// The direct Express import lets Vercel detect this as an Express backend.
// The actual application instance, routes, middleware and cron endpoints
// remain defined in backend/src/app.js.
void express;

export default app;
