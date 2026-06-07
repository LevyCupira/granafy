# Backlog Granafy

Backlog vivo do produto, organizado por prioridade e contexto operacional.

## Em andamento

### Painel de pendencias
- Base ja publicada no Financeiro
- Mostra:
  - nao conciliados do Extrato
  - pendentes de estorno
  - titulos vencidos
  - titulos recebidos/pagos parcialmente
  - lancamentos com rateio
- Proximo passo:
  - virar uma tela de trabalho ainda mais operacional

### Conciliacao inteligente
- Primeira versao ja iniciada no modal do Extrato
- Sugere automaticamente titulos por:
  - valor
  - nome da pessoa / fornecedor
  - descricao parecida
  - status do titulo
- Proximo passo:
  - refinar relevancia
  - incluir mais contexto de data
  - medir acerto em casos reais

### Dashboards executivos
- Primeira versao ja iniciada no Financeiro
- Cards atuais:
  - recebido no mes
  - pago no mes
  - liquido do mes
  - conciliacao do mes
  - devolucoes pendentes
  - previsao liquida
- Blocos atuais:
  - maiores valores a receber
  - maiores valores a pagar
- Proximo passo:
  - amadurecer indicadores de inadimplencia e estornos

## Agora

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

### Concluido recente
- Saldo inicial por conta
  - saldo inicial oficial por conta
  - base do saldo acumulado do Extrato
- Caixa / dinheiro em especie
  - conta do tipo caixa
  - especie tratada como conta operacional

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
  1. Conciliacao inteligente
  2. Dashboards executivos
  3. Titulos recorrentes no Financeiro
  4. Importacao mais inteligente
  5. Auditoria financeira

- Este backlog deve ser revisado sempre que uma frente nova entrar em producao ou mudar de prioridade.
