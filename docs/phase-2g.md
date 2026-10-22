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

## Dados enviados ao modelo

- nome, marca e grupo de cada casa autorizada;
- faturamento, meta, progresso e atualização do mês corrente por casa;
- contagens de manutenções pendentes/em atenção e data da mais antiga por casa;
- headcount e quantidade de ajustes de ponto pendentes por casa;
- contagens e até dez títulos/tipos/prioridades de pendências por casa.

IDs, versões, direitos de decisão, detalhes livres de solicitações, nomes de funcionários, folha e credenciais são excluídos. O modelo não possui ferramenta de escrita nem acesso direto ao banco.

## Limites funcionais

As respostas refletem o mês corrente das casas autorizadas e podem conter imprecisões de linguagem. O modelo pode comparar casas e consolidar valores aditivos, mas não soma percentuais. A interface orienta a conferir as telas de origem. Comparações históricas e análises financeiras adicionais exigem os contratos listados em [backend-contracts.md](backend-contracts.md).
