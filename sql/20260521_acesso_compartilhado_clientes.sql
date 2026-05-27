-- Granafy: acesso compartilhado por cliente.
-- Permite que um login veja ou edite apenas os clientes liberados por email.
-- Rode este arquivo no SQL Editor do Supabase depois das migracoes anteriores.

create table if not exists public.clientes_acessos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  email text not null,
  nome text,
  papel text not null default 'visualizador',
  status text not null default 'ativo',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_acessos_papel_check check (papel in ('visualizador', 'editor')),
  constraint clientes_acessos_status_check check (status in ('ativo', 'revogado'))
);

create unique index if not exists uq_clientes_acessos_cliente_email
  on public.clientes_acessos (cliente_id, lower(email));

create index if not exists idx_clientes_acessos_cliente_id
  on public.clientes_acessos (cliente_id);

create index if not exists idx_clientes_acessos_usuario_id
  on public.clientes_acessos (usuario_id);

create or replace function public.touch_clientes_acessos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_clientes_acessos_updated_at on public.clientes_acessos;
create trigger trg_clientes_acessos_updated_at
before insert or update on public.clientes_acessos
for each row execute function public.touch_clientes_acessos_updated_at();

create or replace function public.user_has_client_access(cliente_uuid uuid, require_write boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  current_email text;
begin
  if public.is_admin() then
    return true;
  end if;

  if exists (
    select 1
    from public.clientes c
    where c.id = cliente_uuid
      and c.user_id = auth.uid()
  ) then
    return true;
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  return exists (
    select 1
    from public.clientes_acessos a
    where a.cliente_id = cliente_uuid
      and a.status = 'ativo'
      and (
        a.usuario_id = auth.uid()
        or (current_email <> '' and lower(a.email) = current_email)
      )
      and (
        not require_write
        or a.papel = 'editor'
      )
  );
end;
$$;

alter table public.clientes_acessos enable row level security;

drop policy if exists "clientes_acessos_select" on public.clientes_acessos;
drop policy if exists "clientes_acessos_insert" on public.clientes_acessos;
drop policy if exists "clientes_acessos_update" on public.clientes_acessos;
drop policy if exists "clientes_acessos_delete" on public.clientes_acessos;

create policy "clientes_acessos_select" on public.clientes_acessos
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
    or usuario_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "clientes_acessos_insert" on public.clientes_acessos
  for insert with check (
    public.is_admin()
    or exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "clientes_acessos_update" on public.clientes_acessos
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  ) with check (
    public.is_admin()
    or exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

create policy "clientes_acessos_delete" on public.clientes_acessos
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );

alter table public.categorias_cliente
  drop constraint if exists categorias_cliente_escopo_check;

alter table public.categorias_cliente
  add constraint categorias_cliente_escopo_check
  check (escopo in ('cc', 'cartao', 'financeiro'));

drop policy if exists "clientes_por_usuario_select" on public.clientes;
drop policy if exists "clientes_por_usuario_insert" on public.clientes;
drop policy if exists "clientes_por_usuario_update" on public.clientes;
drop policy if exists "clientes_por_usuario_delete" on public.clientes;

create policy "clientes_por_usuario_select" on public.clientes
  for select using (
    public.user_has_client_access(id, false)
  );

create policy "clientes_por_usuario_insert" on public.clientes
  for insert with check (
    public.is_admin()
    or auth.uid() = user_id
  );

create policy "clientes_por_usuario_update" on public.clientes
  for update using (
    public.is_admin()
    or auth.uid() = user_id
  ) with check (
    public.is_admin()
    or auth.uid() = user_id
  );

create policy "clientes_por_usuario_delete" on public.clientes
  for delete using (
    public.is_admin()
    or auth.uid() = user_id
  );

drop policy if exists "cartoes_por_usuario_select" on public.cartoes;
drop policy if exists "cartoes_por_usuario_insert" on public.cartoes;
drop policy if exists "cartoes_por_usuario_update" on public.cartoes;
drop policy if exists "cartoes_por_usuario_delete" on public.cartoes;

create policy "cartoes_por_usuario_select" on public.cartoes
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "cartoes_por_usuario_insert" on public.cartoes
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "cartoes_por_usuario_update" on public.cartoes
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "cartoes_por_usuario_delete" on public.cartoes
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "lancamentos_cartao_por_usuario_select" on public.lancamentos_cartao;
drop policy if exists "lancamentos_cartao_por_usuario_insert" on public.lancamentos_cartao;
drop policy if exists "lancamentos_cartao_por_usuario_update" on public.lancamentos_cartao;
drop policy if exists "lancamentos_cartao_por_usuario_delete" on public.lancamentos_cartao;

create policy "lancamentos_cartao_por_usuario_select" on public.lancamentos_cartao
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "lancamentos_cartao_por_usuario_insert" on public.lancamentos_cartao
  for insert with check (
    public.user_has_client_access(cliente_id, true)
    and exists (
      select 1 from public.cartoes cc
      where cc.id = cartao_id
        and cc.cliente_id = cliente_id
    )
  );

create policy "lancamentos_cartao_por_usuario_update" on public.lancamentos_cartao
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
    and exists (
      select 1 from public.cartoes cc
      where cc.id = cartao_id
        and cc.cliente_id = cliente_id
    )
  );

create policy "lancamentos_cartao_por_usuario_delete" on public.lancamentos_cartao
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "dividas_por_usuario_select" on public.dividas;
drop policy if exists "dividas_por_usuario_insert" on public.dividas;
drop policy if exists "dividas_por_usuario_update" on public.dividas;
drop policy if exists "dividas_por_usuario_delete" on public.dividas;

