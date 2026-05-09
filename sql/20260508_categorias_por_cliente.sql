-- Granafy: categorias personalizadas por cliente.
-- Rode este arquivo no SQL Editor do Supabase depois das migracoes de user_id/RLS.

create table if not exists public.categorias_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  escopo text not null,
  nome text not null,
  tipo text not null default 'variavel',
  fixa boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categorias_cliente_escopo_check check (escopo in ('cc', 'cartao')),
  constraint categorias_cliente_tipo_check check (tipo in ('receita', 'fixa', 'variavel', 'transferencia'))
);

create unique index if not exists uq_categorias_cliente_nome
  on public.categorias_cliente (cliente_id, escopo, lower(nome));

create index if not exists idx_categorias_cliente_cliente_id
  on public.categorias_cliente (cliente_id);

create index if not exists idx_categorias_cliente_user_id
  on public.categorias_cliente (user_id);

create or replace function public.touch_categorias_cliente_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_categorias_cliente_updated_at on public.categorias_cliente;
create trigger trg_categorias_cliente_updated_at
before update on public.categorias_cliente
for each row execute function public.touch_categorias_cliente_updated_at();

alter table public.categorias_cliente enable row level security;

drop policy if exists "categorias_cliente_por_usuario_select" on public.categorias_cliente;
drop policy if exists "categorias_cliente_por_usuario_insert" on public.categorias_cliente;
drop policy if exists "categorias_cliente_por_usuario_update" on public.categorias_cliente;
drop policy if exists "categorias_cliente_por_usuario_delete" on public.categorias_cliente;

create policy "categorias_cliente_por_usuario_select" on public.categorias_cliente
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

create policy "categorias_cliente_por_usuario_insert" on public.categorias_cliente
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "categorias_cliente_por_usuario_update" on public.categorias_cliente
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "categorias_cliente_por_usuario_delete" on public.categorias_cliente
  for delete using (auth.uid() = user_id);
