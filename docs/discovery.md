# Ghost — descoberta local do KPH

> Atualização: a Fase 1A local foi autorizada posteriormente e implementada; veja [entrega 1A](phase-1a.md). Bloqueios abaixo continuam válidos para a Fase 1B conectada. Conteúdo original preservado como registro da descoberta.
Data: 2026-10-20. Decisão: **Fase 1 bloqueada por riscos críticos de autorização**. Nenhuma dependência instalada, tela criada, credencial persistida, conexão ao projeto Supabase, migration aplicada ou build publicado.

## Escopo e confiabilidade

Ghost começou vazio, somente `.git`. Nenhum AGENTS.md foi encontrado na árvore pesquisada do KPH ou nos diretórios ancestrais examinados. Fonte somente leitura: `/Users/henriqueguimaraes/kph-financeiro/kph-os-financeiro`, HEAD `0dbc60bd75b243d8ed5fcee0d6994b3d9ea9f1af`. Havia alterações locais pré-existentes; a descoberta considera o checkout, não apenas o commit. Não lemos `.env.local` nem copiamos exportações financeiras.

A descoberta cobre a arquitetura e o código local desta zona. Não certifica produção nem as outras zonas. O [inventário](source-inventory.md) mapeia 83 páginas/handlers e 103 referências `.from()`, além do DDL local. Esse inventário é análise textual, não execução de SQL. Tipos de `lib/kph/db/types/database.ts` são manuais. O schema base de identidade não está integralmente reconstruído pelas migrations presentes.

`docs/INVENTARIO-DADOS.md` do KPH contém resultados históricos de 2026-09-15, inclusive 26 tabelas sem RLS; não repetimos contagens como atuais. Há evolução posterior: por exemplo, `supabase/migrations/20261009130734_create_mapa_conta_dre.sql` existe, logo a antiga afirmação de inexistência de `mapa_conta_dre` não pode ser adotada hoje. Conferir catálogo e migrations aplicadas exige autorização para acessar o ambiente remoto.

## Arquitetura atual

Next.js 16.3.6, React 19.2.4 e TypeScript; npm, App Router, Server Components, Server Actions e Route Handlers. Supabase JS e SSR, Postgres compartilhado por zonas, Auth, Storage e Edge Functions. O pacote `lib/kph` reúne autenticação, tipos e componentes web. O financeiro aparece visualmente como phi; Ghost terá identidade móvel própria.

A ingestão roda no servidor: Everest sincroniza cadastros, títulos, notas, inventário e custos; Lorean ingere relatórios via Gmail/PDF e extração por IA. Edge Functions locais: `process-lorean-emails` e `lorean-monitor`, com auxiliares em `_shared`. Crons `/api/cron/*` são integrações internas, não APIs do app. Conta Azul tem importação/histórico e Storage protegido por autorização específica. Atena possui schema e biblioteca próprios, que exigem descoberta adicional antes de exposição móvel.

`docs/OWNERSHIP.md` atribui Everest/Lorean ao Financeiro e várias views Prisma/ponte ao Compras. Rotas de ponte redirecionam para outra zona. O repositório fornecido não contém a implementação completa do ecossistema; Pessoas tem 11 páginas locais em construção. Não inferir funcionalidades completas a partir de menus ou tipos.

## Autenticação, permissões e escopo

- `src/app/login/page.tsx`: e-mail/senha com `signInWithPassword`.
- `src/app/auth/sso/callback/route.ts`: magic link com `verifyOtp`, sessão via cookies; não é callback móvel pronto.
- `lib/kph/db/supabase/proxy.ts`: atualização/validação por `auth.getUser`, normalização dos cookies do shell e limpeza em sessão revogada. `src/proxy.ts` exige sessão para rotas cobertas; exclui auth, login, cron e paths com ponto. Revisar cobertura de matcher em testes; não depender dele como única autorização.
- `lib/kph/auth/server.ts`: carrega `user_roles`, join `roles`, campos `unit_id`, `brand_id`, `group_id`. Metadata é usada para nome de exibição; não deve conceder acesso.
- Papéis tipados: founder, cfo, gm, pessoas, chef, comprador, colaborador, socio_readonly, comercial, operacional. Isso não é uma matriz completa de capacidades.
- `lib/kph/auth/api.ts`: `canAccessUnit` verifica papel, founder global, associação por unidade OU marca OU grupo; um papel permitido sem escopo também recebe acesso global. Essa semântica exige decisão explícita, não deve ser copiada silenciosamente para Ghost.
- Hierarquia `groups → brands → units` representada nos tipos; algumas consultas trazem grupo via marca. Validar associações conflitantes e unidades administrativas recentes (`20261016203506_administrative_finance_units.sql`).
- `src/app/financeiro/layout.tsx` lista units ativas confiando em RLS. `auth/unit.ts` lê cookie e faz fallback. `auth/context.tsx` guarda seleção em localStorage/cookie. Não há prova local suficiente das policies de units/user_roles para liberar o equivalente móvel.
- Não foi confirmado contrato único para usuário inativo/sem vínculo. Ghost precisa desses estados separados de sessão inválida e de falha de rede.

