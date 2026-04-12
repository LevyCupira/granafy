-- Granafy: perfis de usuarios do app.
-- Rode no SQL Editor do Supabase.

create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  tipo_acesso text not null default 'cliente',
  limite_clientes integer not null default 1,
  status text not null default 'ativo',
  telefone text,
  empresa text,
  documento text,
  plano text not null default 'gratuito',
  data_vencimento_acesso date,
  origem_cadastro text,
  responsavel_atendimento text,
  observacoes text,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perfis_tipo_acesso_check check (tipo_acesso in ('admin', 'cliente')),
  constraint perfis_status_check check (status in ('ativo', 'bloqueado', 'teste')),
  constraint perfis_limite_clientes_check check (limite_clientes >= 0)
);

create index if not exists idx_perfis_email on public.perfis(email);
create index if not exists idx_perfis_tipo_acesso on public.perfis(tipo_acesso);
create index if not exists idx_perfis_status on public.perfis(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_perfis_updated_at on public.perfis;
create trigger trg_perfis_updated_at
before update on public.perfis
for each row
execute function public.set_updated_at();

create or replace function public.criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.perfis (
    id,
    email,
    nome,
    telefone,
    tipo_acesso,
    limite_clientes,
    status,
    plano,
    origem_cadastro
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nome', new.email),
    new.raw_user_meta_data ->> 'telefone',
    case when lower(coalesce(new.email, '')) = 'levy_lima@icloud.com' then 'admin' else 'cliente' end,
    case when lower(coalesce(new.email, '')) = 'levy_lima@icloud.com' then 999999 else 1 end,
    'ativo',
    case when lower(coalesce(new.email, '')) = 'levy_lima@icloud.com' then 'admin' else 'gratuito' end,
    'app'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_criar_perfil_usuario on auth.users;
create trigger trg_criar_perfil_usuario
after insert on auth.users
for each row
execute function public.criar_perfil_usuario();

-- Backfill para usuarios que ja existem.
insert into public.perfis (
  id,
  email,
  nome,
  telefone,
  tipo_acesso,
  limite_clientes,
  status,
  plano,
  origem_cadastro
)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'nome', u.email),
  u.raw_user_meta_data ->> 'telefone',
  case when lower(coalesce(u.email, '')) = 'levy_lima@icloud.com' then 'admin' else 'cliente' end,
  case when lower(coalesce(u.email, '')) = 'levy_lima@icloud.com' then 999999 else 1 end,
  'ativo',
  case when lower(coalesce(u.email, '')) = 'levy_lima@icloud.com' then 'admin' else 'gratuito' end,
  'auth'
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  nome = coalesce(public.perfis.nome, excluded.nome),
  telefone = coalesce(public.perfis.telefone, excluded.telefone),
  tipo_acesso = case
    when lower(excluded.email) = 'levy_lima@icloud.com' then 'admin'
    else public.perfis.tipo_acesso
  end,
  limite_clientes = case
    when lower(excluded.email) = 'levy_lima@icloud.com' then 999999
    else public.perfis.limite_clientes
  end,
  plano = case
    when lower(excluded.email) = 'levy_lima@icloud.com' then 'admin'
    else public.perfis.plano
  end;

alter table public.perfis enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.tipo_acesso = 'admin'
      and p.status = 'ativo'
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'levy_lima@icloud.com';
$$;

drop policy if exists "perfis_select" on public.perfis;
drop policy if exists "perfis_insert" on public.perfis;
drop policy if exists "perfis_update" on public.perfis;
drop policy if exists "perfis_delete" on public.perfis;

create policy "perfis_select" on public.perfis
  for select using (
    auth.uid() = id
    or public.is_admin()
  );

create policy "perfis_insert" on public.perfis
  for insert with check (auth.uid() = id);

create policy "perfis_update" on public.perfis
  for update using (
    auth.uid() = id
    or public.is_admin()
  )
  with check (
    auth.uid() = id
    or public.is_admin()
  );

create policy "perfis_delete" on public.perfis
  for delete using (
    public.is_admin()
  );
