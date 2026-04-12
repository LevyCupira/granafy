-- Granafy: isolamento de dados por usuario Supabase Auth.
-- Rode este arquivo no SQL Editor do Supabase.

-- 1) Adiciona o dono dos registros.
alter table public.clientes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.cartoes
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.lancamentos_cartao
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.dividas
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.lancamentos
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 2) Se ja existem dados antigos, atribua-os a um usuario antes de ativar o NOT NULL.
-- Primeiro descubra o id do usuario:
-- select id, email from auth.users order by created_at;
--
-- Depois substitua o UUID abaixo e rode:
-- update public.clientes set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;
-- update public.cartoes set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;
-- update public.lancamentos_cartao set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;
-- update public.dividas set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;
-- update public.lancamentos set user_id = '00000000-0000-0000-0000-000000000000' where user_id is null;

-- 3) Depois do backfill acima, bloqueie registros sem dono.
alter table public.clientes alter column user_id set not null;
alter table public.cartoes alter column user_id set not null;
alter table public.lancamentos_cartao alter column user_id set not null;
alter table public.dividas alter column user_id set not null;
alter table public.lancamentos alter column user_id set not null;

-- 4) Indices para manter as consultas por usuario rapidas.
create index if not exists idx_clientes_user_id on public.clientes(user_id);
create index if not exists idx_cartoes_user_id on public.cartoes(user_id);
create index if not exists idx_lancamentos_cartao_user_id on public.lancamentos_cartao(user_id);
create index if not exists idx_dividas_user_id on public.dividas(user_id);
create index if not exists idx_lancamentos_user_id on public.lancamentos(user_id);

-- 5) Ativa Row Level Security.
alter table public.clientes enable row level security;
alter table public.cartoes enable row level security;
alter table public.lancamentos_cartao enable row level security;
alter table public.dividas enable row level security;
alter table public.lancamentos enable row level security;

-- 6) Recria politicas padrao por usuario.
drop policy if exists "clientes_por_usuario_select" on public.clientes;
drop policy if exists "clientes_por_usuario_insert" on public.clientes;
drop policy if exists "clientes_por_usuario_update" on public.clientes;
drop policy if exists "clientes_por_usuario_delete" on public.clientes;

create policy "clientes_por_usuario_select" on public.clientes
  for select using (auth.uid() = user_id);
create policy "clientes_por_usuario_insert" on public.clientes
  for insert with check (auth.uid() = user_id);
create policy "clientes_por_usuario_update" on public.clientes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "clientes_por_usuario_delete" on public.clientes
  for delete using (auth.uid() = user_id);

drop policy if exists "cartoes_por_usuario_select" on public.cartoes;
drop policy if exists "cartoes_por_usuario_insert" on public.cartoes;
drop policy if exists "cartoes_por_usuario_update" on public.cartoes;
drop policy if exists "cartoes_por_usuario_delete" on public.cartoes;

create policy "cartoes_por_usuario_select" on public.cartoes
  for select using (auth.uid() = user_id);
create policy "cartoes_por_usuario_insert" on public.cartoes
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );
create policy "cartoes_por_usuario_update" on public.cartoes
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );
create policy "cartoes_por_usuario_delete" on public.cartoes
  for delete using (auth.uid() = user_id);

drop policy if exists "lancamentos_cartao_por_usuario_select" on public.lancamentos_cartao;
drop policy if exists "lancamentos_cartao_por_usuario_insert" on public.lancamentos_cartao;
drop policy if exists "lancamentos_cartao_por_usuario_update" on public.lancamentos_cartao;
drop policy if exists "lancamentos_cartao_por_usuario_delete" on public.lancamentos_cartao;

create policy "lancamentos_cartao_por_usuario_select" on public.lancamentos_cartao
  for select using (auth.uid() = user_id);
create policy "lancamentos_cartao_por_usuario_insert" on public.lancamentos_cartao
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.cartoes cc
      where cc.id = cartao_id and cc.user_id = auth.uid()
    )
  );
create policy "lancamentos_cartao_por_usuario_update" on public.lancamentos_cartao
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
    and exists (
      select 1 from public.cartoes cc
      where cc.id = cartao_id and cc.user_id = auth.uid()
    )
  );
create policy "lancamentos_cartao_por_usuario_delete" on public.lancamentos_cartao
  for delete using (auth.uid() = user_id);

drop policy if exists "dividas_por_usuario_select" on public.dividas;
drop policy if exists "dividas_por_usuario_insert" on public.dividas;
drop policy if exists "dividas_por_usuario_update" on public.dividas;
drop policy if exists "dividas_por_usuario_delete" on public.dividas;

create policy "dividas_por_usuario_select" on public.dividas
  for select using (auth.uid() = user_id);
create policy "dividas_por_usuario_insert" on public.dividas
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );
create policy "dividas_por_usuario_update" on public.dividas
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );
create policy "dividas_por_usuario_delete" on public.dividas
  for delete using (auth.uid() = user_id);

drop policy if exists "lancamentos_por_usuario_select" on public.lancamentos;
drop policy if exists "lancamentos_por_usuario_insert" on public.lancamentos;
drop policy if exists "lancamentos_por_usuario_update" on public.lancamentos;
drop policy if exists "lancamentos_por_usuario_delete" on public.lancamentos;

create policy "lancamentos_por_usuario_select" on public.lancamentos
  for select using (auth.uid() = user_id);
create policy "lancamentos_por_usuario_insert" on public.lancamentos
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );
create policy "lancamentos_por_usuario_update" on public.lancamentos
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.clientes c
      where c.id = cliente_id and c.user_id = auth.uid()
    )
  );
create policy "lancamentos_por_usuario_delete" on public.lancamentos
  for delete using (auth.uid() = user_id);
