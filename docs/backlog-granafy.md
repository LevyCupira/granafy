# Backlog Granafy

Backlog vivo do produto, organizado por prioridade e contexto operacional.

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
  1. Painel de pendencias
  2. Conciliacao inteligente
  3. Saldo inicial por conta
  4. Caixa / dinheiro em especie
  5. Titulos recorrentes

- Este backlog deve ser revisado sempre que uma frente nova entrar em producao ou mudar de prioridade.
