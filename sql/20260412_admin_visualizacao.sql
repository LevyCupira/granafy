-- Granafy: permite que o admin visualize dados de todos os logins.
-- Rode no SQL Editor do Supabase depois da migracao user_id/RLS.

drop policy if exists "clientes_por_usuario_select" on public.clientes;
create policy "clientes_por_usuario_select" on public.clientes
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists "cartoes_por_usuario_select" on public.cartoes;
create policy "cartoes_por_usuario_select" on public.cartoes
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists "lancamentos_cartao_por_usuario_select" on public.lancamentos_cartao;
create policy "lancamentos_cartao_por_usuario_select" on public.lancamentos_cartao
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists "dividas_por_usuario_select" on public.dividas;
create policy "dividas_por_usuario_select" on public.dividas
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );

drop policy if exists "lancamentos_por_usuario_select" on public.lancamentos;
create policy "lancamentos_por_usuario_select" on public.lancamentos
  for select using (
    auth.uid() = user_id
    or public.is_admin()
  );
