-- Granafy: eventos/projetos por cliente PJ.
-- Rode este arquivo no SQL Editor do Supabase antes de usar o modulo de eventos.

alter table public.clientes
  add column if not exists eventos_enabled boolean not null default false,
  add column if not exists eventos_label text not null default 'Eventos';

create table if not exists public.eventos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  status text not null default 'em_andamento',
  data_inicio date,
  data_fim date,
  orcamento_previsto numeric(14,2) not null default 0,
  observacao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eventos_cliente_status_check check (status in ('planejado', 'em_andamento', 'concluido', 'cancelado')),
  constraint eventos_cliente_orcamento_check check (orcamento_previsto >= 0)
);

create unique index if not exists uq_eventos_cliente_nome
  on public.eventos_cliente (cliente_id, lower(nome));

create index if not exists idx_eventos_cliente_cliente_id
  on public.eventos_cliente (cliente_id);

create index if not exists idx_eventos_cliente_user_id
  on public.eventos_cliente (user_id);

create index if not exists idx_eventos_cliente_status
  on public.eventos_cliente (status);

create or replace function public.touch_eventos_cliente_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.nome = trim(new.nome);
  return new;
end;
$$;

drop trigger if exists trg_eventos_cliente_updated_at on public.eventos_cliente;
create trigger trg_eventos_cliente_updated_at
before insert or update on public.eventos_cliente
for each row execute function public.touch_eventos_cliente_updated_at();

alter table public.eventos_cliente enable row level security;

drop policy if exists "eventos_cliente_select" on public.eventos_cliente;
drop policy if exists "eventos_cliente_insert" on public.eventos_cliente;
drop policy if exists "eventos_cliente_update" on public.eventos_cliente;
drop policy if exists "eventos_cliente_delete" on public.eventos_cliente;

create policy "eventos_cliente_select" on public.eventos_cliente
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "eventos_cliente_insert" on public.eventos_cliente
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "eventos_cliente_update" on public.eventos_cliente
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "eventos_cliente_delete" on public.eventos_cliente
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

alter table public.titulos_financeiros
  alter column descricao drop not null,
  add column if not exists evento_id uuid references public.eventos_cliente(id) on delete set null;

create index if not exists idx_titulos_financeiros_evento_id
  on public.titulos_financeiros (evento_id);

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
  );
