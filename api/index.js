import express from 'express';
import app from '../backend/src/app.js';

// Export a concrete Express handler so Vercel's Node/Express detector
// recognizes this file as the serverless backend entrypoint.
const handler = express();
handler.use(app);

export default handler;
