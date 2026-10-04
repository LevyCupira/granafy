# Configuração Rápida - Variáveis de Ambiente

## ⚡ Setup em 5 Minutos

### 1️⃣ Preparar a Chave Supabase

1. Acesse: https://app.supabase.com/project/_/settings/api
2. Copie a chave **Publishable** (começa com `sb_publishable_`)

### 2️⃣ Configurar GitHub Secrets

1. Vá para: https://github.com/LevyCupira/granafy/settings/secrets/actions
2. Clique em **"New repository secret"**
3. Preencha:
   - **Name:** `SUPABASE_KEY`
   - **Value:** Cole a chave que copiou
4. Clique **"Add secret"**

### 3️⃣ Fazer Push de Trigger

O workflow do GitHub Actions já está configurado. Agora:

```bash
git push origin main
```

Isso vai:
- ✅ Injetar a chave automaticamente
- ✅ Fazer deploy para GitHub Pages
- ✅ Site fica disponível em: https://levycupira.github.io/granafy/

### 4️⃣ Verificar Deploy

1. Vá para: https://github.com/LevyCupira/granafy/actions
2. Clique no workflow mais recente
3. Verifique se passou em todos os steps

---

## 🔧 Variantes Locais (Desenvolvimento)

### PowerShell (Windows)

```powershell
.\scripts\inject-supabase-key.ps1 -Key "sb_publishable_sua_chave_aqui"
```

### Node.js (Multiplataforma)

```bash
node scripts/inject-supabase-key.js "sb_publishable_sua_chave_aqui"
```

### Manual (Qualquer Sistema)

Editar `index.html` linha 167 e substituir:

```javascript
// ANTES
window.SUPABASE_KEY = window.SUPABASE_KEY || 'sb_publishable_hiH2CKVSf-he9QP_M3ByrQ_wXXbKZbf';

// DEPOIS
window.SUPABASE_KEY = window.SUPABASE_KEY || 'sb_publishable_SUA_CHAVE_AQUI';
```

---

## 🛡️ Segurança

- ✅ **Nunca** commitar chave real no repositório
- ✅ **Sempre** usar GitHub Secrets para produção
- ✅ **Regenerar** chave se for exposta
- ✅ **Manter** `.env` no `.gitignore`

---

## 📝 Próximos Passos

Após configurar:

1. Teste o login em produção
2. Verifique se "Manter conectado" funciona
3. Monitore as ações do GitHub para futuros deploys

---

## ❓ FAQ

**P: E se eu esquecer de colocar o secret?**
A: O deploy vai usar a chave placeholder do repositório. Não vai funcionar em produção.

**P: Posso testar localmente?**
A: Sim! Use os scripts em `scripts/` para injetar a chave localmente antes de testar.

**P: Como regenerar a chave?**
A: Crie nova chave em Supabase → Atualize o secret no GitHub → Faça um novo push.

**P: A chave fica segura?**
A: Sim. GitHub Secrets são criptografados e visíveis apenas durante build.
