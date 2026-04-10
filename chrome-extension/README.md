# Edi Pro - Captura de Vagas

Extensao Chrome Manifest V3 do Edi Pro. Ela captura o texto de uma vaga em uma pagina externa, valida o conteudo com IA no backend do site e, se for valido, salva a vaga pelo backend para abrir o Edi Pro com `?vaga_id=<uuid>`.

Esta pasta fica versionada junto com o projeto, mas independente do build principal do site.

## Fluxo

1. O usuario abre uma pagina de vaga.
2. Opcionalmente, seleciona com o mouse o texto principal da vaga.
3. Ao clicar em `Validar e Capturar Vaga`, a extensao captura a selecao quando ela tiver mais de 50 caracteres.
4. Se nao houver selecao suficiente, captura ate 8000 caracteres do texto visivel da pagina.
5. A extensao chama `POST /api/validar-vaga` no backend do Edi Pro.
6. O backend valida com IA usando prompt server-side proprio.
7. Se `valido: false`, a extensao nao salva nada.
8. Se `valido: true`, a extensao chama `POST /api/salvar-vaga`.
9. O backend salva em `transferencias_vagas` no Supabase.
10. A extensao abre o site com `?vaga_id=<uuid>`.

## Como carregar localmente no Chrome

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactacao`.
4. Selecione a pasta `chrome-extension`.
5. Fixe a extensao na barra do Chrome, se quiser.

Sempre que alterar arquivos da extensao, volte em `chrome://extensions` e clique em `Recarregar`.

## Como usar

1. Abra a pagina de uma vaga no LinkedIn, Gupy ou outro site.
2. Para melhor resultado, selecione o bloco principal da vaga, incluindo cargo, descricao, requisitos e beneficios.
3. Clique no icone da extensao.
4. Clique em `Validar e Capturar Vaga`.

Se a selecao tiver mais de 50 caracteres, apenas ela sera enviada. Isso reduz ruido de menus, botoes e rodapes.

Se a selecao estiver vazia ou curta demais, a extensao envia ate 8000 caracteres da pagina.

## Endpoints chamados

Producao atual:

```txt
https://curriculo-edi.vercel.app
```

Validacao da vaga:

```txt
POST /api/validar-vaga
```

Payload:

```json
{
  "texto": "texto capturado da vaga",
  "prompt": "prompt enviado pela extensao apenas como contexto",
  "origem": "selecao",
  "truncado": false
}
```

Resposta valida:

```json
{
  "valido": true,
  "motivo": "Texto representa uma vaga de emprego.",
  "texto_normalizado": "texto limpo e validado"
}
```

Resposta invalida:

```json
{
  "valido": false,
  "motivo": "Explique em uma frase curta por que nao parece uma vaga.",
  "texto_normalizado": ""
}
```

Salvamento da vaga validada:

```txt
POST /api/salvar-vaga
```

Payload:

```json
{
  "id": "uuid-gerado-na-extensao",
  "texto": "texto normalizado validado pela IA"
}
```

## Testar com preview da Vercel

1. Abra `popup.js`.
2. Troque temporariamente:

```js
const SEU_SITE_URL = 'https://curriculo-edi.vercel.app';
```

por sua URL de preview, por exemplo:

```js
const SEU_SITE_URL = 'https://sua-preview.vercel.app';
```

3. Abra `manifest.json`.
4. Adicione temporariamente a URL de preview em `host_permissions`:

```json
"host_permissions": [
  "https://curriculo-edi.vercel.app/*",
  "https://sua-preview.vercel.app/*"
]
```

5. Recarregue a extensao em `chrome://extensions`.
6. Teste a captura em uma pagina de vaga.

## Voltar para producao

1. Em `popup.js`, volte `SEU_SITE_URL` para:

```js
const SEU_SITE_URL = 'https://curriculo-edi.vercel.app';
```

2. Em `manifest.json`, remova a URL temporaria de preview.
3. Recarregue a extensao em `chrome://extensions`.

## Variaveis de ambiente no backend

A extensao nao deve conter chave de IA nem service role do Supabase.

O backend precisa ter:

```txt
GEMINI_KEY
```

Recomendado para salvar vagas com mais seguranca:

```txt
SUPABASE_SERVICE_ROLE_KEY
```

Tambem sao aceitos os fallbacks usados no projeto:

```txt
GOOGLE_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

## Seguranca

- A extensao nao contem chave de IA.
- A extensao nao contem service role do Supabase.
- O prompt enviado pela extensao e apenas contexto; o backend usa prompt server-side proprio.
- O endpoint `/api/validar-vaga` limita o tamanho do texto recebido.
- O endpoint `/api/salvar-vaga` salva no Supabase pelo backend.
- A tabela `transferencias_vagas` deve ter RLS revisada para evitar `select` publico amplo.
- Como o app principal ainda le a vaga por `vaga_id`, revise as policies antes de endurecer RLS em producao para nao quebrar o fluxo atual.
