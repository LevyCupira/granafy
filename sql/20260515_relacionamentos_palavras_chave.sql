alter table public.relacionamentos_cliente
add column if not exists palavras_chave text;

comment on column public.relacionamentos_cliente.palavras_chave is
'Palavras-chave opcionais para sugerir automaticamente o relacionamento no extrato.';
