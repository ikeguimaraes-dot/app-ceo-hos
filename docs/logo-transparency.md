# Transparência do logo

O logo do cabeçalho tinha fundo branco na imagem original e também no estilo do
componente `BrandLogo`. A nova imagem RGBA tem fundo alfa transparente, incluindo
os espaços internos das letras. O componente usa `contain`, sem caixa branca nem
recorte, e aplica uma cor clara no tema escuro para preservar o contraste.

- Fonte preservada: `assets/ceo-de-bolso-logo.png`.
- Arquivo aplicado no app: `assets/ceo-de-bolso-logo-transparent.png`.
- Edição feita pela ferramenta integrada `image_gen`, com
  `transparent_background=true`; o arquivo final foi copiado para o projeto.
- Alfa validado por leitura do PNG (RGBA, alfa mínimo zero; cantos transparentes).
- Capturas de login e preferências escuras inspecionadas: sem fundo retangular e
  com texto legível. O ícone instalado do aplicativo não foi alterado.

## Prompt final da edição

> Use case: background-extraction. Edit target: the attached existing CEO de bolso logo. Remove only the white and near-white background, including white enclosed counters inside letters and the very faint gray background shadows, creating a clean genuine alpha-transparent PNG. Preserve the exact original logo identity, letter shapes, thick typography, proportions, kerning and stacked arrangement: dark forest green 'CEO' above black 'de bolso'. Text verbatim: 'CEO' and 'de bolso'. Do not redesign or redraw the typography; preserve all letters exactly. Keep the original green and black ink colors. No white rectangle, no baked checkerboard, no added outlines, no drop shadow, no glow, no new elements. Fit the complete mark closely within a landscape canvas with a small transparent margin, never clipping any letters. This asset is for an app header.

## Validação

Lint, TypeScript, 221 testes unitários, boundaries, gate de release e teste remoto
negativo de 36 RPCs. Jornadas E2E e exportações mock/remotas registradas na entrega.
Sem alteração de integrações financeiras ou módulos nativos; não houve teste em
aparelho físico nesta etapa.
As 13 jornadas E2E passaram, incluindo tema escuro e filtros mensais.

## Publicação

- Implementação `e3e174e`, enviada ao GitHub.
- Web: https://app-ceo-hos.vercel.app, deployment
  `dpl_FTXLhVHzeAw9K4PrGtpsuCKWDb6F`, pronta e promovida.
- PNG baixado da implantação confirmado RGBA e idêntico ao arquivo local. Chrome
  no domínio canônico confirmou o arquivo novo carregado, fundo computado do
  componente `rgba(0, 0, 0, 0)` e zero erros de página.
- iOS `0.1.0 (12)`: build `c547f40a-3498-40ea-966d-e6a697619795`;
  submissão EAS `5c9ffa6b-8c08-4e2d-a11a-f783b4c87772`.
- A versão 12 inclui também o percentual mensal correto e o seletor da Home.
  O link público permanece https://testflight.apple.com/join/41JRK7ea.
- Em 04/11/2026, o pacote 12 foi enviado diretamente pela ferramenta oficial
  da Apple após permanecer na fila do Expo. O IPA original assinado foi mantido;
  identificação, nome CEO de bolso e versões `0.1.0 (12)` foram conferidos.
- Validação e upload com `altool` concluídos sem erros; delivery UUID
  `c3cca7e5-3e09-4450-ba35-a361e8d4ba11`, processamento Apple `VALID`.
- A submissão EAS `5c9ffa6b-8c08-4e2d-a11a-f783b4c87772` foi cancelada somente
  para substituir o transporte parado; esse estado não representa falha na
  distribuição final. O build EAS original continua disponível.
- Credencial de assinatura usada somente pelo utilitário administrativo em
  diretório temporário protegido; arquivos temporários de autenticação removidos
  ao concluir, sem cópia de credenciais ao repositório ou aplicativo.
- Leitura final da Apple: revisão `APPROVED`, estado externo `IN_BETA_TESTING`,
  build 12 associado ao grupo público existente. A versão 12 está liberada para
  atualização no TestFlight pelo mesmo link.
