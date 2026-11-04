# Fontes reais aprovadas para a IA

Em 04/11/2026, o dono do app definiu que a IA deve consultar somente CMV e produtos, receita e metas, contas a pagar, fichas técnicas e inventários. A tabela `dre_despesa_detalhada` é demonstrativa. A cobertura até abril encontrada nessa tabela não descreve a cobertura real do financeiro e não deve fundamentar respostas.

| Área | Dataset da IA | Fonte real |
| --- | --- | --- |
| Receita e metas | `financeiro` | Dashboards Ghost com Lorean, metas semanais/ajustes por data e composição de eventos MISE |
| Notas do CMV/produtos | `compras_notas` | `everest_facade_uniao`, agregada por documento/fornecedor/competência |
| Itens e categorias compradas | `compras_itens` | `everest_facade_uniao`, com classificação gerencial e resumos calculados no banco |
| Produtos vendidos | `vendas_produtos` | `lorean_produtos_dia` e `lorean_workdays` |
| Contas a pagar | `contas_pagar` | `everest_titulos_fornecedor_completo` |
| Ficha técnica | `fichas_tecnicas` | `v_fichas_tecnicas_custo`, `everest_fichas_tecnicas_custo` e relações Everest da ficha |
| Inventário | `inventarios` | `everest_inventarios` e `everest_inventario_itens` |

As fontes foram conferidas por leitura do código do financeiro em `src/app/financeiro/dre/cmv/actions.ts`, `src/app/financeiro/dre/inventario/actions.ts` e `src/app/financeiro/produtos/actions.ts`, além das RPCs já existentes. O repositório financeiro não foi alterado. A localização da página CMV sob o diretório `dre` não transforma suas fontes Everest em DRE demonstrativa.

DRE mensal/detalhada, despesas demonstrativas, folha/pessoas, reservas, contratos e demais módulos estão fora do escopo da IA. Eventos continuam incluídos na receita canônica da Home; o dataset genérico `eventos` não é usado como fonte alternativa.

## Aplicação da regra

- A allowlist é verificada antes de executar consultas nas quatro versões `ghost_assistant_query_v1` a `v4`.
- Os três catálogos públicos são filtrados. As implementações originais ficam privadas, sem execução por clientes.
- O handler filtra o catálogo novamente e o parser das ferramentas recusa datasets fora da allowlist.
- Comparação e cobertura antigas recusam `despesas`/DRE. A versão 2 compara receita ou notas/itens reais, com deltas e direção calculados no servidor.
- `ghost_assistant_coverage_v2` descobre primeiro/último registro apenas das sete fontes reais, revalidando a capability da área em cada unidade. Isso permite localizar a última data de inventário ou cálculo da ficha antes de buscar linhas.
- Pedidos fora do escopo recebem o texto oficial das fontes disponíveis, sem valores demonstrativos ou reaproveitamento das conclusões anteriores.

As permissões por usuário e casa permanecem obrigatórias. Não foi criado acesso direto a tabelas no app ou SQL livre para o modelo. O provedor OpenRouter e a autorização já concedida pelo usuário foram preservados.

## Semântica

Compra por competência não equivale a despesa paga. Contas a pagar são filtradas por vencimento, com os fallbacks de data existentes no contrato. Total de notas ou itens comprados não é automaticamente CMV consumido. Não se apresenta CMV consumido sem os dados/regras de estoque inicial, entradas e estoque final. Inventários são fotografias de estoque: não se somam inventários sucessivos para informar o saldo atual. Custos de fichas só são apresentados como definitivos quando marcados como confiáveis.

A busca histórica por “carne” utiliza a classificação gerencial de proteínas no contrato existente. A resposta deve identificar a abrangência da categoria quando ela também incluir peixes/frutos do mar, em vez de afirmar que o total corresponde somente a carnes terrestres.

## Validação

Testes de parser/modelo cobrem a recusa de fontes fora do escopo, filtragem de catálogo e resposta sem dados demonstrativos. `supabase/tests/assistant-source-scope.sql` verifica os guards com claims dentro de rollback: oitenta combinações de fontes bloqueadas/versões, três catálogos e as análises antigas. Isso não é apresentado como login móvel real.

A validação HTTP com Auth real verifica separadamente os catálogos, a recusa de fontes demonstrativas, as seis consultas de dados reais além da receita, as datas das sete fontes e a comparação de compras. As conversas publicadas cobrem recusa de DRE, continuação por compras reais e receita semanal. Lint, typecheck, testes, boundaries, exportações mock/remota, E2E e teste negativo são executados para esta entrega.

A mudança é no backend e funciona no aplicativo 0.1.0 (12), sem exigir atualização do TestFlight. O ambiente continua sendo o projeto KPH de desenvolvimento utilizado pelo aplicativo; não houve implantação do financeiro em produção.

Resultado final: Edge Function `ghost-assistant` versão 31 ativa; 240 testes unitários, 13 E2Es, lint/typecheck/boundaries/release gate, exportações mock/remota e 41 RPCs negativas passaram. Auth real confirmou as seis consultas aprovadas além da receita, metadados das sete fontes, catálogos filtrados e 28 recusas de fontes fora do escopo entre as versões testadas. A comparação real de compras por categoria retornou deltas e percentuais verificados; a conversa completa recusou a DRE, consultou notas reais e comparou os meses seguintes. Receita semanal, inventários e fichas com custo confiável também foram verificados no endpoint publicado. Não houve teste de aparelho físico ou alteração de módulo nativo.

Os advisors preservaram as categorias anteriores; as duas novas RPCs autenticadas e autorizadas elevam essa categoria de 202 para 204. Nenhuma nova função foi concedida a `anon`. A descoberta de competências de compras usa a origem `everest_notas_recebidas_atuais`, exigindo itens vinculados, a mesma origem da fachada; evita os joins de custos/sincronização que não são necessários para descobrir datas.
