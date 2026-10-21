# Fase 2B — notificações reais

Implementada em 2026-10-21 no projeto Supabase de desenvolvimento. Esta fase cria o pipeline de entrega; nenhuma configuração foi aplicada ao backend de produção.

A Edge Function `ghost-push-worker` está implantada no projeto dev com verificação JWT legada desativada e autenticação própria por segredo constante. O segredo existe somente em Edge Function Secrets e no Vault. O job `ghost-push-worker-every-minute` está ativo no `pg_cron`; sua primeira execução automática retornou HTTP 200 com fila vazia.

## Fluxo

1. Uma inserção no histórico `public.notifications` gera um evento opaco em `ghost_private.push_events`.
2. A chave `notification:<id>` impede o mesmo evento de ser enfileirado duas vezes.
3. O worker cria uma entrega por instalação ativa somente quando usuário, vínculo, capability e preferência continuam válidos.
4. A fila respeita categorias e horário silencioso no timezone validado pelo PostgreSQL.
5. O envio ao Expo usa lotes de até 100; falhas transitórias têm backoff e no máximo cinco tentativas.
6. Tickets são consultados em lotes de até 300. `DeviceNotRegistered` revoga o token; falha temporária do receipt não reenvia a notificação.
7. Eventos antigos e instalações revogadas têm retenção limitada.

O payload contém apenas versão, IDs opacos, categoria e destino permitido. Título e corpo são genéricos; nenhum nome, e-mail, valor financeiro ou detalhe operacional sai na notificação.

## Contratos entregues

- `ghost_notification_preferences_v1()` e `ghost_notification_preferences_update_v1(...)` para o usuário autenticado, com capability e versão esperada.
- `ghost_internal_push_claim_v1(...)`, `ghost_internal_push_apply_v1(...)`, `ghost_internal_push_receipts_claim_v1(...)`, `ghost_internal_push_receipts_apply_v1(...)` e `ghost_internal_push_cleanup_v1()` somente para `service_role`.
- `NotificationGateway.getPreferences` e `updatePreferences`, implementados por adapters mock e remoto.
- `ghost-push-worker`, Edge Function sem sessão de usuário, protegida por `GHOST_PUSH_WORKER_SECRET` e com chave administrativa fornecida somente pelo runtime Supabase.

## Segurança e operação

- As três tabelas do pipeline ficam no schema `ghost_private` e sem grants para `anon` ou `authenticated`.
- As telas continuam RPC-only e não conhecem fila, token, ticket ou chave administrativa.
- O worker não registra token ou payload e retorna somente contagens/códigos estáveis.
- Um lease expirado recoloca uma entrega abandonada na fila; um receipt temporariamente indisponível é consultado novamente sem duplicar o push.
- A migration auditável é `supabase/migrations/20261021193409_ghost_push_pipeline_v1.sql`.
- O agendamento reproduzível, sem o valor do segredo, está em `supabase/schedules/ghost-push-worker.sql`.

## Validação disponível e dependências externas

Os testes unitários cobrem lotes, payload genérico, tickets, receipts, comparação do segredo e deep link permitido. Lint, TypeScript e a barreira de acesso direto passam. Em dev, três RPCs recusaram acesso anônimo; o endpoint do worker retornou 401 sem segredo e 200 com o segredo armazenado.

A entrega física permanece dependente de credenciais FCM v1 para Android e de APNs após a aprovação da organização Apple. Uma conta KPH de desenvolvimento vinculada ainda é necessária para o teste ponta a ponta positivo. Até essas dependências existirem, a fila e o worker podem ser validados sem enviar dados reais a aparelhos.
