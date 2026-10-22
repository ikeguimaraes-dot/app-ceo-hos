-- Expand Ghost IA's authorized semantic layer across the principal CEO
-- domains. Every branch remains server-computed, read-only and unit-scoped.

create or replace function public.ghost_assistant_catalog_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not exists (
    select 1 from public.units u
    where u.active is true
      and ghost_private.user_has_capability(v_user_id, u.id, 'assistant.ask')
  ) then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  return jsonb_build_object(
    'datasets', jsonb_build_array(
      jsonb_build_object('name','financeiro','capability','dashboard.read','dateField','period','description','Faturamento por turno e período, receitas, descontos, gorjetas, custo, lucro, clientes, ticket, pagamentos e metas. reportedRevenue inclui cada turno e sinaliza provisional quando algum fechamento ainda não chegou. Aceita grain day ou month.','fields',jsonb_build_array('unitName','brand','group','period','reportedRevenue','closedRevenue','receivedRevenue','grossRevenue','netRevenue','discount','tips','cost','profit','customers','averageTicket','goal','difference','shifts','shiftCount','closedShiftCount','incompleteShifts','provisional','qualityWarning')),
      jsonb_build_object('name','dre_mensal','capability','dashboard.read','dateField','month','description','DRE consolidada mensal por casa.','fields',jsonb_build_array('unitName','month','type','grossRevenue','cmv','people','occupancy','utilities','operation','maintenance','administrative','marketing','cardFees','taxes','ebitda','netResult','customers','averageTicket')),
      jsonb_build_object('name','dre_detalhes','capability','dashboard.read','dateField','month','description','Linhas detalhadas da DRE por grupo, conta e tipo de custo.','fields',jsonb_build_array('unitName','month','type','groupName','description','account','costType','value','verticalAnalysis')),
      jsonb_build_object('name','despesas','capability','dashboard.read','dateField','date','description','Despesas detalhadas por competência, categoria e classificação DRE.','fields',jsonb_build_array('unitName','month','date','description','category','dreClassification','expenseType','value')),
      jsonb_build_object('name','compras_pedidos','capability','operation.read','dateField','orderDate','description','Pedidos de compra e seus valores e estados.','fields',jsonb_build_array('unitName','number','supplier','status','orderDate','expectedDate','totalValue','requester')),
      jsonb_build_object('name','compras_notas','capability','operation.read','dateField','referenceMonth','description','Notas fiscais atuais da fonte Everest usada pela tela NF/CMV. Use para consultar notas e fornecedores. O summary traz o total calculado pelo banco.','fields',jsonb_build_array('unitName','invoiceNumber','issueDate','supplier','cfop','referenceMonth','totalValue','itemCount')),
      jsonb_build_object('name','compras_itens','capability','operation.read','dateField','referenceMonth','description','Itens atuais das notas Everest, agregados por casa, categoria e produto. Use sempre para perguntas de quanto foi comprado ou gasto com um produto ou categoria. search=carne usa a categoria gerencial A. PROTEINAS. O summary.totalValue e summary.byUnit são calculados pelo banco e devem ser usados na resposta, sem somar as linhas no modelo.','fields',jsonb_build_array('unitName','category','itemDescription','unit','quantity','totalValue','invoiceCount','firstIssueDate','lastIssueDate')),
      jsonb_build_object('name','contas_pagar','capability','dashboard.read','dateField','dueDate','description','Títulos e provisões atuais do Everest: contas abertas, vencidas, pagas, saldos, pagamentos, fornecedor e vencimento. O summary traz totais calculados por situação e por casa.','fields',jsonb_build_array('unitName','supplier','document','dueDate','paymentDate','status','originalValue','balanceValue','paidValue','daysOverdue','paymentMethod','source')),
      jsonb_build_object('name','vendas_produtos','capability','dashboard.read','dateField','date','description','Produtos vendidos no Lorean, agregados por casa, grupo e produto, com quantidade, bruto, desconto, gorjeta e total.','fields',jsonb_build_array('unitName','groupName','product','quantity','grossValue','discountValue','tipsValue','totalValue','firstDate','lastDate')),
      jsonb_build_object('name','pagamentos','capability','dashboard.read','dateField','date','description','Formas de pagamento do Lorean agregadas por casa e forma, com fechado, recebido e diferença.','fields',jsonb_build_array('unitName','paymentMethod','closedValue','receivedValue','difference','firstDate','lastDate')),
      jsonb_build_object('name','descontos','capability','dashboard.read','dateField','date','description','Descontos detalhados do Lorean agregados por casa, item, motivo e usuário.','fields',jsonb_build_array('unitName','item','reason','operator','quantity','value','firstDate','lastDate')),
      jsonb_build_object('name','cancelamentos','capability','dashboard.read','dateField','date','description','Cancelamentos detalhados do Lorean agregados por casa, item, motivo e usuário.','fields',jsonb_build_array('unitName','item','reason','operator','quantity','value','firstDate','lastDate')),
      jsonb_build_object('name','inventarios','capability','operation.read','dateField','inventoryDate','description','Inventários Everest e itens contados, por casa, depósito, grupo e produto.','fields',jsonb_build_array('unitName','inventoryNumber','inventoryDate','status','warehouse','groupName','itemDescription','unit','countedQuantity','systemBalance','unitCost','adjustedValue')),
      jsonb_build_object('name','contratos','capability','dashboard.read','dateField','startDate','description','Contratos por casa sem documentos da contraparte ou anexos, com categoria, contraparte, valor, recorrência, vigência, reajuste e situação.','fields',jsonb_build_array('unitName','title','category','counterparty','owner','value','recurrence','startDate','endDate','automaticRenewal','nextAdjustmentDate','status')),
      jsonb_build_object('name','eventos','capability','operation.read','dateField','startDate','description','Eventos por casa sem contatos pessoais do cliente, com tipo, datas, convidados, status, valores e situação de pagamento.','fields',jsonb_build_array('unitName','name','type','startDate','endDate','guests','status','totalValue','depositValue','depositPaid','paymentStatus','commercialOwner','operationalOwner')),
      jsonb_build_object('name','reservas','capability','operation.read','dateField','date','description','Reservas agregadas por casa, data, status e origem, sem nomes, telefones ou e-mails de clientes.','fields',jsonb_build_array('unitName','date','status','origin','reservationCount','guests')),
      jsonb_build_object('name','operacao_diaria','capability','operation.read','dateField','date','description','Relatórios diários da operação, feedbacks de clientes e registros de produto 86.','fields',jsonb_build_array('unitName','date','status','daySummary','feedbackCount','complaintCount','product86Count')),
      jsonb_build_object('name','folha_resumo','capability','people.read','dateField','month','description','Folha agregada por casa, competência, função e divisão, sem nome, CPF ou salário individual.','fields',jsonb_build_array('unitName','month','role','division','headcount','vacancies','salaryTotal','totalCost')),
      jsonb_build_object('name','manutencao','capability','operation.read','dateField','requestedDate','description','Chamados de manutenção, prioridade, status e valor previsto.','fields',jsonb_build_array('unitName','operation','category','location','floor','priority','service','reason','requestedDate','executionDate','executor','status','expectedValue')),
      jsonb_build_object('name','pessoas','capability','people.read','dateField','admissionDate','description','Quadro operacional sem CPF, documentos, endereço, contatos, salário ou dados bancários.','fields',jsonb_build_array('unitName','displayName','role','department','active','admissionDate','dismissalDate','hrStatus','score','employmentType')),
      jsonb_build_object('name','ausencias','capability','people.read','dateField','date','description','Ausências por colaborador, tipo e impacto operacional, sem anexos médicos.','fields',jsonb_build_array('unitName','employeeName','date','type','reason','scoreImpact')),
      jsonb_build_object('name','planos_acao','capability','operation.read','dateField','deadline','description','Planos de ação operacionais e seus estados.','fields',jsonb_build_array('unitName','title','description','origin','status','deadline','createdAt','updatedAt')),
      jsonb_build_object('name','pedidos_venda','capability','dashboard.read','dateField','orderedAt','description','Pedidos de venda do Atena com pessoas, itens, taxas, descontos e total.','fields',jsonb_build_array('unitName','type','status','orderedAt','people','itemsValue','feesValue','discountValue','totalValue'))
    ),
    'rules', jsonb_build_array(
      'Consultas são somente leitura e limitadas às casas autorizadas.',
      'Datas usam YYYY-MM-DD; períodos não têm o antigo limite de 93 dias.',
      'Use grain month em períodos longos do dataset financeiro.',
      'search filtra nomes ou descrições; unit filtra pelo nome da casa, marca ou grupo.',
      'Cada consulta retorna no máximo 200 linhas; refine os filtros se necessário.'
    )
  );
