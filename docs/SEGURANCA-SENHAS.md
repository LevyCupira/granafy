# 🔐 Segurança de Senhas e Credenciais

## Aviso Crítico

**Este documento trata de informações sensíveis. Acesso RESTRITO.**

---

## 📁 Arquivo de Senhas Local

### Localização
```
.env.secrets.local
```

### Proteção
- ✅ Está no `.gitignore` — **NUNCA será enviado para GitHub**
- ✅ Arquivo local apenas — apenas você tem acesso
- ✅ Documentado — fácil encontrar quando precisar

---

## 🔑 Credenciais Armazenadas

### 1. SUPABASE_DB_URL
- **Tipo:** String de conexão com banco de dados
- **Contém:** Senha real do banco (CRÍTICA!)
- **Localização:** `.env.secrets.local`
- **GitHub Secret:** `SUPABASE_DB_URL` (criptografado)

### 2. BACKUP_SENHA
- **Tipo:** Senha para criptografia de backups
- **Contém:** Senha forte (16+ caracteres)
- **Localização:** `.env.secrets.local`
- **GitHub Secret:** `BACKUP_SENHA` (criptografado)
- **⚠️ Crítico:** Sem esta senha, **não consegue abrir os backups!**

---

## 🛡️ Onde Guardar com Segurança

### Recomendado (escolha UMA):
1. **1Password** (melhor)
2. **LastPass**
3. **Bitwarden** (open-source)
4. **Keeper**
5. **Documento físico** em cofre (última opção)

### ❌ NUNCA:
- ❌ Em arquivo texto no computador (sem encriptação)
- ❌ Em email ou mensagens
- ❌ Em Google Drive/Dropbox sem encriptação
- ❌ No GitHub (mesmo privado é risco)
- ❌ Em post-its na parede 😅

---

## 📋 Checklist de Segurança

- [ ] `.env.secrets.local` criado e protegido
- [ ] Arquivo está no `.gitignore`
- [ ] Backup_Senha guardado em 1Password/LastPass
- [ ] SUPABASE_DB_URL guardado em local seguro
- [ ] GitHub Secrets configurados (SUPABASE_DB_URL, BACKUP_SENHA)
- [ ] Ninguém mais tem acesso às senhas
- [ ] Computador com senha/autenticação biométrica
- [ ] Nenhuma senha em histórico de terminal/bash

---

## 🔄 Se Algo Acontecer...

### Se a senha vazar/expirar:

1. **Regenerar no Supabase:**
   - Vá para Supabase → Database Settings
   - Gere nova connection string
   - Atualize `.env.secrets.local`

2. **Atualizar GitHub:**
   - Settings → Secrets → SUPABASE_DB_URL
   - Cole a nova string

3. **Atualizar cópia segura:**
   - 1Password / LastPass
   - Seu documento de backup

4. **Comunicar (se necessário):**
   - Se compartilhou acidentalmente, avise a equipe

---

## 🚨 Rotina de Manutenção

### Mensalmente:
- [ ] Verifique se `.env.secrets.local` ainda existe
- [ ] Confirme que não foi commitado (git log)
- [ ] Backup_Senha está seguro?

### Quando precisar fazer backup:
- [ ] Certifique-se que BACKUP_SENHA está guardada em local seguro
- [ ] Teste se consegue descriptografar um backup antigo
- [ ] Mantenha histórico de senhas (para poder acessar backups antigos)

### Quando compartilhar projeto:
- [ ] ✅ SEMPRE avise sobre `.env.secrets.local`
- [ ] ✅ NUNCA envie o arquivo
- [ ] ✅ Instruir nova pessoa a criar seu próprio
- [ ] ✅ Compartilhar credenciais via 1Password/LastPass (nunca texto)

---

## 📞 Contato de Emergência

Se ocorrer vazamento de credenciais:

1. **Imediato:** Regenere as senhas no Supabase
2. **Supabase:** Revogar credenciais antigas
3. **GitHub:** Atualizar os secrets
4. **Equipe:** Notifique se alguém teve acesso
5. **Auditoria:** Verifique logs do Supabase

---

## ✅ Conclusão

As credenciais do Granafy são **CRÍTICAS** para:
- 🗄️ Acesso ao banco de dados
- 💾 Descriptografia de backups
- 🔐 Segurança de todos os dados dos usuários

**Trate com o máximo de cuidado!**

---

*Última atualização: 2026-10-04*
*Criado por: Claude Haiku 4.5*
