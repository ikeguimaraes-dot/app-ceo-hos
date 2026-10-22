# Fase 2I — contas a pagar

Status: implementada no app e no projeto Supabase de desenvolvimento em 22/10/2026.

A antiga aba **Pendências** passou a ser **A pagar**. A tela apresenta uma visão financeira por casa ou consolidada em **Todas as casas**, com saldo total em aberto, valores vencidos, vencimentos do dia, próximos sete dias e a lista priorizada de títulos. Os filtros separam **Em aberto**, **A vencer**, **Vencidas** e **Pagas**.

## Contrato remoto

`ghost_payables_v2(unit?, status, asOf, limit)` consulta a visão consolidada `everest_titulos_fornecedor_completo` somente no servidor. Unidade nula representa todas as casas autorizadas. O retorno contém apenas os campos necessários: casa, fornecedor, documento, vencimento ou liquidação, valor, situação calculada, dias em atraso e forma de pagamento.

A RPC:

- deriva o usuário de `auth.uid()`;
- monta no servidor a lista de unidades com `dashboard.read` e impede que a consolidação ultrapasse esse conjunto;
- limita a lista a no máximo 200 títulos;
- não expõe a visão financeira à Data API;
- concede execução somente a `authenticated`;
- não oferece aprovação, baixa ou pagamento pelo aplicativo.

## Evidência

- [Contas a pagar](screenshots/payables.png)

A função foi executada com um escopo autorizado e o contrato JSON foi validado. A chamada anônima também foi testada e recusada. TypeScript estrito, lint, testes unitários e seis jornadas E2E validam a integração no cliente.
