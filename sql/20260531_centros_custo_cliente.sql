-- Granafy: centros de custo por cliente.
-- Rode este arquivo no SQL Editor do Supabase depois das migracoes anteriores.

create table if not exists public.centros_custo_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_centros_custo_cliente_nome
  on public.centros_custo_cliente (cliente_id, lower(nome));

create index if not exists idx_centros_custo_cliente_cliente_id
  on public.centros_custo_cliente (cliente_id);

create index if not exists idx_centros_custo_cliente_user_id
  on public.centros_custo_cliente (user_id);

create or replace function public.touch_centros_custo_cliente_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.nome = trim(new.nome);
  return new;
end;
$$;

drop trigger if exists trg_centros_custo_cliente_updated_at on public.centros_custo_cliente;
create trigger trg_centros_custo_cliente_updated_at
before insert or update on public.centros_custo_cliente
for each row execute function public.touch_centros_custo_cliente_updated_at();

alter table public.centros_custo_cliente enable row level security;

drop policy if exists "centros_custo_cliente_select" on public.centros_custo_cliente;
drop policy if exists "centros_custo_cliente_insert" on public.centros_custo_cliente;
drop policy if exists "centros_custo_cliente_update" on public.centros_custo_cliente;
drop policy if exists "centros_custo_cliente_delete" on public.centros_custo_cliente;

create policy "centros_custo_cliente_select" on public.centros_custo_cliente
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "centros_custo_cliente_insert" on public.centros_custo_cliente
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "centros_custo_cliente_update" on public.centros_custo_cliente
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "centros_custo_cliente_delete" on public.centros_custo_cliente
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

alter table public.lancamentos
  add column if not exists centro_custo_id uuid references public.centros_custo_cliente(id) on delete set null;

create index if not exists idx_lancamentos_centro_custo_id
  on public.lancamentos (centro_custo_id);

alter table public.titulos_financeiros
  add column if not exists centro_custo_id uuid references public.centros_custo_cliente(id) on delete set null;

create index if not exists idx_titulos_financeiros_centro_custo_id
  on public.titulos_financeiros (centro_custo_id);

drop policy if exists "lancamentos_por_usuario_insert" on public.lancamentos;
drop policy if exists "lancamentos_por_usuario_update" on public.lancamentos;

create policy "lancamentos_por_usuario_insert" on public.lancamentos
  for insert with check (
    public.user_has_client_access(cliente_id, true)
    and (conta_id is null or exists (
      select 1 from public.contas ct
      where ct.id = conta_id
        and ct.cliente_id = cliente_id
    ))
    and (centro_custo_id is null or exists (
      select 1 from public.centros_custo_cliente cc
      where cc.id = centro_custo_id
        and cc.cliente_id = cliente_id
    ))
  );

create policy "lancamentos_por_usuario_update" on public.lancamentos
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
    and (conta_id is null or exists (
      select 1 from public.contas ct
      where ct.id = conta_id
        and ct.cliente_id = cliente_id
    ))
    and (centro_custo_id is null or exists (
      select 1 from public.centros_custo_cliente cc
      where cc.id = centro_custo_id
        and cc.cliente_id = cliente_id
    ))
  );

drop policy if exists "titulos_financeiros_por_usuario_insert" on public.titulos_financeiros;
drop policy if exists "titulos_financeiros_por_usuario_update" on public.titulos_financeiros;

create policy "titulos_financeiros_por_usuario_insert" on public.titulos_financeiros
  for insert with check (
    public.user_has_client_access(cliente_id, true)
    and (centro_custo_id is null or exists (
      select 1 from public.centros_custo_cliente cc
      where cc.id = centro_custo_id
        and cc.cliente_id = cliente_id
    ))
  );

create policy "titulos_financeiros_por_usuario_update" on public.titulos_financeiros
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
    and (centro_custo_id is null or exists (
      select 1 from public.centros_custo_cliente cc
      where cc.id = centro_custo_id
        and cc.cliente_id = cliente_id
    ))
  );
