# Fase 2G — assistente executivo

O Ghost oferece um chat somente leitura no botão **IA** do rodapé. Ele conversa sobre o portfólio autorizado sem pedir que o usuário escolha uma casa. A tela depende de `AssistantGateway`; o adapter remoto chama apenas a Edge Function `ghost-assistant`, e o mock continua determinístico e isolado.

## Fluxo e autorização

1. O usuário precisa de sessão válida, vínculo ativo e capability `assistant.ask` em ao menos uma unidade.
2. A Edge Function valida o JWT e carrega o bootstrap; o celular não envia unidade para definir o escopo.
3. Para cada casa autorizada, a função consulta somente as RPCs permitidas por suas capabilities. Cada RPC repete a autorização no banco.
4. A primeira casa autorizada funciona apenas como âncora do registro e limite em `ghost_assistant_begin_v1`; o contexto contém todas as casas autorizadas.
5. O contexto é reduzido antes do envio externo e o OpenRouter recebe instruções de zero retenção e bloqueio de coleta.
6. `ghost_assistant_finish_v1` registra somente resultado, código, modelo e contagem de tokens.

O limite inicial é de oito perguntas por minuto e cem por dia por usuário. Metadados técnicos expiram em 30 dias. Pergunta, resposta e contexto empresarial não são gravados pelo Ghost.

O modelo de resposta configurado é `deepseek/deepseek-v4.1-flash` no OpenRouter. A seleção fica exclusivamente na Edge Function e pode ser trocada pelo segredo de servidor `OPENROUTER_MODEL`; o aplicativo não escolhe nem recebe o identificador do provedor.

## Consultas ao banco KPH

O resumo pré-carregado serve apenas como contexto inicial. Antes de responder uma pergunta sobre as empresas, o DeepSeek chama `consultar_kph`, que aceita dataset, período, casa, busca textual, granularidade e limite. A Edge Function valida o plano e executa `ghost_assistant_query_v1`; períodos financeiros longos usam agregação mensal e não têm o antigo limite de 93 dias.

O catálogo `ghost_assistant_catalog_v1` expõe 11 datasets: financeiro, DRE mensal, linhas da DRE, despesas, pedidos e notas de compra, manutenção, pessoas, ausências, planos de ação e pedidos de venda. A IA pode fazer até quatro rodadas de consulta para cruzar áreas e refinar filtros. Cada resposta do banco é limitada a 200 linhas.

O escopo vem de `auth.uid()` e das capabilities da área; nenhum ID de casa vem do aplicativo ou do modelo. As consultas são somente leitura. Credenciais, hashes, tokens, CPF, documentos, dados bancários, endereços, contatos e anexos médicos não fazem parte do catálogo.

## Dados enviados ao modelo

- nome, marca e grupo de cada casa autorizada;
- faturamento, meta, progresso e atualização do mês corrente por casa;
- contagens de manutenções pendentes/em atenção e data da mais antiga por casa;
- headcount e quantidade de ajustes de ponto pendentes por casa;
- contagens e até dez títulos/tipos/prioridades de pendências por casa.

IDs, versões, direitos de decisão, credenciais e dados pessoais de alto risco são excluídos. O modelo não possui ferramenta de escrita nem credenciais diretas do banco.

## Limites funcionais

As respostas refletem os datasets consultados e podem conter imprecisões de linguagem. O modelo pode comparar casas e consolidar valores aditivos, mas não soma percentuais. A interface orienta a conferir as telas de origem. Áreas ainda ausentes exigem os contratos específicos listados em [backend-contracts.md](backend-contracts.md).
