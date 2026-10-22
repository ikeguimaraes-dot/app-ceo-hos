# Fase 2I — contas a pagar

Status: implementada no app e no projeto Supabase de desenvolvimento em 22/10/2026.

A antiga aba **Pendências** passou a ser **A pagar**. A tela apresenta uma visão financeira por casa com saldo total em aberto, valores vencidos, vencimentos do dia, próximos sete dias e a lista priorizada de títulos. O seletor horizontal troca a unidade sem abrir uma tela intermediária.

## Contrato remoto

`ghost_payables_v1(unit, asOf, limit)` consulta a visão consolidada `everest_titulos_fornecedor_completo` somente no servidor. O retorno contém apenas os campos necessários: fornecedor, documento, vencimento, saldo, situação calculada, dias em atraso e forma de pagamento.

A RPC:

- deriva o usuário de `auth.uid()`;
- exige vínculo com a unidade e `dashboard.read`;
- limita a lista a no máximo 100 títulos;
- não expõe a visão financeira à Data API;
- concede execução somente a `authenticated`;
- não oferece aprovação, baixa ou pagamento pelo aplicativo.

## Evidência

- [Contas a pagar](screenshots/payables.png)

A função foi executada com um escopo autorizado e o contrato JSON foi validado. A chamada anônima também foi testada e recusada. TypeScript estrito, lint, testes unitários e seis jornadas E2E validam a integração no cliente.
