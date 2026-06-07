# Backlog Granafy

Backlog vivo do produto, organizado por prioridade e contexto operacional.

## Em andamento

### Painel de pendências
- Base já publicada no Financeiro
- Mostra:
  - não conciliados do Extrato
  - pendentes de estorno
  - títulos vencidos
  - títulos recebidos/pagos parcialmente
  - lançamentos com rateio
- Próximo passo:
  - virar uma tela de trabalho ainda mais operacional

### Conciliação inteligente
- Primeira versão já iniciada no modal do Extrato
- Sugere automaticamente títulos por:
  - valor
  - nome da pessoa / fornecedor
  - descrição parecida
  - status do título
- Próximo passo:
  - refinar relevância
  - incluir mais contexto de data
  - medir acerto em casos reais

### Dashboards executivos
- Primeira versão já iniciada no Financeiro
- Cards atuais:
  - recebido no mês
  - pago no mês
  - líquido do mês
  - conciliação do mês
  - devoluções pendentes
  - previsão líquida
- Blocos atuais:
  - maiores valores a receber
  - maiores valores a pagar
- Próximo passo:
  - amadurecer indicadores de inadimplência e estornos

### Títulos recorrentes no Financeiro
- Base já iniciada
- Já permite:
  - criar série mensal / semanal
  - duplicar título
  - reduzir trabalho manual em clientes PJ
- Próximo passo:
  - ampliar edição da recorrência no modal do título

### Auditoria financeira
- Base já iniciada
- Já registra:
  - criação
  - edição
  - duplicação
  - exclusão
  - baixas manuais
  - fechamento e reabertura de período
- Próximo passo:
  - adicionar leitura histórica com filtros por evento

### Importação mais inteligente
- Primeira camada já iniciada
- Já reaproveita histórico para sugerir:
  - categoria
  - rateio
- Próximo passo:
  - refinar padrões por texto parecido
  - medir quando a sugestão deve ou não prevalecer

### Fechamento de período
- Base já iniciada
- Já permite:
  - fechar / reabrir o mês atual no Financeiro
  - alertar alterações em títulos do mês
  - alertar alterações e importação no Extrato
- Próximo passo:
  - ampliar o indicador visual de fechamento nas telas

## Em breve

## Depois

### Classificação operacional complementar
- Marcadores além da categoria
- Exemplos:
  - evento
  - fornecedor
  - equipe
  - responsável
- Sem interferir no DRE e no Resumo

### Relatórios operacionais mais ricos
- Exportações mais específicas por tela e por filtro
- PDF/XLSX com agrupamentos operacionais
- Possível visão por evento ou responsável

### Refinos do rateio
- Copiar rateio de lançamento parecido
- Sugerir rateio com base em histórico
- Filtro só de lançamentos rateados

### Concluído recente
- Saldo inicial por conta
  - saldo inicial oficial por conta
  - base do saldo acumulado do Extrato
- Caixa / dinheiro em espécie
  - conta do tipo caixa
  - espécie tratada como conta operacional

## Guardado

### LGPD - pendentes do fim de semana
- Definir canal formal de privacidade
- Definir retenção e descarte
- Estruturar atendimento aos direitos do titular
- Criar fluxo de exportação / correção / exclusão
- Formalizar registro e decisão de incidentes
- Revisar campos livres e backup sob ótica de minimização

### Sincronização em tempo real
- Atualizar Extrato e Financeiro simultaneamente em duas telas / janelas
- Usar Supabase Realtime
- Começar por:
  - lançamentos
  - titulos_financeiros
  - titulos_financeiros_baixas

### Relacionamentos
- Reexibir a frente de Relacionado a quando voltar a fazer sentido operacionalmente
- Evoluir sugestões automáticas e regras de uso

### Centro de custo
- Assunto pausado
- Substituído no momento pelo rateio por categoria
- Pode voltar no futuro se a operação pedir duas camadas de classificação

## Observações

- Prioridade atual recomendada:
  1. Conciliação inteligente
  2. Dashboards executivos
  3. Títulos recorrentes no Financeiro
  4. Importação mais inteligente
  5. Auditoria financeira

- Este backlog deve ser revisado sempre que uma frente nova entrar em produção ou mudar de prioridade.
