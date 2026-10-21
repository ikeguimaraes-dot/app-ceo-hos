# Contratos restantes do backend

Os contratos de leitura e sessão da Fase 1B já existem em `src/contracts/gateways.ts` e nas RPCs `ghost_*_v1`. Esta é a lista exata do que ainda falta para operação e distribuição.

| Contrato restante | Entrada/saída necessária | Regra do servidor |
|---|---|---|
| Decidir aprovação | ID opaco, unidade, decisão, motivo, versão esperada e idempotency key → estado/version/timestamp | Transação única, item ainda pendente, capability de decisão, escopo do recurso e trilha de auditoria; conflito 409 |
| Paginar pendências | unidade, cursor e filtros permitidos → itens mínimos, próximo cursor e updatedAt | Cursor estável e filtro autorizado; hoje a RPC v1 retorna somente manutenção/ponto sem paginação |
| Paginar notificações | unidade/cursor → histórico e próximo cursor | Ownership do usuário; definir se avisos globais ou por unidade |
| Preferências de push | categorias, quiet hours e timezone → versão confirmada | Usuário próprio; categorias permitidas e validação de timezone |
| Worker de push | evento interno → fan-out, tentativas e receipts | Deduplicação, payload genérico, remoção de token inválido e isolamento por ambiente |
| Rotação/reconciliação de instalação | token renovado ou logout offline → vínculo atual | Evitar vínculo órfão sem impedir outro usuário no mesmo aparelho |
| Operação | unidade e período → resumo operacional mínimo | Fonte e capacidades ainda precisam ser escolhidas com o dono do domínio |
| Pessoas | unidade e período → resumo minimizado | Repositório/fonte proprietária e regras de RH ainda não foram auditados |
| Auditoria de revogação | accessVersion ou evento → sessão/contexto invalidado | Definir latência máxima para papel removido durante uso |
| Observabilidade | request ID, código estável e duração → logs sem PII | Nunca registrar JWT, e-mail, valores, documentos ou payload completo |

## Decisões de produto e infraestrutura

- Configurar APNs/FCM fora do cliente depois da aprovação Apple Developer e da criação do projeto Firebase; o projeto EAS já está vinculado.
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
