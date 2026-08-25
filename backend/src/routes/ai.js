import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getModelProfile, validateThinking } from '../services/modelRouter.js';
import { runOrchestration } from '../services/orchestrator.js';

const router = Router();
router.use(requireAuth);

router.post('/generate', async (req,res,next)=>{
  try {
    const model = req.body?.model || 'prism-mini-1.0';
    const thinking = req.body?.thinking || 'medium';
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({error:'Prompt vazio'});
    if (!validateThinking(model, thinking)) return res.status(400).json({error:'Nível incompatível com o modelo'});

    const result = await runOrchestration(prompt, thinking, getModelProfile(model));
    res.json({model, thinking, ...result});
  } catch(error){ next(error); }
});

export default router;
