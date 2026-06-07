-- Granafy: recorrência financeira, auditoria financeira e fechamento de período.
-- Rode este arquivo no SQL Editor do Supabase depois das migrações anteriores.

alter table public.titulos_financeiros
  add column if not exists recorrencia_ativa boolean not null default false,
  add column if not exists recorrencia_frequencia text,
  add column if not exists recorrencia_intervalo integer not null default 1,
  add column if not exists recorrencia_fim date,
  add column if not exists origem_recorrencia_id uuid references public.titulos_financeiros(id) on delete set null;

alter table public.titulos_financeiros
  drop constraint if exists titulos_financeiros_recorrencia_frequencia_check;

alter table public.titulos_financeiros
  add constraint titulos_financeiros_recorrencia_frequencia_check
  check (recorrencia_frequencia is null or recorrencia_frequencia in ('semanal', 'mensal'));

alter table public.titulos_financeiros
  drop constraint if exists titulos_financeiros_recorrencia_intervalo_check;

alter table public.titulos_financeiros
  add constraint titulos_financeiros_recorrencia_intervalo_check
  check (recorrencia_intervalo >= 1);

create index if not exists idx_titulos_financeiros_origem_recorrencia
  on public.titulos_financeiros (origem_recorrencia_id);

create table if not exists public.auditoria_financeira (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  modulo text not null default 'financeiro',
  evento text not null,
  entidade text not null,
  entidade_id uuid,
  resumo text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint auditoria_financeira_modulo_check check (modulo in ('financeiro', 'extrato'))
);

create index if not exists idx_auditoria_financeira_cliente_id
  on public.auditoria_financeira (cliente_id, created_at desc);

create index if not exists idx_auditoria_financeira_entidade
  on public.auditoria_financeira (entidade, entidade_id);

alter table public.auditoria_financeira enable row level security;

drop policy if exists "auditoria_financeira_select" on public.auditoria_financeira;
drop policy if exists "auditoria_financeira_insert" on public.auditoria_financeira;
drop policy if exists "auditoria_financeira_update" on public.auditoria_financeira;
drop policy if exists "auditoria_financeira_delete" on public.auditoria_financeira;

create policy "auditoria_financeira_select" on public.auditoria_financeira
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "auditoria_financeira_insert" on public.auditoria_financeira
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "auditoria_financeira_update" on public.auditoria_financeira
  for update using (
    public.is_admin()
  ) with check (
    public.is_admin()
  );

create policy "auditoria_financeira_delete" on public.auditoria_financeira
  for delete using (
    public.is_admin()
  );

create table if not exists public.fechamentos_periodo (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  referencia text not null,
  status text not null default 'fechado',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fechamentos_periodo_status_check check (status in ('aberto', 'fechado')),
  constraint fechamentos_periodo_referencia_check check (referencia ~ '^[0-9]{4}-[0-9]{2}$')
);

create unique index if not exists uq_fechamentos_periodo_cliente_referencia
  on public.fechamentos_periodo (cliente_id, referencia);

create index if not exists idx_fechamentos_periodo_cliente_id
  on public.fechamentos_periodo (cliente_id, referencia);

create or replace function public.touch_fechamentos_periodo_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fechamentos_periodo_updated_at on public.fechamentos_periodo;
create trigger trg_fechamentos_periodo_updated_at
before update on public.fechamentos_periodo
for each row execute function public.touch_fechamentos_periodo_updated_at();

alter table public.fechamentos_periodo enable row level security;

drop policy if exists "fechamentos_periodo_select" on public.fechamentos_periodo;
drop policy if exists "fechamentos_periodo_insert" on public.fechamentos_periodo;
drop policy if exists "fechamentos_periodo_update" on public.fechamentos_periodo;
drop policy if exists "fechamentos_periodo_delete" on public.fechamentos_periodo;

create policy "fechamentos_periodo_select" on public.fechamentos_periodo
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "fechamentos_periodo_insert" on public.fechamentos_periodo
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "fechamentos_periodo_update" on public.fechamentos_periodo
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "fechamentos_periodo_delete" on public.fechamentos_periodo
  for delete using (
    public.is_admin()
  );
