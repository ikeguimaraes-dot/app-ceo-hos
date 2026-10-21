# Matriz de paridade móvel

Status: baseline do checkout de 2026-10-20 reconciliada com a Fase 1B em desenvolvimento. Login, contexto, perfil, dashboard mínimo, pendências mínimas e notificações possuem contratos Ghost v1. Aprovações e módulos posteriores continuam sem contrato. “Definir” é lacuna, não permissão concedida.

Offline padrão: sem persistência de dados financeiros/RH; “memória” significa apenas dados já obtidos nesta sessão, claramente desatualizados e ocultados ao perder autorização. Nenhuma escrita offline. Endpoints propostos não existem ainda e não têm URL inventada.

| Módulo web | Funcionalidade / estado local | Público autorizado | Prioridade móvel | L/E | Fonte de dados / evidência KPH | Endpoint necessário | Offline | Push relacionado | Fase |
|---|---|---|---|---|---|---|---|---|---|
| Login | E-mail/senha, recovery PKCE | Conta Auth | P0 | L/E sessão | Supabase Auth; `AuthGateway` | Auth nativo implementado em dev | Sem login offline | — | 1 |
| Contexto | Grupo/marca/unidade | vínculo `user_roles` ativo | P0 | L | units/brands/groups; `ghost_bootstrap_v1` | Bootstrap v1 implementado em dev | Só memória revalidada | Contexto de todos | 1 |
| Perfil / Mais | Logout, preferências e biometria local | Próprio usuário | P0 | L/E | Logout web existente; biometria nova | Auth; preferências propostas | Tema/bloqueio local | Categorias/quiet hours | 1–2 |
| Cockpit /financeiro | Receita/meta mensal mínima | `dashboard.read` por unidade | P0 | L | lorean_workdays/pagamentos; metas | `ghost_dashboard_v1` em dev | Memória | Fechamento/meta | 1B |
| Pendências | Manutenção e ajustes de ponto | `pending.read` por unidade | P0 | L | Fontes existentes confirmadas | `ghost_pending_items_v1` em dev | Memória | Pendência crítica | 1B |
| Aprovações | Página em construção; action legada | founder/cfo na action; escopo a validar | P0 | L/E | actions.ts responderAprovacao; approval_requests/cash_flow_entries referenciados | Novo contrato transacional | Não para decisão | Aprovação pendente | 2 |
| Pagar | Consulta, títulos e importação | Definir consulta/aprovação/import separadamente | P0 | L/E aprovação | actions-operations.ts; titulos_a_pagar e fontes Everest coexistentes | Consulta segura; aprovação a confirmar | Memória leitura | Próximo vencimento/vencido | 2 |
| Notificações | Histórico, leitura e instalação Expo | Destinatário ativo com `notifications.read` | P0 | L/E | notifications + schema privado Ghost | Lista/leitura/registro/revogação em dev; worker pendente | Histórico em memória | Envio pendente | 1B–2 |
| Receber | Rota presente; paridade real a validar | Definir por escopo financeiro | P1 | L | financeiro/receber/page.tsx; fontes de devedores em actions-operations.ts | Consulta autorizada a especificar | Memória | Atraso recebível | 3 |
| Fluxo | Consulta de fluxo | Definir por escopo financeiro | P1 | L | financeiro/fluxo; getFluxoCaixaMes | Consulta agregada no backend | Memória | Urgência de caixa a definir | 3 |
| DRE | Competência, detalhamento e classificação | Definir consulta/escrita | P1 | L/E restrita | dre_*, mapa_conta_dre, titulo_override, phi_dre_* | Adaptar APIs/RPCs internas; não expor service RPC | Memória | Inconsistência | 3 |
| Vendas / receita | Fechamento, análise e metas | Metas: founder/cfo/gm; dados consolidado inclui socio_readonly | P1 | L/E metas | /api/lorean/metas, /api/vendas-consolidado/dados; lorean_* | Adaptar bearer, preservar autorização de unidade | Memória | Meta atingida/em risco | 2–3 |
| Ritmo / orçamento | Planejamento e metas | Definir por unidade e tipo de edição | P1 | L/E | /financeiro/ritmo, /financeiro/orcamento; actions-dre.ts | Contrato específico por jornada | Memória leitura | Risco de meta | 3 |
| CMV / produtos | Custos, fornecedores e fichas | Definir financeiro/compras/chef por recurso | P1 | L | dre/cmv/actions.ts; everest_facade_*, v_custo_compra | Backend preserva regra de custo | Memória | Inconsistência de custo | 3 |
| Ponte de compras | Redireciona para Compras | Não confirmado nesta zona | P2 | Definir | /cmv/ponte, /financeiro/dre/cmv/ponte; OWNERSHIP.md | Descobrir repo Compras primeiro | Não | A definir | 3–5 |
| Conciliação/protestos | Consulta/importação | Definir, dados bancários sensíveis | P1 | L; E posterior | conciliacao_extrato, protestos_* | Backend seguro; import fora do MVP | Não persistir | Inconsistência | 3 |
| Auditoria | Sinais e saúde de fontes | Definir visibilidade por escopo | P1 | L | /financeiro/auditoria; sql/061_auditoria_sinalizacoes.sql | Resumo minimizado | Memória | Auditoria/integração | 2–3 |
| Contratos/documentos | CRUD e arquivos | Matriz ausente nos handlers revisados | P1 | L/E | contratos, contratos_arquivos, Storage | Corrigir auth por recurso; URLs assinadas | Não persistir arquivos | Vencimento documental | 3 |
| Conta Azul | Arquivos/histórico | founder/cfo globais na implementação; group_id a revisar | P2 | L/E import | authorizeContaAzul; conta_azul_* | Adaptar bearer mantendo restrição | Não | Falha importação | 3 |
| Colaboradores | Placeholder local | RH/gestor: regra a descobrir | P1 | Definir | /pessoas/colaboradores; employees apenas usado em folha aqui | Descobrir proprietário Pessoas | Não | Documento a vencer | 4 |
| Escala | Placeholder local | Definir | P1 | Definir | /pessoas/escala; tipos pessoas.ts não são contrato | Descoberta Pessoas | Não | Alteração de escala a definir | 4 |
| Faltas | Placeholder local | Definir | P1 | Definir | /pessoas/faltas | Descoberta Pessoas | Não | Ausência/falta | 4 |
| Férias | Placeholder local | Definir solicitante/aprovador | P1 | Definir | /pessoas/ferias | Descoberta Pessoas + decisão transacional | Não | Solicitação de férias | 4 |
| Ponto | Placeholder local | Definir colaborador/gestor | P1 | Definir | /pessoas/ponto | Descobrir importação/consulta e eventual marcação | Não | Atraso/ausência | 4 |
| Holerites | Placeholder local | Definir acesso individual/RH | P1 | L a confirmar | /pessoas/holerites; tipos de RH | Documentos autorizados | Não | Disponibilidade a definir | 4 |
| Gorjetas | Placeholder local | Definir | P1 | Definir | /pessoas/gorjetas; DRE gorjetas não substitui rateio RH | Descoberta Pessoas | Não | Fechamento a definir | 4 |
| Horas extras | Placeholder local | Definir solicitante/aprovador | P1 | Definir | /pessoas/horas-extras | Descoberta Pessoas | Não | Solicitação de HE | 4 |
| Headcount | Placeholder local | Definir RH/gestão | P2 | L | /pessoas/headcount; v_headcount_por_marca tipada, não certificada | Agregação autorizada após descoberta | Não | A definir | 4 |
| Vale-transporte | Placeholder local | Definir RH/colaborador | P2 | Definir | /pessoas/vale-transporte | Descoberta Pessoas | Não | A definir | 4 |
| Disciplina | Placeholder local | Definir, alta sensibilidade | P2 | Definir | /pessoas/disciplina | Descoberta Pessoas | Não | Nenhum detalhe sensível em push | 4 |
| Integrações / crons | Everest, Lorean, Gmail, extração | Somente backend/operador autorizado | P2 | L resumo | api/cron; supabase/functions | Resumo de saúde sem segredos | Não | Falha crítica | 2–5 |
| Demais zonas | Comercial, operação, marca etc. fora do checkout | Não confirmado | P2 | Definir | Referências de arquitetura/ownership | Descobrir fontes proprietárias | A definir | A definir | 5 |

As rotas DRE administrativas e dinâmicas por marca constam integralmente no inventário; não representam automaticamente módulos operacionais prontos. Importações pesadas e administração ficam fora do primeiro produto móvel. Nenhuma linha “definir” permite criar endpoint ou tabela por suposição.
