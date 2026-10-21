# Ghost — design system proposto

> Atualização: a Fase 1A local foi autorizada posteriormente e implementada; veja [entrega 1A](phase-1a.md). Bloqueios abaixo continuam válidos para a Fase 1B conectada. Conteúdo original preservado como registro da descoberta.
Especificação, sem telas implementadas devido ao gate de segurança. Referência conceitual: phi usa Fraunces/Inter em `src/app/financeiro/layout.tsx`; KPH tem brasa `#C4622D`, ouro `#D4A574`, carvão `#0A0A0B`, creme `#FDF6EE` em globals.css. Não copiar CSS ou componentes DOM para React Native.

## Direção

Visual executivo sóbrio, tipografia nativa inicialmente, números tabulares e hierarquia clara. Logo Ghost ainda não definido; wordmark textual é suficiente para fundação. Cor de marca é acento, não indicação única de status.

| Token semântico | Claro proposto | Escuro proposto |
|---|---|---|
| canvas | #F6F5F2 | #101113 |
| surface | #FFFFFF | #1C1E22 |
| text | #181A1F | #F3F4F6 |
| textSecondary | #525760 | #B8BDC7 |
| accent | #984518 | #F2AE79 |
| success | #146C43 | #7AD9AA |
| warning | #805500 | #F1C66D |
| critical | #B42332 | #FF9AA4 |

Paleta é proposta: medir contraste em combinações reais antes de aceite. Espaçamentos 4/8/12/16/24/32; raios 8/12/16; texto 14/16/20/28 com escala dinâmica; alvos de toque mínimos 48dp. Safe areas, teclado e redução de movimento respeitados. Sem tamanhos fixos que cortem valores ou texto ampliado.

## Navegação e componentes

Abas: Início, Pendências, Operação, Pessoas, Mais; exibir somente capacidades liberadas. Início destaca unidade, faturamento/meta, caixa, urgências e aprovações disponíveis. Não mostrar métricas sem contrato ou com valores inventados. Pendência abre detalhe, confirmação e resultado servidor.

Componentes: Screen, Text, Button, TextField, Card, Money, StatusBadge, UnitSelector, ListRow, EmptyState, ErrorState com retry, OfflineBanner, LoadingState, LastUpdated e ConfirmationSheet. Labels acessíveis, ordem de foco e anúncios de erro. Status tem texto/ícone além de cor. Listas/cards substituem tabelas largas; gráficos pequenos têm resumo textual e dados acessíveis.

Moeda pt-BR/BRL, números alinhados e ausência como “Sem dados”, jamais R$ 0 por conveniência. Datas civis não mudam dia por conversão UTC; datas de eventos usam timezone explícito. Loading não mantém informação de unidade anterior. Retry tem causa clara; sucesso só após confirmação.

Catálogo interno futuro em rota de desenvolvimento, ausente no build de produção: componentes em todos os estados, claro/escuro, fonte ampliada e leitores de tela. Fixtures sintéticas somente nesse catálogo/testes e claramente identificadas; nenhum dado fictício nos módulos de negócio.
