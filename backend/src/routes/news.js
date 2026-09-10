import { Router } from 'express';
import { getStoredNews, getLastRefresh, newsUpdatedLabel } from '../services/newsService.js';

const router = Router();

// Rota pública: a Landing exibe notícias sem exigir login.
router.get('/', async (_req, res) => {
  try {
    const [items, last] = await Promise.all([getStoredNews(), getLastRefresh()]);
    res.json({ items, updatedAt: last?.created_at || null, updatedLabel: newsUpdatedLabel(last) });
  } catch (error) {
    console.error('Falha ao carregar notícias:', error);
    res.status(500).json({ items: [], updatedAt: null, updatedLabel: '', error: 'Não foi possível carregar as notícias.' });
  }
});

export default router;
