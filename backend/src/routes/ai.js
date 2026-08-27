import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getModelProfile, validateThinking, normalizeEffort } from '../services/modelRouter.js';
import { runOrchestration } from '../services/orchestrator.js';

const router = Router();
router.use(requireAuth);

router.post('/generate', async (req, res) => {
  try {
    const model = req.body?.model || 'prism-mini-1.0';
    const thinking = normalizeEffort(req.body?.thinking || 'medium');
    const prompt = String(req.body?.prompt || '').trim();
    const context = String(req.body?.context || '').slice(-30_000);

    if (!prompt) return res.status(400).json({ error: 'Prompt vazio' });
    if (prompt.length > 50_000) return res.status(413).json({ error: 'Pedido muito longo' });
    if (!validateThinking(model, thinking)) return res.status(400).json({ error: 'Configuração de modelo inválida' });

    const result = await runOrchestration(
      prompt,
      thinking,
      { ...getModelProfile(model), id: model },
      context,
      req.userId,
    );
    res.json({ model, thinking, ...result });
  } catch (error) {
    console.error('AI generation error:', error);
    const message = error?.message || 'O serviço de IA não respondeu.';
    const status = /não está configurada|Nenhuma chave/i.test(message) ? 503 : 502;
    res.status(status).json({ error: message });
  }
});

export default router;
