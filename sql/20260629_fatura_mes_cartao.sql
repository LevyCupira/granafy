alter table public.lancamentos_cartao
  add column if not exists fatura_mes text;

update public.lancamentos_cartao
   set fatura_mes = to_char(data, 'YYYY-MM')
 where fatura_mes is null
   and data is not null;

create index if not exists idx_lancamentos_cartao_fatura_mes
  on public.lancamentos_cartao(fatura_mes);
