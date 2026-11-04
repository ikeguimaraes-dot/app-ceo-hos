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
