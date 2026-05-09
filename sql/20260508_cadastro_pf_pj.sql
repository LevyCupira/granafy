-- Granafy: reforco do cadastro de acesso e separacao PF/PJ nos clientes.
-- Rode este arquivo no SQL Editor do Supabase.

alter table public.perfis
  add column if not exists perfil_uso text not null default 'pf',
  add column if not exists aceitou_termos_em timestamptz;

alter table public.perfis
  drop constraint if exists perfis_perfil_uso_check;

alter table public.perfis
  add constraint perfis_perfil_uso_check
  check (perfil_uso in ('pf', 'pj', 'consultor'));

create index if not exists idx_perfis_perfil_uso on public.perfis(perfil_uso);

alter table public.clientes
  add column if not exists tipo_cliente text not null default 'pf',
  add column if not exists documento text,
  add column if not exists telefone text,
  add column if not exists email_financeiro text,
  add column if not exists responsavel text,
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists observacoes text;

alter table public.clientes
  drop constraint if exists clientes_tipo_cliente_check;

alter table public.clientes
  add constraint clientes_tipo_cliente_check
  check (tipo_cliente in ('pf', 'pj'));

create index if not exists idx_clientes_tipo_cliente on public.clientes(tipo_cliente);
create index if not exists idx_clientes_documento on public.clientes(documento);
