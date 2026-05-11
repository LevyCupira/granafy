-- Granafy: relacionamentos gerenciais por cliente no extrato.
-- Rode este arquivo no SQL Editor do Supabase depois das migracoes anteriores.

create table if not exists public.relacionamentos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null default 'interno',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relacionamentos_cliente_tipo_check check (tipo in ('pf', 'pj', 'interno', 'terceiro'))
);

alter table public.lancamentos
  add column if not exists descricao_original text,
  add column if not exists relacionamento_id uuid references public.relacionamentos_cliente(id) on delete set null,
  add column if not exists observacao text;

create unique index if not exists uq_relacionamentos_cliente_nome
  on public.relacionamentos_cliente (cliente_id, lower(nome));

create index if not exists idx_relacionamentos_cliente_cliente_id
  on public.relacionamentos_cliente (cliente_id);

create index if not exists idx_relacionamentos_cliente_user_id
  on public.relacionamentos_cliente (user_id);

create index if not exists idx_lancamentos_relacionamento_id
  on public.lancamentos (relacionamento_id);

create or replace function public.touch_relacionamentos_cliente_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_relacionamentos_cliente_updated_at on public.relacionamentos_cliente;
create trigger trg_relacionamentos_cliente_updated_at
before update on public.relacionamentos_cliente
for each row execute function public.touch_relacionamentos_cliente_updated_at();

alter table public.relacionamentos_cliente enable row level security;

drop policy if exists "relacionamentos_cliente_por_usuario_select" on public.relacionamentos_cliente;
drop policy if exists "relacionamentos_cliente_por_usuario_insert" on public.relacionamentos_cliente;
drop policy if exists "relacionamentos_cliente_por_usuario_update" on public.relacionamentos_cliente;
drop policy if exists "relacionamentos_cliente_por_usuario_delete" on public.relacionamentos_cliente;

create policy "relacionamentos_cliente_por_usuario_select" on public.relacionamentos_cliente
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

create policy "relacionamentos_cliente_por_usuario_insert" on public.relacionamentos_cliente
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "relacionamentos_cliente_por_usuario_update" on public.relacionamentos_cliente
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "relacionamentos_cliente_por_usuario_delete" on public.relacionamentos_cliente
  for delete using (auth.uid() = user_id);
