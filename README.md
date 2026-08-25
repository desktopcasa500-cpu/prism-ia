# Prism IA

Plataforma web da Prism IA com React/Vite no frontend, Express no backend, autenticação JWT, PostgreSQL e orquestração de provedores de IA.

## Arquitetura de produção

- **Vercel:** frontend estático (`dist`).
- **Render:** Web Service Node/Express que executa a API e pode servir o build também.
- **Render PostgreSQL:** banco usado pelo backend do Render.
- O frontend não acessa o PostgreSQL diretamente.

## Variáveis do Render Web Service

Configure no Web Service do Render:

```text
DATABASE_URL=<Internal Database URL do PostgreSQL do Render>
JWT_SECRET=<segredo longo e aleatório>
JWT_EXPIRES_IN=7d
FRONTEND_ORIGIN=<URL pública do frontend na Vercel>
GOOGLE_CLIENT_ID=<Client ID do Google, se o login Google for usado>
GEMINI_API_KEY=<chave, se usada>
GROQ_API_KEY=<chave, se usada>
OPENROUTER_NVIDIA_API_KEY=<chave, se usada>
NVIDIA_BUILDER_API_KEY=<chave, se usada>
```

Para o PostgreSQL no mesmo Render, prefira a **Internal Database URL**. Não coloque a senha ou a URL real no Git.

## Variável da Vercel

No projeto do frontend na Vercel, configure:

```text
VITE_API_URL=https://SEU-WEB-SERVICE.onrender.com
```

Use exatamente a URL pública do **Web Service** do Render, sem `/api` no final.

Assim o fluxo fica:

```text
Vercel (frontend)
      |
      | HTTPS /api/...
      v
Render Web Service
      |
      +---- PostgreSQL
      +---- Gemini / Groq / OpenRouter
```

A Vercel não precisa ter `DATABASE_URL` nessa arquitetura porque ela não executa mais a API da Prism IA.

## Desenvolvimento

```bash
npm install
npm run build
npm start
```

Para desenvolvimento local, use `backend/.env.example` como referência e execute a migração com:

```bash
npm run migrate
```