## Módulos e mapa de dados

Rotas e referências exatas estão no [inventário](source-inventory.md); prioridade e cobertura estão na [matriz](feature-parity.md).

| Domínio | Objetos locais relevantes | Escopo/observação |
|---|---|---|
| Identidade | groups, brands, units, roles, user_roles | Associação por grupo/marca/unidade; DDL base incompleto |
| Dashboard e vendas | lorean_workdays, lorean_pagamentos, lorean_produtos_dia, metas_dia_semana, metas_dia_override, vendas_consolidado_* | Unidade no pai; filhos precisam herdar isolamento |
| Pagar e DRE | titulos_a_pagar, everest_titulos_fornecedor, titulo_override, mapa_conta_dre, dre_* | Legado e fontes novas coexistem; regra de precedência fica no servidor |
| Compras/CMV | everest_facade_produtos_relatorio, everest_facade_uniao, v_custo_compra, v_fichas_tecnicas_custo, everest_* | Views e escopo precisam revisão; parte pertence a Compras |
| Auditoria | auditoria_sinalizacoes, everest_sync_*, v_fonte_saude | Não expor payload bruto/logs operacionais ao móvel |
| Contratos | contratos, contratos_arquivos, bucket contratos | Arquivo filho deve herdar unidade e permissão do contrato |
| Conta Azul | conta_azul_arquivos, conta_azul_registros, bucket conta-azul | Regra existente global founder/CFO; revisar group_id |
| Conciliação | conciliacao_extrato, protestos_certidoes, protestos_registros | Informação bancária/documental sensível |
| Pessoas | employees, employee_benefits, tipos em pessoas.ts | Folha usa employees; fluxos de RH completos fora desta zona |
| Aprovações legadas | approval_requests, cash_flow_entries, v_aprovacoes_pendentes | Referências não comprovam existência atual nem fluxo utilizável |
| Notificações | notifications nos tipos manuais | Não encontrado registro de dispositivo Expo/pipeline push local |

## APIs existentes e reaproveitamento

