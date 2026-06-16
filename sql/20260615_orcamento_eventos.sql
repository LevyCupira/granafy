-- Granafy: orcamento de receitas e despesas por evento/projeto.
-- Rode este arquivo no SQL Editor do Supabase antes de testar o orcamento de eventos.

create table if not exists public.orcamento_eventos_linhas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  evento_id uuid not null references public.eventos_cliente(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  natureza text not null default 'despesa',
  categoria text not null,
  descricao text,
  pessoa_nome text,
  valor_orcado numeric(14,2) not null default 0,
  valor_previsto numeric(14,2) not null default 0,
  status text not null default 'previsto',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamento_eventos_linhas_natureza_check check (natureza in ('receita', 'despesa')),
  constraint orcamento_eventos_linhas_status_check check (status in ('previsto', 'contratado', 'realizado', 'cancelado')),
  constraint orcamento_eventos_linhas_valores_check check (valor_orcado >= 0 and valor_previsto >= 0)
);

create index if not exists idx_orcamento_eventos_linhas_cliente_id
  on public.orcamento_eventos_linhas (cliente_id);

create index if not exists idx_orcamento_eventos_linhas_evento_id
  on public.orcamento_eventos_linhas (evento_id);

create index if not exists idx_orcamento_eventos_linhas_user_id
  on public.orcamento_eventos_linhas (user_id);

create index if not exists idx_orcamento_eventos_linhas_natureza
  on public.orcamento_eventos_linhas (natureza);

create or replace function public.touch_orcamento_eventos_linhas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.categoria = trim(new.categoria);
  new.descricao = nullif(trim(coalesce(new.descricao, '')), '');
  new.pessoa_nome = nullif(trim(coalesce(new.pessoa_nome, '')), '');
  new.observacao = nullif(trim(coalesce(new.observacao, '')), '');
  return new;
end;
$$;

drop trigger if exists trg_orcamento_eventos_linhas_updated_at on public.orcamento_eventos_linhas;
create trigger trg_orcamento_eventos_linhas_updated_at
before insert or update on public.orcamento_eventos_linhas
for each row execute function public.touch_orcamento_eventos_linhas_updated_at();

alter table public.orcamento_eventos_linhas enable row level security;

drop policy if exists "orcamento_eventos_linhas_select" on public.orcamento_eventos_linhas;
drop policy if exists "orcamento_eventos_linhas_insert" on public.orcamento_eventos_linhas;
drop policy if exists "orcamento_eventos_linhas_update" on public.orcamento_eventos_linhas;
drop policy if exists "orcamento_eventos_linhas_delete" on public.orcamento_eventos_linhas;

create policy "orcamento_eventos_linhas_select" on public.orcamento_eventos_linhas
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "orcamento_eventos_linhas_insert" on public.orcamento_eventos_linhas
  for insert with check (
    public.user_has_client_access(cliente_id, true)
    and exists (
      select 1 from public.eventos_cliente ev
      where ev.id = evento_id
        and ev.cliente_id = cliente_id
    )
  );

create policy "orcamento_eventos_linhas_update" on public.orcamento_eventos_linhas
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
    and exists (
      select 1 from public.eventos_cliente ev
      where ev.id = evento_id
        and ev.cliente_id = cliente_id
    )
  );

create policy "orcamento_eventos_linhas_delete" on public.orcamento_eventos_linhas
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

alter table public.titulos_financeiros
  add column if not exists orcamento_linha_id uuid references public.orcamento_eventos_linhas(id) on delete set null;

create index if not exists idx_titulos_financeiros_orcamento_linha_id
  on public.titulos_financeiros (orcamento_linha_id);

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
    and (evento_id is null or exists (
      select 1 from public.eventos_cliente ev
      where ev.id = evento_id
        and ev.cliente_id = cliente_id
    ))
    and (orcamento_linha_id is null or exists (
      select 1 from public.orcamento_eventos_linhas ol
      where ol.id = orcamento_linha_id
        and ol.cliente_id = cliente_id
        and (evento_id is null or ol.evento_id = evento_id)
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
    and (evento_id is null or exists (
      select 1 from public.eventos_cliente ev
      where ev.id = evento_id
        and ev.cliente_id = cliente_id
    ))
    and (orcamento_linha_id is null or exists (
      select 1 from public.orcamento_eventos_linhas ol
      where ol.id = orcamento_linha_id
        and ol.cliente_id = cliente_id
        and (evento_id is null or ol.evento_id = evento_id)
    ))
  );
