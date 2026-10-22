# Fase 2J — fluxo de caixa semanal

Status: implementada no app e no projeto Supabase em 22/10/2026.

A tela **A pagar** oferece **Fluxo da semana** por casa ou em **Todas as casas**. A experiência apresenta quatro semanas civis consecutivas, de segunda a domingo, com entradas, saídas, acumulado, alerta de saldo negativo e barras animadas para cada dia.

## Contrato remoto

`ghost_cash_flow_week_v2(unit?, weekOffset)` usa vendas de `lorean_workdays` e títulos abertos de `everest_titulos_fornecedor_completo`:

- segunda até ontem usa o faturamento realizado de cada dia;
- hoje e os dias futuros usam a média das cinco ocorrências anteriores do mesmo dia da semana;
- o retorno separa `actualIncoming` e `projectedIncoming` no total e em cada dia;
- saídas usam títulos abertos marcados para fluxo de caixa na data de vencimento;
- o backend calcula o acumulado diário e informa se ele fica negativo;
- unidade nula consolida somente as casas em que o usuário possui `dashboard.read`;
- o deslocamento é limitado à semana atual e às três seguintes.

A função deriva o usuário de `auth.uid()`, monta o escopo autorizado no servidor, executa com `search_path` vazio e concede acesso apenas ao papel `authenticated`. O aplicativo não acessa tabelas e apenas apresenta os valores já calculados pelo contrato remoto.

## Evidência

- [Fluxo de caixa semanal](screenshots/cash-flow-week.png)

O contrato tem fixture determinística, validação Zod, testes unitários, jornada E2E e teste de recusa anônima.
