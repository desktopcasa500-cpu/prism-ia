import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import app from './app.js';
import { pool } from './db/pool.js';
const __filename=fileURLToPath(import.meta.url);const __dirname=path.dirname(__filename);const rootDir=path.resolve(__dirname,'../..');const distDir=path.join(rootDir,'dist');
app.use(express.static(distDir,{index:false}));app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();return res.sendFile(path.join(distDir,'index.html'),error=>{if(error)next(error)})});
const port=Number(process.env.PORT)||4000;const host=process.env.HOST||'0.0.0.0';
async function ensureDatabase(){if(!process.env.DATABASE_URL&&!process.env.POSTGRES_URL&&!process.env.POSTGRES_PRISMA_URL){console.warn('DATABASE_URL não configurada; recursos de conta ficarão indisponíveis.');return}const schema=await fs.readFile(path.join(__dirname,'db','schema.sql'),'utf8');await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');await pool.query(schema);await pool.query('SELECT 1');console.log('PostgreSQL conectado e schema verificado.')}
ensureDatabase().then(()=>app.listen(port,host,()=>console.log(`Prism IA listening on ${host}:${port}`))).catch(error=>{console.error('Falha ao preparar banco:',error);process.exit(1)});
