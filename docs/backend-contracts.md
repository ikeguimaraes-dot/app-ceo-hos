# Contratos restantes do backend

Os contratos técnicos de leitura, sessão, decisão, reconciliação de instalação e observabilidade já existem em `src/contracts/gateways.ts` e nas RPCs `ghost_*_v1`. Não resta contrato técnico genérico para a fundação móvel. A expansão funcional exige os contratos de produto abaixo, definidos com o KPH antes de qualquer implementação.

| Contrato de produto ainda necessário | Definição necessária                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Eventos de Operação e Pessoas        | Evento de origem, destinatários, deduplicação, prioridade, validade e destino local permitido |
| Dashboard financeiro ampliado        | Fonte oficial, competência, unidade monetária, precisão, ausência de dados, atualização e SLA |
| Assistente analítico ampliado        | Períodos comparáveis, consolidação multiunidade, DRE/CMV/produtos e vocabulário executivo     |
| Novas ações sensíveis                | Recurso, estados, capability, versão esperada, idempotência, auditoria e regras de reversão   |

## Decisões de produto e infraestrutura

- Configurar APNs/FCM fora do cliente depois da aprovação Apple Developer e da criação do projeto Firebase; o projeto EAS já está vinculado.
- Definir quais eventos de Operação e Pessoas geram notificações; a integração inicial enfileira apenas inserções no histórico `notifications` existente.
- Confirmar `com.grupomeeteat.ghost` como ID de loja antes da primeira submissão; o preview isolado usa `com.grupomeeteat.ghost.preview`.
- Testar e-mail real nos redirects nativos já cadastrados no Auth: `ghost-local://auth/reset-password`, `ghost-preview://auth/reset-password` e `ghost-production://auth/reset-password`, além do redirect web `https://app-ceo-hos.vercel.app/auth/reset-password`.
- Disponibilizar uma conta KPH de desenvolvimento já vinculada para jornada positiva completa no app, sem criar papel por credencial administrativa.
- Implantar as migrations Ghost em staging/produção somente após regressão dos consumidores web e aprovação da matriz de capabilities.

## Gates de segurança para produção

- Rotacionar a credencial administrativa que foi exposta fora do repositório e comprovar que a anterior foi revogada.
- Revisar a superfície legada: foram observadas muitas funções `SECURITY DEFINER` executáveis por `anon`/`authenticated`, policies amplas e tabelas com acesso genérico. A API Ghost não depende de acesso direto, mas esse passivo afeta o mesmo projeto.
- Habilitar proteção contra senhas vazadas no Auth.
- Criar testes reais com dois usuários, duas unidades e papéis distintos: allow próprio, deny cruzado, inativo, sem vínculo, papel removido, token expirado e instalação de outro usuário.
- Definir SLA/semântica para indisponibilidade de fonte e valores ausentes do dashboard.

Nenhum desses itens exige mudar telas para consultar tabelas. Novas capacidades entram no bootstrap e novas operações entram por RPC/Edge Function versionada.

Os contratos paginados, os agregados mínimos de Operação/Pessoas e a revogação por `accessVersion` foram entregues na [Fase 2C](phase-2c.md). O SLA atual de revogação em primeiro plano é de até 60 segundos, além da revalidação em cada RPC.

O contrato transacional de decisão, com versão esperada, idempotência, conflito 409 e auditoria privada, foi entregue na [Fase 2D](phase-2d.md).

A reconciliação atômica de instalações, expiração de vínculos sem contato e observabilidade técnica sem PII foram entregues na [Fase 2E](phase-2e.md).

O contrato do assistente entregue na [Fase 2G](phase-2g.md) consolida e compara todas as unidades autorizadas. `ghost_assistant_catalog_v1` descreve as áreas liberadas e `ghost_assistant_query_v1` consulta histórico financeiro diário ou mensal, DRE, despesas, compras, manutenção, quadro operacional, ausências, planos de ação e pedidos de venda. O servidor deriva o escopo por usuário e capability, limita cada resultado a 200 linhas e não permite escrita.

Ainda precisam de contratos próprios antes de entrarem no catálogo: caixa e conciliação bancária, orçamento, CMV por produto e ficha técnica, inventário, escala e ponto detalhados, folha e benefícios individuais, documentos e saúde ocupacional, marketing e contratos. Esses domínios exigem capabilities mais específicas do que as disponíveis hoje para evitar que `people.read` ou `dashboard.read` liberem dados excessivos.
