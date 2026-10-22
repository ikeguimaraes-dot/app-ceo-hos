# Receita mensal e NF de produto

O dashboard de cada casa aceita o mês como parâmetro e retorna somente indicadores financeiros necessários ao aplicativo: faturamento conciliado, bruto, líquido, recebido, descontos, gorjeta, clientes, ticket, projeção, meta e série diária. O mês atual é o padrão e os últimos 13 meses podem ser consultados.

A home usa a série autorizada do dashboard para destacar o fechamento do dia anterior das quatro casas. A aba `NF` substitui a antiga visão operacional e consulta `ghost_product_invoices_v1(unit, month, limit)`. O contrato lê `everest_facade_uniao`, a mesma fonte da tela CMV do KPH, e agrupa suas linhas de produtos por DANFE, emissão e fornecedor. O aplicativo recebe número, emissão, fornecedor, CFOP, total e quantidade de itens da nota.

Os dois contratos validam `auth.uid()` e a capability da unidade no servidor. `ghost_dashboard_v2` exige `dashboard.read`; `ghost_product_invoices_v1` exige `operation.read`. `anon` e `public` não executam as funções, e nenhuma tabela financeira é consultada diretamente pelo aplicativo.

O dashboard também entrega o fechamento de cada dia e os turnos. Caixas separados preservam o turno gravado; um caixa de dia inteiro usa primeiro a divisão por horários do Lorean e depois a seção de turnos, seguindo a regra do Financeiro. A lista de NF inclui as linhas da DANFE vindas da fachada Everest e permite abrir quantidade, unidade, custo e classificação CMV de cada item.

Referências funcionais: [Receita e metas do KPH](https://kph-os-financeiro.vercel.app/financeiro/dre/receita) e [CMV e produtos do KPH](https://kph-os-financeiro.vercel.app/financeiro/dre/cmv).
