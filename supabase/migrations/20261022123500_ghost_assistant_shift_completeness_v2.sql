-- Fix the financial shift projection and keep explicit completeness so a
-- partial import cannot be presented as the complete day.

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
      jsonb_build_object('name','compras_notas','capability','operation.read','dateField','issueDate','description','Notas fiscais de compras por fornecedor.','fields',jsonb_build_array('unitName','invoiceNumber','issueDate','supplier','cfop','source','status','referenceMonth','totalValue')),
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
    with result as (
      select u.name "unitName",i.numero_danfe "invoiceNumber",i.data_emissao "issueDate",
        i.fornecedor_nome supplier,i.cfop,i.origem source,i.situacao status,
        i.mes_referencia "referenceMonth",i.valor_total "totalValue"
      from public.purchase_invoices i join public.units u on u.id=i.unit_id
      where i.data_emissao between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(u.name) like '%'||lower(p_unit)||'%')
        and (p_search is null or lower(concat_ws(' ',i.numero_danfe,i.fornecedor_nome,i.cfop,i.origem,i.situacao)) like '%'||lower(p_search)||'%')
      order by i.data_emissao desc limit v_limit
    ) select coalesce(jsonb_agg(to_jsonb(result)),'[]'::jsonb) into v_rows from result;

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
    'rowCount',jsonb_array_length(v_rows),'limit',v_limit,'rows',v_rows);
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
