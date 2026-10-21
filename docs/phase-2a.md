# Fase 2A — distribuição controlada

Iniciada em 2026-10-21. Esta fase transforma a fundação validada em artefatos instaláveis de preview, mantendo o backend de desenvolvimento e sem habilitar operações financeiras.

## Configuração criada

- Projeto EAS: `@grupomeeteat/ghost-mobile` (`55db4818-fda5-4b05-ae7b-4114bb1c7e70`).
- Identificador de preview Android/iOS: `com.grupomeeteat.ghost.preview`.
- Identificador reservado para produção: `com.grupomeeteat.ghost`.
- EAS CLI fixado no projeto e versões nativas controladas remotamente.
- Ambiente EAS `preview` contém somente Project URL e publishable key do Supabase de desenvolvimento.
- Perfis `preview` para APK/ iOS ad hoc e `preview-simulator` para validação iOS sem assinatura.
- Ícone próprio quadrado aplicado a iOS, Android adaptativo e web; sem texto ou referência a outra marca.
- OTA permanece desativado.

## Builds

| Plataforma | Build EAS | Estado inicial |
|---|---|---|
| Android interno (APK) | `d171e1fe-f7ac-47cb-96d8-a2f227618a0f` | Enviado; keystore gerado e gerenciado pelo EAS |
| iOS Simulator | `0bdedb7c-4420-41f0-9c26-284db873d475` | Enviado sem credencial Apple |

Os estados finais, links dos artefatos e validações de instalação devem ser acrescentados quando os jobs terminarem.

## Dependências externas abertas

- O portal Apple mostra `ORK IA SOLUCAO TECNOLOGIA LTDA (Pendente)`. Enquanto a inscrição não for aprovada, não é possível criar certificado de distribuição, perfil ad hoc, chave APNs ou enviar ao TestFlight.
- FCM requer um projeto Firebase e uma service account FCM v1 fornecida ao EAS. Nenhum arquivo ou segredo Firebase foi inventado ou colocado no cliente.
- A jornada positiva ainda requer uma conta KPH de desenvolvimento vinculada. Os testes negativos e de autorização do backend continuam válidos.

Quando a Apple liberar a organização, executar `npm run build:preview:ios`, cadastrar os UDIDs necessários e validar em iPhone físico. Quando as credenciais FCM/APNs existirem, configurá-las no EAS e executar os casos de push do [checklist de dispositivos](device-checklist.md).
