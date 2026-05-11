-- Granafy: perfis Master / Consultor / Usuario
-- Rode no SQL Editor do Supabase depois das migracoes anteriores.

alter table public.perfis
  drop constraint if exists perfis_tipo_acesso_check;

alter table public.perfis
  add column if not exists solicitacao_tipo_acesso text,
  add column if not exists solicitacao_perfil_motivo text,
  add column if not exists solicitacao_perfil_em timestamptz;

update public.perfis
set tipo_acesso = case
  when tipo_acesso = 'admin' then 'master'
  when tipo_acesso = 'cliente' then 'usuario'
  else coalesce(tipo_acesso, 'usuario')
end;

update public.perfis
set
  tipo_acesso = 'master',
  limite_clientes = 999999,
  plano = case when coalesce(plano, '') in ('', 'admin') then 'master' else plano end
where lower(coalesce(email, '')) = 'levy_lima@icloud.com';

update public.perfis
set limite_clientes = case
  when tipo_acesso = 'master' then 999999
  when tipo_acesso = 'consultor' and coalesce(limite_clientes, 0) < 2 then 10
  when tipo_acesso = 'usuario' and coalesce(limite_clientes, 0) < 1 then 1
  else limite_clientes
end;

alter table public.perfis
  add constraint perfis_tipo_acesso_check
  check (tipo_acesso in ('master', 'consultor', 'usuario'));

create or replace function public.criar_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tipo text;
  v_limite integer;
  v_plano text;
begin
  v_tipo := case
    when lower(coalesce(new.email, '')) = 'levy_lima@icloud.com' then 'master'
    else 'usuario'
  end;

  v_limite := case
    when v_tipo = 'master' then 999999
    when v_tipo = 'consultor' then 10
    else 1
  end;

  v_plano := case
    when v_tipo = 'master' then 'master'
    else 'gratuito'
  end;

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
    v_tipo,
    v_limite,
    'ativo',
    v_plano,
    'app'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

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
      and p.tipo_acesso = 'master'
      and p.status = 'ativo'
  )
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'levy_lima@icloud.com';
$$;

create or replace function public.validar_limite_clientes_por_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tipo text;
  v_status text;
  v_limite integer;
  v_total integer;
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido para este cadastro.';
  end if;

  select
    coalesce(p.tipo_acesso, 'usuario'),
    coalesce(p.status, 'ativo'),
    coalesce(
      p.limite_clientes,
      case
        when p.tipo_acesso = 'master' then 999999
        when p.tipo_acesso = 'consultor' then 10
        else 1
      end
    )
  into v_tipo, v_status, v_limite
  from public.perfis p
  where p.id = auth.uid();

  if v_tipo = 'master' then
    return new;
  end if;

  if v_status <> 'ativo' then
    raise exception 'Seu acesso nao esta ativo para cadastrar clientes.';
  end if;

  select count(*)
  into v_total
  from public.clientes c
  where c.user_id = auth.uid()
    and c.id is distinct from new.id;

  if v_total >= coalesce(v_limite, 1) then
    raise exception 'Seu acesso permite cadastrar somente % cliente(s).', coalesce(v_limite, 1);
  end if;

  return new;
end;
$$;
