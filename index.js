import express from 'express';
import app from './backend/src/app.js';

// Keep a direct Express import in this entrypoint so Vercel's Express detector
// can identify the application without following nested imports.
void express;

export default app;
