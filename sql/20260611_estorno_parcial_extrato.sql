-- Granafy: valor parcial de estorno no Extrato.
-- Rode este arquivo no SQL Editor do Supabase antes de usar estorno parcial.

alter table public.lancamentos
  add column if not exists estorno_valor numeric(14,2) null;
