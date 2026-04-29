# Plano de limpeza Supabase - CV Edi Pro

## Escopo

Diagnosticar e limpar apenas objetos do schema `public` que estejam sem uso confirmado. Nao alterar `auth`, `storage`, schemas internos ou objetos padrao do Supabase.

## Fase 1 - Versionar antes de limpar

Criar migrations futuras para objetos usados que existem no banco, mas nao estao totalmente reproduzidos nas migrations locais:

- `curriculos_saas`
- `profiles`
- `user_roles`
- RPCs `admin_listar_usuarios`, `admin_deletar_usuario`, `admin_reabilitar_usuario`, `admin_excluir_usuario_definitivo`, `desativar_minha_conta`
- policies e indexes realmente ativos desses objetos

Resultado esperado: um rebuild limpo do projeto recria tudo que a aplicacao usa.

## Fase 2 - Backup e verificacao dos candidatos

Antes de qualquer `DROP`, exportar schema e dados dos candidatos:

- `app_settings`
- `perfis_usuarios`
- `curriculos`
- `version_control`
- `register_app_version`

Validar:

- contagem de linhas
- uso por endpoints externos
- uso por admin/pipeline/deploy
- dependencias por FK, view, trigger ou policy

## Fase 3 - Remocao controlada

Remover apenas depois de confirmacao manual e backup validado.

Candidatos provaveis:

- `app_settings`: remover se continuar sem uso e sem dados.
- `perfis_usuarios`: remover se `profiles` for confirmado como perfil oficial.
- `curriculos`: remover se `curriculos_saas` for confirmado como unica tabela de curriculos.
- `version_control`: remover se nenhum consumidor externo depender da view.
- `register_app_version`: remover se o pipeline/runtime nao voltar a registrar versoes no banco.

## Ordem sugerida

1. Criar migrations faltantes dos objetos usados.
2. Rodar inventario novamente e comparar app x banco.
3. Exportar backup dos candidatos.
4. Executar `DROP` em uma branch/tarefa separada, com confirmacao explicita.

## Nao remover agora

- `curriculos_saas`
- `transferencias_vagas`
- `app_versions`
- `ai_prompts`
- `ai_settings`
- `ai_interactions`
- `login_logs`
- `profiles`
- `user_roles`
- RPCs admin usadas pela UI
