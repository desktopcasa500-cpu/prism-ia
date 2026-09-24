import { Router } from 'express';
import { MODEL_PROFILES } from '../services/modelRouter.js';
import { hasBothGroqKeys, isGroqConfigured } from '../services/groqRouter.js';

const router = Router();

function configured() {
  return {
    groq: isGroqConfigured(),
    groqSplit: hasBothGroqKeys(),
    nvidia: Boolean(process.env.NVIDIA_NIM_API_KEY || process.env.NIM_API_KEY),
    opencode: Boolean(process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY || process.env.ZEN_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY && process.env.PRISM_OPENROUTER_FREE_FALLBACK === 'true'),
  };
}

router.get('/', (_req, res) => {
  res.json({
    models: Object.entries(MODEL_PROFILES).map(([id, data]) => ({ id, ...data })),
    providers: configured(),
  });
});

router.get('/providers', (_req, res) => {
  res.json({ providers: configured() });
});

export default router;
