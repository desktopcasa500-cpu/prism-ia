# Prism IA — arquitetura interna e deploy

## Escopo

A landing page fica fora desta arquitetura. As mudanças descritas aqui se aplicam às superfícies autenticadas do aplicativo, principalmente Chat, Codex e API.

## Stack

- Frontend: React 18 + Vite
- Roteamento: React Router
- Backend: Node.js + Express
- Banco: PostgreSQL
- Autenticação: JWT
- Streaming: Server-Sent Events (SSE)
- Integrações: provedores de IA compatíveis com Chat Completions, MCP e Stripe

## Fluxo de uma mensagem

1. O navegador envia a mensagem autenticada para a API.
2. Rate limiting, traffic gate, quota gate e autenticação são aplicados antes da geração.
3. O backend monta histórico, instruções pessoais, projeto e anexos.
4. O orquestrador escolhe o provedor disponível e interrompe o failover quando o usuário cancela.
5. O provedor pode responder por streaming; cada delta é encaminhado pelo SSE.
6. Cancelamento percorre navegador → rota → orquestrador → provider/Groq/MegaBrain sem virar uma nova tentativa automática.
7. Regeneração reutiliza a pergunta original sem duplicar o turno do usuário.
8. Edição atualiza o turno original e remove respostas posteriores somente quando a nova geração termina com sucesso.
9. A resposta completa é persistida no PostgreSQL e o cliente mantém o histórico em tempo real.

## Variáveis de ambiente

As chaves devem existir apenas no ambiente do backend/Render.

### Banco e autenticação

- DATABASE_URL
- JWT_SECRET
- JWT_EXPIRES_IN
- GOOGLE_CLIENT_ID

### Provedores de IA

- NVIDIA_NIM_API_KEY
- NIM_API_KEY
- GROQ_API_KEY_1
- GROQ_API_KEY_2
- GROQ_API_KEY
- OPENCODE_ZEN_API_KEY
- OPENCODE_API_KEY
- ZEN_API_KEY
- OPENROUTER_API_KEY

GROQ_API_KEY é mantida apenas para compatibilidade com instalações antigas. O roteamento novo usa GROQ_API_KEY_1 e GROQ_API_KEY_2.

### Aplicação e segurança

- FRONTEND_ORIGIN
- APP_URL
- PRISM_IP_RATE_LIMIT
- PRISM_AUTH_RATE_LIMIT
- PRISM_GENERATION_RATE_LIMIT
- PRISM_MAX_CONCURRENT_GENERATIONS
- PRISM_RPM_LIMIT
- PRISM_HTTP_LOGS
- MCP_ENCRYPTION_KEY

Nunca coloque valores reais dessas variáveis no Git.

## Deploy no Render

Build: npm install && npm run build

Start: npm start

O npm start valida a sintaxe do backend, aplica a migração/schema e inicia o Express.

Health check: /api/health

Para produção em domínio separado, defina FRONTEND_ORIGIN com a origem do frontend. Em uma instalação do Render onde frontend e API são servidos pelo mesmo Web Service, deixe a política usar a origem do próprio host ou configure explicitamente APP_URL.

## Controles de produção

O backend possui:

- limite geral por IP;
- limite específico de autenticação;
- limite específico de geração;
- fila de concorrência por plano;
- quota por conta/modelo;
- CORS por origem;
- JWT com algoritmo HS256 explicitamente limitado;
- IDs de requisição para correlação de logs;
- headers básicos de segurança;
- cancelamento do provedor quando o cliente encerra uma geração SSE;
- cancelamento terminal em failover de Groq/provedores e MegaBrain;
- heartbeat no SSE para conexões longas;
- persistência de mensagens, feedback e edição/regeneração;
- idempotência por client request id;
- sanitização de erros internos antes de retorná-los ao cliente;
- HSTS/DNS-prefetch headers quando o request está em HTTPS.

## Interface do Chat

O Chat usa um único stylesheet interno (`frontend/workspace.css`) e os tokens compartilhados ficam em `frontend/styles.css`. Não crie um CSS novo para cada correção. Antes de remover uma camada antiga, confirme que seus seletores não aparecem nas superfícies ativas.

## Escala

A fila de tráfego atual fica em memória. Isso é adequado para uma única instância do serviço. Para várias instâncias simultâneas, substitua o estado de fila/concorrência por um armazenamento compartilhado, como Redis, antes de aumentar horizontalmente o backend.

## Verificação local

npm install

npm run check

npm run build

npm start

O build do Vite verifica o frontend; npm run check verifica a sintaxe das entradas de backend listadas no script.