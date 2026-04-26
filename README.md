# CV Edi Pro

Aplicação PWA para criar, importar e adaptar currículos com IA, com autenticação e persistência no Supabase, deploy na Vercel e uma extensão Chrome para capturar vagas externas.

## Arquitetura

- Frontend: HTML, CSS e JavaScript Vanilla em `public/`.
- Backend: Vercel Functions em `api/`.
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

Configure na Vercel:

- `GEMINI_KEY`: chave do Google AI Studio.
- `SUPABASE_SERVICE_ROLE_KEY`: usada apenas no backend para salvar vagas temporárias.

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

- Preview: push em branch de trabalho pode gerar preview no Vercel e também passar pelo pipeline do GitHub Actions.
- Produção: merge da PR na `main` gera versionamento + deploy de produção pelo GitHub Actions.
- A versão aparece no rodapé do app e também no painel de log minimizado.
- O workflow atual continua versionando preview como `CV Edi Pro vX.Y.Z - Preview`.

## Regra de Deploy

- Preview por Git no Vercel está habilitado.
- O pipeline do GitHub Actions continua sendo o fluxo principal para versionamento automatizado.
- Deploy manual continua exigindo atenção, porque pode divergir do versionamento registrado.

## Processo Recomendado

1. Trabalhar em branch `codex/...`.
2. Testar localmente ou no preview da Vercel.
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
