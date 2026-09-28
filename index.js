import express from 'express';
import app from './backend/src/app.js';

// Keep Express visible in this entrypoint so Vercel's Express detector
// recognizes the application and deploys it as a single Node.js Function.
const server = express();
server.use(app);

export default server;
