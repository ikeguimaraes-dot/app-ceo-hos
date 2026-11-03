# Receita diária de eventos

A RPC `ghost_dashboard_v4` consolida restaurante (Lorean) e eventos (MISE), sem
alterar a v3 consumida pelos aplicativos antigos. O app exibe `Eventos` em azul
junto dos turnos, com valor em centavos, e inclui a receita em cartões, gráfico,
metas e posição mensal. A atualização do app é necessária para consumir a v4.

## Origem e composição

Eventos ficam no projeto `rpavxnjchfmeiacnumpk`, na tabela `eventos`. São usados
somente casa, data, status e os três campos financeiros já utilizados pelo KPH
web: `custo_evento`, `valor_cobrado` e `extras_valor`. Cada parcela é arredondada
em centavos antes da soma. Cancelados são excluídos sem distinção de maiúsculas;
valores negativos ou não finitos produzem erro, nunca receita fabricada.

O vínculo das quatro casas é explícito no servidor, igual ao painel KPH. Não
são importados nomes de clientes, convidados, contatos ou detalhes de eventos.
Almoço e jantar continuam calculados apenas sobre o restaurante; eventos são
adicionados depois. Dia com apenas evento também é incluído, e zero legítimo é
preservado. Um dia sem qualquer dado continua ausente.

Recebido, líquido, descontos, gorjeta, clientes, ticket e CMV continuam restritos
ao restaurante: a fonte de eventos não fornece essas métricas. Essa distinção é
informada no resumo do app. A linha Eventos não mostra métricas inexistentes.

## Fronteira de acesso

1. No backend dev, `ghost_dashboard_v4` exige identidade, unidade autorizada e
   capability `dashboard.read` antes de qualquer consulta externa.
2. O banco chama o endereço fixo da Edge Function `ghost-events-revenue` do MISE
   usando o JWT do próprio usuário. Não usa segredos compartilhados novos.
3. A Edge Function valida novamente essa identidade/unidade no KPH pela RPC
   `ghost_events_authorize_v1`. A validação de JWT ocorre no gateway Auth KPH;
   `verify_jwt=false` na função fonte é necessário porque o JWT pertence ao KPH.
4. Só depois dessa autorização, a identidade de servidor fornecida pelo runtime
   consulta a RPC `ghost_events_revenue_source_v1`, executável apenas pelo servidor.
5. A resposta contém somente totais por data. A RPC v4 valida escopo, intervalo,
   duplicidades e valores; a composição financeira acontece no PostgreSQL.

Falhas de fonte ou autorização são explícitas; não há fallback para eventos
zero. O total do portfólio não apresenta soma parcial como consolidado quando
alguma consulta falha. Nenhuma chave administrativa vai para cliente, testes,
documentação ou configuração pública. Nenhuma tabela de negócio foi alterada.
O repositório KPH foi usado somente para leitura.

## Validação — 2026-11-03

- Auth HTTP real com a conta de revisão já autorizada e RPC v4: Meet em
  27/10/2026 retornou restaurante `48.225,40`, eventos `26.200,00`, total
  `74.425,40`, igual à imagem de referência. Unidade fora do vínculo foi negada.
  Isso valida Auth/RPC e a integração entre servidores, não login na UI móvel.
- `supabase/tests/dashboard-events.sql`: cálculo diário/mensal, meta, snapshot,
  evento sem restaurante, zero legítimo, ausência e rejeição de duplicados,
  valores negativos e datas fora do período. Sem escrita em tabelas de negócio.
- 219 testes unitários; nove E2E; lint, typecheck, limites de acesso e gate de
  release; exportações remota Android/iOS/web e mock web passaram.
- Teste HTTP negativo: 34 RPCs anônimas negadas, credenciais inválidas negadas,
  integrações Serena e Eventos recusando tokens ausentes/inválidos.
- RPC fonte sem `EXECUTE` para anon/authenticated. Security Advisor antes/depois
  sem novos avisos nos dois projetos; passivo anterior permanece fora desta mudança.

## Distribuição

- Commit de implementação: `161d523`.
- Web publicada em https://app-ceo-hos.vercel.app, deployment
  `dpl_AGJf4bqEqektpxTkAimNGyCN8Fvg` com status READY. HTML/bundle verificados;
  Chrome confirmou login remoto, redirecionamento protegido e nenhum erro de
  página ou HTTP do app nessa verificação sem sessão.
- iOS `0.1.0 (7)`, build EAS
  `372a84f6-47bb-417a-8332-dea68dc4fa7f`, compilado para aparelho com assinatura store.
- Submissão EAS: `f759f420-00c9-4cf9-9dc1-2a5b21d5d42c`.
- Consulta em 03/11/2026 às 11h26 (São Paulo): `IN_QUEUE`, sem erro informado.
  O build 7 ainda não está disponível no TestFlight; a atribuição ao grupo externo
  e eventual revisão beta dependem do envio e processamento pela Apple.
- A atualização no TestFlight é necessária; versões antigas continuam usando v3.
- Não foi executada instalação nem jornada positiva em aparelho físico desta versão.
