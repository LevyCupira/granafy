-- Granafy: limita usuarios nao administradores a um cliente.
-- Rode no SQL Editor do Supabase depois da migracao user_id/RLS.

create or replace function public.validar_limite_clientes_por_usuario()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.user_id is distinct from auth.uid() then
    raise exception 'Usuario invalido para este cadastro.';
  end if;

  if exists (
       select 1
       from public.perfis p
       where p.id = auth.uid()
         and p.tipo_acesso <> 'admin'
         and p.status = 'ativo'
         and (
           select count(*)
           from public.clientes c
           where c.user_id = auth.uid()
             and c.id is distinct from new.id
         ) >= p.limite_clientes
     )
     or (
       not exists (select 1 from public.perfis p where p.id = auth.uid() and p.tipo_acesso = 'admin')
       and exists (
       select 1
       from public.clientes c
       where c.user_id = auth.uid()
         and c.id is distinct from new.id
       )
     ) then
    raise exception 'Seu acesso permite cadastrar somente um cliente.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_limite_clientes_por_usuario on public.clientes;

create trigger trg_limite_clientes_por_usuario
before insert on public.clientes
for each row
execute function public.validar_limite_clientes_por_usuario();
