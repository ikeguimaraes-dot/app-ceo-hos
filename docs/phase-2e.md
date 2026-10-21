# Fase 2E — confiabilidade e observabilidade

Preparada em 2026-10-21 para o projeto Supabase de desenvolvimento. A fase fecha os dois contratos técnicos restantes da fundação móvel sem tocar no backend de produção ou no repositório KPH.

## Reconciliação de instalações

- O identificador aleatório da instalação permanece no SecureStore quando o usuário encerra a sessão. Credenciais e cache continuam sendo removidos.
- `ghost_reconcile_installation_v1` valida sessão, usuário ativo e `notifications.read`, serializa a operação e transfere de forma atômica a posse ativa da instalação ou do Expo token no mesmo ambiente.
- `ghost_register_installation_v1` continua disponível como wrapper compatível para builds anteriores.
- O app reconcilia silenciosamente após login ou restauração quando a permissão do sistema já existe. Não abre o prompt automaticamente e limita a renovação em primeiro plano a uma vez a cada 12 horas por execução.
- `last_seen_at` registra apenas contato técnico. Vínculos ativos sem contato por 45 dias são revogados; registros já revogados são removidos após 90 dias.
- A unicidade parcial por ambiente e instalação impede dois usuários ativos no mesmo aparelho. A unicidade existente por ambiente e token continua protegendo rotação e reuso.

Um logout offline ainda não consegue chamar o backend naquele instante. A limpeza local permanece imediata; o vínculo anterior é encerrado na próxima reconciliação autenticada do aparelho ou pela expiração de 45 dias.

## Observabilidade sem PII

- Cada execução autenticada do worker recebe um UUID, aceita `x-request-id` somente quando válido e devolve o identificador no header e no JSON.
- O worker emite somente `requestId`, operação allowlisted, resultado, código estável e duração. Contadores de lote não identificáveis também são mantidos.
- JWT, e-mail, usuário, token Expo, título, corpo, valores, documentos e payloads não entram no log operacional.
- `ghost_private.operation_logs` tem RLS, nenhum grant para clientes e retenção de 30 dias. Somente `service_role` executa `ghost_internal_operation_log_v1`.
- Falha na telemetria não altera o resultado do worker; um evento técnico mínimo é escrito no log do runtime.

## Evidência local

- Auditoria agregada anterior à migration: zero instalações ativas, revogadas, antigas ou duplicadas no ambiente dev; nenhum identificador foi consultado.
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run check:boundaries` passam.
- A migration auditável é `supabase/migrations/20261021204715_ghost_reliability_observability_v1.sql`.

Os testes e a aplicação remota são registrados em `docs/validation.md` depois da implantação no projeto dev.
