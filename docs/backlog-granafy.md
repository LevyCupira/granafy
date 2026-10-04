# Backlog Granafy

Backlog vivo do produto, organizado por prioridade e contexto operacional.

## Padroes do produto

### Listas dinamicas
- Manter opcoes e cadastros em ordem alfabetica, priorizando o nome usado na tarefa principal
- Refletir inclusoes, edicoes e exclusoes simultaneamente nas outras abas abertas
- Preservar a selecao atual quando o item continuar disponivel
- Remover imediatamente da selecao itens excluidos ou que deixaram de ser elegiveis
- Expandir este comportamento gradualmente para todas as listas do sistema

## Revisao atual - 21/06/2026

### Pendencias prioritarias
- [ ] Revisar redundancias entre Extrato, Financeiro, Eventos e Orcamento
- [ ] Criar cadastro estruturado de clientes e fornecedores
- [ ] Criar titulos recorrentes no Financeiro
- [ ] Completar a auditoria financeira de conciliacoes, estornos, titulos, rateios e categorias
- [ ] Criar fechamento de periodo com conferencia e bloqueio ou alerta de alteracoes
- [ ] Ampliar testes automatizados dos fluxos criticos de conciliacao, Financeiro e Orcamento

### Evolucoes pendentes
- [ ] Operacao offline com sincronizacao posterior
- [ ] Importacao inteligente com sugestoes de categoria, rateio e conciliacao
- [ ] Dashboards executivos com inadimplencia, devolucoes e estornos
- [ ] Relatorios e exportacoes operacionais por evento, responsavel e filtros
- [ ] Refinar rateios com copia e sugestoes baseadas no historico
- [ ] Sincronizacao em tempo real entre dispositivos pelo Supabase Realtime
- [ ] Concluir os fluxos de governanca e direitos previstos no plano de LGPD

### Cadastro de clientes e fornecedores
- Criar uma base unica de pessoas e empresas vinculadas a cada cliente PJ
- Permitir classificar o cadastro como:
  - cliente
  - fornecedor
  - cliente e fornecedor
- Armazenar nome, nome fantasia, documento, contatos, dados bancarios e observacoes
- Reaproveitar o cadastro em:
  - Contas a Receber
  - Contas a Pagar
  - Orcamento de eventos
  - conciliacao do Extrato
  - importacoes e relatorios
- Evitar duplicidades por documento e sugerir possiveis cadastros repetidos por nome
- Manter historico mesmo quando o cadastro for inativado
- Preparar importacao em lote por planilha
- Avaliar migracao dos nomes livres existentes sem alterar o historico financeiro

### Funcionalidades ja operacionais ou parcialmente entregues
- Painel de pendencias
- Sugestoes de conciliacao
- Saldo inicial por conta
- Conta Caixa / Carteira
- Eventos e Orcamento vinculados ao Financeiro
- Atualizacao entre abas do mesmo navegador

## Agora

### Painel de pendencias
- Mostrar nao conciliados do Extrato
- Mostrar pendentes de estorno
- Mostrar titulos vencidos
- Mostrar titulos recebidos/pagos parcialmente
- Mostrar lancamentos com rateio
- Virar uma tela de trabalho do dia

### Conciliacao inteligente
- Sugerir automaticamente qual titulo financeiro combina com o lancamento do Extrato
- Considerar:
  - valor
  - nome da pessoa / fornecedor
  - data proxima
  - status do titulo
- Permitir aceitar a sugestao com menos cliques

### Saldo inicial por conta
- Definir saldo inicial oficial por conta
- Usar esse saldo como base para o saldo acumulado do Extrato
- Preparar abertura por periodo quando necessario

### Caixa / dinheiro em especie
- Tratar especie como conta
- Exemplos:
  - Caixa
  - Caixa loja
  - Caixa operacional
- Permitir:
  - entrada em dinheiro
  - saida em dinheiro
  - deposito no banco
  - transferencia entre caixa e banco

