# Fase 2F — prontidão de release

Implementada no repositório em 2026-10-21. Esta fase torna os requisitos de empacotamento verificáveis no CI e registra os gates externos atuais sem criar credenciais, projetos de nuvem ou publicações em loja.

## Gate automatizado

`npm run check:release` resolve a configuração pública do Expo para local, preview e produção e falha quando encontra divergência em:

- schemes, bundle identifiers e packages Android;
- modo mock local e modo remoto de preview/produção;
- OTA, que permanece desativado;
- declaração de criptografia do iOS;
- perfis EAS internos, de simulador e produção;
- diretório e comando de publicação Vercel;
- valores remotos acidentalmente preenchidos em `.env.example`;
- campos Supabase ou administrativos dentro de `extra` público.

O workflow usa permissões somente de leitura, concorrência com cancelamento de execução obsoleta, timeout e actions baseadas em Node 24. O aplicativo continua testado em Node 22.

## Estado das credenciais externas

- Apple Developer: organização aprovada, assinatura store configurada e Ghost preview cadastrado no App Store Connect em 2026-11-01. O perfil `testflight` mantém ambiente preview, incrementa build number e usa o destino Apple fixado no gate. Veja [TestFlight](testflight.md). A chave APNs válida foi associada ao Ghost no EAS em 2026-11-01; entrega física ainda precisa de teste em aparelho.
- Android preview: keystore existente e usada pelo build interno. Nenhuma credencial FCM Legacy/V1 ou conta de submissão Google Play está associada.
- Nenhuma senha Apple, fingerprint de certificado, conteúdo de keystore ou chave de serviço foi copiada para o repositório ou documentação.

O avanço Android depende da criação/aprovação do projeto Firebase/Google Play. A distribuição iOS passa pelo TestFlight; instalação e login KPH em aparelho físico precisam de evidência própria.
