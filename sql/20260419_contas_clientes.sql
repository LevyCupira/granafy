-- Granafy: contas bancarias por cliente.
-- Rode este arquivo no SQL Editor do Supabase depois da migracao user_id/RLS.

create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null default 'corrente',
  banco text not null,
  agencia text,
  numero text,
  created_at timestamptz not null default now(),
  constraint contas_tipo_check check (tipo in ('corrente', 'poupanca'))
);

alter table public.lancamentos
  add column if not exists conta_id uuid references public.contas(id) on delete set null;

create index if not exists idx_contas_cliente_id on public.contas(cliente_id);
create index if not exists idx_contas_user_id on public.contas(user_id);
create index if not exists idx_lancamentos_conta_id on public.lancamentos(conta_id);

alter table public.contas enable row level security;

drop policy if exists "contas_por_usuario_select" on public.contas;
drop policy if exists "contas_por_usuario_insert" on public.contas;
drop policy if exists "contas_por_usuario_update" on public.contas;
drop policy if exists "contas_por_usuario_delete" on public.contas;

create policy "contas_por_usuario_select" on public.contas
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

create policy "contas_por_usuario_insert" on public.contas
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "contas_por_usuario_update" on public.contas
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "contas_por_usuario_delete" on public.contas
  for delete using (auth.uid() = user_id);
