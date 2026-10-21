# Inventário estático de fontes

Gerado em 2026-10-20. Referências locais, não comprovação do schema remoto. Caminhos relativos ao KPH Financeiro. Métodos detectados por análise textual; policies listadas exigem revisão conjunta de grants, substituições posteriores e estado implantado.

## Páginas e APIs

| Rota | Tipo / métodos | Evidência |
|---|---|---|
| `/cmv/ponte` | redirect | `src/app/cmv/ponte/page.tsx` |
| `/contratos` | redirect | `src/app/contratos/page.tsx` |
| `/financeiro/[brand_slug]/cmv` | página | `src/app/financeiro/[brand_slug]/cmv/page.tsx` |
| `/financeiro/[brand_slug]/lancamento` | página | `src/app/financeiro/[brand_slug]/lancamento/page.tsx` |
| `/financeiro/[brand_slug]` | página | `src/app/financeiro/[brand_slug]/page.tsx` |
| `/financeiro/aprovacoes` | placeholder | `src/app/financeiro/aprovacoes/page.tsx` |
| `/financeiro/auditoria` | página | `src/app/financeiro/auditoria/page.tsx` |
| `/financeiro/conciliacao` | página | `src/app/financeiro/conciliacao/page.tsx` |
| `/financeiro/conta-azul` | página | `src/app/financeiro/conta-azul/page.tsx` |
| `/financeiro/contratos` | página | `src/app/financeiro/contratos/page.tsx` |
| `/financeiro/dre/administrativo` | página | `src/app/financeiro/dre/administrativo/page.tsx` |
| `/financeiro/dre/classificacao` | página | `src/app/financeiro/dre/classificacao/page.tsx` |
| `/financeiro/dre/cmv` | redirect | `src/app/financeiro/dre/cmv/page.tsx` |
| `/financeiro/dre/cmv/ponte` | redirect | `src/app/financeiro/dre/cmv/ponte/page.tsx` |
| `/financeiro/dre/despesas-financeiras` | página | `src/app/financeiro/dre/despesas-financeiras/page.tsx` |
| `/financeiro/dre/folha` | página | `src/app/financeiro/dre/folha/page.tsx` |
| `/financeiro/dre/gerencial` | redirect | `src/app/financeiro/dre/gerencial/page.tsx` |
| `/financeiro/dre/impostos` | página | `src/app/financeiro/dre/impostos/page.tsx` |
| `/financeiro/dre/inventario` | página | `src/app/financeiro/dre/inventario/page.tsx` |
| `/financeiro/dre/manutencao` | página | `src/app/financeiro/dre/manutencao/page.tsx` |
| `/financeiro/dre/marketing` | página | `src/app/financeiro/dre/marketing/page.tsx` |
| `/financeiro/dre/ocupacao` | página | `src/app/financeiro/dre/ocupacao/page.tsx` |
| `/financeiro/dre/operacao` | página | `src/app/financeiro/dre/operacao/page.tsx` |
| `/financeiro/dre` | página | `src/app/financeiro/dre/page.tsx` |
| `/financeiro/dre/receita/analise-vendas` | página | `src/app/financeiro/dre/receita/analise-vendas/page.tsx` |
| `/financeiro/dre/receita/import-lote` | página | `src/app/financeiro/dre/receita/import-lote/page.tsx` |
| `/financeiro/dre/receita` | página | `src/app/financeiro/dre/receita/page.tsx` |
| `/financeiro/dre/utilidades` | página | `src/app/financeiro/dre/utilidades/page.tsx` |
| `/financeiro/fluxo` | página | `src/app/financeiro/fluxo/page.tsx` |
| `/financeiro/orcamento` | página | `src/app/financeiro/orcamento/page.tsx` |
| `/financeiro/pagar` | página | `src/app/financeiro/pagar/page.tsx` |
| `/financeiro` | página | `src/app/financeiro/page.tsx` |
| `/financeiro/receber` | placeholder | `src/app/financeiro/receber/page.tsx` |
| `/financeiro/ritmo` | página | `src/app/financeiro/ritmo/page.tsx` |
| `/login` | página | `src/app/login/page.tsx` |
| `/` | redirect | `src/app/page.tsx` |
| `/pessoas/colaboradores` | placeholder | `src/app/pessoas/colaboradores/page.tsx` |
| `/pessoas/disciplina` | placeholder | `src/app/pessoas/disciplina/page.tsx` |
| `/pessoas/escala` | placeholder | `src/app/pessoas/escala/page.tsx` |
| `/pessoas/faltas` | placeholder | `src/app/pessoas/faltas/page.tsx` |
| `/pessoas/ferias` | placeholder | `src/app/pessoas/ferias/page.tsx` |
| `/pessoas/gorjetas` | placeholder | `src/app/pessoas/gorjetas/page.tsx` |
| `/pessoas/headcount` | placeholder | `src/app/pessoas/headcount/page.tsx` |
| `/pessoas/holerites` | placeholder | `src/app/pessoas/holerites/page.tsx` |
| `/pessoas/horas-extras` | placeholder | `src/app/pessoas/horas-extras/page.tsx` |
| `/pessoas/ponto` | placeholder | `src/app/pessoas/ponto/page.tsx` |
| `/pessoas/vale-transporte` | placeholder | `src/app/pessoas/vale-transporte/page.tsx` |
| `/api/contratos/[id]/arquivos` | OPTIONS, POST | `src/app/api/contratos/[id]/arquivos/route.ts` |
| `/api/contratos/[id]/arquivos/upload-url` | OPTIONS, POST | `src/app/api/contratos/[id]/arquivos/upload-url/route.ts` |
| `/api/contratos/[id]` | OPTIONS, GET, PATCH, DELETE | `src/app/api/contratos/[id]/route.ts` |
| `/api/contratos/arquivos/[arquivoId]/download` | OPTIONS, GET | `src/app/api/contratos/arquivos/[arquivoId]/download/route.ts` |
| `/api/contratos/arquivos/[arquivoId]` | OPTIONS, DELETE | `src/app/api/contratos/arquivos/[arquivoId]/route.ts` |
| `/api/contratos` | OPTIONS, GET, POST | `src/app/api/contratos/route.ts` |
| `/api/cron/everest-fechamento-competencia` | GET | `src/app/api/cron/everest-fechamento-competencia/route.ts` |
| `/api/cron/everest-refresh-fichatecnica-custo` | GET | `src/app/api/cron/everest-refresh-fichatecnica-custo/route.ts` |
| `/api/cron/everest-sync-cadastro` | GET | `src/app/api/cron/everest-sync-cadastro/route.ts` |
| `/api/cron/everest-sync-cap` | GET | `src/app/api/cron/everest-sync-cap/route.ts` |
| `/api/cron/everest-sync-custo` | GET | `src/app/api/cron/everest-sync-custo/route.ts` |
| `/api/cron/everest-sync-danfe` | GET | `src/app/api/cron/everest-sync-danfe/route.ts` |
| `/api/cron/everest-sync-fichatecnica` | GET | `src/app/api/cron/everest-sync-fichatecnica/route.ts` |
| `/api/cron/everest-sync-inventario` | GET | `src/app/api/cron/everest-sync-inventario/route.ts` |
| `/api/cron/everest-transform-cadastro` | GET | `src/app/api/cron/everest-transform-cadastro/route.ts` |
| `/api/cron/everest-transform-fichatecnica` | GET | `src/app/api/cron/everest-transform-fichatecnica/route.ts` |
| `/api/cron/everest-worker` | GET | `src/app/api/cron/everest-worker/route.ts` |
| `/api/cron/lorean-import` | GET | `src/app/api/cron/lorean-import/route.ts` |
| `/api/cron/lorean-monitor` | GET | `src/app/api/cron/lorean-monitor/route.ts` |
| `/api/dashboard` | OPTIONS, GET | `src/app/api/dashboard/route.ts` |
| `/api/dre/despesas` | OPTIONS, GET | `src/app/api/dre/despesas/route.ts` |
| `/api/dre/linha-detalhe` | OPTIONS, GET | `src/app/api/dre/linha-detalhe/route.ts` |
| `/api/dre/mapa` | OPTIONS, GET, POST | `src/app/api/dre/mapa/route.ts` |
| `/api/dre/override` | OPTIONS, POST, DELETE | `src/app/api/dre/override/route.ts` |
| `/api/dre/titulos` | OPTIONS, GET | `src/app/api/dre/titulos/route.ts` |
| `/api/financeiro/pagar/import` | POST | `src/app/api/financeiro/pagar/import/route.ts` |
| `/api/lorean/health` | GET | `src/app/api/lorean/health/route.ts` |
| `/api/lorean/import` | OPTIONS, POST | `src/app/api/lorean/import/route.ts` |
| `/api/lorean/import-xlsx` | POST | `src/app/api/lorean/import-xlsx/route.ts` |
| `/api/lorean/metas` | OPTIONS, POST | `src/app/api/lorean/metas/route.ts` |
| `/api/lorean/workdays` | OPTIONS, GET | `src/app/api/lorean/workdays/route.ts` |
| `/api/vendas-consolidado/dados` | OPTIONS, GET | `src/app/api/vendas-consolidado/dados/route.ts` |
| `/api/vendas-consolidado/import` | OPTIONS, POST | `src/app/api/vendas-consolidado/import/route.ts` |
| `/auth/sign-out` | POST | `src/app/auth/sign-out/route.ts` |
| `/auth/sso/callback` | GET | `src/app/auth/sso/callback/route.ts` |
| `/financeiro/conta-azul/api` | GET, POST | `src/app/financeiro/conta-azul/api/route.ts` |

