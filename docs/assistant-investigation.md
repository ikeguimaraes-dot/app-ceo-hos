# IA com investigação no CEO de bolso

Entrega de 04/11/2026. O backend do app passou a investigar com ferramentas antes de responder. A entrega usa o projeto KPH de desenvolvimento já conectado ao app; não implanta o sistema financeiro em produção nem altera o repositório KPH somente leitura.

## Comportamento

O handler `ghost-assistant` agora usa `runInvestigation`, compartilhado com os testes. Todas as perguntas, inclusive as reconhecidas pelas receitas antigas, passam pelo mesmo ciclo: interpretar, consultar, avaliar os resultados, refinar e concluir. As receitas e os textos determinísticos antigos permanecem para compatibilidade de código/testes, mas não encerram a requisição publicada.

As ferramentas disponíveis são:

- `analisar_financeiro`: faturamento, eventos, metas, turnos, médias e cobertura, agrupados por unidade, dia, dia da semana ou mês.
- `comparar_kph`: diferenças e variações de faturamento/despesas entre dois períodos, calculadas no PostgreSQL.
- `consultar_kph`: DRE, compras e demais datasets existentes, com a autorização original de cada área. Faturamento usa exclusivamente a nova ferramenta para evitar as regras antigas de metas/eventos.
- `verificar_cobertura`: primeiro e último registro importado de financeiro, despesas ou DRE por casa autorizada.
- `finalizar_resposta`: texto final e referência à evidência que representa o foco da conversa, preservando o assunto mesmo após consultas auxiliares.

A investigação admite até oito rodadas e doze chamadas de dados, com um orçamento de 105 segundos, prazos individuais e cache somente em memória por requisição. Não existe cache compartilhado entre usuários. Erros de argumentos/fonte retornam ao modelo para correção. Consultas idênticas na mesma requisição reutilizam a evidência. Valores não encontrados nos resultados são recusados e há até duas tentativas de correção.

O histórico aceita respostas anteriores de até 6.000 caracteres; antes, uma resposta longa podia tornar a próxima mensagem inválida pelo limite de 1.200. O corpo possui limite de 128 KiB. O contrato de resposta continua compatível com o aplicativo 0.1.0 (12), inclusive quando a validação antiga descarta os campos opcionais novos do estado. O histórico continua disponível nesses clientes. Não há novo módulo nativo, build obrigatório ou mudança no link do TestFlight.

## Regras financeiras

A nova RPC reaproveita `ghost_dashboard_v3` para o restaurante e `dashboard_with_events_v1` para compor os eventos, com as mesmas regras da Home. Assim, inclui a herança de metas por competência, os ajustes por data e a fonte MISE já utilizada no app.

