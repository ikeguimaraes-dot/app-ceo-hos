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
