# Registro de validação

Sessão concluída em 2026-10-21 no projeto de desenvolvimento `kph-os-dev`.

## Código e bundles

| Verificação                                   | Resultado                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run lint`                                | PASS                                                                                          |
| `npm run typecheck`                           | PASS                                                                                          |
| `npm test`                                    | PASS — 31 testes                                                                              |
| `npm run check:boundaries` após export remoto | PASS                                                                                          |
| `npm run test:remote:negative`                | PASS — 18 RPCs anônimas e credencial inválida negadas                                         |
| `npm run test:e2e`                            | PASS — 6 jornadas                                                                             |
| `npm run export:mock`                         | PASS — web                                                                                    |
| `npm run export:remote`                       | PASS — Android, iOS e web                                                                     |
| `python3 scripts/check_docs.py`               | PASS — 16 arquivos, links e ausência de JWT                                                   |
| `npx expo install --check`                    | Dependências compatíveis pelo mapa local do SDK 58; endpoint online indisponível no sandbox   |
| `npx expo-doctor`                             | PASS — 20/20 checks                                                                           |
| `vercel build --prod`                         | PASS — exportação web estática em `dist/`                                                     |
| Vercel staged deployment                      | PASS — `/`, `/pending` e bundle JS responderam 200; fallback SPA e cache imutável confirmados |
| EAS Android release local                     | PASS — 566 tarefas, APK assinado instalado e processo ativo sem Metro                         |
| EAS Android cloud                             | PASS — build `b0c4f0b0-be63-4e71-8ba7-60867a03790c` concluído                                 |
| EAS iOS Simulator final                       | PASS — build `3acc52ba-8c22-43c4-9e5c-fbc94d1ae48f`, instalado e aberto sem Metro             |

Os testes cobrem navegação protegida, sem vínculo, inativo, troca de unidade, capability ausente, sessão expirada, deep link, recovery simulado e limpeza no logout. As seis jornadas E2E mantêm os dados mock no processo local e validam estados vazio/erro/offline/retry e tema.

## Backend

| Caso                             | Resultado                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Migration Ghost API v1           | aplicada em desenvolvimento                                                                                                  |
| Migration de token push revogado | aplicada; índice parcial presente e constraint antiga ausente                                                                |
| Registro push sem vínculo        | negado; usuário vinculado aceito em rollback                                                                                 |
| Bootstrap vinculado              | ativo, quatro unidades e capabilities                                                                                        |
| Unidade fora do vínculo          | negada com 42501                                                                                                             |
| Inativo / sem vínculo            | zero unidades                                                                                                                |
| RPC anônima                      | negada                                                                                                                       |
| Grants                           | 0 funções Ghost para `anon`; 18 RPCs móveis para `authenticated`; seis RPCs internas somente para `service_role`             |
| Pipeline push v1                 | três tabelas privadas e trigger presentes; Edge Function implantada; cron ativo com primeira resposta HTTP 200               |
| Worker sem/com segredo           | PASS — 401 sem Bearer e 200 com segredo de servidor; fila vazia                                                              |
| Confiabilidade push 2E           | reconciliação autenticada; instalação ativa única; `last_seen_at`; expiração em 45 dias                                      |
| Observabilidade 2E               | tabela privada com RLS e zero grants de cliente; execução agendada `success`/`ok`, request ID e 168 ms                       |
| Assistente 2G                    | capability em 27 papéis; catálogo e consulta ampla somente para autenticado; tabela privada com RLS e zero grants de cliente |
| Consulta KPH                     | 11 datasets; financeiro diário validado em quatro casas para 21/10/2026; nomes/valores vieram das fontes KPH reais           |
| Grants do agente                 | `ghost_assistant_catalog_v1` e `ghost_assistant_query_v1`: `anon=false`, `authenticated=true`                                |
| Consolidação por turno           | Meet & Eat em 21/10/2026: dois turnos; almoço fechado e jantar parcial; total disponível marcado como provisório             |
| Linguagem de conciliação         | resposta confirma todos os turnos incluídos e distingue vendas importadas de pagamentos ainda sem conciliação                |
| Cockpit executivo                | quatro cards mensais, seletor de casa, progresso de meta e gráfico diário animado                                             |
| Dashboard remoto v2              | RPC executada em escopo autorizado e bloqueada para chamada anônima                                                           |
| Contas a pagar                   | fonte Everest consolidada; resumo e títulos por unidade validados; RPC bloqueada para chamada anônima                         |
| Fluxo de caixa semanal           | receita bruta D+1, títulos abertos, ajuste de fim de semana e acumulado diário validados; RPC anônima negada                  |
| Edge Function `ghost-assistant`  | versão 9 ativa com JWT obrigatório; chamada anônima recusada com HTTP 401                                                    |

O Performance Advisor pós-migration permaneceu sem erros. Os 25 erros do Security Advisor pertencem ao passivo geral já registrado: 16 views security-definer e 9 tabelas expostas sem RLS. A superfície Ghost adicionada na Fase 2E usa `search_path` vazio, RLS, grants explícitos e schema privado. O passivo geral também inclui funções definer legadas executáveis por clientes e proteção contra senhas vazadas desativada. Veja [prontidão](backend-readiness.md).

## Android e iOS

- iOS: Xcode 26.3, runtime iOS 26.3.1 e iPhone 17 Pro Simulator. O build EAS final concluiu, foi instalado e aberto sem Metro. A primeira execução local revelou um separador inválido em chaves SecureStore; o adapter foi corrigido e reaberto sem erro. Evidências: [ios-phase1b-login.png](screenshots/ios-phase1b-login.png) e [ios-eas-preview-login.png](screenshots/ios-eas-preview-login.png).
- iPhone físico: o preview Release com a aba IA no rodapé e consulta global do portfólio foi assinado pela Personal Team, reinstalado e aberto sem Metro em 2026-10-22. O teste positivo da resposta do OpenRouter depende da sessão do usuário no aparelho; a fronteira anônima foi validada remotamente.
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