## Objetos consultados via .from()

Inclui nomes de buckets quando o cliente é Storage. Não equivale a uma lista de tabelas existentes. Tipos manuais e SQL complementam este mapa.

| Objeto referenciado | Evidências (até 4) |
|---|---|
| `approval_requests` | `src/app/financeiro/actions.ts:296`, `src/app/financeiro/actions.ts:424`, `src/app/financeiro/actions.ts:439` |
| `brand_financial_config` | `src/app/financeiro/actions.ts:244`, `src/app/financeiro/actions.ts:683` |
| `brands` | `src/app/financeiro/actions-dre.ts:248`, `src/app/financeiro/actions.ts:72`, `src/app/financeiro/actions.ts:664`, `src/app/financeiro/actions.ts:702` |
| `cash_flow_entries` | `src/app/financeiro/actions.ts:195`, `src/app/financeiro/actions.ts:285`, `src/app/financeiro/actions.ts:361` |
| `categoria_grupo` | `src/app/financeiro/actions-operations.ts:579`, `src/app/financeiro/actions-operations.ts:638`, `src/app/financeiro/actions-operations.ts:644`, `src/app/financeiro/dre/dre-semestre-comparacao.ts:201` |
| `conciliacao_extrato` | `src/app/financeiro/conciliacao/actions.ts:198`, `src/app/financeiro/conciliacao/actions.ts:249`, `src/app/financeiro/conciliacao/actions.ts:314`, `src/app/financeiro/conciliacao/actions.ts:332` |
| `conta-azul` | `src/app/financeiro/conta-azul/view.tsx:81` |
| `conta_azul_arquivos` | `src/app/financeiro/conta-azul/api/route.ts:19`, `src/app/financeiro/conta-azul/api/route.ts:25`, `src/app/financeiro/conta-azul/api/route.ts:67`, `src/app/financeiro/conta-azul/api/route.ts:72` |
| `conta_azul_registros` | `src/app/financeiro/conta-azul/api/route.ts:35`, `src/app/financeiro/conta-azul/api/route.ts:104`, `src/app/financeiro/conta-azul/api/route.ts:107` |
| `contratos` | `src/app/api/contratos/[id]/arquivos/upload-url/route.ts:22`, `src/app/api/contratos/[id]/route.ts:16`, `src/app/api/contratos/[id]/route.ts:34`, `src/app/api/contratos/[id]/route.ts:53` |
| `contratos_arquivos` | `src/app/api/contratos/[id]/arquivos/route.ts:24`, `src/app/api/contratos/[id]/route.ts:48`, `src/app/api/contratos/arquivos/[arquivoId]/download/route.ts:17`, `src/app/api/contratos/arquivos/[arquivoId]/route.ts:16` |
| `dre_contratos_fixos` | `src/app/financeiro/dre/actions.ts:428`, `src/app/financeiro/dre/actions.ts:444` |
| `dre_despesa_detalhada` | `src/app/financeiro/dre/actions.ts:338`, `src/app/financeiro/dre/actions.ts:354` |
| `dre_faturamento_historico` | `src/app/financeiro/dre/actions.ts:385`, `src/app/financeiro/dre/actions.ts:401` |
| `dre_folha` | `src/app/financeiro/dre/actions.ts:474`, `src/app/financeiro/dre/actions.ts:490` |
| `dre_gorjeta_mensal` | `src/app/financeiro/dre/actions.ts:112`, `src/app/financeiro/dre/actions.ts:129` |
| `dre_indicadores` | `src/app/financeiro/dre/actions.ts:293`, `src/app/financeiro/dre/actions.ts:309` |
| `dre_kpis_mensais` | `src/app/financeiro/dre/actions.ts:251`, `src/app/financeiro/dre/actions.ts:267` |
| `dre_linhas_detalhadas` | `src/app/financeiro/dre/actions.ts:27`, `src/app/financeiro/dre/actions.ts:47`, `src/app/financeiro/dre/actions.ts:66` |
| `dre_manutencao_detalhada` | `src/app/financeiro/dre/actions.ts:557`, `src/app/financeiro/dre/actions.ts:573` |
| `dre_mensal` | `src/app/financeiro/actions-dre.ts:140`, `src/app/financeiro/actions-dre.ts:168`, `src/app/financeiro/actions-dre.ts:173`, `src/app/financeiro/actions-dre.ts:223` |
| `dre_pessoal_detalhado` | `src/app/financeiro/dre/actions.ts:515`, `src/app/financeiro/dre/actions.ts:531` |
| `dre_prestadores` | `src/app/financeiro/dre/actions.ts:599`, `src/app/financeiro/dre/actions.ts:615` |
| `dre_receita_detalhada` | `src/app/financeiro/dre/actions.ts:147`, `src/app/financeiro/dre/actions.ts:164` |
| `dre_referencia` | `src/app/financeiro/dre/dre-semestre-actions.ts:104`, `src/app/financeiro/dre/dre-semestre-actions.ts:125`, `src/app/financeiro/dre/dre-semestre-actions.ts:146`, `src/app/financeiro/dre/dre-semestre-comparacao.ts:230` |
| `employee_benefits` | `src/app/financeiro/dre/folha/actions.ts:65` |
| `employees` | `src/app/financeiro/dre/dre-semestre-comparacao.ts:169`, `src/app/financeiro/dre/folha/actions.ts:46`, `src/app/financeiro/fluxo/actions.ts:493` |
| `events` | `src/app/financeiro/actions.ts:733` |
| `everest_cobertura_resumo` | `supabase/functions/lorean-monitor/everest-checks.ts:227` |
| `everest_cobertura_sync` | `src/app/api/cron/everest-fechamento-competencia/route.ts:63` |
| `everest_custo_sync_progresso` | `src/lib/everest/sync/avaliarFechamento.ts:179`, `src/lib/everest/sync/runSyncCusto.ts:45`, `src/lib/everest/sync/runSyncCusto.ts:84` |
| `everest_estoque_provas` | `src/lib/everest/sync/syncEstoqueProva.ts:29` |
| `everest_facade_uniao` | `src/app/financeiro/dre/cmv/actions.ts:94`, `src/app/financeiro/dre/cmv/actions.ts:147`, `src/app/financeiro/dre/cmv/actions.ts:255`, `src/app/financeiro/dre/cmv/actions.ts:308` |
| `everest_fechamento_checagem` | `src/app/api/cron/everest-fechamento-competencia/route.ts:74`, `supabase/functions/lorean-monitor/everest-checks.ts:241`, `supabase/functions/lorean-monitor/everest-checks.ts:277` |
| `everest_fichas_tecnicas` | `src/lib/everest/transform/transformCatalogo.ts:160` |
| `everest_fichas_tecnicas_custo` | `src/lib/everest/sync/refreshFichaTecnicaCusto.ts:32`, `src/lib/everest/sync/refreshFichaTecnicaCusto.ts:56` |
| `everest_fichas_tecnicas_itens` | `src/lib/everest/transform/transformCatalogo.ts:209` |
| `everest_fornecedores` | `src/app/financeiro/actions-operations.ts:211`, `src/app/financeiro/danfe-actions.ts:75`, `src/app/financeiro/dre/cmv/ranking-fornecedores-actions.ts:61`, `src/app/financeiro/fluxo/actions.ts:240` |
| `everest_inventario_itens` | `src/app/financeiro/dre/inventario/actions.ts:45`, `src/lib/everest/sync/syncInventario.ts:114` |
| `everest_inventarios` | `src/app/financeiro/dre/inventario/actions.ts:39`, `src/app/financeiro/dre/inventario/page.tsx:18`, `src/lib/everest/sync/syncInventario.ts:68` |
| `everest_itens` | `src/app/financeiro/danfe-actions.ts:84`, `src/lib/everest/sync/avaliarFechamento.ts:173`, `src/lib/everest/sync/syncInventario.ts:78`, `src/lib/everest/sync/syncItemDiario.ts:35` |
| `everest_itens_custo_historico` | `src/app/financeiro/dre/inventario/actions.ts:59`, `src/lib/everest/transform/transformCustoHistorico.ts:87` |
| `everest_notas_recebidas` | `src/app/financeiro/dre/cmv/ranking-fornecedores-actions.ts:26`, `src/components/financeiro/EverestSyncStatus.tsx:19`, `src/lib/everest/transform/transformNotas.ts:160`, `supabase/functions/lorean-monitor/everest-checks.ts:468` |
| `everest_notas_recebidas_atuais` | `src/app/financeiro/danfe-actions.ts:51`, `src/lib/everest/sync/avaliarFechamento.ts:115`, `src/lib/everest/sync/avaliarFechamento.ts:241`, `supabase/functions/lorean-monitor/everest-checks.ts:333` |
| `everest_notas_recebidas_itens` | `src/app/financeiro/danfe-actions.ts:70`, `src/app/financeiro/dre/cmv/ranking-fornecedores-actions.ts:48`, `src/lib/everest/sync/avaliarFechamento.ts:124`, `src/lib/everest/sync/avaliarFechamento.ts:168` |
| `everest_provisoes_fornecedor` | `src/lib/everest/transform/transformProvisoes.ts:67` |
| `everest_raw_custo_historico` | `src/lib/everest/sync/syncCustoHistoricoItens.ts:38`, `src/lib/everest/transform/transformCustoHistorico.ts:25` |
| `everest_raw_danferecebida` | `src/lib/everest/sync/backfillPeriodo.ts:57`, `src/lib/everest/sync/detectarMudanca.ts:52`, `src/lib/everest/sync/retentarItensOrfaos.ts:36`, `src/lib/everest/sync/retentarItensOrfaos.ts:60` |
| `everest_raw_danferecebida_historico` | `src/lib/everest/sync/detectarMudanca.ts:90` |
| `everest_raw_danferecebidaitem` | `src/lib/everest/sync/detectarMudanca.ts:109`, `src/lib/everest/sync/sincronizarItensNota.ts:69`, `src/lib/everest/transform/transformNotas.ts:181`, `supabase/functions/lorean-monitor/everest-checks.ts:456` |
| `everest_raw_danferecebidaitem_historico` | `src/lib/everest/sync/detectarMudanca.ts:141` |
| `everest_raw_fichatecnica` | `src/lib/everest/sync/syncFichaTecnica.ts:44`, `src/lib/everest/transform/transformCatalogo.ts:102` |
| `everest_raw_fornecedor` | `src/lib/everest/sync/syncFornecedorCatalogoCompleto.ts:36`, `src/lib/everest/transform/transformCatalogo.ts:28` |
| `everest_raw_inventario` | `src/app/financeiro/dre/inventario/page.tsx:21`, `src/lib/everest/sync/syncInventario.ts:44` |
| `everest_raw_item` | `src/lib/everest/sync/syncItemCatalogoCompleto.ts:37`, `src/lib/everest/sync/syncItemDiario.ts:33` |
| `everest_raw_provisao` | `src/lib/everest/sync/syncProvisoes.ts:31`, `src/lib/everest/transform/transformProvisoes.ts:7` |
| `everest_raw_titulofornecedor` | `src/lib/everest/sync/syncTitulosFornecedor.ts:29`, `src/lib/everest/transform/transformTitulosFornecedor.ts:96` |
| `everest_sync_cursors` | `src/components/financeiro/EverestSyncStatus.tsx:15`, `src/components/financeiro/EverestSyncStatus.tsx:16`, `src/lib/everest/sync/cursor.ts:11`, `src/lib/everest/sync/cursor.ts:34` |
| `everest_sync_lock` | `src/lib/everest/sync/avaliarFechamento.ts:199`, `src/lib/everest/sync/lock.ts:57`, `supabase/functions/lorean-monitor/everest-checks.ts:138` |
| `everest_sync_logs` | `src/app/financeiro/auditoria/page.tsx:87`, `src/components/financeiro/EverestSyncStatus.tsx:17`, `src/components/financeiro/EverestSyncStatus.tsx:18`, `src/lib/everest/sync/avaliarFechamento.ts:95` |
| `everest_sync_pendencias` | `src/lib/everest/sync/avaliarFechamento.ts:146`, `src/lib/everest/sync/pendencia.ts:60`, `src/lib/everest/sync/resolverPendenciasObsoletas.ts:49`, `src/lib/everest/sync/resolverPendenciasObsoletas.ts:73` |
| `everest_titulos_fornecedor` | `src/lib/everest/transform/transformTitulosFornecedor.ts:214`, `src/lib/everest/transform/transformTitulosFornecedor.ts:228`, `supabase/functions/lorean-monitor/everest-checks.ts:337` |
| `everest_titulos_fornecedor_completo` | `src/app/financeiro/actions-operations.ts:278`, `src/app/financeiro/actions-operations.ts:313`, `src/app/financeiro/actions-operations.ts:342`, `src/app/financeiro/actions-operations.ts:367` |
| `everest_unidades` | `src/app/api/cron/everest-fechamento-competencia/route.ts:51`, `src/lib/everest/sync/pendencia.ts:21`, `src/lib/everest/sync/unidadesMapeadas.ts:20`, `supabase/functions/lorean-monitor/everest-checks.ts:171` |
| `financial_periods` | `src/app/financeiro/actions.ts:57`, `src/app/financeiro/actions.ts:82`, `src/app/financeiro/actions.ts:112`, `src/app/financeiro/actions.ts:234` |
| `folha_encargos_pct` | `src/app/financeiro/dre/folha/actions.ts:104`, `src/app/financeiro/dre/folha/actions.ts:126` |
| `lorean-pdv` | `src/lib/lorean/pdv/upload.ts:17` |
| `lorean_caixas` | `src/app/api/lorean/import/route.ts:257`, `supabase/functions/process-lorean-emails/index.ts:526`, `supabase/functions/process-lorean-emails/index.ts:530` |
| `lorean_grupos` | `src/app/api/dashboard/route.ts:136` |
| `lorean_horarios` | `supabase/functions/process-lorean-emails/index.ts:1122` |
| `lorean_import_log` | `src/app/financeiro/auditoria/page.tsx:85`, `supabase/functions/lorean-monitor/index.ts:194`, `supabase/functions/lorean-monitor/index.ts:209`, `supabase/functions/lorean-monitor/index.ts:240` |
| `lorean_pagamentos` | `src/app/api/dashboard/route.ts:106` |
| `lorean_produtos_dia` | `src/app/api/lorean/import/route.ts:234`, `src/app/api/lorean/import/route.ts:236`, `src/app/financeiro/actions.ts:783`, `supabase/functions/process-lorean-emails/index.ts:661` |
| `lorean_workdays` | `src/app/api/dashboard/route.ts:73`, `src/app/api/lorean/import/route.ts:225`, `src/app/api/lorean/import/route.ts:250`, `src/app/api/lorean/workdays/route.ts:105` |
| `maestri_3r_empresa` | `src/lib/maestri.ts:10` |
| `mapa_conta_dre` | `src/app/api/dashboard/route.ts:215`, `src/app/api/dre/despesas/route.ts:32`, `src/app/api/dre/linha-detalhe/route.ts:37`, `src/app/api/dre/mapa/route.ts:27` |
| `menu_items` | `src/app/financeiro/actions.ts:502`, `src/app/financeiro/actions.ts:541`, `src/app/financeiro/actions.ts:575` |
| `metas_dia_override` | `src/app/api/lorean/metas/route.ts:81`, `src/app/api/lorean/metas/route.ts:91`, `src/app/api/lorean/workdays/route.ts:122` |
| `metas_dia_semana` | `src/app/api/lorean/metas/route.ts:107`, `src/app/api/lorean/workdays/route.ts:55`, `src/app/api/lorean/workdays/route.ts:63`, `src/app/api/lorean/workdays/route.ts:74` |
| `metas_projecoes` | `src/app/api/lorean/workdays/route.ts:161`, `src/app/financeiro/actions-operations.ts:149` |
| `produtos_relatorio` | `src/app/financeiro/actions-operations.ts:723`, `src/app/financeiro/actions-operations.ts:747`, `src/app/financeiro/dre/cmv/actions.ts:44`, `src/app/financeiro/dre/cmv/actions.ts:74` |
| `protestos` | `src/components/financeiro/ProtestosTab.tsx:107` |
| `protestos_certidoes` | `src/app/financeiro/pagar/protestos-actions.ts:50`, `src/app/financeiro/pagar/protestos-actions.ts:157` |
| `protestos_registros` | `src/app/financeiro/pagar/protestos-actions.ts:63`, `src/app/financeiro/pagar/protestos-actions.ts:182` |
| `titulo_override` | `src/app/api/dashboard/route.ts:216`, `src/app/api/dre/despesas/route.ts:33`, `src/app/api/dre/linha-detalhe/route.ts:38`, `src/app/api/dre/override/route.ts:21` |
| `titulos_a_pagar` | `src/app/api/dashboard/route.ts:160`, `src/app/api/dre/despesas/route.ts:25`, `src/app/api/dre/linha-detalhe/route.ts:25`, `src/app/api/dre/linha-detalhe/route.ts:32` |
| `units` | `lib/kph/auth/unit.ts:30`, `lib/kph/auth/unit.ts:43`, `src/app/api/lorean/metas/route.ts:64`, `src/app/api/vendas-consolidado/dados/route.ts:44` |
| `user_roles` | `lib/kph/auth/server.ts:54`, `src/lib/conta-azul/server.ts:14` |
| `v_aprovacoes_pendentes` | `src/app/financeiro/actions.ts:387`, `src/app/financeiro/actions.ts:610` |
| `v_auditoria_sinalizacoes` | `src/app/financeiro/auditoria/page.tsx:82` |
| `v_cmv_dashboard` | `src/app/financeiro/actions.ts:479`, `src/app/financeiro/actions.ts:616` |
| `v_dre_consolidado` | `src/app/financeiro/actions.ts:139`, `src/app/financeiro/actions.ts:613` |
| `v_fichas_tecnicas_custo` | `src/app/financeiro/dre/cmv/actions.ts:738`, `src/app/financeiro/dre/cmv/actions.ts:773` |
| `v_gap_projecao_realizado` | `src/app/financeiro/actions.ts:164` |
| `vendas_consolidado_ambiente` | `src/app/api/vendas-consolidado/dados/route.ts:81`, `src/app/api/vendas-consolidado/import/route.ts:292`, `src/app/api/vendas-consolidado/import/route.ts:322` |
| `vendas_consolidado_dia_semana` | `src/app/api/vendas-consolidado/dados/route.ts:80`, `src/app/api/vendas-consolidado/import/route.ts:291`, `src/app/api/vendas-consolidado/import/route.ts:316` |
| `vendas_consolidado_funcionarios` | `src/app/api/dashboard/route.ts:273`, `src/app/api/vendas-consolidado/dados/route.ts:82`, `src/app/api/vendas-consolidado/import/route.ts:293`, `src/app/api/vendas-consolidado/import/route.ts:328` |
| `vendas_consolidado_mensal` | `src/app/api/vendas-consolidado/dados/route.ts:78`, `src/app/api/vendas-consolidado/import/route.ts:289`, `src/app/api/vendas-consolidado/import/route.ts:304`, `src/app/financeiro/dre/dre-semestre-comparacao.ts:134` |
| `vendas_consolidado_periodo` | `src/app/api/dashboard/route.ts:226`, `src/app/api/vendas-consolidado/dados/route.ts:55`, `src/app/api/vendas-consolidado/import/route.ts:146`, `src/app/api/vendas-consolidado/import/route.ts:153` |
| `vendas_consolidado_produtos` | `src/app/api/dashboard/route.ts:251`, `src/app/api/vendas-consolidado/dados/route.ts:76`, `src/app/api/vendas-consolidado/import/route.ts:201`, `src/app/api/vendas-consolidado/import/route.ts:205` |
| `vendas_consolidado_resumo` | `src/app/api/vendas-consolidado/dados/route.ts:77`, `src/app/api/vendas-consolidado/import/route.ts:288`, `src/app/api/vendas-consolidado/import/route.ts:300` |
| `vendas_consolidado_turno` | `src/app/api/vendas-consolidado/dados/route.ts:79`, `src/app/api/vendas-consolidado/import/route.ts:290`, `src/app/api/vendas-consolidado/import/route.ts:310` |
| `vendas_diarias` | `src/app/financeiro/actions-operations.ts:123` |

