# LGPD - Registro Inicial de Tratamento do Granafy

Ultima atualizacao: 31/05/2026

## 1. Escopo deste registro

Este documento registra os principais fluxos de dados atualmente identificados no Granafy. Ele serve como ponto de partida para inventario, revisao de risco e atendimento a direitos do titular.

## 2. Tabela resumida

| Processo | Dados tratados | Finalidade | Base legal indicativa | Compartilhamento | Retencao inicial |
| --- | --- | --- | --- | --- | --- |
| Cadastro e autenticacao | nome, e-mail, telefone, documento, perfil de uso, aceite de termos | criar conta, autenticar, controlar acesso | execucao de contrato; procedimentos preliminares; cumprimento de obrigacao legal; interesses legitimos | Supabase/Auth | enquanto a conta estiver ativa e pelo prazo necessario para defesa e auditoria |
| Cadastro de cliente PF/PJ | nome, documento, telefone, e-mail financeiro, responsavel, razao social, nome fantasia, observacoes | organizar a base financeira do cliente | execucao de contrato; interesses legitimos; exercicio regular de direitos | Supabase | enquanto houver relacao ativa e pelo prazo de retencao aplicavel |
| Extrato e movimentacoes | descricoes bancarias, valores, contas, centros de custo, categorias, observacoes | controle financeiro e gerencial | execucao de contrato; interesses legitimos; obrigacoes legais/contabeis quando aplicavel | Supabase | conforme politica financeira e contenciosa a definir |
| Cartoes e faturas | compras, estornos, pagamentos, parcelas, descricoes, datas | gestao de cartoes e faturas | execucao de contrato; interesses legitimos | Supabase | conforme politica financeira a definir |
| Dividas | credor, parcelas, juros, IOF, observacoes, historico de pagamentos | acompanhamento de obrigacoes financeiras | execucao de contrato; interesses legitimos | Supabase | conforme politica financeira a definir |
| Financeiro PJ | contas a receber, contas a pagar, baixas, conciliacao, centro de custo | operacao financeira de empresas | execucao de contrato; interesses legitimos; obrigacoes legais/contabeis | Supabase | conforme politica financeira e fiscal a definir |
| Acesso compartilhado por cliente | e-mail do convidado, papel, data de concessao, relacao com cliente | permitir colaboracao controlada | execucao de contrato; interesses legitimos; seguranca | Supabase/Auth | enquanto o acesso estiver ativo ou pelo prazo de auditoria |
| Backup e restauracao | conjunto integral da base visivel ao usuario | seguranca operacional, contingencia e migracao | interesses legitimos; execucao de contrato | armazenamento local do usuario e Supabase | arquivo exportado fica sob responsabilidade do usuario que o baixa |

## 3. Dados pessoais hoje identificados no projeto

### Conta do usuario

- nome
- e-mail
- telefone
- CPF ou CNPJ
- empresa ou razao social
- perfil de uso
- aceite de termos
- status e perfil de acesso

### Cliente PF/PJ

- nome
- nome fantasia
- razao social
- documento
- telefone
- e-mail financeiro
- responsavel
- observacoes

### Dados financeiros

- descricoes de extrato e cartao
- contas bancarias
- centros de custo
- titulos financeiros
- baixas
- historico de pagamentos
- categorias e classificacoes

## 4. Dados sensiveis

Nao ha, nesta fase, identificacao clara de tratamento de dado pessoal sensivel nos termos do art. 5o, II, da LGPD como fluxo intencional de produto. Ainda assim, descricoes livres e observacoes podem receber dados sensiveis por erro humano. Isso exige:

- orientacao de uso
- minimizacao de campos livres
- cautela em exportacoes e compartilhamentos

## 5. Pontos de atencao

- descricoes bancarias podem conter nomes completos e referencias pessoais
- observacoes livres podem receber informacoes desnecessarias
- backup em JSON pode circular fora do ambiente controlado
- compartilhamento por cliente aumenta a superficie de exposicao

## 6. Proximas revisoes recomendadas

- revisar se todos os campos livres sao realmente necessarios
- definir retencao por modulo
- mapear quais dados precisam de mascaramento em telas administrativas
- revisar eventuais campos que possam receber informacoes sensiveis por uso indevido
