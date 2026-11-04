# Filtro de mês na Home

A Home oferece o mesmo seletor mensal do detalhe da casa, com o mês corrente e
os 12 anteriores. A escolha atualiza o faturamento consolidado, todas as casas,
metas, percentuais mensais, dados diários e cartões de posição acumulada.

Abrir uma casa leva o mês escolhido na Home para o detalhe. Navegar por outro mês
no detalhe não altera o filtro da Home; ao voltar, a escolha original permanece.
“Voltar ao período atual” retoma o acompanhamento automático do período de reporte.
A escolha é mantida apenas em memória durante a sessão, sem persistir dados de
negócio nem ampliar permissões de usuário/casa.

Sem escolha manual, preserva-se a regra existente: no dia 1, o período padrão
continua no mês anterior; a partir do dia 2, passa para o mês corrente. Uma escolha
manual permanece ao virar o mês até o usuário voltar ao período atual. As opções
do calendário usam America/Sao_Paulo e são renovadas quando muda o mês.

No período padrão, mantém-se “Ontem nas casas”. Nos demais meses, a seção mostra
o último ponto com receita informada de cada casa dentro do mês e até ontem,
com a data explícita. Zero informado é válido; ausência permanece “—”. Pontos
provisórios são identificados. Nenhum dado de outro mês é apresentado como
fechamento do mês escolhido. A posição acumulada usa a data retornada pelo servidor.

A alteração usa a RPC v5 e os filtros de mês existentes. Os cálculos financeiros
continuam no servidor. O perfil de sócio recebe o mesmo filtro, conservando
somente suas unidades e os dados de faturamento/metas permitidos.

Validação: lint, TypeScript, 221 testes unitários, 13 E2E (incluindo seleção em
todas as casas, sócio, mês do detalhe, volta à Home, retorno ao período atual e
escolha manual durante a virada de mês), boundaries, gate de release, exportações
mock web/remota Android/iOS/web e teste remoto negativo de 36 RPCs. Sem mudança
de módulos nativos. Não houve instalação ou teste em aparelho físico nesta etapa.

## Distribuição

- Implementação `d7e8d5d`, enviada ao GitHub.
- Web publicada e promovida em https://app-ceo-hos.vercel.app, deployment
  `dpl_6fETXbQYKBgy5BtGyGxspi76xkSA`; bundle e API v5 conferidos.
- iOS `0.1.0 (11)`, build `8f770ca1-b416-4df8-b374-57498add4efa`;
  submissão automática EAS `58d8062e-4720-4f48-87ae-2c2bb6a80f76` agendada.
  A versão 11 inclui também a correção do percentual mensal feita na versão 10.
- O link TestFlight é o mesmo: https://testflight.apple.com/join/41JRK7ea.
  Compilação/envio e processamento externo ainda precisam concluir para que
  a versão 11 possa ser instalada. O acompanhamento das versões 10/11 foi
  configurado para concluir a associação ao grupo e a revisão após o processamento.
- Validação real no domínio canônico com login: seleção de outubro, quatro casas
  com referências diárias de outubro, abertura do detalhe no mês escolhido,
  navegação de outro mês no detalhe e volta à Home preservando outubro, retorno
  ao período atual e logout; zero erros de página no Chrome com viewport móvel.
  Isso não equivale a validação em aparelho físico.
