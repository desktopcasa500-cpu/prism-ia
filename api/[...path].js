// Intentionally unused. Vercel uses api/index.js as the API entrypoint.
export default function handler(_req, res) {
  return res.status(404).json({ error: 'Use /api endpoints' });
}