create policy "dividas_por_usuario_select" on public.dividas
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "dividas_por_usuario_insert" on public.dividas
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "dividas_por_usuario_update" on public.dividas
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "dividas_por_usuario_delete" on public.dividas
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "lancamentos_por_usuario_select" on public.lancamentos;
drop policy if exists "lancamentos_por_usuario_insert" on public.lancamentos;
drop policy if exists "lancamentos_por_usuario_update" on public.lancamentos;
drop policy if exists "lancamentos_por_usuario_delete" on public.lancamentos;

create policy "lancamentos_por_usuario_select" on public.lancamentos
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "lancamentos_por_usuario_insert" on public.lancamentos
  for insert with check (
    public.user_has_client_access(cliente_id, true)
    and (
      conta_id is null
      or exists (
        select 1 from public.contas ct
        where ct.id = conta_id
          and ct.cliente_id = cliente_id
      )
    )
  );

create policy "lancamentos_por_usuario_update" on public.lancamentos
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
    and (
      conta_id is null
      or exists (
        select 1 from public.contas ct
        where ct.id = conta_id
          and ct.cliente_id = cliente_id
      )
    )
  );

create policy "lancamentos_por_usuario_delete" on public.lancamentos
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "contas_por_usuario_select" on public.contas;
drop policy if exists "contas_por_usuario_insert" on public.contas;
drop policy if exists "contas_por_usuario_update" on public.contas;
drop policy if exists "contas_por_usuario_delete" on public.contas;

create policy "contas_por_usuario_select" on public.contas
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "contas_por_usuario_insert" on public.contas
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "contas_por_usuario_update" on public.contas
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "contas_por_usuario_delete" on public.contas
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "categorias_cliente_por_usuario_select" on public.categorias_cliente;
drop policy if exists "categorias_cliente_por_usuario_insert" on public.categorias_cliente;
drop policy if exists "categorias_cliente_por_usuario_update" on public.categorias_cliente;
drop policy if exists "categorias_cliente_por_usuario_delete" on public.categorias_cliente;

create policy "categorias_cliente_por_usuario_select" on public.categorias_cliente
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "categorias_cliente_por_usuario_insert" on public.categorias_cliente
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "categorias_cliente_por_usuario_update" on public.categorias_cliente
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "categorias_cliente_por_usuario_delete" on public.categorias_cliente
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "relacionamentos_cliente_por_usuario_select" on public.relacionamentos_cliente;
drop policy if exists "relacionamentos_cliente_por_usuario_insert" on public.relacionamentos_cliente;
drop policy if exists "relacionamentos_cliente_por_usuario_update" on public.relacionamentos_cliente;
drop policy if exists "relacionamentos_cliente_por_usuario_delete" on public.relacionamentos_cliente;

create policy "relacionamentos_cliente_por_usuario_select" on public.relacionamentos_cliente
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "relacionamentos_cliente_por_usuario_insert" on public.relacionamentos_cliente
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "relacionamentos_cliente_por_usuario_update" on public.relacionamentos_cliente
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "relacionamentos_cliente_por_usuario_delete" on public.relacionamentos_cliente
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "titulos_financeiros_por_usuario_select" on public.titulos_financeiros;
drop policy if exists "titulos_financeiros_por_usuario_insert" on public.titulos_financeiros;
drop policy if exists "titulos_financeiros_por_usuario_update" on public.titulos_financeiros;
drop policy if exists "titulos_financeiros_por_usuario_delete" on public.titulos_financeiros;

create policy "titulos_financeiros_por_usuario_select" on public.titulos_financeiros
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "titulos_financeiros_por_usuario_insert" on public.titulos_financeiros
  for insert with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "titulos_financeiros_por_usuario_update" on public.titulos_financeiros
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
  );

create policy "titulos_financeiros_por_usuario_delete" on public.titulos_financeiros
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );

drop policy if exists "titulos_financeiros_baixas_por_usuario_select" on public.titulos_financeiros_baixas;
drop policy if exists "titulos_financeiros_baixas_por_usuario_insert" on public.titulos_financeiros_baixas;
drop policy if exists "titulos_financeiros_baixas_por_usuario_update" on public.titulos_financeiros_baixas;
drop policy if exists "titulos_financeiros_baixas_por_usuario_delete" on public.titulos_financeiros_baixas;

create policy "titulos_financeiros_baixas_por_usuario_select" on public.titulos_financeiros_baixas
  for select using (
    public.user_has_client_access(cliente_id, false)
  );

create policy "titulos_financeiros_baixas_por_usuario_insert" on public.titulos_financeiros_baixas
  for insert with check (
    public.user_has_client_access(cliente_id, true)
    and exists (
      select 1
      from public.titulos_financeiros t
      where t.id = titulo_id
        and t.cliente_id = cliente_id
    )
  );

create policy "titulos_financeiros_baixas_por_usuario_update" on public.titulos_financeiros_baixas
  for update using (
    public.user_has_client_access(cliente_id, true)
  ) with check (
    public.user_has_client_access(cliente_id, true)
    and exists (
      select 1
      from public.titulos_financeiros t
      where t.id = titulo_id
        and t.cliente_id = cliente_id
    )
  );

create policy "titulos_financeiros_baixas_por_usuario_delete" on public.titulos_financeiros_baixas
  for delete using (
    public.user_has_client_access(cliente_id, true)
  );
