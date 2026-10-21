# Fase 2D — decisões transacionais

A Fase 2D adiciona decisões de manutenção e ajuste de ponto sem liberar tabelas ao cliente. O app continua usando somente RPCs versionadas e recebe de `ghost_pending_items_v2` um ID opaco, uma versão e `canDecide` calculado no servidor.

## Contrato

`ghost_decide_pending_v1` recebe unidade, ID opaco, decisão, motivo, versão esperada e chave idempotente. A função:

- revalida autenticação, unidade e capability específica do recurso;
- bloqueia o registro durante a decisão;
- devolve conflito HTTP 409 se a versão mudou, o item já foi decidido ou a chave foi reutilizada com outro payload;
- exige motivo para rejeição;
- atualiza apenas os campos de estado e autoria já existentes;
- grava a resposta e a trilha de auditoria na mesma transação;
- devolve a mesma resposta para uma repetição idêntica.

As capabilities `maintenance.decide` e `punch.decide` são separadas. A primeira usa apenas papéis executivos/operacionais ou permissão explícita de manutenção; a segunda também reconhece a permissão existente `ponto.aprovacao` e `can_approve_punch`. As telas não inferem papéis.

## Auditoria e privacidade

`ghost_private.decision_audit` guarda usuário, unidade, recurso, decisão, motivo, versões, horário e chave idempotente. A tabela tem RLS habilitada e nenhum grant para `anon` ou `authenticated`; apenas a função `SECURITY DEFINER` escreve nela. O cliente não recebe valores financeiros, documentos, dados pessoais do colaborador ou a trilha completa.

## Cliente e falhas

A lista mostra ações somente quando `canDecide` vem verdadeiro do servidor. O usuário prepara a ação, revisa o item e confirma em uma etapa separada. Uma rejeição exige texto. Após sucesso, o cache de pendências, Operação e Pessoas é invalidado. Conflitos pedem atualização da lista e não repetem a ação com uma versão nova automaticamente.

## Validação

Os mocks exercitam sucesso, remoção da lista, repetição idempotente, chave reutilizada, versão desatualizada e capability ausente. A migration deve ser aplicada apenas no projeto `kph-os-dev`; staging e produção continuam bloqueados pelos gates de segurança documentados.
