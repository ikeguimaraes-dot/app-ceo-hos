# Cobertura de dados do Ghost IA

Auditoria atualizada em 23/10/2026. O assistente consulta apenas RPCs `security definer` com autenticação, capability e escopo de unidades autorizadas. O OpenRouter nunca recebe credenciais, IDs internos nem acesso SQL.

## Cobertura disponível

| Área                                   | Dataset semântico                  | Resumo calculado pelo banco | Resposta factual determinística |
| -------------------------------------- | ---------------------------------- | --------------------------- | ------------------------------- |
| Faturamento, meta, clientes e ticket   | `financeiro`                       | Sim                         | Sim                             |
| DRE mensal e linhas da DRE             | `dre_mensal`, `dre_detalhes`       | Sim, realizado/orçado       | Sim                             |
| Despesas por competência               | `despesas`                         | Sim, categoria e casa       | Sim                             |
| Pedidos e notas de compra              | `compras_pedidos`, `compras_notas` | Notas: sim                  | Notas: sim                      |
| Itens, produtos e categorias compradas | `compras_itens`                    | Sim, inclusive por casa     | Sim                             |
| Contas a pagar                         | `contas_pagar`                     | Sim                         | Sim                             |
| Produtos vendidos e pagamentos         | `vendas_produtos`, `pagamentos`    | Sim                         | Sim                             |
| Descontos e cancelamentos              | `descontos`, `cancelamentos`       | Sim                         | Sim                             |
| Inventário e contratos                 | `inventarios`, `contratos`         | Sim                         | Sim                             |
| Eventos e reservas                     | `eventos`, `reservas`              | Sim                         | Sim                             |
| Operação e planos de ação              | `operacao_diaria`, `planos_acao`   | Operação: sim               | Ainda não                       |
| Folha e quadro de pessoas              | `folha_resumo`, `pessoas`          | Folha: sim                  | Folha: sim                      |
| Ausências e manutenção                 | `ausencias`, `manutencao`          | Linhas filtradas            | Ainda não                       |
| Pedidos de venda                       | `pedidos_venda`                    | Linhas filtradas            | Ainda não                       |
| Fichas técnicas e custo confiável      | `fichas_tecnicas`                  | Sim, com confiança          | Sim                             |
| Recebimentos de mercadorias            | `recebimentos`                     | Sim, por unidade de medida  | Sim                             |
| Fechamentos e diferenças de caixa      | `caixas`                           | Sim, sem dados do operador  | Sim                             |
| Conciliação de vendas e pagamentos     | `conciliacao_pagamentos`           | Sim, mensal e por casa      | Sim                             |

## Fontes existentes que ainda precisam de contrato seguro

As fontes de fichas técnicas e custos (`everest_fichas_tecnicas*`, `v_fichas_tecnicas_custo`), recebimentos (`recebimentos`, `recebimento_itens`) e caixas (`lorean_caixas`) entram somente por contratos semânticos autorizados. Custos sem a marca oficial `custo_confiavel` são ocultados; recebimentos não expõem assinatura, observação ou recebedor; caixas não expõem operador ou CPF.

O DRE e as despesas agora usam agregados completos calculados no PostgreSQL. Valores de despesas, armazenados com sinal contábil negativo, são apresentados como valor positivo gasto. O DRE mantém realizado e orçado separados. A conciliação usa `v_lorean_reconciliacao_mensal` e expõe apenas totais por casa e mês; `conciliacao_extrato` continua fora do catálogo porque contém dados bancários e grande parte dos registros não tem `unit_id` para aplicar o escopo do usuário com segurança.

Ainda faltam contratos confirmados para orçamento detalhado, contas a receber consolidadas, conciliação bancária por lançamento, benefícios agregados, escalas e marketing. A rota web `/financeiro/receber` é um placeholder e a auditoria não encontrou tabela, view ou RPC que defina uma fonte oficial de contas a receber. Entradas do extrato não serão tratadas como recebíveis porque isso produziria números incorretos.

## Próximas ampliações

1. Definir e materializar no KPH a fonte oficial de contas a receber, com competência, vencimento, baixa, saldo e unidade.
2. Criar resumos completos de manutenção, pessoas, ausências, planos de ação e pedidos de venda para eliminar cálculos do modelo.
3. Adicionar casos de avaliação a cada novo contrato antes de ativá-lo no catálogo.

## Garantias de qualidade

- Perguntas frequentes com totais usam valores já calculados pelo PostgreSQL.
- Continuações preservam dataset, período, casa e busca em estado estruturado validado no servidor.
- Toda resposta numérica passa por verificação contra a evidência retornada.
- O painel de qualidade mostra sucesso, avaliações, latência, falhas e comparação por modelo sem guardar perguntas ou respostas.
