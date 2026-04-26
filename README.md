# CV Edi Pro

Aplicação PWA para criar, importar e adaptar currículos com IA, com autenticação e persistência no Supabase, deploy no Render e uma extensão Chrome para capturar vagas externas.

## Arquitetura

- Frontend: HTML, CSS e JavaScript Vanilla em `public/`.
- Backend: servidor Node/Express em `server.js`, reaproveitando os handlers de `api/` como rotas.
- Banco e autenticação: Supabase com RLS.
- IA: Google Gemini via variáveis de ambiente no backend.
- Extensão Chrome: pasta independente em `chrome-extension/`.

## Estrutura Principal

- `public/index.html`: telas do app em uma SPA estática.
- `public/config.js`: estado global, prompts padrão e configuração pública do Supabase.
- `public/api.js`: cliente de IA, prompts administrativos, logs e helpers de API.
- `public/auth.js`: login, conta, admin e permissões.
- `public/cv-builder.js`: criação, importação, ajuste de currículo e análise de vaga.
- `api/ia.js`: proxy server-side para chamadas Gemini do app.
- `api/validar-vaga.js`: valida e normaliza vagas capturadas pela extensão.
- `api/salvar-vaga.js`: salva temporariamente a vaga capturada no Supabase pelo backend.
- `chrome-extension/`: extensão Chrome versionada junto do projeto, fora do build principal.

## Variáveis de Ambiente

Configure no Render:

- `GEMINI_KEY`: chave do Google AI Studio.
- `SUPABASE_SERVICE_ROLE_KEY`: usada apenas no backend para salvar vagas temporárias.
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_ADMIN_EMAIL`
- `NODE_ENV=production`

Não coloque chaves secretas no frontend nem na extensão.

## Extensão Chrome

A extensão fica em `chrome-extension/` e deve ser carregada manualmente em `chrome://extensions` usando “Carregar sem compactação”.

Fluxo:

- O usuário seleciona o texto da vaga ou a extensão captura até 8000 caracteres da página.
- A extensão chama `POST /api/validar-vaga`.
- Se a vaga for válida, chama `POST /api/salvar-vaga`.
- O site abre com `?vaga_id=<uuid>` e importa a vaga para o usuário logado.

Para testar em preview, veja o passo a passo em `chrome-extension/README.md`.

## Deploy e Versionamento

- Produção: o Render roda como Web Service Node na branch `main`.
- Build Command: `npm install`.
- Start Command: `npm start`.
- A versão aparece no rodapé do app e também no painel de log minimizado.
- O endpoint `/api/build-version` reconhece `RENDER_EXTERNAL_URL`, `RENDER_GIT_COMMIT` e `RENDER_GIT_BRANCH`.

## Regra de Deploy

- Deploy principal: Render Web Service.
- O arquivo `vercel.json` permanece apenas como legado durante a migração.
- Deploy manual continua exigindo atenção, porque pode divergir do versionamento registrado.

## Processo Recomendado

1. Trabalhar em branch `codex/...`.
2. Testar localmente com `npm start`.
3. Gerar commit com resumo claro.
4. Abrir PR para `main` usando o resumo das alterações.
5. Validar preview.
6. Fazer merge para subir produção.

## Observações de Manutenção

- O projeto não é monorepo; mantenha a extensão isolada em `chrome-extension/`.
- Alterações em arquivos estáticos podem exigir atualização do service worker/cache.
- Prompts e modelo de IA podem ser ajustados pela área admin.
- A conta admin principal é identificada pelo e-mail `dop.jr82@gmail.com`.

Criado por [Daniel](https://github.com/danidopx) - 2026
