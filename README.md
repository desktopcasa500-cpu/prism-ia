# Prism IA

Plataforma web da Prism IA com React/Vite no frontend, Express no backend, autenticação JWT, PostgreSQL e orquestração de provedores de IA.

## Produção no Render

O projeto roda como **um único Web Service Node no Render**. O build do React é criado durante o deploy e o Express serve `dist` junto com a API.

O `render.yaml` usa:

```text
Build: npm install && npm run build
Start: npm start
Health check: /api/health
```

O PostgreSQL deve ser o banco do Render. O navegador nunca acessa o banco diretamente.

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

Como frontend e API são servidos pelo mesmo Web Service, o cliente usa `/api` por padrão e normalmente não precisa de `VITE_API_URL`.

Não coloque segredos, senhas ou URLs reais no Git.

## Desenvolvimento

```bash
npm install
npm run dev
```

Para produção/local com o servidor completo:

```bash
npm run build
npm start
```

Para preparar o PostgreSQL localmente, use `backend/.env.example` como referência e execute:

```bash
npm run migrate
```
