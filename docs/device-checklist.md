# Checklist Android e iOS

## Executado nesta máquina

- [x] Xcode 26.3, CocoaPods e runtime iOS 26.3.1 instalados.
- [x] iPhone 17 Pro Simulator iniciado.
- [x] Build iOS remoto concluído, instalado e aberto.
- [x] SecureStore nativo inicializado sem erro após correção das chaves.
- [x] Android SDK/AVD `Ghost_API_36` disponível.
- [x] Build Android remoto concluído, APK instalado e app aberto.
- [x] Schemes e identificadores locais gerados pelos dois projetos.
- [x] Capturas do login remoto em [screenshots](screenshots).

## Repetir antes de distribuição interna

- [ ] Login válido com conta KPH de desenvolvimento já vinculada.
- [ ] Login inválido, refresh, reinício e expiração sem token em logs.
- [ ] Usuário sem vínculo, inativo e papel removido durante uso.
- [ ] Troca A → B com request em voo; resposta A nunca aparece em B.
- [ ] Deep links `/pending` e `/notifications` a frio/quente e após logout.
- [ ] Recovery PKCE por e-mail, link expirado/replay e nova senha.
- [ ] Biometria: sucesso, cancelamento, sem cadastro e mudança de cadastro.
- [ ] Push: negado/permitido, token rotacionado, dois usuários no aparelho e logout offline.
- [ ] Push foreground/background/encerrado com payload sem dado sensível.
- [ ] Offline/reconexão/retry sem escrita financeira enfileirada.
- [ ] Tema, fonte ampliada, teclado, VoiceOver/TalkBack e touch targets.
- [ ] Android e iPhone físicos; simulador não valida APNs/FCM nem biometria real.
- [x] Projeto EAS vinculado, ambiente preview isolado e keystore Android gerada.
- [x] Preview Android gerado pelo EAS local e cloud, assinado, instalado e aberto.
- [x] Preview iOS do EAS instalado e aberto no simulador, sem Metro/localhost.
- [x] Preview remoto em Release assinado pela Personal Team, instalado e aberto no iPhone físico em 2026-10-22, sem Metro/localhost e conectado ao `kph-os-dev` somente pelas RPCs Ghost.
- [ ] Preview iOS da organização com APNs; a Personal Team usada na validação física não aceita a capability de Push Notifications.
- [ ] FCM V1 Android; a inspeção EAS de 2026-10-21 confirmou que nenhuma conta de serviço está associada.
- [ ] APNs e App Store Connect; o perfil iOS ainda não possui credenciais enquanto a inscrição está pendente.
- [x] Inspeção dos bundles por JWT, secret key e `service_role`; `check:release` valida também ambientes, IDs e OTA.

## Comandos

```sh
npm ci
npx expo prebuild
npx expo run:android --no-bundler
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer npx expo run:ios --no-bundler
```

Em modo remoto, configure apenas Project URL e publishable key em `.env.local`. Nunca copie credencial administrativa. O Metro deve estar ativo na porta exibida pelo Expo. Para builds preview/production, configure variáveis no EAS e mantenha OTA desativado até existir política de rollout.

Builds controlados usam `npm run build:preview:android`, `npm run build:preview:ios-simulator` e, após a aprovação da Apple Developer, `npm run build:preview:ios`. O APK e o build de simulador não dependem de Metro nem de servidor localhost.
