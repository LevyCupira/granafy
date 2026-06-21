-- Granafy: conciliacao direta do Extrato com linhas do orcamento de eventos.
-- Rode este arquivo no SQL Editor do Supabase antes de testar o novo fluxo.

create table if not exists public.orcamento_eventos_realizacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  orcamento_linha_id uuid not null references public.orcamento_eventos_linhas(id) on delete cascade,
  extrato_lancamento_id uuid not null references public.lancamentos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data_realizacao date not null default current_date,
  valor numeric(14,2) not null,
  observacao text,
  created_at timestamptz not null default now(),
  constraint orcamento_eventos_realizacoes_valor_check check (valor > 0),
  constraint orcamento_eventos_realizacoes_linha_lancamento_unique
    unique (orcamento_linha_id, extrato_lancamento_id)
);

create index if not exists idx_orcamento_eventos_realizacoes_cliente_id
  on public.orcamento_eventos_realizacoes (cliente_id);

create index if not exists idx_orcamento_eventos_realizacoes_linha_id
  on public.orcamento_eventos_realizacoes (orcamento_linha_id);

create index if not exists idx_orcamento_eventos_realizacoes_lancamento_id
  on public.orcamento_eventos_realizacoes (extrato_lancamento_id);

alter table public.orcamento_eventos_realizacoes enable row level security;

drop policy if exists "orcamento_eventos_realizacoes_select" on public.orcamento_eventos_realizacoes;
drop policy if exists "orcamento_eventos_realizacoes_insert" on public.orcamento_eventos_realizacoes;
drop policy if exists "orcamento_eventos_realizacoes_update" on public.orcamento_eventos_realizacoes;
drop policy if exists "orcamento_eventos_realizacoes_delete" on public.orcamento_eventos_realizacoes;

create policy "orcamento_eventos_realizacoes_select" on public.orcamento_eventos_realizacoes
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "orcamento_eventos_realizacoes_insert" on public.orcamento_eventos_realizacoes
  for insert with check (
    public.user_has_client_access(cliente_id, true)
    and exists (
      select 1 from public.orcamento_eventos_linhas linha
      where linha.id = orcamento_linha_id
        and linha.cliente_id = cliente_id
    )
    and exists (
      select 1 from public.lancamentos lancamento
      where lancamento.id = extrato_lancamento_id
        and lancamento.cliente_id = cliente_id
    )
  );

create policy "orcamento_eventos_realizacoes_update" on public.orcamento_eventos_realizacoes
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "orcamento_eventos_realizacoes_delete" on public.orcamento_eventos_realizacoes
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );
