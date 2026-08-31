# Prism IA

Prism IA é uma plataforma de engenharia de software com React/Vite no frontend, Express no backend, autenticação JWT, PostgreSQL e orquestração de provedores de IA.

## Produção no Render

O projeto pode ser executado como **um único Web Service Node no Render**. O serviço constrói o frontend e o backend serve o conteúdo de `dist` junto com a API.

O `render.yaml` usa:

```text
Build: npm install && npm run build
Start: npm start
Health check: /api/health
```

O PostgreSQL deve ser um banco do Render. O backend nunca deve expor credenciais do banco ao navegador.

## Variáveis do Render

Configure no Web Service:

```text
DATABASE_URL=<Internal Database URL do PostgreSQL do Render>
JWT_SECRET=<segredo longo e aleatório>
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=<Client ID do Google, se o login Google for usado>
GEMINI_API_KEY=<chave, se usada>
GROQ_API_KEY=<chave, se usada>
OPENROUTER_NVIDIA_API_KEY=<chave, se usada>
NVIDIA_BUILDER_API_KEY=<chave, se usada>
MCP_ENCRYPTION_KEY=<chave longa e aleatória, se MCP persistido for usado>
```

Como frontend e API são servidos pelo mesmo Web Service, o frontend usa `/api` por padrão e normalmente não precisa de `VITE_API_URL`.

## Desenvolvimento

```bash
npm install
npm run build
npm start
```

Para executar apenas o frontend em desenvolvimento:

```bash
npm run dev
```

Para executar o banco localmente, use `backend/.env.example` como referência e rode:

```bash
npm run migrate
```
