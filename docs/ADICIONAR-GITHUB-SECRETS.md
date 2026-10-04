# 🔑 Como Adicionar GitHub Secrets - Passo a Passo

**Tempo estimado: 2 minutos**

---

## 📍 Passo 1: Ir para a Página de Secrets

### 1.1 Abra o GitHub
Vá para: https://github.com/LevyCupira/granafy

### 1.2 Clique em "Settings"
```
Repositório
  └─ Aba "Settings" (a última aba, com ⚙️)
```

### 1.3 No menu esquerdo, clique em "Secrets and variables"
```
Desenvolper settings
  └─ Secrets and variables
      └─ Actions ⬅️ Clique aqui
```

**Resultado esperado:** Você vê botão azul "New repository secret"

---

## 🔐 Passo 2: Adicionar SUPABASE_DB_URL

### 2.1 Clique em "New repository secret"

### 2.2 Preencha o formulário

| Campo | Valor |
|-------|-------|
| **Name** | `SUPABASE_DB_URL` |
| **Secret** | Cole aqui (veja abaixo) |

### 2.3 Qual valor colar?

Abra seu arquivo `.env.secrets.local` na pasta do Granafy:
```
C:\Users\Levy Silva\GranaFy\.env.secrets.local
```

Procure pela linha:
```
SUPABASE_DB_URL=postgresql://postgres:88604396Le@pjnnkaafrxruooplccnz.pooler.supabase.com:6543/postgres
```

**Copie tudo depois do `=`:**
```
postgresql://postgres:88604396Le@pjnnkaafrxruooplccnz.pooler.supabase.com:6543/postgres
```

### 2.4 Cole no GitHub
```
[Nome do Secret]
SUPABASE_DB_URL

[Valor]
postgresql://postgres:88604396Le@pjnnkaafrxruooplccnz.pooler.supabase.com:6543/postgres
```

### 2.5 Clique em "Add secret"
✅ Pronto! Secret adicionado.

---

## 🔐 Passo 3: Adicionar BACKUP_SENHA

### 3.1 Clique em "New repository secret" novamente

### 3.2 Preencha o formulário

| Campo | Valor |
|-------|-------|
| **Name** | `BACKUP_SENHA` |
| **Secret** | Cole aqui (veja abaixo) |

### 3.3 Qual valor colar?

No seu arquivo `.env.secrets.local`, procure:
```
BACKUP_SENHA=Gr@n@fy#B@ckup$2026!
```

**Copie tudo depois do `=`:**
```
Gr@n@fy#B@ckup$2026!
```

### 3.4 Cole no GitHub
```
[Nome do Secret]
BACKUP_SENHA

[Valor]
Gr@n@fy#B@ckup$2026!
```

### 3.5 Clique em "Add secret"
✅ Pronto! Segundo secret adicionado.

---

## ✅ Verificar se Funcionou

### 3.6 Volte para a lista de secrets
```
Settings
  └─ Secrets and variables
      └─ Actions
```

Você deve ver:
```
✓ SUPABASE_KEY        (já estava lá)
✓ SUPABASE_URL        (já estava lá)
✓ SUPABASE_DB_URL     ← NOVO
✓ BACKUP_SENHA        ← NOVO
```

---

## 🚀 Próximas Etapas Automáticas

Assim que os secrets foram adicionados:

### Deploy Automático
```
Próximo git push main
  ↓
GitHub Actions injeta SUPABASE_KEY
  ↓
Deploy automático para GitHub Pages
```

### Backup Semanal
```
Próxima segunda-feira 06:43
  ↓
Backup automático (criptografado)
  ↓
Guardado por 90 dias no GitHub
```

### Keep-Alive
```
A cada 2 dias 08:17
  ↓
Consulta ao banco Supabase
  ↓
Mantém tudo ativo (sem pausar)
```

---

## 🐛 Se Algo Der Errado

### Erro: "HTTP 401/403" no workflow

**Causa:** Secret não foi configurado ou tem valor errado

**Solução:**
1. Volte para Settings → Secrets
2. Verifique se **SUPABASE_DB_URL** está lá
3. Verifique se **BACKUP_SENHA** está lá
4. Se faltam, adicione novamente (Passo 2 e 3)

### Erro: "secret not found"

**Causa:** Nome do secret está errado (case-sensitive)

**Solução:**
- Tem que ser: `SUPABASE_DB_URL` (maiúscula)
- NÃO é: `supabase_db_url` (minúscula)
- NÃO é: `Supabase_Db_Url` (misto)

### Erro: Workflow roda mas não faz backup

**Causa:** BACKUP_SENHA não foi adicionado

**Solução:** Adicione o secret BACKUP_SENHA (Passo 3)

---

## 🔒 Segurança

⚠️ **NUNCA:**
- ❌ Compartilhe o valor dos secrets
- ❌ Coloque em commit no Git
- ❌ Deixe visível na tela
- ❌ Envie por email/chat

✅ **SEMPRE:**
- ✅ Guarde em lugar seguro (1Password, LastPass)
- ✅ Use GitHub Secrets (criptografados)
- ✅ Se expirar/vazar, regenere imediatamente

---

## 📋 Checklist Final

- [ ] Abri Settings do repositório GitHub
- [ ] Fui para Secrets and variables → Actions
- [ ] Adicionei SUPABASE_DB_URL
- [ ] Adicionei BACKUP_SENHA
- [ ] Verifiquei que ambos aparecem na lista
- [ ] Guardei os valores em lugar seguro (1Password/etc)

---

## ✨ Parabéns!

Você configurou com sucesso:
- ✅ Deploy automático
- ✅ Backup semanal criptografado
- ✅ Keep-Alive para Supabase

**O Granafy está 100% pronto para produção!** 🚀

---

*Documento criado por Claude Haiku 4.5*
*Projeto: Granafy - Financial Management Platform*
