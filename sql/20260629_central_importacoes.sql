create table if not exists public.importacao_lotes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null,
  arquivo_nome text,
  quantidade integer not null default 0,
  valor_total numeric(14,2) not null default 0,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  constraint importacao_lotes_area_check check (area in ('extrato', 'cartao', 'financeiro', 'importacao')),
  constraint importacao_lotes_status_check check (status in ('ativo', 'removido'))
);

create table if not exists public.importacao_itens (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.importacao_lotes(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tabela_destino text not null,
  registro_id uuid not null,
  resumo jsonb not null default '{}'::jsonb,
  valor numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint importacao_itens_tabela_check check (tabela_destino in ('lancamentos', 'lancamentos_cartao', 'titulos_financeiros'))
);

create index if not exists idx_importacao_lotes_cliente_id
  on public.importacao_lotes(cliente_id);

create index if not exists idx_importacao_lotes_user_id
  on public.importacao_lotes(user_id);

create index if not exists idx_importacao_itens_lote_id
  on public.importacao_itens(lote_id);

create index if not exists idx_importacao_itens_registro_id
  on public.importacao_itens(registro_id);

alter table public.importacao_lotes enable row level security;
alter table public.importacao_itens enable row level security;

drop policy if exists "importacao_lotes_por_usuario_select" on public.importacao_lotes;
drop policy if exists "importacao_lotes_por_usuario_insert" on public.importacao_lotes;
drop policy if exists "importacao_lotes_por_usuario_update" on public.importacao_lotes;
drop policy if exists "importacao_lotes_por_usuario_delete" on public.importacao_lotes;

create policy "importacao_lotes_por_usuario_select" on public.importacao_lotes
for select using (
  public.user_has_client_access(cliente_id, false)
);

create policy "importacao_lotes_por_usuario_insert" on public.importacao_lotes
for insert with check (
  user_id = auth.uid()
  and public.user_has_client_access(cliente_id, true)
);

create policy "importacao_lotes_por_usuario_update" on public.importacao_lotes
for update using (
  public.user_has_client_access(cliente_id, true)
) with check (
  public.user_has_client_access(cliente_id, true)
);

create policy "importacao_lotes_por_usuario_delete" on public.importacao_lotes
for delete using (
  public.user_has_client_access(cliente_id, true)
);

drop policy if exists "importacao_itens_por_usuario_select" on public.importacao_itens;
drop policy if exists "importacao_itens_por_usuario_insert" on public.importacao_itens;
drop policy if exists "importacao_itens_por_usuario_update" on public.importacao_itens;
drop policy if exists "importacao_itens_por_usuario_delete" on public.importacao_itens;

create policy "importacao_itens_por_usuario_select" on public.importacao_itens
for select using (
  public.user_has_client_access(cliente_id, false)
);

create policy "importacao_itens_por_usuario_insert" on public.importacao_itens
for insert with check (
  user_id = auth.uid()
  and public.user_has_client_access(cliente_id, true)
  and exists (
    select 1 from public.importacao_lotes l
    where l.id = lote_id
      and l.cliente_id = cliente_id
  )
);

create policy "importacao_itens_por_usuario_update" on public.importacao_itens
for update using (
  public.user_has_client_access(cliente_id, true)
) with check (
  public.user_has_client_access(cliente_id, true)
  and exists (
    select 1 from public.importacao_lotes l
    where l.id = lote_id
      and l.cliente_id = cliente_id
  )
);

create policy "importacao_itens_por_usuario_delete" on public.importacao_itens
for delete using (
  public.user_has_client_access(cliente_id, true)
);