### Titulos recorrentes no Financeiro
- Criar contas recorrentes
- Repetir titulo mensal / semanal
- Duplicar titulo antigo
- Reduzir trabalho manual em clientes PJ

## Em breve

### Auditoria financeira
- Registrar quem:
  - conciliou
  - estornou
  - alterou titulo
  - alterou rateio
  - mudou categoria
- Melhorar rastreabilidade para operacao compartilhada

### Dashboards executivos
- Recebido no mes
- A receber do mes
- Inadimplencia
- Devolucoes
- Estornos
- Visao mais gerencial para PJ

### Importacao mais inteligente
- Aprender padroes do extrato
- Sugerir categoria automaticamente
- Sugerir rateio
- Sugerir conciliacao

### Fechamento de periodo
- Marcar periodo como conferido
- Exibir status do fechamento
- Opcionalmente bloquear ou alertar alteracoes apos fechamento

## Depois

### Classificacao operacional complementar
- Marcadores alem da categoria
- Exemplos:
  - evento
  - fornecedor
  - equipe
  - responsavel
- Sem interferir no DRE e no Resumo

### Relatorios operacionais mais ricos
- Exportacoes mais especificas por tela e por filtro
- PDF/XLSX com agrupamentos operacionais
- Possivel visao por evento ou responsavel

### Refinos do rateio
- Copiar rateio de lancamento parecido
- Sugerir rateio com base em historico
- Filtro so de lancamentos rateados

## Guardado

### Operacao offline com sincronizacao posterior
- Manter o sistema utilizavel quando a internet cair, inclusive apos recarregar a pagina
- Evoluir o Service Worker atual para armazenar todo o shell necessario da aplicacao
- Armazenar os dados de trabalho localmente com IndexedDB
- Criar uma fila local de alteracoes pendentes para inclusoes e edicoes feitas offline
- Exibir estados claros:
  - Offline
  - Alteracoes pendentes
  - Sincronizando
- Sincronizar automaticamente ao recuperar a conexao ou abrir o sistema novamente
- Definir idempotencia e regras de conflito antes de liberar operacoes sensiveis
- Implantar em etapas:
  1. consulta offline
  2. cadastros e edicoes simples de lancamentos, titulos e orcamento
  3. conciliacoes, rateios, estornos e exclusoes

### Revisao de redundancias
- Mapear informacoes e acoes repetidas entre Extrato, Financeiro, Eventos e Orcamento
- Definir uma unica origem para cada valor realizado, previsto e conciliado
- Simplificar telas sem remover rastreabilidade ou atalhos importantes

### LGPD - pendentes do fim de semana
- Definir canal formal de privacidade
- Definir retencao e descarte
- Estruturar atendimento aos direitos do titular
- Criar fluxo de exportacao / correcao / exclusao
- Formalizar registro e decisao de incidentes
- Revisar campos livres e backup sob otica de minimizacao

### Sincronizacao em tempo real
- Atualizar Extrato e Financeiro simultaneamente em duas telas / janelas
- Usar Supabase Realtime
- Comecar por:
  - lancamentos
  - titulos_financeiros
  - titulos_financeiros_baixas

### Relacionamentos
- Reexibir a frente de Relacionado a quando voltar a fazer sentido operacionalmente
- Evoluir sugestoes automaticas e regras de uso

### Centro de custo
- Assunto pausado
- Substituido no momento pelo rateio por categoria
- Pode voltar no futuro se a operacao pedir duas camadas de classificacao

## Observacoes

- Prioridade atual recomendada:
  1. Revisao de redundancias
  2. Cadastro de clientes e fornecedores
  3. Titulos recorrentes
  4. Auditoria financeira completa
  5. Fechamento de periodo

- Este backlog deve ser revisado sempre que uma frente nova entrar em producao ou mudar de prioridade.