## DDL de tabelas, views e funções

| Objeto | Tipo | Evidência |
|---|---|
| `public.dre_mensal` | table | `sql/002_dre_mensal.sql:10` |
| `public.dre_indicadores` | table | `sql/005_dre_indicadores.sql:7` |
| `public.dre_receita_detalhada` | table | `sql/006_dre_receita_detalhada.sql:7` |
| `public.dre_despesa_detalhada` | table | `sql/007_dre_despesa_detalhada.sql:7` |
| `public.dre_folha` | table | `sql/008_dre_folha.sql:7` |
| `public.dre_gorjeta_mensal` | table | `sql/009_dre_gorjeta_mensal.sql:8` |
| `public.dre_faturamento_historico` | table | `sql/010_dre_faturamento_historico.sql:7` |
| `public.dre_pessoal_detalhado` | table | `sql/011_dre_pessoal_detalhado.sql:2` |
| `public.dre_manutencao_detalhada` | table | `sql/012_dre_manutencao_detalhada.sql:2` |
| `public.dre_prestadores` | table | `sql/013_dre_prestadores.sql:2` |
| `public.dre_contratos_fixos` | table | `sql/014_dre_contratos_fixos.sql:2` |
| `public.dre_kpis_mensais` | table | `sql/015_dre_kpis_mensais.sql:2` |
| `dre_linhas_detalhadas` | table | `sql/016_dre_linhas_detalhadas.sql:4` |
| `public.produtos_relatorio` | table | `sql/018_produtos_relatorio.sql:7` |
| `public.vendas_consolidado_periodo` | table | `sql/020_vendas_consolidado.sql:10` |
| `public.vendas_consolidado_produtos` | table | `sql/020_vendas_consolidado.sql:22` |
| `public.vendas_consolidado_resumo` | table | `sql/021_vendas_consolidado_movimento.sql:10` |
| `public.vendas_consolidado_mensal` | table | `sql/021_vendas_consolidado_movimento.sql:37` |
| `public.vendas_consolidado_turno` | table | `sql/021_vendas_consolidado_movimento.sql:50` |
| `public.vendas_consolidado_dia_semana` | table | `sql/021_vendas_consolidado_movimento.sql:62` |
| `public.vendas_consolidado_ambiente` | table | `sql/021_vendas_consolidado_movimento.sql:74` |
| `public.vendas_consolidado_funcionarios` | table | `sql/021_vendas_consolidado_movimento.sql:85` |
| `public.contratos` | table | `sql/022_contratos.sql:10` |
| `public.contratos_arquivos` | table | `sql/022_contratos.sql:35` |
| `public.mapa_conta_dre` | table | `sql/023_mapa_conta_dre.sql:10` |
| `public.titulo_override` | table | `sql/024_titulo_override.sql:10` |
| `public.protestos_certidoes` | table | `sql/026_protestos.sql:14` |
| `public.protestos_registros` | table | `sql/026_protestos.sql:27` |
| `public.categoria_grupo` | table | `sql/027_categoria_grupo.sql:12` |
| `public.replace_dre_folha_competencia` | function | `sql/027_folha_import_atomic.sql:4` |
| `public.dre_referencia` | table | `sql/028_dre_referencia.sql:22` |
| `em` | table | `sql/030_conciliacao_extrato.sql:24` |
| `public.conciliacao_extrato` | table | `sql/030_conciliacao_extrato.sql:29` |
| `public.folha_encargos_pct` | table | `sql/033_folha_encargos_e_limpeza.sql:20` |
| `lorean_import_lock` | table | `sql/034_lorean_import_lock.sql:13` |
| `claim_lorean_import_lock` | function | `sql/034_lorean_import_lock.sql:25` |
| `release_lorean_import_lock` | function | `sql/034_lorean_import_lock.sql:42` |
| `claim_lorean_import_lock` | function | `sql/035_lorean_import_lock_stale_360.sql:14` |
| `cfop_classificacao` | table | `sql/038_cfop_classificacao_cmv.sql:8` |
| `sync_entra_cmv_cfop` | function | `sql/038_cfop_classificacao_cmv.sql:36` |
| `resync_produtos_on_classificacao_change` | function | `sql/038_cfop_classificacao_cmv.sql:53` |
| `everest_unidades` | table | `sql/039_everest_schema.sql:25` |
| `everest_raw_fornecedor` | table | `sql/039_everest_schema.sql:59` |
| `everest_raw_item` | table | `sql/039_everest_schema.sql:71` |
| `everest_raw_fichatecnica` | table | `sql/039_everest_schema.sql:80` |
| `everest_raw_danferecebida` | table | `sql/039_everest_schema.sql:88` |
| `everest_raw_danferecebidaitem` | table | `sql/039_everest_schema.sql:98` |
| `everest_raw_custo_historico` | table | `sql/039_everest_schema.sql:111` |
| `everest_fornecedores` | table | `sql/039_everest_schema.sql:122` |
| `everest_itens` | table | `sql/039_everest_schema.sql:136` |
| `everest_fichas_tecnicas` | table | `sql/039_everest_schema.sql:152` |
| `everest_fichas_tecnicas_itens` | table | `sql/039_everest_schema.sql:166` |
| `everest_notas_recebidas` | table | `sql/039_everest_schema.sql:178` |
| `everest_notas_recebidas_itens` | table | `sql/039_everest_schema.sql:197` |
| `everest_itens_custo_historico` | table | `sql/039_everest_schema.sql:226` |
| `sync_entra_cmv_cfop_everest_nota_item` | function | `sql/039_everest_schema.sql:245` |
| `resync_everest_nota_item_on_classificacao_change` | function | `sql/039_everest_schema.sql:262` |
| `everest_sync_cursors` | table | `sql/039_everest_schema.sql:284` |
| `everest_sync_logs` | table | `sql/039_everest_schema.sql:296` |
| `everest_sync_pendencias` | table | `sql/039_everest_schema.sql:310` |
| `everest_sync_lock` | table | `sql/040_everest_sync_lock.sql:7` |
| `claim_everest_sync_lock` | function | `sql/040_everest_sync_lock.sql:17` |
| `release_everest_sync_lock` | function | `sql/040_everest_sync_lock.sql:34` |
| `everest_facade_produtos_relatorio` | view | `sql/041_everest_facade_produtos_relatorio.sql:21` |
| `everest_raw_danferecebida_historico` | table | `sql/042_everest_historico_mudanca.sql:18` |
| `everest_raw_danferecebidaitem_historico` | table | `sql/042_everest_historico_mudanca.sql:35` |
| `everest_cobertura_sync` | table | `sql/043_everest_facade_uniao.sql:16` |
| `everest_facade_uniao` | view | `sql/043_everest_facade_uniao.sql:32` |
| `marcar_cobertura_api` | function | `sql/044_everest_cobertura_regua_unica.sql:34` |
| `everest_status_xlsx` | function | `sql/044_everest_cobertura_regua_unica.sql:61` |
| `everest_cobertura_resumo` | view | `sql/044_everest_cobertura_regua_unica.sql:97` |
| `everest_facade_uniao` | view | `sql/044_everest_cobertura_regua_unica.sql:127` |
| `everest_custo_sync_progresso` | table | `sql/045_everest_custo_sync_progresso.sql:16` |
| `renew_everest_sync_lock` | function | `sql/046_everest_sync_lock_renew.sql:12` |
| `confirmar_fechamento_competencia` | function | `sql/048_everest_cobertura_verificacao.sql:24` |
| `everest_cobertura_resumo` | view | `sql/048_everest_cobertura_verificacao.sql:53` |
| `get_produto_meses` | function | `sql/049_everest_facade_get_produto_meses.sql:6` |
| `everest_facade_uniao` | view | `sql/050_everest_facade_qt_saldo.sql:11` |
| `everest_facade_uniao` | view | `sql/051_everest_custo_snapshot_em.sql:18` |
| `everest_facade_uniao` | view | `sql/052_everest_custo_verificado_em.sql:16` |
| `everest_fechamento_checagem` | table | `sql/053_everest_fechamento_checagem.sql:12` |
| `everest_raw_titulofornecedor` | table | `sql/054_everest_cap_titulofornecedor.sql:36` |
| `everest_titulos_fornecedor` | table | `sql/054_everest_cap_titulofornecedor.sql:48` |
| `reverter_cobertura_api` | function | `sql/055_everest_reverter_cobertura.sql:17` |
| `everest_fichas_tecnicas_custo` | table | `sql/056_everest_fichas_tecnicas_custo.sql:19` |
| `v_fichas_tecnicas_custo` | view | `sql/057_v_fichas_tecnicas_custo.sql:5` |
| `everest_facade_uniao` | view | `sql/058_everest_facade_sem_gate.sql:29` |
| `public.atena_unidades` | table | `sql/059_atena_unidade_teste.sql:47` |
| `public.everest_job_queue` | table | `sql/059_everest_coordinator.sql:5` |
| `public.everest_request_log` | table | `sql/059_everest_coordinator.sql:22` |
| `public.everest_request_gate` | table | `sql/059_everest_coordinator.sql:36` |
| `public.everest_enqueue` | function | `sql/059_everest_coordinator.sql:52` |
| `public.everest_claim_job` | function | `sql/059_everest_coordinator.sql:61` |
| `public.everest_finish_job` | function | `sql/059_everest_coordinator.sql:81` |
| `public.everest_acquire_request` | function | `sql/059_everest_coordinator.sql:93` |
| `public.everest_finish_request` | function | `sql/059_everest_coordinator.sql:121` |
| `atena_raw_payboxcart` | table | `sql/060_atena_schema.sql:27` |
| `atena_raw_orderbydate` | table | `sql/060_atena_schema.sql:37` |
| `atena_pedidos` | table | `sql/060_atena_schema.sql:47` |
| `v_auditoria_sinalizacoes` | view | `sql/061_auditoria_sinalizacoes.sql:10` |
| `public.conta_azul_arquivos` | table | `supabase/migrations/20260926023059_conta_azul_historico.sql:2` |
| `public.conta_azul_registros` | table | `supabase/migrations/20260926023059_conta_azul_historico.sql:26` |
| `public.everest_raw_inventario` | table | `supabase/migrations/20261005145759_everest_inventario.sql:5` |
| `public.everest_inventarios` | table | `supabase/migrations/20261005145759_everest_inventario.sql:14` |
| `public.everest_inventario_itens` | table | `supabase/migrations/20261005145759_everest_inventario.sql:43` |
| `public.everest_continue_job` | function | `supabase/migrations/20261007212325_everest_checkpoint_continuations.sql:3` |
| `public.everest_enqueue` | function | `supabase/migrations/20261007212325_everest_checkpoint_continuations.sql:16` |
| `public.everest_claim_job` | function | `supabase/migrations/20261007212325_everest_checkpoint_continuations.sql:34` |
| `public.v_custo_compra` | view | `supabase/migrations/20261008100007_prisma_api_only.sql:3` |
| `public.v_custo_compra_unidade` | view | `supabase/migrations/20261008100007_prisma_api_only.sql:133` |
| `public.everest_facade_uniao` | view | `supabase/migrations/20261008100007_prisma_api_only.sql:137` |
| `public.everest_status_xlsx` | function | `supabase/migrations/20261008100007_prisma_api_only.sql:177` |
| `public.resync_produtos_on_classificacao_change` | function | `supabase/migrations/20261008100007_prisma_api_only.sql:180` |
| `public.everest_cobertura_resumo` | view | `supabase/migrations/20261008100007_prisma_api_only.sql:182` |
| `public.v_fonte_saude` | view | `supabase/migrations/20261008100007_prisma_api_only.sql:193` |
| `public.v_custo_compra` | view | `supabase/migrations/20261008100054_prisma_cmv_totals.sql:3` |
| `public.mapa_conta_dre` | table | `supabase/migrations/20261009130734_create_mapa_conta_dre.sql:1` |
| `public.phi_dre_parcial` | function | `supabase/migrations/20261013110007_phi_dre_parcial.sql:3` |
| `public.everest_rateio_sync` | table | `supabase/migrations/20261013112813_everest_transacoes_rateios.sql:4` |
| `public.everest_raw_transacaofornecedor` | table | `supabase/migrations/20261013112813_everest_transacoes_rateios.sql:17` |
| `public.everest_raw_transacaofornecedorcusto` | table | `supabase/migrations/20261013112813_everest_transacoes_rateios.sql:30` |
| `public.everest_iniciar_rateios` | function | `supabase/migrations/20261013112813_everest_transacoes_rateios.sql:57` |
| `public.everest_gravar_pagina_rateios` | function | `supabase/migrations/20261013112813_everest_transacoes_rateios.sql:72` |
| `public.v_everest_transacoes_publicadas` | view | `supabase/migrations/20261013112813_everest_transacoes_rateios.sql:127` |
| `public.phi_dre_preparacao` | function | `supabase/migrations/20261013113309_phi_dre_diagnostico.sql:2` |
| `public.phi_dre_compras` | function | `supabase/migrations/20261013123349_phi_dre_compras.sql:2` |
| `public.everest_reconciliar_itens_notas` | function | `supabase/migrations/20261013123349_phi_dre_compras.sql:78` |
| `public.everest_cap_reconciliation_runs` | table | `supabase/migrations/20261013192429_create_everest_cap_reconciliation.sql:4` |
| `public.everest_cap_reconciliation_items` | table | `supabase/migrations/20261013192429_create_everest_cap_reconciliation.sql:32` |
| `public.everest_titulos_fornecedor_fallback` | table | `supabase/migrations/20261013194013_create_everest_cap_fallback.sql:3` |
| `public.everest_titulos_fornecedor_completo` | view | `supabase/migrations/20261013194013_create_everest_cap_fallback.sql:66` |
| `public.phi_dre_parcial` | function | `supabase/migrations/20261014023648_phi_integracao_fontes.sql:2` |
| `public.everest_dre_catalogos` | table | `supabase/migrations/20261014023648_phi_integracao_fontes.sql:86` |
| `public.everest_dre_catalogos_necessarios` | function | `supabase/migrations/20261014023648_phi_integracao_fontes.sql:98` |
| `public.everest_dre_publicar_catalogo` | function | `supabase/migrations/20261014023648_phi_integracao_fontes.sql:112` |
| `public.phi_dre_despesas_insumos` | function | `supabase/migrations/20261014023648_phi_integracao_fontes.sql:129` |
| `public.phi_dre_compras` | function | `supabase/migrations/20261014023648_phi_integracao_fontes.sql:169` |
| `public.everest_estoque_provas` | table | `supabase/migrations/20261014024906_everest_estoque_prova.sql:2` |
| `public.everest_estoque_amostras_pendentes` | function | `supabase/migrations/20261014024906_everest_estoque_prova.sql:12` |
| `public.everest_raw_provisao` | table | `supabase/migrations/20261014205919_add_everest_cap_provisions.sql:1` |
| `public.everest_provisoes_fornecedor` | table | `supabase/migrations/20261014205919_add_everest_cap_provisions.sql:9` |
| `public.everest_titulos_fornecedor_completo` | view | `supabase/migrations/20261014205919_add_everest_cap_provisions.sql:90` |
| `public.everest_titulos_fornecedor_completo` | view | `supabase/migrations/20261014210239_fix_everest_provision_fallback_dedupe.sql:1` |
| `public.everest_notas_recebidas_atuais` | view | `supabase/migrations/20261014212240_everest_latest_note_state.sql:13` |
| `public.everest_facade_produtos_relatorio` | view | `supabase/migrations/20261014212240_everest_latest_note_state.sql:40` |
| `public.everest_facade_uniao` | view | `supabase/migrations/20261014212240_everest_latest_note_state.sql:68` |
| `public.everest_notas_recebidas_atuais` | view | `supabase/migrations/20261014220214_everest_active_notes_and_pending_dedupe.sql:4` |

