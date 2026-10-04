#!/usr/bin/env node

/**
 * Script para injetar chave Supabase no index.html
 * Uso: node scripts/inject-supabase-key.js [chave_supabase]
 */

const fs = require('fs');
const path = require('path');

const supabaseKey = process.argv[2];
const indexPath = path.join(__dirname, '..', 'index.html');

if (!supabaseKey) {
  console.error('❌ Erro: Informe a chave Supabase como argumento');
  console.error('Uso: node scripts/inject-supabase-key.js "sb_publishable_..."');
  process.exit(1);
}

if (!supabaseKey.startsWith('sb_publishable_')) {
  console.error('❌ Erro: A chave deve começar com "sb_publishable_"');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('❌ Erro: Arquivo index.html não encontrado');
  process.exit(1);
}

try {
  let content = fs.readFileSync(indexPath, 'utf8');
  const originalLength = content.length;

  // Injetar chave
  content = content.replace(
    /window\.SUPABASE_KEY = window\.SUPABASE_KEY \|\| 'sb_publishable_[^']*'/,
    `window.SUPABASE_KEY = window.SUPABASE_KEY || '${supabaseKey}'`
  );

  if (content.length === originalLength) {
    console.warn('⚠️  Aviso: Padrão não encontrado, verificando se já foi injetado...');
  }

  fs.writeFileSync(indexPath, content);
  console.log('✅ Chave Supabase injetada com sucesso!');
  console.log(`📝 Arquivo: ${indexPath}`);
  console.log(`🔑 Chave: ${supabaseKey.substring(0, 20)}...`);

} catch (error) {
  console.error('❌ Erro ao injetar chave:', error.message);
  process.exit(1);
}
