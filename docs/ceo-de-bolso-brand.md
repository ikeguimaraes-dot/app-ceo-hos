# CEO de bolso

Nome público atualizado para **CEO de bolso**, sem sufixo de ambiente no nome
instalado. O ícone do fantasma existente foi preservado; é a versão de maior
resolução do ícone enviado pelo usuário. O logo recebido foi copiado sem alteração
para `assets/ceo-de-bolso-logo.png` e aparece no login, na Home e nos cabeçalhos.

Os textos visíveis do aplicativo, assistente, lembrete diário e desbloqueio
biométrico usam o novo nome. IDs de pacote, schemes, slug EAS, armazenamento e RPCs
mantêm a identidade técnica existente para preservar a atualização do mesmo app.

App Store Connect: nome principal confirmado como CEO de bolso no mesmo app
`6829441595`. Link TestFlight preservado: https://testflight.apple.com/join/41JRK7ea.
A mudança do nome instalado exige atualizar o binário pelo TestFlight.

Validação: lint, typecheck, 221 testes unitários, limites de acesso e gate de
release; teste remoto negativo de 35 RPCs. Captura do login inspecionada com o
logo real recebido. Sem alterações em módulos nativos ou integrações financeiras.
Dez E2E e exportações remotas Android/iOS/web e mock web passaram.
Não houve instalação ou jornada em aparelho físico desta atualização.

## Distribuição

- Commit de implementação `3f224f3`, enviado ao GitHub.
- Web publicada e promovida em https://app-ceo-hos.vercel.app, deployment
  `dpl_2Hfp3jJLGZiE2cjkhGciv3pz3FjJ`. Chrome confirmou título, logo visível,
  login e bundle novo no domínio canônico; zero erros de página.
- iOS `0.1.0 (9)`: build `8ed5de2b-b971-4cb1-9191-da423ac1ff81` concluído;
  Apple confirmou processamento `VALID`.
- Submissão EAS `8251ac0b-e345-4300-9a2b-0b317310cae2`: `FINISHED`.
- Em 04/11/2026 foi concluída a associação ao grupo público existente e o envio
  à revisão beta externa. A versão 9 está `WAITING_FOR_REVIEW`; ainda não está
  confirmada disponível para instalação externa.
- A atribuição ao grupo e a revisão externa haviam ficado pendentes após o envio
  automático do pacote na entrega de 03/11; essa pendência foi resolvida em 04/11.
