import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(503).json({ error: 'JWT_SECRET não configurado. Adicione JWT_SECRET ao Web Service do backend.' });

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado' });
  if (token.length > 4096) return res.status(401).json({ error: 'Token inválido' });

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (!payload?.sub || typeof payload.sub !== 'string') return res.status(401).json({ error: 'Token inválido' });
    req.userId = payload.sub;
    next();
  } catch (error) {
    if (error?.name === 'TokenExpiredError') return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