| Família | Contrato/uso observado | Situação para Ghost |
|---|---|---|
| GET /api/dashboard | unidade, mes; indicadores com valor, valor_mes_anterior, delta_pct, sem_dados | Adaptar autenticação bearer e autorização de unidade; agregação fica no servidor |
| /api/dre/{despesas,linha-detalhe,titulos,mapa,override} | Leitura/classificação e escrita de overrides, service role | Não liberar antes de autorização de recurso/papel |
| /api/lorean/workdays, /api/lorean/metas | Fechamentos; POST metas com authenticateApi/canAccessUnit | Cookies atuais; metas admite founder/cfo/gm no escopo |
| /api/vendas-consolidado/dados | Consulta com authenticateApi/canAccessUnit | Permite founder/cfo/gm/socio_readonly no escopo; adaptar bearer |
| /api/contratos e filhos | CRUD, arquivos, URLs upload/download | Helpers privilegiados; falta autorização por recurso em handlers inspecionados |
| /api/financeiro/pagar/import | Upload/importação, requireUser | Autenticação não resolve matriz de permissões; fora do primeiro produto |
| /api/lorean/import*, /api/vendas-consolidado/import | Ingestão privilegiada | Backend somente; validação, limites e auditoria |
| /financeiro/conta-azul/api | Histórico/importação | authorizeContaAzul valida sessão/papel global |
| /api/cron/* | Jobs e integrações | Nunca expor segredo de cron ao app |

As Server Actions não são um contrato HTTP móvel estável. CORS não é autorização de usuário ou unidade. O cliente SSR depende de cookies; não assume que um bearer token será reconhecido pelas rotas atuais.

## Achados que bloqueiam a fundação conectada

| ID / severidade | Evidência local | Consequência / ação |
|---|---|---|
| S01 crítica | Chave administrativa compartilhada na conversa | Rotacionar no ambiente proprietário e atualizar consumidores; nenhum valor foi salvo no Ghost. Não foi feita rotação nesta sessão |
| S02 crítica | `sql/011_dre_pessoal_detalhado.sql:11`, também 012/013/014/015: FOR ALL USING(true) WITH CHECK(true) sem TO | SQL não delimita papel nem tenant; acesso depende dos grants. Auditar estado aplicado, revogar policies amplas e testar allow/deny |
| S03 alta | `sql/008_dre_folha.sql:22`, `022_contratos.sql:62`, `030_conciliacao_extrato.sql:83`: SELECT TO authenticated, anon USING(true) | Leitura sem isolamento nas definições locais; revisar todas as tabelas e filhos |
| S04 alta | `sql/039_everest_schema.sql:341` e `054_everest_cap_titulofornecedor.sql:136` | Autenticação sozinha permite leitura transversal no SQL; retirar raw da superfície pública |
| S05 crítica para integração | `src/app/api/contratos/route.ts`, `src/app/api/dre/override/route.ts` e `src/lib/{contratos,dre}/api.ts` | Handlers usam service role sem checagem própria de papel/unidade. Proxy exige sessão nas rotas cobertas, mas não valida acesso ao objeto. Reproduzir em staging, corrigir antes do móvel |
| S06 alta | `lib/kph/auth/api.ts` | Papel sem escopo recebe acesso global. Necessita regra formal de escopo global e testes com grupos distintos |
| S07 alta | `src/app/financeiro/actions.ts:407` | Aprovação verifica estado e depois faz duas escritas; falha na cascata pode retornar sucesso. Exigir transação, versão e idempotência |
| S08 bloqueio de evidência | Inventário de setembro + ausência de DDL completo de identidade | Não há certificação atual de RLS, grants, policies, views, RPCs ou usuário inativo |

São achados estáticos, não exploits executados nem afirmações de exposição atual em produção. Policies permissivas somam acesso; adicionar uma policy restritiva comum sem remover a ampla não resolve. `security_invoker` de algumas views é um bom sinal, mas depende das policies das tabelas subjacentes e de grants. Validar também views recriadas em migrations posteriores.

Contrapontos: a função `replace_dre_folha_competencia` é SECURITY DEFINER, mas revoga PUBLIC e concede execução apenas a service_role no próprio arquivo. Não classificamos isso como RPC pública comprovada. Migrations recentes de DRE também restringem execução à service role. Conta Azul possui RLS específica, embora a interpretação de escopo global precise revisão.

## Acesso direto, backend e dados locais

**Nenhuma tabela foi aprovada para acesso direto pelo Ghost nesta sessão.** Supabase Auth é o caminho proposto para login; não houve login remoto. Units/user_roles e notifications só poderão ser acessadas após auditoria e testes de isolamento, ou via backend autenticado que derive o escopo. Dados sensíveis devem preferir respostas minimizadas do backend.

Backend obrigatório para aprovações, cálculos DRE/CMV, agregações, mutações financeiras, importações, integrações, URLs assinadas, administração e envio push. Faturamento, por exemplo, tem regra existente sobre `lorean_pagamentos.valor_fechado`; não duplicar como soma improvisada no app. Ausência de dado não deve virar zero.

Nunca persistir indiscriminadamente salários, holerites, documentos pessoais, dados bancários, contratos, payloads ERP, PDFs, respostas financeiras ou logs. Sessão apenas em SecureStore. Cache de negócio só em memória inicialmente; limpar no logout, troca de usuário, perda de acesso e troca de unidade. Tokens de push são identificadores sensíveis e não entram em logs. Nenhuma credencial de serviço, Gmail, Everest ou push privado no bundle.

## Próxima evidência necessária

O [plano de remediação](backend-readiness.md) define escopo exato, responsáveis e testes. Para avançar: obter snapshot autorizado de metadados em ambiente apropriado, fechar identidade/escopos e corrigir os achados em uma alteração separada no backend. Não acessar produção, alterar KPH ou banco sem autorização específica. A Fase 1 permanece pendente conforme o gate solicitado pelo usuário.

Referência consultada: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). O changelog markdown não pôde ser carregado pelo navegador; tentativa por curl falhou por DNS no sandbox. Revalidar changelog e versões antes de implementar. [Referência Expo](https://docs.expo.dev/versions/latest/) consultada apenas como direção; nenhuma versão instalada ou certificada.
