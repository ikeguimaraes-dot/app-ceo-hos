# Ghost

Aplicativo móvel oficial KPH. Leia `docs/architecture.md`, `docs/backend-readiness.md` e `docs/phase-1b.md` antes de alterar integrações.

## Estado

Fase 1A concluída com mocks. Fase 1B conectada ao projeto Supabase de desenvolvimento `kph-os-dev` por Auth e RPCs Ghost v1. A Fase 2B adiciona o pipeline de push no mesmo ambiente de desenvolvimento. Não há implantação em produção.

## Limites permanentes

- O repositório KPH em `/Users/henriqueguimaraes/kph-financeiro/kph-os-financeiro` é somente leitura e possui mudanças locais de terceiros.
- Nunca usar ou copiar `service_role`, secret key ou segredo no cliente, testes, documentação ou exemplos. O app aceita somente publishable key.
- Telas não importam mocks nem cliente Supabase. Dados entram pelos gateways; negócio remoto entra somente por RPCs `ghost_*` versionadas.
- Não adicionar `.from(...)`, acesso temporário a tabela ou lógica financeira no cliente.
- Capabilities e unidades vêm do bootstrap do servidor. Ocultar tela é UX; toda RPC valida novamente usuário, unidade e capability.
- Cache de negócio permanece em memória e separado por usuário/unidade. Logout limpa queries, contexto e SecureStore mesmo se a revogação remota falhar.
- Push usa tabelas no schema privado; payloads não levam informação financeira/pessoal. Envio e receipts passam somente pelo worker `ghost-push-worker` autenticado por segredo de servidor.
- Aprovações financeiras permanecem fora do cliente até existir contrato transacional, idempotente e auditável.

## Validação

Antes de entregar, execute lint, typecheck, testes, `check:boundaries`, exportações mock/remota, E2E e teste remoto negativo. Valide build em Android/iOS ao mudar módulos nativos. Não apresente teste SQL simulado como login móvel real nem build de simulador como validação de aparelho físico.
