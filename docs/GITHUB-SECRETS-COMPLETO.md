# Configuração Completa de GitHub Secrets

Guia para configurar TODOS os secrets necessários para os workflows do Granafy funcionarem.

## 📍 Onde Adicionar Secrets

1. Vá para: https://github.com/LevyCupira/granafy/settings/secrets/actions
2. Clique em **"New repository secret"**
3. Preencha **Name** e **Value**
4. Clique **"Add secret"**

---

## 🔑 Secrets Necessários

### 1. SUPABASE_KEY (para Deploy)
**Para:** `deploy.yml` (injetar chave em produção)

1. Acesse: https://app.supabase.com/project/_/settings/api
2. Copie a chave **Publishable** (começa com `sb_publishable_`)
3. No GitHub:
   - Name: `SUPABASE_KEY`
   - Value: `sb_publishable_hiH2CKVSf-he9QP_M3ByrQ_wXXbKZbf` (sua chave)

---

### 2. SUPABASE_URL (para Keep-Alive)
**Para:** `supabase-manter-ativo.yml` (manter projeto ativo)

1. Acesse: https://app.supabase.com/project/_/settings/api
2. Copie a **Project URL**
3. No GitHub:
   - Name: `SUPABASE_URL`
   - Value: `https://pjnnkaafrxruooplccnz.supabase.co`

---

### 3. SUPABASE_DB_URL (para Backup)
**Para:** `supabase-backup.yml` (backup do banco)

**Desta precisamos com cuidado! A URL contém a SENHA do banco.**

1. Acesse: https://app.supabase.com/project/_/settings/database
2. Vá para aba **"Connection pooling"** (não a padrão!)
3. Copie a **Connection string** (a do Session pooler)
4. A string terá `[YOUR-PASSWORD]` - **substitua pela senha real do banco**
5. No GitHub:
   - Name: `SUPABASE_DB_URL`
   - Value: `postgresql://postgres:[SENHA_REAL]@pjnnkaafrxruooplccnz.pooler.supabase.com:6543/postgres`

⚠️ **AVISO:** Guarde esta URL em lugar MUITO seguro. Quem tiver acesso a ela pode acessar todo o banco!

---

### 4. BACKUP_SENHA (para Criptografia de Backup)
**Para:** `supabase-backup.yml` (cifrar backup com GPG)

1. Crie uma **senha FORTE** (mínimo 16 caracteres)
2. Exemplos (GERE UMA PRÓPRIA):
   - `Gr@n@fy#B@ckup$2026!Segura`
   - `xK9m#pL2$vR8@qW4&jN6!hT5`
3. No GitHub:
   - Name: `BACKUP_SENHA`
   - Value: `sua_senha_forte_aqui`

⚠️ **CRÍTICO:** Guarde esta senha em um local SEGURO (1Password, LastPass, etc). Sem ela, não consegue abrir os backups!

---

## ✅ Checklist de Configuração

- [ ] `SUPABASE_KEY` adicionado (chave Publishable)
- [ ] `SUPABASE_URL` adicionado (URL do projeto)
- [ ] `SUPABASE_DB_URL` adicionado (com senha real)
- [ ] `BACKUP_SENHA` adicionado (senha forte)
- [ ] Todos os 4 secrets estão em Settings → Secrets

---

## 🧪 Testar Workflows

Após adicionar os secrets:

1. Vá para: https://github.com/LevyCupira/granafy/actions
2. Clique em cada workflow:
   - **Deploy** → Click "Run workflow"
   - **Supabase - manter ativo** → Click "Run workflow"
   - **Supabase - backup** → Click "Run workflow"
3. Verifique se todos passam (✅ verde)

---

## 📅 Agendamento Automático

Após configurados, os workflows rodam automaticamente:

| Workflow | Frequência | Próxima Execução |
|----------|-----------|------------------|
| Deploy | Manual + Push | Quando você faz git push |
| Keep-Alive | A cada 2 dias | 08:17 Brasília |
| Backup | 1x semana | Toda segunda às 6:43 |

---

## 🔒 Segurança

**Nunca:**
- 🚫 Commit secrets no repositório
- 🚫 Compartilhe SUPABASE_DB_URL ou BACKUP_SENHA
- 🚫 Coloque secrets em variáveis de ambiente locais (git)

**Sempre:**
- ✅ Use GitHub Secrets (criptografados)
- ✅ Regenere secrets se forem expostos
- ✅ Guarde BACKUP_SENHA em lugar seguro

---

## ❓ Troubleshooting

**Erro: "secret not found"**
- Secret não foi adicionado ou o nome está errado
- Nomes são case-sensitive: `SUPABASE_KEY` ≠ `supabase_key`

**Backup: "pg_dump not found"**
- Cliente PostgreSQL não instalou (raro, workflow instala automaticamente)
- Verificar logs no Actions

**Keep-Alive: "HTTP 401/403"**
- Chave Supabase expirou ou inválida
- Regenerar em: https://app.supabase.com/project/_/settings/api

**Workflow não roda no agendado**
- GitHub desliga workflows após 60 dias sem commits
- O workflow "keep-alive" reabilita automaticamente
- Se continuar desligado, clicar em "Enable" manualmente

---

## 📞 Referências

- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase API Keys](https://supabase.com/docs/guides/api/api-keys-and-tokens)
