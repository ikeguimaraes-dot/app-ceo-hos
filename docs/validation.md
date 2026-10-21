# Registro de validação

Sessão concluída em 2026-10-21 no projeto de desenvolvimento `kph-os-dev`.

## Código e bundles

| Verificação | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 17 testes |
| `npm run check:boundaries` após export remoto | PASS |
| `npm run test:remote:negative` | PASS — endpoint público, RPC anônima negada e credencial inválida negada |
| `npm run test:e2e` | PASS — 6 jornadas |
| `npm run export:mock` | PASS — web |
| `npm run export:remote` | PASS — Android, iOS e web |
| `python3 scripts/check_docs.py` | PASS — 16 arquivos, links e ausência de JWT |
| `npx expo install --check` | Dependências compatíveis pelo mapa local do SDK 58; endpoint online indisponível no sandbox |
| `npx expo-doctor` | PASS — 20/20 checks |
| `vercel build --prod` | PASS — exportação web estática em `dist/` |
| Vercel staged deployment | PASS — `/`, `/pending` e bundle JS responderam 200; fallback SPA e cache imutável confirmados |
| EAS Android release local | PASS — 566 tarefas, APK assinado instalado e processo ativo sem Metro |
| EAS Android cloud | PASS — build `b0c4f0b0-be63-4e71-8ba7-60867a03790c` concluído |
| EAS iOS Simulator final | PASS — build `3acc52ba-8c22-43c4-9e5c-fbc94d1ae48f`, instalado e aberto sem Metro |

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
| Grants | 0 grants `anon`; nove RPCs móveis para `authenticated`; cinco RPCs internas somente para `service_role` |
| Pipeline push v1 | três tabelas privadas e trigger presentes; Edge Function implantada; cron ativo com primeira resposta HTTP 200 |
| Worker sem/com segredo | PASS — 401 sem Bearer e 200 com segredo de servidor; fila vazia |

O advisor pós-migration não encontrou alerta de performance nos objetos Ghost. Ele sinaliza as sete RPCs `SECURITY DEFINER` porque são executáveis por `authenticated`; isso é intencional para a fachada móvel e cada função valida `auth.uid()`, status, vínculo, unidade e capability com `search_path` vazio. O passivo geral do projeto permanece: 16 views security-definer, 9 tabelas públicas sem RLS, 107 funções definer executáveis por anônimo, 162 por autenticado e proteção contra senhas vazadas desativada. Veja [prontidão](backend-readiness.md).

## Android e iOS

- iOS: Xcode 26.3, runtime iOS 26.3.1 e iPhone 17 Pro Simulator. O build EAS final concluiu, foi instalado e aberto sem Metro. A primeira execução local revelou um separador inválido em chaves SecureStore; o adapter foi corrigido e reaberto sem erro. Evidências: [ios-phase1b-login.png](screenshots/ios-phase1b-login.png) e [ios-eas-preview-login.png](screenshots/ios-eas-preview-login.png).
- Android: AVD `Ghost_API_36`, compile SDK 37/target 36. O release local concluiu 566 tarefas, foi assinado com a keystore gerenciada, instalado e aberto com o processo ativo. O build cloud `b0c4f0b0-be63-4e71-8ba7-60867a03790c` também concluiu e gerou APK interno. Evidências: [android-phase1b-login.png](screenshots/android-phase1b-login.png) e [android-eas-preview-login.png](screenshots/android-eas-preview-login.png).
- Web: a versão pública em `https://app-ceo-hos.vercel.app` exibe o login remoto com selo `PREVIEW · REMOTO`. A rota protegida `/pending` redireciona para login mantendo o destino. O único warning observado é a limitação esperada do listener de token do Expo Notifications no web.

Simuladores comprovam build, instalação, abertura e SecureStore nativo. Os três redirects nativos e o redirect web de recovery foram salvos no Auth; a lista passou de cinco para nove URLs. Recuperação por e-mail, push APNs/FCM e jornada positiva de um usuário KPH ainda não foram executados porque dependem de um e-mail/conta de desenvolvimento vinculada e das credenciais APNs/FCM.

## Auditoria de dependências

`npm audit --omit=dev` reporta 22 achados transitivos (19 high, 3 moderate, 0 critical), concentrados no toolchain Expo/Metro/React Native. A correção automática sugerida rebaixa para Expo 44/React Native 0.72, incompatível com SDK 58, portanto não foi aplicada. Achados específicos incluem `braces`, `node-forge` e `uuid` em caminhos de build/CLI. O app deve acompanhar releases corrigidas do SDK 58 antes de distribuição; não usar `npm audit fix --force`.

## Limitações verificáveis

- Não houve EAS Update, Submit, publicação em loja ou conexão ao backend de produção. O site Vercel publicado é explicitamente um preview do backend de desenvolvimento.
- O repositório KPH não foi modificado.
- A conta sintética não foi criada; teste SQL com claims em rollback não equivale a login real.
- Nenhuma aprovação ou escrita financeira foi implementada.
