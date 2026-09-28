# Prism IA

Plataforma web da Prism IA com React/Vite no frontend, Express no backend, autenticação JWT, PostgreSQL/Neon e orquestração de provedores de IA.

## Produção

A infraestrutura de produção é:

- **Vercel** para hospedagem do frontend e do backend Express.
- **Neon PostgreSQL** para persistência.
- **Vercel Cron** para tarefas agendadas.

O entrypoint de produção do Express é o `index.js` na raiz. O Vite gera o frontend em `public/`, que a Vercel serve pelo CDN. A API continua em `/api/*` dentro do mesmo domínio.

## Variáveis de ambiente

Configure na Vercel, principalmente no ambiente **Production**:

```text
DATABASE_URL=<connection string do Neon>
JWT_SECRET=<segredo longo e aleatório>
JWT_EXPIRES_IN=7d
CRON_SECRET=<segredo usado pelos cron jobs>
APP_URL=https://SEU-DOMINIO
FRONTEND_ORIGIN=https://SEU-DOMINIO
GOOGLE_CLIENT_ID=<Client ID do Google OAuth>
GOOGLE_CLIENT_SECRET=<Client Secret do Google OAuth>
GOOGLE_REDIRECT_URI=https://SEU-DOMINIO/api/auth/google/callback
GITHUB_CLIENT_ID=<Client ID do GitHub OAuth>
GITHUB_CLIENT_SECRET=<Client Secret do GitHub OAuth>
GITHUB_REDIRECT_URI=https://SEU-DOMINIO/api/auth/github/callback
GROQ_API_KEY_1=<primeira chave Groq>
GROQ_API_KEY_2=<segunda chave Groq>
NVIDIA_NIM_API_KEY=<chave NVIDIA NIM>
NVIDIA_API_KEY=<alias aceito para NVIDIA NIM>
OPENCODE_ZEN_API_KEY=<chave OpenCode Zen>
OPENROUTER_API_KEY=<opcional>
PRISM_OPENROUTER_FREE_FALLBACK=false
MCP_ENCRYPTION_KEY=<se MCP persistido for usado>
STRIPE_SECRET_KEY=<se cobrança real for usada>
PRISM_STRIPE_ENABLED=false
```

Nunca coloque segredos no Git.

## Banco Neon

O schema está em `backend/src/db/schema.sql`.

Para uma primeira configuração do banco, a migração pode ser executada apontando `DATABASE_URL` para o Neon:

```bash
npm run migrate
```

Depois da migração, confirme a aplicação pelo endpoint `GET /api/health`. Uma resposta saudável deve informar `ok: true`.

## Desenvolvimento

```bash
npm install
npm run dev
```

Backend local:

```bash
npm run dev:api
```

Validação obrigatória:

```bash
npm run check
npm run build
```

## Rotas principais

```text
/login
/register
/chat
/codex
/studio
/configuracoes
/modelos
/modelos/taff-2-0
```

A Landing pública permanece em `frontend/pages/Landing.jsx` e não faz parte das alterações funcionais do app.

## Cron jobs

Os jobs são registrados no `vercel.json`:

```text
GET /api/cron/reset-usage
GET /api/cron/refresh-news
```

As duas rotas exigem `Authorization: Bearer <CRON_SECRET>`. A Vercel envia esse cabeçalho ao executar Vercel Cron quando `CRON_SECRET` está configurado.

## Provedores de IA

O endpoint `GET /api/models/providers` mostra quais provedores estão configurados sem expor chaves.

Com duas chaves Groq, o roteador distribui usuários entre as chaves e faz failover quando uma delas falha.
