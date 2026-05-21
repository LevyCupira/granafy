-- Granafy: contas a receber / contas a pagar para clientes PJ
-- Rode este arquivo no SQL Editor do Supabase depois das migracoes anteriores.

create table if not exists public.titulos_financeiros (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  natureza text not null,
  pessoa_nome text not null,
  descricao text not null,
  categoria text,
  vencimento date,
  valor_total numeric(14,2) not null default 0,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint titulos_financeiros_natureza_check check (natureza in ('receber', 'pagar')),
  constraint titulos_financeiros_valor_total_check check (valor_total >= 0)
);

create table if not exists public.titulos_financeiros_baixas (
  id uuid primary key default gen_random_uuid(),
  titulo_id uuid not null references public.titulos_financeiros(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data_baixa date not null default current_date,
  valor numeric(14,2) not null default 0,
  observacao text,
  origem text not null default 'manual',
  extrato_lancamento_id uuid references public.lancamentos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint titulos_financeiros_baixas_origem_check check (origem in ('manual', 'extrato')),
  constraint titulos_financeiros_baixas_valor_check check (valor > 0)
);

create index if not exists idx_titulos_financeiros_cliente_id
  on public.titulos_financeiros (cliente_id);

create index if not exists idx_titulos_financeiros_user_id
  on public.titulos_financeiros (user_id);

create index if not exists idx_titulos_financeiros_natureza
  on public.titulos_financeiros (natureza);

create index if not exists idx_titulos_financeiros_baixas_titulo_id
  on public.titulos_financeiros_baixas (titulo_id);

create index if not exists idx_titulos_financeiros_baixas_cliente_id
  on public.titulos_financeiros_baixas (cliente_id);

create index if not exists idx_titulos_financeiros_baixas_user_id
  on public.titulos_financeiros_baixas (user_id);

create or replace function public.touch_titulos_financeiros_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.touch_titulos_financeiros_baixas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_titulos_financeiros_updated_at on public.titulos_financeiros;
create trigger trg_titulos_financeiros_updated_at
before update on public.titulos_financeiros
for each row execute function public.touch_titulos_financeiros_updated_at();

drop trigger if exists trg_titulos_financeiros_baixas_updated_at on public.titulos_financeiros_baixas;
create trigger trg_titulos_financeiros_baixas_updated_at
before update on public.titulos_financeiros_baixas
for each row execute function public.touch_titulos_financeiros_baixas_updated_at();

alter table public.titulos_financeiros enable row level security;
alter table public.titulos_financeiros_baixas enable row level security;

drop policy if exists "titulos_financeiros_por_usuario_select" on public.titulos_financeiros;
drop policy if exists "titulos_financeiros_por_usuario_insert" on public.titulos_financeiros;
drop policy if exists "titulos_financeiros_por_usuario_update" on public.titulos_financeiros;
drop policy if exists "titulos_financeiros_por_usuario_delete" on public.titulos_financeiros;

create policy "titulos_financeiros_por_usuario_select" on public.titulos_financeiros
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

create policy "titulos_financeiros_por_usuario_insert" on public.titulos_financeiros
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "titulos_financeiros_por_usuario_update" on public.titulos_financeiros
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "titulos_financeiros_por_usuario_delete" on public.titulos_financeiros
  for delete using (auth.uid() = user_id);

drop policy if exists "titulos_financeiros_baixas_por_usuario_select" on public.titulos_financeiros_baixas;
drop policy if exists "titulos_financeiros_baixas_por_usuario_insert" on public.titulos_financeiros_baixas;
drop policy if exists "titulos_financeiros_baixas_por_usuario_update" on public.titulos_financeiros_baixas;
drop policy if exists "titulos_financeiros_baixas_por_usuario_delete" on public.titulos_financeiros_baixas;

create policy "titulos_financeiros_baixas_por_usuario_select" on public.titulos_financeiros_baixas
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

create policy "titulos_financeiros_baixas_por_usuario_insert" on public.titulos_financeiros_baixas
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.titulos_financeiros t
      join public.clientes c on c.id = t.cliente_id
      where t.id = titulo_id
        and t.cliente_id = cliente_id
        and c.user_id = auth.uid()
    )
  );

create policy "titulos_financeiros_baixas_por_usuario_update" on public.titulos_financeiros_baixas
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.titulos_financeiros t
      join public.clientes c on c.id = t.cliente_id
      where t.id = titulo_id
        and t.cliente_id = cliente_id
        and c.user_id = auth.uid()
    )
  );

create policy "titulos_financeiros_baixas_por_usuario_delete" on public.titulos_financeiros_baixas
  for delete using (auth.uid() = user_id);
