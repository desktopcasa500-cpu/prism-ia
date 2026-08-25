import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import chatRoutes from './routes/chat.js';
import skillsRoutes from './routes/skills.js';
import modelsRoutes from './routes/models.js';
import projectsRoutes from './routes/projects.js';
import filesRoutes from './routes/files.js';
import uploadsRoutes from './routes/uploads.js';
import aiRoutes from './routes/ai.js';
import { pool } from './db/pool.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../../dist');
const allowedOrigins = (process.env.FRONTEND_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin:(origin,callback)=>{ if(!origin || allowedOrigins.length===0 || allowedOrigins.includes(origin)) return callback(null,true); return callback(new Error('Origem não permitida')); }, credentials:true }));
app.use(express.json({limit:'10mb'}));
app.use(rateLimit({windowMs:60000,max:120,standardHeaders:true,legacyHeaders:false}));

app.get('/api/health', async(_req,res)=>{ try { await pool.query('SELECT 1'); res.json({ok:true,database:'connected',auth:Boolean(process.env.JWT_SECRET)}); } catch { res.status(503).json({ok:false,database:'unreachable',auth:Boolean(process.env.JWT_SECRET)}); }});

app.use('/api/auth',authRoutes);
app.use('/api/user',userRoutes);
app.use('/api/chat',chatRoutes);
app.use('/api/skills',skillsRoutes);
app.use('/api/models',modelsRoutes);
app.use('/api/projects',projectsRoutes);
app.use('/api/files',filesRoutes);
app.use('/api/uploads',uploadsRoutes);
app.use('/api/ai',aiRoutes);

app.use(express.static(distPath,{index:false}));
app.get('*',(req,res,next)=>{ if(req.path.startsWith('/api/')) return next(); return res.sendFile(path.join(distPath,'index.html'),error=>{if(error)next(error);});});
app.use((_req,res)=>res.status(404).json({error:'Endpoint não encontrado'}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:err.message||'Erro interno do servidor'});});

export default app;
