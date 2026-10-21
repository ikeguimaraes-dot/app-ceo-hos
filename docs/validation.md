# Registro de validação

Sessão concluída em 2026-10-21 no projeto de desenvolvimento `kph-os-dev`.

## Código e bundles

| Verificação | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 12 testes |
| `npm run check:boundaries` após export remoto | PASS |
| `npm run test:remote:negative` | PASS — endpoint público, RPC anônima negada e credencial inválida negada |
| `npm run test:e2e` | PASS — 6 jornadas |
| `npm run export:mock` | PASS — web |
| `npm run export:remote` | PASS — Android, iOS e web |
| `python3 scripts/check_docs.py` | PASS — 14 arquivos, links e ausência de JWT |
| `npx expo install --check` | Dependências compatíveis pelo mapa local do SDK 58; endpoint online indisponível no sandbox |

Os testes cobrem navegação protegida, sem vínculo, inativo, troca de unidade, capability ausente, sessão expirada, deep link, recovery simulado e limpeza no logout. As seis jornadas E2E mantêm os dados mock no processo local e validam estados vazio/erro/offline/retry e tema.

## Backend

| Caso | Resultado |
|---|---|
| Migration Ghost API v1 | aplicada em desenvolvimento |
| Migration de token push revogado | aplicada; índice parcial presente e constraint antiga ausente |
| Registro push sem vínculo | negado; usuário vinculado aceito em rollback |
| Bootstrap vinculado | ativo, quatro unidades e capabilities |
| Unidade fora do vínculo | negada com 42501 |
| Inativo / sem vínculo | zero unidades |
| RPC anônima | negada |
| Grants | 0 grants `anon`; sete para `authenticated` |

O advisor pós-migration não encontrou alerta de performance nos objetos Ghost. Ele sinaliza as sete RPCs `SECURITY DEFINER` porque são executáveis por `authenticated`; isso é intencional para a fachada móvel e cada função valida `auth.uid()`, status, vínculo, unidade e capability com `search_path` vazio. O passivo geral do projeto permanece: 16 views security-definer, 9 tabelas públicas sem RLS, 107 funções definer executáveis por anônimo, 162 por autenticado e proteção contra senhas vazadas desativada. Veja [prontidão](backend-readiness.md).

## Android e iOS

- iOS: Xcode 26.3, runtime iOS 26.3.1 e iPhone 17 Pro Simulator. Build concluído com zero erros, app instalado e aberto. A primeira execução revelou um separador inválido em chaves SecureStore; o adapter foi corrigido e reaberto sem erro. Evidência: [ios-phase1b-login.png](screenshots/ios-phase1b-login.png).
- Android: AVD `Ghost_API_36`, compile SDK 37/target 36. Gradle concluiu 326 tarefas, instalou o APK e abriu o scheme `ghost-local`. Evidência: [android-phase1b-login.png](screenshots/android-phase1b-login.png).
- Web: Metro responde em `127.0.0.1:8081`; Chrome exibiu o login remoto. O único warning observado é a limitação esperada do listener de token do Expo Notifications no web.

Simuladores comprovam build, instalação, abertura e SecureStore nativo. Os três redirects de recovery foram salvos no Auth e a lista passou de cinco para oito URLs. Recuperação por e-mail, push APNs/FCM e jornada positiva de um usuário KPH ainda não foram executados porque dependem de um e-mail/conta de desenvolvimento vinculada e, para push, de projeto EAS.

## Auditoria de dependências

`npm audit --omit=dev` reporta 27 achados transitivos (19 high, 8 moderate, 0 critical), concentrados no toolchain Expo/Metro/React Native. A correção automática sugerida rebaixa para Expo 44/React Native 0.72, incompatível com SDK 58, portanto não foi aplicada. Achados específicos incluem `braces`, `node-forge` e `uuid` em caminhos de build/CLI. O app deve acompanhar releases corrigidas do SDK 58 antes de distribuição; não usar `npm audit fix --force`.

## Limitações verificáveis

- Não houve publicação, EAS Update, Submit ou produção.
- O repositório KPH não foi modificado.
- A conta sintética não foi criada; teste SQL com claims em rollback não equivale a login real.
- Nenhuma aprovação ou escrita financeira foi implementada.
