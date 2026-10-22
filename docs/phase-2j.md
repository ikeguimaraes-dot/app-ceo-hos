# Fase 2J — fluxo de caixa semanal

Status: implementada no app e no projeto Supabase em 22/10/2026.

A tela **A pagar** ganhou a opção **Fluxo da semana**, mantendo o seletor de casa no mesmo contexto. A experiência oferece quatro janelas consecutivas de sete dias, totais de entrada, saída e acumulado, alerta de saldo negativo e barras animadas para cada dia.

## Contrato remoto

`ghost_cash_flow_week_v1(unit, weekOffset)` reproduz a projeção usada pelo KPH Financeiro:

- entradas usam `lorean_workdays.receita_bruta` em D+1;
- saídas usam títulos abertos de `everest_titulos_fornecedor_completo` marcados para fluxo de caixa;
- vencimentos de sábado e domingo aparecem na segunda-feira;
- o backend calcula o acumulado diário e informa se ele fica negativo;
- o deslocamento é limitado à semana atual e às três seguintes.

A função deriva o usuário de `auth.uid()`, exige `dashboard.read` na unidade solicitada, executa com `search_path` vazio e concede acesso apenas ao papel `authenticated`. O aplicativo não acessa tabelas nem calcula regras financeiras.

## Evidência

- [Fluxo de caixa semanal](screenshots/cash-flow-week.png)

O contrato tem fixture determinística, validação Zod, teste unitário, jornada E2E e teste de recusa anônima.
