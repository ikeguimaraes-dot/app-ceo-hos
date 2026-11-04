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

## Percentual mensal e posição até uma data — 04/11/2026

O card principal usava `goalProgress`, um indicador do período decorrido, como se
fosse o avanço da meta mensal. No Frêneze, o payload tinha receita `30.488,45`,
meta até 04/11 `38.000` e progresso `80,23%`, mas meta mensal `524.000`. A posição
até 03/11, separadamente, tinha meta `25.000` e receita `30.488,45`.

A API aditiva `ghost_dashboard_v5` calcula `monthGoalProgress` no servidor usando
a mesma receita exibida no card dividida pela meta do mês inteiro. O caso real
retorna `5,818406...%` (5,82% com duas casas). `goalProgress` e todas as versões
anteriores mantêm seu significado; a posição acumulada continua com sua data.
A nova UI usa somente o percentual mensal no card principal, mostra “Meta do mês”
no detalhe e identifica os cartões de posição como “até DD/MM”. Essa apresentação
exige a nova versão do app, ao contrário da correção anterior de herança de metas.

O cálculo recebe a resposta já autorizada e minimizada da v4; não expõe nenhum
campo adicional do restaurante aos sócios. Zero, ausência de dados, meta zero e
atingimento acima de 100% são tratados explicitamente. O teste SQL reproduz o
exemplo real sem gravar dados de negócio. Auth/RPC real validou as quatro casas
nas versões v3/v4/v5 e manteve a negação de unidade fora do vínculo.

Validação da distinção mensal: 221 testes unitários, 11 jornadas E2E (incluindo
regressão específica do denominador mensal), lint, TypeScript, boundaries e gate
de release. Teste negativo ampliado para 36 RPCs, incluindo v5. Security Advisor
mantém as mesmas categorias e passivo; a contagem de funções autenticadas cresce
em uma pela nova v5, com autorização explícita e execução anônima revogada.

### Distribuição da correção de percentual

- Implementação: `a8a8653`, enviada ao GitHub.
- Web publicada e promovida no domínio https://app-ceo-hos.vercel.app, deployment
  `dpl_3n99Vz3nPiHNgPfYcNDDELBBGFz3`; bundle v5 e rótulo mensal conferidos.
- iOS `0.1.0 (10)`: build `4c2c255b-4add-442d-8019-98277e9dbbc5`;
  submissão EAS `3f9897a9-2f6f-4d88-b1c5-159af53647dd`.
- Link de distribuição preservado: https://testflight.apple.com/join/41JRK7ea.
- Jornada web real no domínio canônico: login, card e detalhe do Frêneze mostrando
  `5,8% da meta do mês` e `R$ 524 mil`, logout; zero erros de página no Chrome.
  Não representa instalação ou jornada em aparelho físico.
- Build iOS concluído (`FINISHED`). Na consulta final, a submissão está `IN_QUEUE`
  no Expo; ainda não é disponibilidade no TestFlight. O acompanhamento local do
  envio foi iniciado para associar o build processado ao grupo público, enviar à
  revisão externa se necessário e ler o estado final da Apple.
