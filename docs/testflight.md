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

## Push, acesso salvo e compartilhamento externo — 2026-11-01

A chave APNs válida existente foi associada ao Ghost no EAS. A fila privada de
desenvolvimento e o agendamento a cada minuto estavam ativos; as três respostas
HTTP mais recentes foram 200. Havia zero instalações ativas, portanto essa
verificação não comprova recebimento físico de push. No iPhone, entrar, permitir
notificações e registrar a instalação antes do teste ponta a ponta.

O login nativo oferece “Salvar login e senha neste aparelho”, desativado por
padrão. Só salva após autenticação e bootstrap ativo. Usa SecureStore com acesso
somente no aparelho desbloqueado, sem backup/migração e sem fallback inseguro.
Desmarcar ou sair apaga o acesso salvo. Campos suportam preenchimento pelo
gerenciador de senhas; a web não persiste senhas pelo app. Escritas interrompidas
removem fragmentos antes de devolver erro.

209 testes, lint, typecheck, check:boundaries, check:release, exportações e oito
E2E passaram; teste remoto negativo confirmou 32 RPCs anônimas bloqueadas.

Grupo externo criado: `Ghost — Teste externo`, limite de 100 testadores.
Link público habilitado: https://testflight.apple.com/join/41JRK7ea

O build final `0.1.0 (6)` foi compilado para aparelho e enviado à Apple:

- [Build EAS](https://expo.dev/accounts/grupomeeteat/projects/ghost-mobile/builds/994994f2-19ad-4f54-98bc-92db64267a7e).
- [Submissão EAS](https://expo.dev/accounts/grupomeeteat/projects/ghost-mobile/submissions/ccc7e540-a93c-4a61-957b-84194669e5db).
- App Store Connect: `processingState=VALID`, `internalState=IN_BETA_TESTING`.
- Build 6 associado ao grupo externo; link público habilitado para 100 testadores.
- Contato de revisão e descrições beta em pt-BR/en-US salvos na Apple.
- A conta de demonstração fornecida pelo usuário autenticou via HTTP no backend
  dev com publishable key; bootstrap retornou `active` e quatro unidades. Isso
  comprova Auth/RPC reais, não uma jornada positiva na UI móvel.
- Credenciais de revisão fornecidas pelo usuário foram transmitidas somente ao
  Auth KPH e App Store Connect, em memória e sem eco. Não estão no repositório,
  documentação, exemplos, logs ou artefatos do app.
- Revisão beta `79389727-f798-461c-9974-511596ab3240` enviada com status
  `WAITING_FOR_REVIEW`. A liberação de instalações pelo link depende da Apple.
- Ainda não houve instalação física nem recebimento real de push desta versão.
