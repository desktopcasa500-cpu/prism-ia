import app from '../backend/src/app.js';

export default function handler(req, res) {
  const originalUrl = req.url || '/';

  // Vercel invokes this function without the `/api` prefix in some setups.
  // Express routes in this project are mounted under `/api`, so normalize it.
  if (!originalUrl.startsWith('/api/')) {
    req.url = `/api${originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`}`;
  }

  return app(req, res);
}
