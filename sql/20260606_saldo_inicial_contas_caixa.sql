-- Granafy: saldo inicial por conta + tipo de conta Caixa.
-- Rode este arquivo no SQL Editor do Supabase.

alter table public.contas
  add column if not exists saldo_inicial numeric(14,2) not null default 0;

update public.contas
set saldo_inicial = 0
where saldo_inicial is null;

alter table public.contas
  drop constraint if exists contas_tipo_check;

alter table public.contas
  add constraint contas_tipo_check check (tipo in ('corrente', 'poupanca', 'caixa'));
