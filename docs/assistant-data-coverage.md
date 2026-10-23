# Cobertura de dados do Ghost IA

Auditoria atualizada em 23/10/2026. O assistente consulta apenas RPCs `security definer` com autenticação, capability e escopo de unidades autorizadas. O OpenRouter nunca recebe credenciais, IDs internos nem acesso SQL.

## Cobertura disponível

| Área                                   | Dataset semântico                  | Resumo calculado pelo banco | Resposta factual determinística |
| -------------------------------------- | ---------------------------------- | --------------------------- | ------------------------------- |
| Faturamento, meta, clientes e ticket   | `financeiro`                       | Sim                         | Sim                             |
| DRE mensal e linhas da DRE             | `dre_mensal`, `dre_detalhes`       | Parcial                     | Ainda não                       |
| Despesas por competência               | `despesas`                         | Linhas filtradas            | Ainda não                       |
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

## Fontes existentes que ainda precisam de contrato seguro

A inspeção do catálogo do banco encontrou fontes para fichas técnicas e custos (`everest_fichas_tecnicas*`, `v_fichas_tecnicas_custo`, `v_kph_fichas_unidade`), recebimentos (`recebimentos`, `recebimento_itens`) e caixas (`lorean_caixas`, `workday_caixas`). Elas não entram no assistente até receberem uma visão semântica agregada com autorização por unidade e testes de não exposição.

Ainda faltam contratos confirmados para orçamento, contas a receber consolidadas, conciliação de caixa, benefícios agregados, escalas e marketing. A existência de uma tabela com nome parecido não é suficiente para definir a regra de negócio.

## Próximas ampliações

1. Definir com o KPH a métrica oficial de contas a receber e conciliação de caixa.
2. Publicar resumos agregados de fichas técnicas e custo teórico, sem expor tabelas brutas.
3. Criar resumos completos de despesas, manutenção, pessoas, ausências, planos de ação e pedidos de venda para eliminar cálculos do modelo.
4. Adicionar casos de avaliação a cada novo contrato antes de ativá-lo no catálogo.

## Garantias de qualidade

- Perguntas frequentes com totais usam valores já calculados pelo PostgreSQL.
- Continuações preservam dataset, período, casa e busca em estado estruturado validado no servidor.
- Toda resposta numérica passa por verificação contra a evidência retornada.
- O painel de qualidade mostra sucesso, avaliações, latência, falhas e comparação por modelo sem guardar perguntas ou respostas.
