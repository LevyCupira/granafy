# Segurança - Configuração da Chave Supabase

## 🔐 Problema Corrigido

A chave Supabase estava hardcoded no arquivo `js/supabase.js`, expondo a credencial publicamente. Isso foi corrigido para carregar a chave de forma segura.

## ✅ Solução Implementada

O arquivo `js/supabase.js` agora carrega a chave a partir de:
1. `window.SUPABASE_KEY` (se injetada via script)
2. `process.env.SUPABASE_KEY` (em ambientes Node.js/build)
3. Retorna `null` se não encontrada (a aplicação exibirá erro apropriado)

## 🔧 Como Configurar

### Opção 1: Injetar via Script HTML (Desenvolvimento Local)

```html
<!-- Em index.html, ANTES de carregar supabase.js -->
<script>
  window.SUPABASE_KEY = 'sb_publishable_seu_token_aqui';
</script>
<script src="js/supabase.js"></script>
```

### Opção 2: Carregar do Servidor (Recomendado para Produção)

Criar um endpoint que retorna a chave:

```javascript
// Exemplo com backend Node.js/Express
app.get('/api/config', (req, res) => {
  res.json({
    supabaseKey: process.env.SUPABASE_KEY
  });
});
```

Depois carregar no frontend:

```javascript
// Em js/supabase.js ou antes de usá-lo
fetch('/api/config')
  .then(r => r.json())
  .then(config => {
    window.SUPABASE_KEY = config.supabaseKey;
    // reinicializar supabaseClient
  });
```

### Opção 3: Usar Variáveis de Ambiente do Build (GitHub Pages/Vercel)

Se usa GitHub Actions para build:

```yaml
# .github/workflows/deploy.yml
env:
  SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}

script:
  - npm run build
```

E no arquivo de build, injetar no HTML gerado:

```javascript
const html = fs.readFileSync('index.html', 'utf8');
const injected = html.replace(
  '</head>',
  `<script>window.SUPABASE_KEY = '${process.env.SUPABASE_KEY}';</script></head>`
);
fs.writeFileSync('index.html', injected);
```

## 🚨 Nunca Faça

- ❌ Commitar `.env` com chaves reais no Git
- ❌ Expor `SUPABASE_SECRET_KEY` em código frontend
- ❌ Armazenar credenciais em localStorage sem encriptação
- ❌ Usar a mesma chave em dev/staging/produção

## ✅ Checklist de Segurança

- [ ] Chave Supabase carregada dinamicamente (não hardcoded)
- [ ] `.env` adicionado ao `.gitignore`
- [ ] Chave regenerada se foi exposta
- [ ] Row Level Security (RLS) ativado no Supabase
- [ ] Policies de segurança configuradas por tabela
- [ ] Chaves diferentes para dev/staging/produção
- [ ] Audit logs ativados no Supabase

## 📚 Referências

- [Supabase - API Keys](https://supabase.com/docs/guides/api/api-keys-and-tokens)
- [Supabase - Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP - Secrets Management](https://owasp.org/www-community/attacks/Sensitive_Data_Exposure)
