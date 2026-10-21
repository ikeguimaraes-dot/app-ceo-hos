# Entrega da Fase 1A — Ghost local

Implementação autorizada após a descoberta, em 2026-10-20. O gate crítico continua para a Fase 1B. Não houve acesso ao Supabase, uso de credencial real, migration, alteração do KPH, publicação de build ou EAS Update.

## Implementado

Expo SDK 58.0.16, React Native 0.88.0, React 19.3.0, Expo Router 58.0.24 e TypeScript estrito. Versões instaladas fixadas no package.json e package-lock.json; validação de compatibilidade feita contra o mapa local do SDK. TanStack Query 5 em memória, sem persistência de dados de negócio.

Cinco abas com visibilidade baseada em capabilities do bootstrap; guard de navegação autenticada; splash; login/recuperação simulados; sem vínculo/inativo/expirado; escolha/troca de unidade; perfil/preferências; biometria opcional nativa com indisponibilidade tratada; tema claro/escuro/sistema; catálogo interno em desenvolvimento; estados loading/vazio/erro/offline/retry; central de notificações com registro/abertura simulados; links autenticados com destinos permitidos.

Interfaces AuthGateway, BootstrapGateway, DashboardGateway, PendingItemsGateway e NotificationGateway são independentes das telas. O composition root instancia adapters mockados; fixtures centralizadas em `src/data/fixtures.ts`. Campos de cenário e simulation são exclusivos da demonstração. Nenhuma tela importa fixtures ou adapters mockados diretamente, regra também imposta pelo ESLint.

O bootstrap distribui capacidades diferentes para Jardim/Costa e para o usuário restrito. Nenhuma tela deriva permissão de nome do usuário ou role hardcoded. O adapter também nega acesso fora de escopo, mas essa verificação mock não é prova de segurança do backend real.

SecureStore está encapsulado e recebe somente um marcador fixo `demonstration-only`. Login permanece em memória, não contém JWT; reiniciar exige novo login. Logout apaga marcador e cache, cancela consultas, limpa contexto e vínculo simulado. Erros de limpeza são reportados sem restaurar sessão. Troca de unidade invalida geração e cancela requests; respostas antigas não repovoam o cache.

Ambientes local/preview/production com IDs de demonstração e schemes distintos. Todos são mock-only; configuração rejeita modo de dados diferente de mock. EAS está apenas descrito/configurado, sem projeto remoto ou assinatura. OTA desativado.

## Verificações

- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm test`: 11 testes aprovados (gate, contexto, capacidades, usuário inativo/sem vínculo, resposta atrasada, expiração, logout e mocks determinísticos).
- `npx expo install --check`: dependências compatíveis com mapa local do SDK. Modo offline; não certifica o catálogo remoto.
- `CI=1 EXPO_NO_TELEMETRY=1 npx expo export --platform all`: bundles Android/Hermes, iOS/Hermes e web gerados localmente. Não é build assinado nem publicação.
- Playwright/Chrome: jornadas reais de UI com viewport 390×844, incluindo captura de screenshots. A jornada principal monitora requisições e exige zero URLs externas.
- Verificação documental e ausência de chaves/URLs reais nos fontes e artefatos: executada no fechamento da sessão.

Screenshots em `docs/screenshots`: login, unidades, início, pendências, notificações e preferências escuras da versão web local, além de `ios-dashboard.png`, capturada pelo iPhone 17 Pro Simulator.

## Limitações verificadas

Este Mac tem Xcode 26.3 instalado em `/Applications`, licença aceita, componentes iniciais concluídos, CocoaPods 1.17 e runtime iOS 26.3.1. O AVD `Ghost_API_36` foi criado e iniciou com Android 36; o APK Android compilou, foi instalado e iniciou com runtime JavaScript ativo (Fabric), sem erros nos logs consultados. No iPhone 17 Pro Simulator, o build iOS terminou com zero erros, instalou e abriu o Ghost; login, seleção da unidade Jardim, dashboard e ativação/bloqueio/desbloqueio com Face ID simulado foram conferidos interativamente. SecureStore nativo, deep link nativo, Android BiometricPrompt e aparelhos físicos ainda não foram comprovados. A checklist é `device-checklist.md`. A versão web informa biometria indisponível; não finge sucesso.

`npm audit` reportou 27 ocorrências transitivas (8 moderate, 19 high), propagadas principalmente por `braces`/Metro, `node-forge`/Expo CLI e `uuid`/xcode. As versões instaladas são braces 3.0.3, node-forge 1.4.0 e uuid 7.0.3. O npm sugere inclusive downgrade para Expo 44/React Native 0.72; não foi aplicado por quebrar a matriz SDK 58. Isso não foi marcado como corrigido. Revisar atualizações compatíveis do toolchain antes de builds distribuídos e manter Metro local. Advisories reportados: GHSA-vfj7-8cjw-p6xm, GHSA-86w9-cpqp-85rv, GHSA-w5hq-g745-h8pq.

A demonstração não implementa operações financeiras, push real, recuperação com e-mail, sessão real renovável ou backend. Não há dados de produção nem placeholders passando por reais.

## Referências técnicas consultadas

- [Instalação Expo Router](https://docs.expo.dev/router/installation/)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/)

A lista exata de contratos necessários para substituir os adapters está em [backend-contracts.md](backend-contracts.md). Segurança e autorização para conexão continuam em [backend-readiness.md](backend-readiness.md).

## Fechamento verificado

Exportação atualizada e suíte final: **11 testes de domínio + 6 jornadas E2E aprovados**. A sexta jornada verifica que login por deep link não contorna capability ausente. Lint, TypeScript, formatação, consistência package/lockfile, 14 entregáveis documentais e `npm run check:boundaries` aprovados. O verificador de fronteiras examina também os bundles exportados. Validação nativa adicional: builds Android e iOS debug bem-sucedidos; APK instalado no AVD com runtime JavaScript iniciado; app iOS instalado e aberto no iPhone 17 Pro Simulator, com login, unidade e dashboard validados visualmente.

## Compilação Android local

`EXPO_NO_TELEMETRY=1 npx expo run:android --no-bundler`: **BUILD SUCCESSFUL**, 326 tarefas, aproximadamente 14 minutos na primeira compilação. APK em `android/app/build/outputs/apk/debug/app-debug.apk` (artefato local ignorado pelo Git). Instalado no AVD `Ghost_API_36`; custom scheme de inicialização aberto pela CLI, Metro entregou bundle Android e log `ReactNativeJS` confirmou `Running "main"` com Fabric. Nenhum erro `AndroidRuntime`/`ReactNativeJS` na consulta após inicialização. A interface do emulador não ficou acessível pela ferramenta de controle de UI; não se afirma validação interativa das jornadas nativas.

## Compilação iOS local

Xcode 26.3 (build 17C529), CocoaPods 1.17 e runtime iOS 26.3.1 (23D8133) foram instalados. `EXPO_NO_TELEMETRY=1 npx expo run:ios --no-bundler --device 443CA7A8-C88D-4DBA-B9F8-1B7DEC3BA176`: **Build Succeeded**, zero erros e quatro avisos do toolchain/dependências. O app foi instalado e aberto no iPhone 17 Pro Simulator com bundle ID de demonstração `app.ghost.demo.local`. Login mockado, seleção de Jardim, dashboard e ativação/bloqueio/desbloqueio com Face ID simulado foram usados pela interface; o processo permaneceu ativo e o filtro de logs não encontrou erros/faults do Ghost. Evidência em `screenshots/ios-dashboard.png`.
