# Roadmap e critérios de aceite

| Fase | Estado | Entrega / próximo gate |
|---|---|---|
| 0 — descoberta | Concluída | Inventário KPH, auditoria remota, riscos e matriz de segurança |
| 1A — fundação mock | Concluída | Expo/Router, tema, componentes, navegação, gateways, estados, catálogo, testes e builds locais |
| 1B — backend dev | Concluída | Auth real, SecureStore, PKCE, bootstrap/capabilities, dashboard, pendências, notificações, instalação push e RPCs seguras no desenvolvimento |
| 2A — distribuição controlada | Em andamento | Projeto EAS e builds internos; iOS físico/APNs aguardam aprovação Apple, FCM e conta KPH de teste ainda faltam |
| 2B — notificações reais | Implementada em dev | Preferências, fila privada, deduplicação, retentativas, receipts, limpeza e worker Edge Function; entrega física aguarda APNs/FCM |
| 2C — piloto operacional | Pendente | Paginação, Operação/Pessoas mínimos, revogação e grupo pequeno de usuários |
| 2D — decisões | Pendente | Contrato transacional de aprovação, idempotência, conflito e auditoria |
| 3 — expansão financeira/operacional | Pendente | Receber, fluxo, DRE, CMV, produtos, orçamento, conciliação e operação por contratos minimizados |
| 4 — pessoas | Pendente | Descoberta da fonte proprietária, minimização e fluxos RH por papel/recurso |
| 5 — lojas | Pendente | Privacidade, acessibilidade física, performance, observabilidade, assinatura, rollout e rollback |

## Definition of Done da Fase 1

- Mock e remoto selecionáveis por ambiente sem segredos no repositório.
- Auth móvel persiste sessão apenas em SecureStore e limpa estado no logout.
- Unidade e capability derivadas no servidor e revalidadas por operação.
- Nenhuma consulta direta a tabela ou regra financeira no app.
- Android e iOS compilam e abrem localmente.
- Lint, typecheck, testes, E2E, exports e checks de fronteira aprovados.
- API móvel testada com allow/deny no desenvolvimento.
- Documentação lista com precisão o que falta para staging/produção.

A Fase 1 não inclui aprovação financeira, envio efetivo de push, EAS Build/Submit ou implantação em produção. A [Fase 2A](phase-2a.md) registra a distribuição controlada posterior.