## Arquivos com policies

Não classificar `TO service_role USING (true)` como exposição pública. Ler destinatários e revogações.

- `sql/002_dre_mensal.sql`
- `sql/005_dre_indicadores.sql`
- `sql/006_dre_receita_detalhada.sql`
- `sql/007_dre_despesa_detalhada.sql`
- `sql/008_dre_folha.sql`
- `sql/009_dre_gorjeta_mensal.sql`
- `sql/010_dre_faturamento_historico.sql`
- `sql/011_dre_pessoal_detalhado.sql`
- `sql/012_dre_manutencao_detalhada.sql`
- `sql/013_dre_prestadores.sql`
- `sql/014_dre_contratos_fixos.sql`
- `sql/015_dre_kpis_mensais.sql`
- `sql/016_dre_linhas_detalhadas.sql`
- `sql/018_produtos_relatorio.sql`
- `sql/020_vendas_consolidado.sql`
- `sql/021_vendas_consolidado_movimento.sql`
- `sql/022_contratos.sql`
- `sql/023_mapa_conta_dre.sql`
- `sql/024_titulo_override.sql`
- `sql/026_protestos.sql`
- `sql/027_categoria_grupo.sql`
- `sql/028_dre_referencia.sql`
- `sql/030_conciliacao_extrato.sql`
- `sql/033_folha_encargos_e_limpeza.sql`
- `sql/039_everest_schema.sql`
- `sql/040_everest_sync_lock.sql`
- `sql/042_everest_historico_mudanca.sql`
- `sql/043_everest_facade_uniao.sql`
- `sql/045_everest_custo_sync_progresso.sql`
- `sql/053_everest_fechamento_checagem.sql`
- `sql/054_everest_cap_titulofornecedor.sql`
- `sql/056_everest_fichas_tecnicas_custo.sql`
- `sql/059_everest_coordinator.sql`
- `supabase/migrations/20260926023059_conta_azul_historico.sql`
- `supabase/migrations/20261005145759_everest_inventario.sql`
- `supabase/migrations/20261013112813_everest_transacoes_rateios.sql`
- `supabase/migrations/20261014205919_add_everest_cap_provisions.sql`
