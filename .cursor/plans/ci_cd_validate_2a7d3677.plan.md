---
name: CI/CD Validate
overview: Validar ponta a ponta o fluxo de deploy do frontend (Vercel) e do banco (Supabase), com foco em versionamento, cache/service worker e consistência de ambientes preview/produção.
todos:
  - id: check-workflow-loop
    content: Revisar `/.github/workflows/supabase.yml` para garantir que o guard `[skip ci]` realmente bloqueia o run gerado pelo commit automático.
    status: pending
  - id: check-sw-cache-sync
    content: "Validar sincronismo entre `public/index.html` (manifest/sw ?v) e `public/sw.js` (CACHE_NAME) nos dois cenários: preview e produção."
    status: pending
  - id: check-supabase-push
    content: Confirmar no log real do workflow que `supabase db push` executa com sucesso e que `public.app_versions` existe/é atualizada.
    status: pending
  - id: check-vercel-deploy
    content: Garantir que a Vercel deploy usa `vercel.json` correto e `--prod` apenas em main/master; conferir URLs e alias conforme o job.
    status: pending
  - id: smoke-test-frontend
    content: "Testar carregamento e fluxos principais no preview/prod: login, importação de vaga (via `?vaga_id=`), geração de PDF e navegação entre telas, verificando no DevTools que o SW novo está ativo."
    status: pending
isProject: false
---

## Diagnóstico atual (o que já dá para concluir pelos arquivos)

- O pipeline está concentrado em `/.github/workflows/supabase.yml`, que:
  - detecta branch (main/master vs demais) para definir `release` (produção) e `preview`;
  - atualiza `package.json`, `public/index.html` e `public/sw.js` com um `CACHE_ID` para bust de cache do Service Worker;
  - comita e faz `git push` no próprio branch;
  - executa `supabase db push` (SQL/funções/migrations) via Supabase CLI;
  - faz deploy na Vercel via `vercel deploy` (CLI) e registra a versão no banco.

- `vercel.json` contém apenas rewrites para `/api/*` e mapeamento de assets estáticos para `/public/*`. Isso tende a ser OK para um app que navega só via `?query` e não via rotas profundas (SPA sem router).

- `public/sw.js` implementa `precache` no `install` + `network-first` no `fetch` (cache atualizado quando resposta ok). Para funcionar bem, precisa que o workflow sincronize:
  - `manifest.json?v=...` e `sw.js?v=...` no `public/index.html`;
  - `CACHE_NAME` do `public/sw.js` com o mesmo `CACHE_ID`.

## Checklist de validação end-to-end (sem mudanças)

1. Validar o comportamento de “autocommit” do workflow
   - Confirmar que o guard do job (`[skip ci]`/`[skip actions]`) impede loop infinito quando o workflow commita e dá push no próprio branch.
   - Confirmar se existem restrições para push em branches protegidas ou em PRs de fork.

2. Validar bust de cache do Service Worker em preview e produção
   - Em um commit de preview (branch diferente de main/master):
     - checar se `public/index.html` ganhou `manifest.json?v=<CACHE_ID>` e `sw.js?v=<CACHE_ID>`;
     - checar se `public/sw.js` ganhou `const CACHE_NAME = 'cv-edi-pro-v<CACHE_ID>-preview'`;
     - abrir o preview URL e validar no DevTools (Application -> Service Workers) se o SW foi atualizado.
   - Em produção (main/master): repetir checando o `CACHE_NAME` sem `-preview`.

3. Validar Supabase db push
   - Confirmar no log do workflow se `supabase db push` aplicou migrations/funções sem erro.
   - Validar a tabela usada no workflow (`public.app_versions`) para registrar produção/preview.

4. Validar deploy Vercel
   - Conferir se `vercel deploy --prod` roda para main/master e se `--prod` não é usado em preview.
   - Conferir se o URL final bate com o que o workflow calcula (`cvedipro.vercel.app` vs `${DEPLOYMENT_URL}` e alias especial para `codex/supabase-ajustes`).

5. Validar compatibilidade do frontend após refatoração para ES modules
   - Garantir que o `public/index.html` usa `type="module" src="main.js"` e que os novos módulos em `public/` foram publicados/atualizados pelo deploy.

## Critérios de aceite

- Preview: ao atualizar o branch, o app carrega `main.js` e módulos sem falhas de cache; SW atualizado no DevTools; Supabase db push sem erros.
- Produção: ao mergear em main, deploy de produção com `--prod` e registro no Supabase efetuados.
- Sem loops de workflow (nenhuma sequência infinita de “chore/preview” commits).