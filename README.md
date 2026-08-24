# Prism IA

Plataforma web de IA com interface React/Vite, autenticação JWT, PostgreSQL e orquestração paralela de múltiplos provedores.

## Estrutura

- `frontend/` — landing, login, cadastro e chat Prism IA.
- `backend/` — API Express, autenticação, sessões, mensagens e orquestração.
- `backend/src/db/` — schema e migração PostgreSQL.

## Desenvolvimento

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Variáveis de ambiente

Preencha `backend/.env` com `DATABASE_URL`, `JWT_SECRET` e as chaves dos provedores de IA. Nunca coloque chaves reais no código ou no Git.

## Orquestração

- `medium`: Gemini + Groq em paralelo.
- `ultracode`: Gemini + Groq + NVIDIA via OpenRouter em paralelo.

## Deploy

Frontend: Vercel com diretório raiz `frontend`. Backend: qualquer host Node compatível com Express e PostgreSQL.
