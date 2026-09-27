import { Router } from 'express';
import { resetExpiredWeeklyLocks } from '../services/weeklyUsageReset.js';
import { refreshNewsFromWeb, shouldRefreshNews } from '../services/newsService.js';

const router = Router();

function authorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

function guard(req, res) {
  if (!process.env.CRON_SECRET) {
    res.status(503).json({
      ok: false,
      error: 'CRON_SECRET não configurado.',
      code: 'CRON_SECRET_NOT_CONFIGURED',
    });
    return false;
  }

  if (!authorized(req)) {
    res.status(401).json({
      ok: false,
      error: 'Não autorizado.',
      code: 'CRON_UNAUTHORIZED',
    });
    return false;
  }

  return true;
}

router.get('/reset-usage', async (req, res) => {
  if (!guard(req, res)) return;

  try {
    const resetCount = await resetExpiredWeeklyLocks();

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      job: 'reset-usage',
      resetCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron reset-usage falhou:', error);
    return res.status(500).json({
      ok: false,
      job: 'reset-usage',
      error: 'Falha ao executar o reset semanal.',
      code: 'CRON_RESET_FAILED',
    });
  }
});

router.get('/refresh-news', async (req, res) => {
  if (!guard(req, res)) return;

  try {
    const due = await shouldRefreshNews();

    if (!due) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        ok: true,
        job: 'refresh-news',
        status: 'skipped',
        reason: 'not_due',
        timestamp: new Date().toISOString(),
      });
    }

    const result = await refreshNewsFromWeb();

    res.setHeader('Cache-Control', 'no-store');
    return res.status(result?.status === 'error' ? 500 : 200).json({
      ok: result?.status !== 'error',
      job: 'refresh-news',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron refresh-news falhou:', error);
    return res.status(500).json({
      ok: false,
      job: 'refresh-news',
      error: 'Falha ao atualizar as notícias.',
      code: 'CRON_NEWS_FAILED',
    });
  }
});

export default router;
