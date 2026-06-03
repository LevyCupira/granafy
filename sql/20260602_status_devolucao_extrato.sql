alter table public.lancamentos
  add column if not exists status_estorno text not null default 'normal',
  add column if not exists estorno_lancamento_id uuid null references public.lancamentos(id) on delete set null,
  add column if not exists estorno_data date null,
  add column if not exists estorno_observacao text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lancamentos_status_estorno_check'
  ) then
    alter table public.lancamentos
      add constraint lancamentos_status_estorno_check
      check (status_estorno in ('normal', 'pendente_estorno', 'estornado'));
  end if;
end $$;

create index if not exists lancamentos_estorno_lancamento_idx
  on public.lancamentos(estorno_lancamento_id);

create index if not exists lancamentos_status_estorno_idx
  on public.lancamentos(status_estorno);
