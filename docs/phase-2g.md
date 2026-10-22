# Fase 2G — assistente executivo

O Ghost oferece um chat somente leitura para perguntas sobre a unidade selecionada. A tela depende de `AssistantGateway`; o adapter remoto chama apenas a Edge Function `ghost-assistant`, e o mock continua determinístico e isolado.

## Fluxo e autorização

1. O usuário precisa de sessão válida, vínculo ativo, unidade selecionada e capability `assistant.ask`.
2. A Edge Function valida o JWT e autoriza a requisição em `ghost_assistant_begin_v1`.
3. Cada fonte é consultada por uma RPC existente, que repete a checagem de capability no banco.
4. O contexto é reduzido antes do envio externo e o OpenRouter recebe instruções de zero retenção e bloqueio de coleta.
5. `ghost_assistant_finish_v1` registra somente resultado, código, modelo e contagem de tokens.

O limite inicial é de oito perguntas por minuto e cem por dia por usuário. Metadados técnicos expiram em 30 dias. Pergunta, resposta e contexto empresarial não são gravados pelo Ghost.

## Dados enviados ao modelo

- nome, marca e grupo da unidade atual;
- faturamento, meta, progresso e atualização do mês corrente;
- contagens de manutenções pendentes/em atenção e data da mais antiga;
- headcount e quantidade de ajustes de ponto pendentes;
- contagens e até dez títulos/tipos/prioridades de pendências.

IDs, versões, direitos de decisão, detalhes livres de solicitações, nomes de funcionários, folha e credenciais são excluídos. O modelo não possui ferramenta de escrita nem acesso direto ao banco.

## Limites funcionais

As respostas refletem um recorte da unidade atual e podem conter imprecisões de linguagem. A interface orienta a conferir as telas de origem. Comparações históricas, visão consolidada entre empresas e análises financeiras adicionais exigem os contratos listados em [backend-contracts.md](backend-contracts.md).