A consulta de eventos foi ampliada por um contrato servidor `ghost_events_revenue_source_v2`, limitado a 123 dias. A versão anterior continua disponível. O gateway continua autenticando no KPH antes de ler a origem. Uma consulta histórica usa uma requisição por casa para todo o intervalo, evitando uma requisição para cada casa/mês. Os novos RPCs de análise e comparação têm timeout específico de 30 segundos via configuração de função PostgREST; os limites globais e dos outros RPCs não foram alterados. Referência: [timeouts por função do Supabase](https://supabase.com/docs/guides/database/postgres/timeouts).

Médias habituais sem período explícito usam as últimas doze semanas completas, de segunda a domingo. Cada média consolidada usa os totais diários apenas nas datas com receita conhecida em todas as casas selecionadas. Zero registrado entra no denominador; ausência não vira zero. A resposta informa amostras e exclusões. Sem cobertura conjunta, pode apresentar médias individuais com seus próprios denominadores, sem somá-las como se fossem a média do grupo.

A meta da faixa consultada e a meta do mês inteiro são campos separados. Percentuais novos são pontos percentuais (0 a 100), calculados no servidor. Comparações também retornam deltas e variações calculadas no banco, com direção e magnitude absoluta. Isso permite escrever “queda de X%” sem recusar o valor positivo da redução. A posição contra meta também inclui direção e desvio absoluto. Uma regressão real dessa apresentação foi corrigida e a conversa foi repetida com sucesso. O ticket exclui eventos, pois os clientes de eventos não entram no denominador de restaurante.

Um filtro de mês da DRE tinha expressão regular com escape excessivo, excluindo competências válidas. A migration corrige somente esse predicado nas consultas já autorizadas. Orçado e realizado continuam separados.

## Permissões e provedor

Os três RPCs novos exigem autenticação, usuário com `assistant.ask`, unidade ativa e `dashboard.read` na unidade consultada. O compositor fica privado, sem execução por `anon`/`authenticated`. O contrato de origem de eventos só pode ser executado pela identidade servidora do gateway. Sócios continuam sem acesso à IA, inclusive por chamada direta.

O modelo não recebe JWT, chave administrativa, credenciais, cliente de banco ou ferramenta de SQL livre. As consultas executam com a identidade autenticada do usuário. Histórico e evidências necessárias são enviados ao OpenRouter, mantendo `data_collection=deny` e `zdr=true`. A revisão automática bloqueou inicialmente a publicação por esse envio externo; o usuário autorizou explicitamente manter o OpenRouter antes da implantação. Não foram trocados silenciosamente provedor ou modelo.

A preferência e os quatro modelos existentes foram preservados. Os testes de integração descritos abaixo são amostras de compatibilidade/qualidade, não um ranking estatístico entre modelos.

## Validação

- Lint, typecheck, 238 testes unitários, boundaries e release gate passaram.
- Exportações remota Android/iOS/web e mock web executadas.
- Treze jornadas E2E existentes passaram no Chrome, incluindo login, isolamento de unidade, sócios, Home e logout.
- Trinta e nove RPCs negaram chamadas anônimas; login inválido e tokens ausentes/inválidos na IA, reservas e eventos foram recusados.
- SQL de regressão em `supabase/tests/assistant-finance-analysis.sql`: médias de totais diários, zero conhecido, ausência, paginação, metas nulas e privilégios. Os guards de sócio foram testados com claims em transação/rollback; isso não representa login móvel real de sócio.
- Login Auth real da conta de demonstração e chamadas HTTP aos novos RPCs: doze semanas, quatro casas, eventos, metas iguais às da Home, comparação de despesas com período que tem registros e unidade não autorizada negada.
- Conversa real com Claude: pergunta literal do anexo, “E sem eventos?” e detalhamento do Frêneze no mesmo período. A validação reproduz o formato de estado aceito pela versão 12 instalada.
- A mesma pergunta original foi respondida com o histórico adequado também por DeepSeek (padrão), GPT-6 Luna e Gemini nas respectivas conversas/testes. GPT foi usado adicionalmente para metas e cobertura de despesas.
- Advisors KPH: três novas funções autenticadas com autorização explícita, total 202; categoria anônima permanece em 107. Demais categorias legadas permanecem em 184/15/66/9/3/1 e proteção de senha vazada desativada. Na origem de eventos, permanecem os dois avisos legados (RLS de uma tabela e proteção de senha vazada). Não se afirma saneamento da superfície legada.

A versão final publicada da Edge Function é 29, e o gateway de eventos é a versão 2. O teste final de metas com GPT concluiu a distinção mensal/acumulada e a comparação entre os primeiros três dias de novembro/outubro, incluindo diferença e redução percentual. O detalhamento final com Claude também concluiu após uma correção de validação numérica.

Não houve teste em aparelho físico nesta entrega. A validação conversacional usa Auth real e o endpoint publicado, e os E2Es locais usam mocks, claramente separados.

## Limites observados

A fonte autorizada de despesas detalhadas possui registros até abril de 2026, com cobertura desigual entre casas. Consultar outubro/setembro não comprova despesa zero. A IA deve verificar a cobertura e informar essa limitação, mantendo o período solicitado; não deve substituí-lo silenciosamente por outro. Atualizar essa integração é trabalho distinto da melhoria do agente.

Há domingos sem registro em todas as casas simultaneamente. Isso impede uma média consolidada completa; não comprova fechamento da casa nem receita zero. A resposta precisa declarar a limitação.

A verificação atual prova suporte numérico e inclui proteção para ausência descrita como zero, mas não comprova semanticamente cada afirmação por caminho de campo. Avaliações contínuas de conversas e expansão de contratos continuam necessárias. Não foi feito fine-tuning nem prometida precisão absoluta.
