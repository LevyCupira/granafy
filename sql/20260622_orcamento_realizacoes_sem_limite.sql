-- Granafy: permite mais de uma realizacao do mesmo extrato na mesma linha do orcamento.
-- Rode este arquivo no SQL Editor do Supabase se a base ja executou a migracao 20260621.

alter table if exists public.orcamento_eventos_realizacoes
  drop constraint if exists orcamento_eventos_realizacoes_linha_lancamento_unique;
