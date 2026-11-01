# Distribuição TestFlight

O Ghost preview usa o perfil `testflight` do EAS: herda o ambiente `preview`,
assina para `store`, compila para aparelho físico e incrementa o build number.
O backend permanece em homologação (`kph-os-dev`); OTA continua desativado.

- Expo: `@grupomeeteat/ghost-mobile`.
- Apple: ORK IA SOLUCAO TECNOLOGIA LTDA, team `ZR3LMRS4N5`.
- Bundle: `com.grupomeeteat.ghost.preview`.
- App Store Connect: [Ghost preview](https://appstoreconnect.apple.com/apps/6829441595/testflight/ios).
- Grupo interno: `Team (Expo)`.
- Certificado de distribuição existente reutilizado; provisioning profile store criado.
- Credencial de submissão existente reutilizada pelo EAS; nenhuma chave privada no repositório.

## Gerar e enviar

```sh
npx --yes eas-cli@25.3.0 build --platform ios --profile testflight --auto-submit-with-profile testflight
```

Para reenviar um build específico, usar seu ID (não selecionar um build de simulador):

```sh
npx --yes eas-cli@25.3.0 submit --platform ios --profile testflight --id BUILD_ID
```

Para consultar a disponibilidade real na Apple, resolver explicitamente o ambiente:

```sh
EXPO_PUBLIC_APP_ENV=preview EXPO_PUBLIC_DATA_MODE=remote npx --yes eas-cli@25.3.0 submit:status --platform ios --profile testflight
```

O envio é para TestFlight. Uma publicação pública na App Store é uma etapa separada.
A chave APNs existente e válida da organização foi associada ao Ghost preview no
EAS em 2026-11-01, com autorização do usuário. Worker dev ativo e HTTP 200 nas
execuções observadas. Nenhuma instalação estava registrada nessa verificação;
a entrega física de push ainda requer login e permissão em um aparelho.

## Primeira distribuição — 2026-11-01

Versão `0.1.0`, build `3`.

- [Build EAS](https://expo.dev/accounts/grupomeeteat/projects/ghost-mobile/builds/60e2df20-bfb7-4eba-b194-828dc4905639).
- [Submissão](https://expo.dev/accounts/grupomeeteat/projects/ghost-mobile/submissions/591a6549-84e4-49b7-894d-b3b617daed3c).
- Validação local: lint, typecheck, 202 testes, check:boundaries, check:release,
  exportações remota Android/iOS/web e mock web, oito E2E e teste remoto negativo
  (32 RPCs anônimas e credenciais/tokens inválidos negados) passaram.
- Build EAS concluído com assinatura store em 2026-11-01 às 10:15 (São Paulo).
- Submissão EAS concluída às 10:15. App Store Connect confirmou `processingState=VALID`
  e `internalState=IN_BETA_TESTING`; build disponível para o grupo interno.
- Teste externo permanece `READY_FOR_BETA_SUBMISSION`; não houve envio para revisão beta externa
  nem publicação pública na App Store.
- Não foi executado login KPH positivo nem instalação física desta distribuição.
