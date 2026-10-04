alter table public.lancamentos
  add column if not exists rateio_categorias jsonb not null default '[]'::jsonb;
