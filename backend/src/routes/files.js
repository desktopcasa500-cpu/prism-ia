import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/analyze', async(req,res)=>{
 const fileName=String(req.body?.fileName||'');
 const type=String(req.body?.type||'unknown');
 if(!fileName) return res.status(400).json({error:'Arquivo não informado'});
 res.json({
  file:{name:fileName,type},
  analysis:'Arquivo recebido pelo Prism Codex. O processador de arquivos está preparado para integração com PDF, ZIP e projetos.'
 });
});

export default router;