end
$$;

create or replace function public.ghost_assistant_query_v1(
  p_dataset text,
  p_from date default null,
  p_to date default null,
  p_unit text default null,
  p_search text default null,
  p_grain text default 'day',
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_from date := coalesce(p_from, date_trunc('month', current_date)::date);
  v_to date := coalesce(p_to, current_date);
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if p_dataset is null or v_from > v_to or v_from < date '2000-01-01'
     or v_to > current_date + 366 then
    raise invalid_parameter_value using message = 'invalid_assistant_query';
  end if;
  if p_grain not in ('day','month') then
    raise invalid_parameter_value using message = 'invalid_assistant_query';
  end if;

  if p_dataset = 'financeiro' then
    with scoped_units as (
      select distinct u.id, u.name, b.name brand, g.name group_name
      from public.units u join public.brands b on b.id=u.brand_id join public.groups g on g.id=b.group_id
      where u.active is true
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(concat_ws(' ',u.name,b.name,g.name)) like '%'||lower(p_unit)||'%')
    ), payment_by_shift as (
      select p.workday_id_fk,
        sum(p.valor_fechado) closed_revenue,
        sum(p.valor_recebido) received_revenue,
        sum(p.diferenca) difference
      from public.lorean_pagamentos p
      group by p.workday_id_fk
    ), shift_rows as (
      select w.unit_id,w.id,w.turno,
        case when p_grain='month' then date_trunc('month',w.data)::date else w.data end period,
        w.receita_bruta gross_revenue,w.receita_liquida net_revenue,w.desconto discount,w.gorjeta tips,
        w.custo cost,w.lucro profit,w.clientes customers,
        p.closed_revenue,p.received_revenue,p.difference,
        coalesce(p.closed_revenue,w.receita_bruta,w.previsto) reported_revenue,
        p.closed_revenue is null or w.receita_liquida is null provisional,
        coalesce(w.qualidade_suspeito,false) quality_warning
      from public.lorean_workdays w join scoped_units u on u.id=w.unit_id
      left join payment_by_shift p on p.workday_id_fk=w.id
      where w.data between v_from and v_to
    ), workdays as (
      select unit_id,period,
        sum(reported_revenue) reported_revenue,sum(closed_revenue) closed_revenue,
        sum(received_revenue) received_revenue,sum(gross_revenue) gross_revenue,
        sum(net_revenue) net_revenue,sum(discount) discount,sum(tips) tips,sum(cost) cost,
        sum(profit) profit,sum(customers) customers,sum(difference) difference,
        case when sum(customers)>0 then sum(reported_revenue)/sum(customers) end average_ticket,
        array_agg(distinct turno order by turno) shifts,count(*) shift_count,
        count(closed_revenue) closed_shift_count,
        array_agg(turno order by turno) filter (where provisional) incomplete_shifts,
        bool_or(provisional) provisional,bool_or(quality_warning) quality_warning
      from shift_rows group by unit_id,period
    ), goals as (
      select u.id unit_id,
        case when p_grain='month' then date_trunc('month',d)::date else d end period,
        sum(coalesce((select o.meta from public.metas_dia_override o where o.unit_id=u.id and o.data=d),
          (select s.meta from public.metas_dia_semana s where s.unit_id=u.id and s.competencia=to_char(d,'YYYY-MM') and s.dia_semana=extract(dow from d)::integer))) goal
      from scoped_units u cross join lateral generate_series(v_from,v_to,interval '1 day') d
      group by u.id,period
    ), result as (
      select u.name "unitName",u.brand,u.group_name "group",coalesce(w.period,g.period) period,
        w.reported_revenue "reportedRevenue",w.closed_revenue "closedRevenue",w.received_revenue "receivedRevenue",
        w.gross_revenue "grossRevenue",w.net_revenue "netRevenue",w.discount,w.tips,w.cost,w.profit,
        w.customers,w.average_ticket "averageTicket",g.goal,w.difference,w.shifts,
        w.shift_count "shiftCount",w.closed_shift_count "closedShiftCount",
        coalesce(w.incomplete_shifts,'{}'::text[]) "incompleteShifts",coalesce(w.provisional,false) provisional,
        coalesce(w.quality_warning,false) "qualityWarning"
      from scoped_units u
      join (select unit_id,period from workdays union select unit_id,period from goals) k on k.unit_id=u.id
      left join workdays w on w.unit_id=k.unit_id and w.period=k.period
      left join goals g on g.unit_id=k.unit_id and g.period=k.period
      order by k.period desc,u.name limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'dre_mensal' then
    with result as (
      select u.name "unitName",d.mes_ano "month",d.tipo "type",d.receita_bruta "grossRevenue",d.cmv,
        d.pessoal people,d.ocupacao occupancy,d.utilidades utilities,d.operacao operation,
        d.manutencao maintenance,d.administrativa administrative,d.marketing,
        d.taxa_cartao "cardFees",d.impostos taxes,d.ebitda,d.resultado_liquido "netResult",
        d.clientes customers,d.ticket_medio "averageTicket"
      from public.dre_mensal d join public.units u on u.id=d.unit_id
      where d.mes_ano between to_char(v_from,'YYYY-MM') and to_char(v_to,'YYYY-MM')
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
      order by d.mes_ano desc,u.name limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'dre_detalhes' then
    with result as (
      select u.name "unitName",d.mes_ano "month",d.tipo "type",d.grupo "groupName",d.descricao description,
        d.conta account,d.custo_tipo "costType",d.valor value,d.av_percentual "verticalAnalysis"
      from public.dre_linhas_detalhadas d join public.units u on u.id=d.unit_id
      where d.mes_ano between to_char(v_from,'YYYY-MM') and to_char(v_to,'YYYY-MM')
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',d.tipo,d.grupo,d.descricao,d.conta,d.custo_tipo)) like '%'||lower(p_search)||'%')
      order by d.mes_ano desc,abs(d.valor) desc nulls last limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'despesas' then
    with result as (
      select u.name "unitName",d.mes_ano "month",d.data_competencia "date",d.descricao description,
        d.categoria category,d.classificacao_dre "dreClassification",d.tipo_despesa "expenseType",d.valor value
      from public.dre_despesa_detalhada d join public.units u on u.id=d.unit_id
      where d.data_competencia between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',d.descricao,d.categoria,d.classificacao_dre,d.tipo_despesa)) like '%'||lower(p_search)||'%')
      order by d.data_competencia desc,abs(d.valor) desc nulls last limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'compras_pedidos' then
    with result as (
      select u.name "unitName",o.numero "number",o.fornecedor supplier,o.status,
        o.data_pedido "orderDate",o.data_prevista "expectedDate",o.valor_total "totalValue",o.solicitante_nome requester
      from public.purchase_orders o join public.units u on u.id=o.unit_id
      where o.data_pedido between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',o.numero,o.fornecedor,o.status,o.solicitante_nome)) like '%'||lower(p_search)||'%')
      order by o.data_pedido desc limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'compras_notas' then
    with invoice_lines as (
      select u.name unit_name,
        coalesce(nullif(trim(f.nr_danfe::text),''),'Sem número') invoice_number,
        coalesce(f.dt_emissao::date,make_date(f.ano_lancamento,f.mes_lancamento,1)) issue_date,
        make_date(f.ano_lancamento,f.mes_lancamento,1) reference_month,
        coalesce(nullif(trim(f.fornecedor_nome),''),'Fornecedor não identificado') supplier,
        nullif(trim(f.cfop::text),'') cfop,
        greatest(coalesce(f.v_total_danfe,0),0)::numeric invoice_total,
        greatest(abs(coalesce(f.v_total_embalagem,f.v_custo_total,0)),0)::numeric item_total
      from public.everest_facade_uniao f join public.units u on u.id=f.unit_id
      where make_date(f.ano_lancamento,f.mes_lancamento,1)
              between date_trunc('month',v_from)::date and date_trunc('month',v_to)::date
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',f.nr_danfe,f.fornecedor_nome,f.cfop,f.item_descricao,f.desc_gerencial)) like '%'||lower(p_search)||'%')
    ), grouped as (
      select unit_name,invoice_number,issue_date,reference_month,supplier,
        string_agg(distinct cfop,', ' order by cfop) cfop,
        case when max(invoice_total)>0 then max(invoice_total) else sum(item_total) end total_value,
        count(*)::integer item_count
      from invoice_lines
      group by unit_name,invoice_number,issue_date,reference_month,supplier
    ), page as (
      select * from grouped order by issue_date desc,total_value desc limit v_limit
    ), by_unit as (
      select unit_name,sum(total_value) total_value,count(*)::integer invoice_count
      from grouped group by unit_name order by unit_name
    )
    select
      coalesce((select jsonb_agg(jsonb_build_object(
        'unitName',p.unit_name,'invoiceNumber',p.invoice_number,'issueDate',p.issue_date,
        'supplier',p.supplier,'cfop',p.cfop,'referenceMonth',p.reference_month,
        'totalValue',p.total_value,'itemCount',p.item_count
      ) order by p.issue_date desc,p.total_value desc) from page p),'[]'::jsonb),
      jsonb_build_object(
        'totalValue',coalesce((select sum(g.total_value) from grouped g),0),
        'invoiceCount',(select count(*) from grouped),
        'byUnit',coalesce((select jsonb_agg(jsonb_build_object('unitName',b.unit_name,'totalValue',b.total_value,'invoiceCount',b.invoice_count) order by b.unit_name) from by_unit b),'[]'::jsonb)
      )
    into v_rows,v_summary;

  elsif p_dataset = 'compras_itens' then
    with filtered as (
      select u.name unit_name,
        make_date(f.ano_lancamento,f.mes_lancamento,1) reference_month,
        coalesce(f.dt_emissao::date,make_date(f.ano_lancamento,f.mes_lancamento,1)) issue_date,
        coalesce(nullif(trim(f.nr_danfe::text),''),'Sem número') invoice_number,
        coalesce(nullif(trim(f.item_descricao),''),nullif(trim(f.desc_gerencial),''),'Item sem descrição') item_description,
        coalesce(nullif(trim(f.desc_gerencial),''),'Sem categoria') category,
        nullif(trim(f.unidade_medida),'') unit_name_measure,
        coalesce(f.q_embalagem,0)::numeric quantity,
        greatest(abs(coalesce(f.v_total_embalagem,f.v_custo_total,0)),0)::numeric item_total
      from public.everest_facade_uniao f join public.units u on u.id=f.unit_id
      where make_date(f.ano_lancamento,f.mes_lancamento,1)
              between date_trunc('month',v_from)::date and date_trunc('month',v_to)::date
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (
          p_search is null
          or (
            regexp_replace(lower(public.unaccent(p_search)),'[^a-z0-9]+','','g')
              in ('carne','carnes','proteina','proteinas')
            and lower(public.unaccent(coalesce(f.desc_gerencial,''))) like '%proteina%'
          )
          or (
            regexp_replace(lower(public.unaccent(p_search)),'[^a-z0-9]+','','g')
              not in ('carne','carnes','proteina','proteinas')
            and lower(public.unaccent(concat_ws(' ',f.item_descricao,f.desc_gerencial,f.fornecedor_nome)))
                 like '%'||lower(public.unaccent(p_search))||'%'
          )
        )
    ), grouped as (
      select unit_name,category,item_description,unit_name_measure,
        sum(quantity) quantity,sum(item_total) total_value,
        count(distinct concat_ws('|',invoice_number,issue_date::text))::integer invoice_count,
        min(issue_date) first_issue_date,max(issue_date) last_issue_date
      from filtered
      group by unit_name,category,item_description,unit_name_measure
    ), page as (
      select * from grouped order by total_value desc,item_description limit v_limit
    ), by_unit as (
      select unit_name,sum(item_total) total_value,
        count(distinct concat_ws('|',invoice_number,issue_date::text))::integer invoice_count,
        count(*)::integer line_count
      from filtered group by unit_name order by unit_name
    )
    select
      coalesce((select jsonb_agg(jsonb_build_object(
        'unitName',p.unit_name,'category',p.category,'itemDescription',p.item_description,
        'unit',p.unit_name_measure,'quantity',p.quantity,'totalValue',p.total_value,
        'invoiceCount',p.invoice_count,'firstIssueDate',p.first_issue_date,'lastIssueDate',p.last_issue_date
      ) order by p.total_value desc,p.item_description) from page p),'[]'::jsonb),
      jsonb_build_object(
        'totalValue',coalesce((select sum(f.item_total) from filtered f),0),
        'invoiceCount',coalesce((select count(distinct concat_ws('|',f.invoice_number,f.issue_date::text)) from filtered f),0),
        'lineCount',(select count(*) from filtered),
        'classification',case when regexp_replace(lower(public.unaccent(coalesce(p_search,''))),'[^a-z0-9]+','','g') in ('carne','carnes','proteina','proteinas') then 'A. PROTEINAS' else p_search end,
        'byUnit',coalesce((select jsonb_agg(jsonb_build_object('unitName',b.unit_name,'totalValue',b.total_value,'invoiceCount',b.invoice_count,'lineCount',b.line_count) order by b.unit_name) from by_unit b),'[]'::jsonb)
      )
    into v_rows,v_summary;

  elsif p_dataset = 'contas_pagar' then
    with filtered as (
      select u.name unit_name,t.fornecedor_nome supplier,
        coalesce(nullif(t.documento,''),concat_ws('/',t.nr_nota,t.nr_titulo,t.nr_parcela)) document,
        t.dt_vencimento due_date,coalesce(t.dt_pagamento,t.dt_liquidacao) payment_date,
        case when coalesce(t.dt_pagamento,t.dt_liquidacao) is not null or coalesce(t.vl_saldo,0)<=0 then 'paga'
             when t.dt_vencimento<current_date then 'vencida' else 'a_vencer' end status,
        coalesce(t.vl_original,t.vl_titulo,0)::numeric original_value,
        coalesce(t.vl_saldo,0)::numeric balance_value,coalesce(t.vl_pagamento,0)::numeric paid_value,
        coalesce(t.qt_dias_atraso,0) days_overdue,t.ds_forma_pagamento payment_method,t.source_kind source
      from public.everest_titulos_fornecedor_completo t join public.units u on u.id=t.unit_id
      where coalesce(t.dt_vencimento,t.dt_competencia,t.dt_lancamento) between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',t.fornecedor_nome,t.documento,t.ds_situacao,t.ds_forma_pagamento,t.observacao))) like '%'||lower(public.unaccent(p_search))||'%')
    ), page as (
      select * from filtered order by due_date desc nulls last,original_value desc limit v_limit
    ), by_unit as (
      select unit_name,sum(original_value) original_value,sum(balance_value) balance_value,sum(paid_value) paid_value,
        count(*) filter(where status='a_vencer') upcoming_count,count(*) filter(where status='vencida') overdue_count,count(*) filter(where status='paga') paid_count
      from filtered group by unit_name order by unit_name
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',p.unit_name,'supplier',p.supplier,'document',p.document,'dueDate',p.due_date,
      'paymentDate',p.payment_date,'status',p.status,'originalValue',p.original_value,
      'balanceValue',p.balance_value,'paidValue',p.paid_value,'daysOverdue',p.days_overdue,
      'paymentMethod',p.payment_method,'source',p.source
    ) order by p.due_date desc nulls last,p.original_value desc) from page p),'[]'::jsonb),
    jsonb_build_object(
      'originalValue',coalesce((select sum(original_value) from filtered),0),
      'openBalance',coalesce((select sum(balance_value) from filtered where status in ('a_vencer','vencida')),0),
      'paidValue',coalesce((select sum(paid_value) from filtered),0),
      'upcomingCount',(select count(*) from filtered where status='a_vencer'),
      'overdueCount',(select count(*) from filtered where status='vencida'),
      'paidCount',(select count(*) from filtered where status='paga'),
      'byUnit',coalesce((select jsonb_agg(to_jsonb(b) order by b.unit_name) from by_unit b),'[]'::jsonb)
    ) into v_rows,v_summary;

  elsif p_dataset = 'vendas_produtos' then
    with grouped as (
      select u.name unit_name,coalesce(p.grupo,'Sem grupo') group_name,coalesce(p.produto,'Produto não identificado') product,
        sum(coalesce(p.qtd,0)) quantity,sum(coalesce(p.bruto,0)) gross_value,
        sum(coalesce(p.desconto,0)) discount_value,sum(coalesce(p.gorjeta,0)) tips_value,
        sum(coalesce(p.total,0)) total_value,min(w.data) first_date,max(w.data) last_date
      from public.lorean_produtos_dia p join public.lorean_workdays w on w.id=p.workday_id_fk join public.units u on u.id=w.unit_id
      where w.data between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',p.grupo,p.produto))) like '%'||lower(public.unaccent(p_search))||'%')
      group by u.name,p.grupo,p.produto
    ), page as (select * from grouped order by total_value desc limit v_limit)
    select coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'groupName',group_name,'product',product,
      'quantity',quantity,'grossValue',gross_value,'discountValue',discount_value,'tipsValue',tips_value,
      'totalValue',total_value,'firstDate',first_date,'lastDate',last_date) order by total_value desc) from page),'[]'::jsonb),
      jsonb_build_object('quantity',coalesce((select sum(quantity) from grouped),0),'grossValue',coalesce((select sum(gross_value) from grouped),0),
        'discountValue',coalesce((select sum(discount_value) from grouped),0),'totalValue',coalesce((select sum(total_value) from grouped),0))
    into v_rows,v_summary;

  elsif p_dataset = 'pagamentos' then
    with grouped as (
      select u.name unit_name,coalesce(p.forma,'Não informada') payment_method,
        sum(coalesce(p.valor_fechado,0)) closed_value,sum(coalesce(p.valor_recebido,0)) received_value,
        sum(coalesce(p.diferenca,0)) difference,min(w.data) first_date,max(w.data) last_date
      from public.lorean_pagamentos p join public.lorean_workdays w on w.id=p.workday_id_fk join public.units u on u.id=w.unit_id
      where w.data between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(p.forma)) like '%'||lower(public.unaccent(p_search))||'%')
      group by u.name,p.forma
    ), page as (select * from grouped order by received_value desc limit v_limit)
    select coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'paymentMethod',payment_method,
      'closedValue',closed_value,'receivedValue',received_value,'difference',difference,'firstDate',first_date,'lastDate',last_date)
      order by received_value desc) from page),'[]'::jsonb),
      jsonb_build_object('closedValue',coalesce((select sum(closed_value) from grouped),0),
        'receivedValue',coalesce((select sum(received_value) from grouped),0),'difference',coalesce((select sum(difference) from grouped),0))
    into v_rows,v_summary;

  elsif p_dataset in ('descontos','cancelamentos') then
    if p_dataset='descontos' then
      with grouped as (
        select u.name unit_name,d.item,d.motivo reason,d.usuario operator,sum(coalesce(d.qtd,0)) quantity,
          sum(coalesce(d.valor,0)) value,min(w.data) first_date,max(w.data) last_date
        from public.lorean_descontos_detalhe d join public.lorean_workdays w on w.id=d.workday_id_fk join public.units u on u.id=w.unit_id
        where w.data between v_from and v_to
          and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
          and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
          and (p_search is null or lower(public.unaccent(concat_ws(' ',d.item,d.motivo,d.usuario))) like '%'||lower(public.unaccent(p_search))||'%')
        group by u.name,d.item,d.motivo,d.usuario
      ), page as (select * from grouped order by value desc limit v_limit)
      select coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'item',item,'reason',reason,'operator',operator,
        'quantity',quantity,'value',value,'firstDate',first_date,'lastDate',last_date) order by value desc) from page),'[]'::jsonb),
        jsonb_build_object('quantity',coalesce((select sum(quantity) from grouped),0),'value',coalesce((select sum(value) from grouped),0))
      into v_rows,v_summary;
    else
      with grouped as (
        select u.name unit_name,d.item,d.motivo reason,d.usuario operator,sum(coalesce(d.qtd,0)) quantity,
          sum(coalesce(d.valor,0)) value,min(w.data) first_date,max(w.data) last_date
        from public.lorean_cancelamentos_detalhe d join public.lorean_workdays w on w.id=d.workday_id_fk join public.units u on u.id=w.unit_id
        where w.data between v_from and v_to
          and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
          and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
          and (p_search is null or lower(public.unaccent(concat_ws(' ',d.item,d.motivo,d.usuario))) like '%'||lower(public.unaccent(p_search))||'%')
        group by u.name,d.item,d.motivo,d.usuario
      ), page as (select * from grouped order by value desc limit v_limit)
      select coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'item',item,'reason',reason,'operator',operator,
        'quantity',quantity,'value',value,'firstDate',first_date,'lastDate',last_date) order by value desc) from page),'[]'::jsonb),
        jsonb_build_object('quantity',coalesce((select sum(quantity) from grouped),0),'value',coalesce((select sum(value) from grouped),0))
      into v_rows,v_summary;
    end if;

  elsif p_dataset = 'inventarios' then
    with filtered as (
      select u.name unit_name,i.nr_inventario inventory_number,i.dt_inventario inventory_date,i.situacao status,
        i.deposito warehouse,coalesce(x.grupo,i.grupo,'Sem grupo') group_name,x.descricao_item item_description,
        x.unidade_medida unit_measure,x.quantidade_contada counted_quantity,x.saldo_api system_balance,
        x.custo_api unit_cost,x.valor_ajustado_api adjusted_value
      from public.everest_inventarios i join public.units u on u.id=i.unit_id
      left join public.everest_inventario_itens x on x.inventario_id=i.id
      where i.dt_inventario between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',i.deposito,i.grupo,i.situacao,x.grupo,x.subgrupo,x.descricao_item))) like '%'||lower(public.unaccent(p_search))||'%')
    ), page as (select * from filtered order by inventory_date desc,abs(adjusted_value) desc nulls last limit v_limit)
    select coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'inventoryNumber',inventory_number,'inventoryDate',inventory_date,
      'status',status,'warehouse',warehouse,'groupName',group_name,'itemDescription',item_description,'unit',unit_measure,
      'countedQuantity',counted_quantity,'systemBalance',system_balance,'unitCost',unit_cost,'adjustedValue',adjusted_value)
      order by inventory_date desc) from page),'[]'::jsonb),
      jsonb_build_object('inventoryCount',(select count(distinct concat_ws('|',unit_name,inventory_number::text)) from filtered),
        'itemCount',(select count(*) from filtered where item_description is not null),'adjustedValue',coalesce((select sum(adjusted_value) from filtered),0))
    into v_rows,v_summary;

  elsif p_dataset = 'contratos' then
    with result as (
      select u.name "unitName",c.titulo title,c.categoria category,c.contraparte counterparty,c.responsavel owner,
        c.valor value,c.recorrencia recurrence,c.data_inicio "startDate",c.data_fim "endDate",
        c.renovacao_automatica "automaticRenewal",c.data_proximo_reajuste "nextAdjustmentDate",c.status_manual status
      from public.contratos c join public.units u on u.id=c.unit_id
      where c.data_inicio<=v_to and (c.data_fim is null or c.data_fim>=v_from)
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',c.titulo,c.categoria,c.contraparte,c.responsavel,c.status_manual,c.tags))) like '%'||lower(public.unaccent(p_search))||'%')
      order by c.valor desc nulls last limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb),
      jsonb_build_object('contractCount',count(*),'totalValue',coalesce(sum(value),0)) into v_rows,v_summary from result;

  elsif p_dataset = 'eventos' then
    with result as (
      select u.name "unitName",e.nome name,e.tipo type,e.data_inicio "startDate",e.data_fim "endDate",e.num_convidados guests,
        e.status::text status,e.valor_total "totalValue",e.valor_sinal "depositValue",e.valor_sinal_pago "depositPaid",
        e.situacao_pagamento "paymentStatus",e.responsavel_comercial "commercialOwner",e.responsavel_operacional "operationalOwner"
      from public.events e join public.units u on u.id=e.unit_id
      where e.data_inicio::date between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',e.nome,e.tipo,e.status,e.situacao_pagamento,e.responsavel_comercial,e.responsavel_operacional))) like '%'||lower(public.unaccent(p_search))||'%')
      order by e.data_inicio desc limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb),
      jsonb_build_object('eventCount',count(*),'guestCount',coalesce(sum(guests),0),'totalValue',coalesce(sum("totalValue"),0))
      into v_rows,v_summary from result;

  elsif p_dataset = 'reservas' then
    with grouped as (
      select u.name unit_name,r.data,r.status::text status,r.origem::text origin,count(*)::integer reservation_count,sum(coalesce(r.pax,0)) guests
      from public.reservations r join public.units u on u.id=r.unit_id
      where r.data between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',r.status,r.origem))) like '%'||lower(public.unaccent(p_search))||'%')
      group by u.name,r.data,r.status,r.origem
    ), page as (select * from grouped order by data desc,guests desc limit v_limit)
    select coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'date',data,'status',status,'origin',origin,
      'reservationCount',reservation_count,'guests',guests) order by data desc) from page),'[]'::jsonb),
      jsonb_build_object('reservationCount',coalesce((select sum(reservation_count) from grouped),0),'guests',coalesce((select sum(guests) from grouped),0))
    into v_rows,v_summary;

  elsif p_dataset = 'operacao_diaria' then
    with result as (
      select u.name "unitName",r.data,r.status::text status,r.resumo_dia "daySummary",
        (select count(*) from public.op_feedback_cliente f where f.relatorio_id=r.id) "feedbackCount",
        (select count(*) from public.op_feedback_cliente f where f.relatorio_id=r.id and lower(f.tipo::text) like '%reclama%') "complaintCount",
        (select count(*) from public.op_86 o where o.relatorio_id=r.id) "product86Count"
      from public.op_relatorio_diario r join public.units u on u.id=r.unit_id
      where r.data between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',r.status,r.resumo_dia))) like '%'||lower(public.unaccent(p_search))||'%')
      order by r.data desc limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb),
      jsonb_build_object('reportCount',count(*),'feedbackCount',coalesce(sum("feedbackCount"),0),
        'complaintCount',coalesce(sum("complaintCount"),0),'product86Count',coalesce(sum("product86Count"),0))
      into v_rows,v_summary from result;

  elsif p_dataset = 'folha_resumo' then
    with grouped as (
      select u.name unit_name,f.competencia competence,coalesce(f.funcao,'Sem função') role_name,coalesce(f.divisao,'Sem divisão') division_name,
        count(*) filter(where coalesce(f.is_vaga,false) is false)::integer headcount,
        count(*) filter(where coalesce(f.is_vaga,false) is true)::integer vacancies,
        sum(coalesce(f.salario,0)) salary_total,sum(coalesce(f.custo_total,0)) total_cost
      from public.dre_folha f join public.units u on u.id=f.unit_id
      where f.competencia between to_char(v_from,'YYYY-MM') and to_char(v_to,'YYYY-MM')
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user_id,u.id,'people.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',f.funcao,f.divisao))) like '%'||lower(public.unaccent(p_search))||'%')
      group by u.name,f.competencia,f.funcao,f.divisao
    ), page as (select * from grouped order by competence desc,total_cost desc limit v_limit)
    select coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'month',competence,'role',role_name,'division',division_name,
      'headcount',headcount,'vacancies',vacancies,'salaryTotal',salary_total,'totalCost',total_cost)
      order by competence desc,total_cost desc) from page),'[]'::jsonb),
      jsonb_build_object('headcount',coalesce((select sum(headcount) from grouped),0),'vacancies',coalesce((select sum(vacancies) from grouped),0),
        'salaryTotal',coalesce((select sum(salary_total) from grouped),0),'totalCost',coalesce((select sum(total_cost) from grouped),0))
    into v_rows,v_summary;

  elsif p_dataset = 'manutencao' then
    with result as (
      select u.name "unitName",m.operacao operation,m.categoria category,m.local location,m.andar "floor",
        m.prioridade priority,m.servico service,m.motivo reason,m.data_solicitacao "requestedDate",
        m.data_execucao "executionDate",m.executado_por executor,m.status,m.valor_previsto "expectedValue"
      from public.manutencao_chamados m join public.units u on u.id=m.unit_id
      where m.data_solicitacao between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',m.operacao,m.categoria,m.local,m.servico,m.motivo,m.status)) like '%'||lower(p_search)||'%')
      order by m.data_solicitacao desc limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'pessoas' then
    with result as (
      select u.name "unitName",coalesce(e.nome_exibicao,concat_ws(' ',e.nome,e.sobrenome)) "displayName",
        e.funcao "role",e.departamento department,e.ativo active,e.data_admissao "admissionDate",
        e.data_demissao "dismissalDate",e.status_rh "hrStatus",e.score,e.tipo_vinculo "employmentType"
      from public.employees e join public.units u on u.id=e.unit_id
      where e.data_admissao <= v_to and (e.data_demissao is null or e.data_demissao >= v_from)
        and coalesce(e.is_system_account,false) is false
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'people.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',e.nome_exibicao,e.nome,e.sobrenome,e.funcao,e.departamento,e.status_rh,e.tipo_vinculo)) like '%'||lower(p_search)||'%')
      order by e.ativo desc,"displayName" limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'ausencias' then
    with result as (
      select u.name "unitName",coalesce(e.nome_exibicao,concat_ws(' ',e.nome,e.sobrenome)) "employeeName",
        a.data "date",a.tipo "type",a.motivo reason,a.score_impact "scoreImpact"
      from public.absences a join public.employees e on e.id=a.employee_id join public.units u on u.id=e.unit_id
      where a.data between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'people.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',e.nome_exibicao,e.nome,e.sobrenome,a.tipo,a.motivo)) like '%'||lower(p_search)||'%')
      order by a.data desc limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'planos_acao' then
    with result as (
      select u.name "unitName",a.titulo title,a.descricao description,a.origem origin,a.status,
        a.prazo deadline,a.created_at "createdAt",a.updated_at "updatedAt"
      from public.action_plans a join public.units u on u.id=a.unit_id
      where coalesce(a.prazo,a.created_at::date) between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',a.titulo,a.descricao,a.origem,a.status)) like '%'||lower(p_search)||'%')
      order by a.prazo desc nulls last limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

  elsif p_dataset = 'pedidos_venda' then
    with result as (
      select u.name "unitName",a.tipo "type",a.status,a.pedido_criado_em "orderedAt",a.pessoas people,
        a.valor_itens "itemsValue",a.valor_taxas "feesValue",a.valor_desconto "discountValue",a.valor_total "totalValue"
      from public.atena_pedidos a join public.units u on u.id=a.unit_id
      where a.pedido_criado_em::date between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',a.tipo,a.status)) like '%'||lower(p_search)||'%')
      order by a.pedido_criado_em desc limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;
  else
    raise invalid_parameter_value using message = 'invalid_assistant_dataset';
  end if;

  return jsonb_build_object('dataset',p_dataset,'from',v_from,'to',v_to,'grain',p_grain,
    'rowCount',jsonb_array_length(v_rows),'limit',v_limit,'summary',v_summary,'rows',v_rows);
end
$$;

revoke all on function public.ghost_assistant_catalog_v1() from public, anon;
grant execute on function public.ghost_assistant_catalog_v1() to authenticated;
revoke all on function public.ghost_assistant_query_v1(text,date,date,text,text,text,integer) from public, anon;
grant execute on function public.ghost_assistant_query_v1(text,date,date,text,text,text,integer) to authenticated;

comment on function public.ghost_assistant_catalog_v1() is
  'Authorized, read-only catalog of KPH datasets available to Ghost IA.';
comment on function public.ghost_assistant_query_v1(text,date,date,text,text,text,integer) is
  'Authorized, read-only KPH business query for Ghost IA with capability and unit scoping.';
