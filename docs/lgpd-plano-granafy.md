# LGPD - Plano Base do Granafy

Ultima atualizacao: 31/05/2026

## 1. Objetivo

Este documento inicia a trilha de conformidade LGPD do Granafy e organiza o trabalho em cinco frentes:

- documental
- produto
- banco de dados e infraestrutura
- operacao
- resposta a incidentes

O objetivo desta fase inicial e reduzir risco, dar previsibilidade e criar um roteiro auditavel para as proximas etapas.

## 2. Referencias oficiais usadas nesta fase

- Lei Geral de Protecao de Dados Pessoais - Lei no 13.709/2018
  [https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709.htm](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709.htm)
- ANPD - Direitos dos titulares
  [https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direitos-dos-titulares](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direitos-dos-titulares)
- ANPD - Guia orientativo sobre agentes de tratamento e encarregado
  [https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-agentes-de-tratamento-e-encarregado.pdf](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-agentes-de-tratamento-e-encarregado.pdf)
- ANPD - Guia orientativo de seguranca da informacao para agentes de tratamento de pequeno porte
  [https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-seguranca-da-informacao-para-agentes-de-tratamento-de-pequeno-porte.pdf)
- ANPD - Regulamento para agentes de tratamento de pequeno porte
  [https://www.gov.br/anpd/pt-br/assuntos/legislacao/regulamento-de-aplicacao-da-lgpd-para-agentes-de-tratamento-de-pequeno-porte](https://www.gov.br/anpd/pt-br/assuntos/legislacao/regulamento-de-aplicacao-da-lgpd-para-agentes-de-tratamento-de-pequeno-porte)
- ANPD - Regulamento do encarregado
  [https://www.gov.br/anpd/pt-br/assuntos/legislacao/resolucao-cd-anpd-no-18-de-16-de-julho-de-2024](https://www.gov.br/anpd/pt-br/assuntos/legislacao/resolucao-cd-anpd-no-18-de-16-de-julho-de-2024)

## 3. Papel do Granafy no tratamento

O Granafy precisa operar com uma leitura clara de papeis:

- **Controlador**: em regra, o cliente dono da base que decide quais dados de pessoas fisicas e juridicas serao cadastrados e para quais finalidades.
- **Operador**: o Granafy, enquanto plataforma, trata os dados em nome do controlador para viabilizar autenticacao, registros financeiros, auditoria, compartilhamento e relatorios.
- **Suboperadores**: provedores usados na operacao, como Supabase e qualquer servico de e-mail, hospedagem, analytics ou automacao que venha a ser conectado.

Observacao importante: quando o proprio Granafy usar dados para finalidades proprias fora da instrucao do cliente, esse desenho deve ser revisto com cuidado.

## 4. Estado atual do produto

Itens ja presentes no projeto:

- autenticacao por e-mail e senha
- perfis de acesso (`Master`, `Consultor`, `Usuario`)
- compartilhamento de acesso por cliente
- aceite de termos e politica de privacidade no cadastro
- trilhas de auditoria operacionais em modulos especificos
- segregacao de categorias, centros de custo e configuracoes por cliente
- backups manuais
- limitacao visual e funcional por perfil

Itens parcialmente cobertos:

- transparencia legal no front-end
- controle de acesso por cliente
- segregacao de ambiente PJ e PF
- minimizacao parcial por perfil e por cliente

Itens ainda pendentes:

- canal formal para exercicio de direitos do titular
- politica de retencao e descarte
- fluxo de exportacao orientado ao titular
- fluxo de correcao/exclusao/anonimizacao orientado ao titular
- registro formal de incidentes
- inventario formal de operadores e suboperadores
- base legal mapeada por fluxo

## 5. Fases recomendadas

### Fase 1 - Governanca minima

- manter termos e politica visiveis e aceitos no cadastro
- consolidar documentacao LGPD do projeto
- registrar papeis de controlador, operador e suboperadores
- definir canal de contato para privacidade
- definir rito basico de incidente

### Fase 2 - Direitos do titular

- permitir localizacao rapida dos dados por cliente e por usuario
- preparar exportacao de dados do titular
- preparar fluxo de correcao e atualizacao
- preparar fluxo de eliminacao ou anonimizacao quando juridicamente possivel

### Fase 3 - Seguranca e retencao

- criar tabela ou documento de retencao por tipo de dado
- revisar logs de acesso e auditoria
- revisar backups e destino dos arquivos exportados
- revisar compartilhamento de acesso por cliente

### Fase 4 - Operacao recorrente

- revisao periodica de perfis
- revisao de acessos compartilhados
- revisao de integracoes externas
- registro de incidentes, ainda que nao notificaveis

## 6. Prioridade pratica para o Granafy

Para a realidade atual do produto, a ordem mais eficiente e:

1. documentar o tratamento atual
2. definir canal e responsavel por privacidade
3. fechar retencao
4. estruturar atendimento a direitos do titular
5. endurecer resposta a incidente

## 7. Observacao final desta fase

Esta etapa nao encerra a conformidade LGPD. Ela cria a base para que as proximas alteracoes do produto sejam feitas com rastreabilidade, menos improviso e menor risco.
