# 📊 Guia de Migração - Sistema de Logs de Login

## Visão Geral
Este guia descreve como executar a migração para criar a tabela `login_logs` no banco de dados Supabase.

---

## ✅ Mudanças Implementadas

### 1. **Registro Automático de Logins Bem-sucedidos**
- ✓ Quando um usuário faz login, o evento é automaticamente registrado no banco
- ✓ Dados capturados: `user_id`, `email`, `timestamp`, `user_agent`, `ip_address`

### 2. **Registro de Tentativas de Login Falhadas**
- ✓ Tentativas de login com senha incorreta são registradas
- ✓ Essas tentativas não possuem `user_id` (ainda não autenticado)
- ✓ Útil para detectar padrões de ataque ou força bruta

### 3. **Interface Admin para Visualizar Logs**
- ✓ Novo menu em "📊 Logs de Login" (visível apenas para admin)
- ✓ Tabela interativa com histórico de logins
- ✓ Filtros por email e status (sucesso/falha)
- ✓ Exibe informações: email, data/hora, status, user_agent, IP

---

## 🚀 Como Executar a Migração

### **Opção 1: Via Supabase Dashboard (Recomendado)**

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **SQL Editor** (lado esquerdo)
4. Clique em **New Query**
5. Copie e cole o conteúdo do arquivo:
   ```
   supabase/migrations/20260419000000_criar_tabela_login_logs.sql
   ```
6. Clique em **Run** (ou pressione `Ctrl+Enter`)
7. Confirme que a migração foi executada com sucesso

### **Opção 2: Via CLI do Supabase**

Se você tem o Supabase CLI instalado:

```bash
# 1. Faça login no Supabase
supabase login

# 2. Link seu projeto
supabase link --project-id seu-project-id-aqui

# 3. Execute as migrações
supabase migration up

# 4. Verifique o status
supabase migration list
```

### **Opção 3: Via Vercel (Automático em Deploy)**

Se você usa Vercel + Supabase com automação:

1. Commit e deploy do código atualizado
2. Adicione a integração Supabase ao seu ambiente Vercel se ainda não tiver
3. As migrações podem ser executadas automaticamente durante o deploy

---

## 📋 Conteúdo da Migração

A migração cria:

```sql
-- Tabela para armazenar logs de login
CREATE TABLE login_logs (
    id UUID PRIMARY KEY,
    user_id UUID (pode ser NULL para falhas),
    email VARCHAR(255),
    login_timestamp TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN
);
```

### Índices para Performance:
- `idx_login_logs_user_id` - Busca por usuário
- `idx_login_logs_timestamp` - Ordenação por data
- `idx_login_logs_email` - Filtro por email

### Políticas de Segurança (RLS):
- Admin consegue ver todos os logs
- Usuários veem apenas seus próprios logs
- Sistema consegue inserir novos logs

---

## ✨ Como Usar nos Próximos Passos

### **Para o Admin (você):**

1. Faça login na aplicação
2. Clique em ⚙️ (Configurações) → **Logs de Login**
3. Você verá uma tabela com todos os logins do sistema
4. Use os filtros para buscar por email ou ver apenas falhas

### **Dados Capturados:**

Cada login registra:
- **E-mail**: Do usuário que fez login
- **Data/Hora**: Quando o login ocorreu
- **Status**: ✓ Sucesso ou ✗ Falha
- **User Agent**: Tipo de navegador/dispositivo
- **IP**: Endereço IP (será preenchido se integrado com servidor backend)

---

## 🛠️ Troubleshooting

### Erro: "Table already exists"
- A tabela já foi criada anteriormente
- Você pode verificar em `Database` → `Tables` no Supabase

### Erro: "Permission denied"
- Verifique se você tem permissões de admin no Supabase
- Confirme se está usando a chave correta do projeto

### Logs não aparecem:
- Verifique as políticas RLS em `Database` → `login_logs` → `RLS`
- Certifique-se que a migração foi executada com sucesso

---

## 📌 Próximas Melhorias Sugeridas

1. **Captura de IP Real**: Integrar com servidor backend para capturar IP do cliente
2. **Dashboard Analytics**: Gráficos de logins por dia/hora
3. **Alertas**: Notificar sobre múltiplas falhas de login
4. **Exportar Dados**: Permitir download de logs em CSV
5. **Bloqueio Automático**: Bloquear IP após N tentativas falhas

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do Supabase em `Logs` → `API`
2. Abra o console do navegador (F12) para ver erros
3. Verifique que a migração está listada em `Migrations`

