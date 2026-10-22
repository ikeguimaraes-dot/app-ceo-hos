# Receita mensal e NF de produto

O dashboard de cada casa aceita o mês como parâmetro e retorna somente indicadores financeiros necessários ao aplicativo: faturamento conciliado, bruto, líquido, recebido, descontos, gorjeta, clientes, ticket, projeção, meta e série diária. O mês atual é o padrão e os últimos 13 meses podem ser consultados.

A home usa a série autorizada do dashboard para destacar o fechamento do dia anterior das quatro casas. A aba `NF` substitui a antiga visão operacional e consulta `ghost_product_invoices_v1(unit, month, limit)`, que expõe somente número, emissão, fornecedor, CFOP, situação e total da nota.

Os dois contratos validam `auth.uid()` e a capability da unidade no servidor. `ghost_dashboard_v2` exige `dashboard.read`; `ghost_product_invoices_v1` exige `operation.read`. `anon` e `public` não executam as funções, e nenhuma tabela financeira é consultada diretamente pelo aplicativo.

Referências funcionais: [Receita e metas do KPH](https://kph-os-financeiro.vercel.app/financeiro/dre/receita) e [CMV e produtos do KPH](https://kph-os-financeiro.vercel.app/financeiro/dre/cmv).
