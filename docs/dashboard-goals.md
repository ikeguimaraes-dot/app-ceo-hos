# Metas do dashboard — referência mensal

## Origem e divergência encontrada em 04/11/2026

As metas vêm do KPH (`kph-os-dev`): `metas_dia_semana`, por casa, competência
`YYYY-MM` e dia da semana, e `metas_dia_override`, para exceções por data.
Na investigação, as quatro casas tinham sete metas semanais em outubro e nenhuma
em novembro; não havia exceções por data a partir de outubro.

O endpoint web `src/app/api/lorean/workdays/route.ts` do repositório KPH, consultado
somente para leitura, já usa a competência anterior mais recente quando faltam
metas no mês solicitado. O app buscava apenas a competência exata, retornando
metas nulas para novembro.

## Correção no servidor

A função privada `ghost_private.weekday_goal_reference_v1` aplica a mesma regra:
meta do dia da semana no mês solicitado; na ausência desse registro, meta do mesmo
dia da semana na competência anterior mais recente daquela casa. Valores zero
explícitos são preservados, sem buscar meses posteriores. Meses parcialmente
preenchidos mantêm os dias próprios e herdam os demais, como o endpoint web.

A substituição foi limitada à consulta semanal das implementações privadas dos
dashboards v1–v3. O dashboard v4 de eventos usa essa mesma cadeia e recebe a
correção. Exceções de uma data específica continuam com prioridade. Não foram
criadas, copiadas nem alteradas metas cadastradas; a meta herdada é uma referência,
não uma confirmação ou gravação de metas próprias de novembro.

Contratos públicos, autenticação, autorização por casa e minimização do perfil de
sócio foram preservados. A função nova não tem execução para anon/authenticated.
A versão 9 já instalada recebe a correção pela API, sem novo binário/TestFlight.

## Validação

- Comparação de 30 dias nas quatro casas com a regra da web: zero divergências.
  Metas mensais de referência para novembro: Meet `1.850.000`, Madonna `261.000`,
  Frêneze `524.000`, Match `149.000`.
- Auth HTTP real da conta de revisão e RPCs v3/v4: metas mensais e acumuladas até
  03/11/2026 válidas nas quatro casas; todas as metas da série disponíveis;
  unidade fora do vínculo negada com `42501`.
- `supabase/tests/dashboard-goal-reference.sql`: competência exata, herança,
  ausência de referência futura, isolamento entre casas e grants privados;
  somente leitura, sem gravação de metas ou identidades.
- 221 testes unitários, dez E2E, lint, TypeScript, boundaries e gate de release.
- Teste remoto negativo: 35 RPCs anônimas negadas; credencial inválida e tokens
  ausentes/inválidos nas integrações recusados.
- Security Advisor antes/depois sem alterações; passivo anterior preservado.
- Exportações mock web e remota Android/iOS/web. Não houve alteração de módulos
  nativos, instalação ou jornada em aparelho físico nesta correção.
