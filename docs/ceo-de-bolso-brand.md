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
