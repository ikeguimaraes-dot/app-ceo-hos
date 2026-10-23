-- Deterministic finance semantics for the Ghost assistant. Raw bank statement
-- rows remain unavailable; reconciliation is exposed only as a monthly,
-- permission-scoped aggregate without bank, account or document identifiers.

create or replace function public.ghost_assistant_catalog_v3()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
begin
  v_base := public.ghost_assistant_catalog_v2();
  return jsonb_set(v_base,'{datasets}',coalesce(v_base->'datasets','[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'name','conciliacao_pagamentos','capability','dashboard.read','dateField','month',
      'description','Conciliação mensal agregada entre vendas fechadas e pagamentos recebidos por casa. Não expõe banco, conta, documento, CPF/CNPJ ou histórico do extrato.',
      'fields',jsonb_build_array('unitName','month','shifts','reconciledShifts','grossRevenue','closedPaymentValue','receivedPaymentValue','difference','coverageComplete')
    )
  ),true);
end
$$;

create or replace function public.ghost_assistant_query_v4(
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
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_from date := coalesce(p_from,date_trunc('month',current_date)::date);
  v_to date := coalesce(p_to,current_date);
begin
  if p_dataset not in ('dre_mensal','dre_detalhes','despesas','conciliacao_pagamentos') then
    return public.ghost_assistant_query_v3(p_dataset,p_from,p_to,p_unit,p_search,p_grain,p_limit);
  end if;
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if v_from > v_to or v_from < date '2000-01-01' or v_to > current_date + 366
    or p_grain not in ('day','month') or length(coalesce(p_unit,'')) > 120
    or length(coalesce(p_search,'')) > 120 then
    raise invalid_parameter_value using message = 'invalid_assistant_query';
  end if;

  if p_dataset = 'dre_mensal' then
    with filtered as (
      select u.name unit_name,d.mes_ano month_value,d.tipo,
        coalesce(d.receita_bruta,0)::numeric gross_revenue,
        coalesce(d.cmv,0)::numeric cmv,coalesce(d.pessoal,0)::numeric people,
        coalesce(d.ocupacao,0)::numeric occupancy,coalesce(d.utilidades,0)::numeric utilities,
        coalesce(d.operacao,0)::numeric operation,coalesce(d.manutencao,0)::numeric maintenance,
        coalesce(d.administrativa,0)::numeric administrative,coalesce(d.marketing,0)::numeric marketing,
        coalesce(d.taxa_cartao,0)::numeric card_fees,coalesce(d.impostos,0)::numeric taxes,
        coalesce(d.ebitda,0)::numeric ebitda,coalesce(d.resultado_liquido,0)::numeric net_result,
        coalesce(d.clientes,0)::integer customers,d.ticket_medio::numeric average_ticket
      from public.dre_mensal d
      join public.units u on u.id=d.unit_id
      where d.mes_ano ~ '^\\d{4}-\\d{1,2}$'
        and make_date(split_part(d.mes_ano,'-',1)::integer,split_part(d.mes_ano,'-',2)::integer,1)
          between date_trunc('month',v_from)::date and date_trunc('month',v_to)::date
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',d.tipo,d.mes_ano))) like '%'||lower(public.unaccent(p_search))||'%')
    ), page as (
      select * from filtered order by month_value desc,unit_name,tipo limit v_limit
    ), by_type as (
      select tipo,sum(gross_revenue) gross_revenue,sum(cmv) cmv,sum(people) people,
        sum(ebitda) ebitda,sum(net_result) net_result,sum(customers)::integer customers,
        case when sum(customers)>0 then sum(gross_revenue)/sum(customers) end average_ticket,
        count(*)::integer record_count
      from filtered group by tipo order by tipo
    ), by_unit as (
      select unit_name,tipo,sum(gross_revenue) gross_revenue,sum(cmv) cmv,
        sum(ebitda) ebitda,sum(net_result) net_result,sum(customers)::integer customers,
        count(*)::integer record_count
      from filtered group by unit_name,tipo order by unit_name,tipo
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'month',month_value,'type',tipo,'grossRevenue',gross_revenue,'cmv',cmv,
      'people',people,'occupancy',occupancy,'utilities',utilities,'operation',operation,
      'maintenance',maintenance,'administrative',administrative,'marketing',marketing,
      'cardFees',card_fees,'taxes',taxes,'ebitda',ebitda,'netResult',net_result,
      'customers',customers,'averageTicket',average_ticket
    ) order by month_value desc,unit_name,tipo) from page),'[]'::jsonb),
    jsonb_build_object(
      'recordCount',(select count(*) from filtered),
      'byType',coalesce((select jsonb_agg(jsonb_build_object(
        'type',tipo,'grossRevenue',gross_revenue,'cmv',cmv,'people',people,'ebitda',ebitda,
        'netResult',net_result,'customers',customers,'averageTicket',average_ticket,'recordCount',record_count
      ) order by tipo) from by_type),'[]'::jsonb),
      'byUnit',coalesce((select jsonb_agg(jsonb_build_object(
        'unitName',unit_name,'type',tipo,'grossRevenue',gross_revenue,'cmv',cmv,
        'ebitda',ebitda,'netResult',net_result,'customers',customers,'recordCount',record_count
      ) order by unit_name,tipo) from by_unit),'[]'::jsonb),
      'authorizedUnitCount',(select count(*) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')),
      'unitsWithDataCount',(select count(distinct unit_name) from filtered)
    ) into v_rows,v_summary;

  elsif p_dataset = 'dre_detalhes' then
    with filtered as (
      select u.name unit_name,d.mes_ano month_value,d.tipo,d.grupo group_name,d.descricao,
        d.conta account,d.custo_tipo cost_type,coalesce(d.valor,0)::numeric signed_value,
        abs(coalesce(d.valor,0))::numeric absolute_value,d.av_percentual vertical_analysis
      from public.dre_linhas_detalhadas d
      join public.units u on u.id=d.unit_id
      where d.mes_ano ~ '^\\d{4}-\\d{1,2}$'
        and make_date(split_part(d.mes_ano,'-',1)::integer,split_part(d.mes_ano,'-',2)::integer,1)
          between date_trunc('month',v_from)::date and date_trunc('month',v_to)::date
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',d.tipo,d.grupo,d.descricao,d.conta,d.custo_tipo))) like '%'||lower(public.unaccent(p_search))||'%')
    ), page as (
      select * from filtered order by month_value desc,absolute_value desc,unit_name limit v_limit
    ), by_group as (
      select coalesce(group_name,'Sem grupo') group_name,sum(signed_value) net_value,
        sum(absolute_value) absolute_value,count(*)::integer line_count
      from filtered group by coalesce(group_name,'Sem grupo') order by sum(absolute_value) desc
    ), by_unit as (
      select unit_name,sum(signed_value) net_value,sum(absolute_value) absolute_value,
        count(*)::integer line_count from filtered group by unit_name order by unit_name
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'month',month_value,'type',tipo,'groupName',group_name,'description',descricao,
      'account',account,'costType',cost_type,'signedValue',signed_value,'absoluteValue',absolute_value,
      'verticalAnalysis',vertical_analysis
    ) order by month_value desc,absolute_value desc,unit_name) from page),'[]'::jsonb),
    jsonb_build_object(
      'lineCount',(select count(*) from filtered),'netValue',coalesce((select sum(signed_value) from filtered),0),
      'absoluteValue',coalesce((select sum(absolute_value) from filtered),0),
      'byGroup',coalesce((select jsonb_agg(jsonb_build_object('groupName',group_name,'netValue',net_value,
        'absoluteValue',absolute_value,'lineCount',line_count) order by absolute_value desc) from by_group),'[]'::jsonb),
      'byUnit',coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'netValue',net_value,
        'absoluteValue',absolute_value,'lineCount',line_count) order by unit_name) from by_unit),'[]'::jsonb)
    ) into v_rows,v_summary;

  elsif p_dataset = 'despesas' then
    with filtered as (
      select u.name unit_name,d.mes_ano month_value,d.data_competencia data,d.descricao,
        d.categoria category,d.classificacao_dre dre_classification,d.tipo_despesa expense_type,
        abs(coalesce(d.valor,0))::numeric amount
      from public.dre_despesa_detalhada d
      join public.units u on u.id=d.unit_id
      where d.data_competencia between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',d.descricao,d.categoria,d.classificacao_dre,d.tipo_despesa))) like '%'||lower(public.unaccent(p_search))||'%')
    ), page as (
      select * from filtered order by data desc,amount desc,unit_name limit v_limit
    ), by_category as (
      select coalesce(category,'Sem categoria') category,sum(amount) total_value,count(*)::integer expense_count
      from filtered group by coalesce(category,'Sem categoria') order by sum(amount) desc
    ), by_unit as (
      select unit_name,sum(amount) total_value,count(*)::integer expense_count
      from filtered group by unit_name order by unit_name
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'month',month_value,'date',data,'description',descricao,'category',category,
      'dreClassification',dre_classification,'expenseType',expense_type,'value',amount
    ) order by data desc,amount desc,unit_name) from page),'[]'::jsonb),
    jsonb_build_object(
      'expenseCount',(select count(*) from filtered),'totalValue',coalesce((select sum(amount) from filtered),0),
      'byCategory',coalesce((select jsonb_agg(jsonb_build_object('category',category,
        'totalValue',total_value,'expenseCount',expense_count) order by total_value desc) from by_category),'[]'::jsonb),
      'byUnit',coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,
        'totalValue',total_value,'expenseCount',expense_count) order by unit_name) from by_unit),'[]'::jsonb),
      'authorizedUnitCount',(select count(*) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')),
      'unitsWithDataCount',(select count(distinct unit_name) from filtered)
    ) into v_rows,v_summary;

  else
    with filtered as (
      select u.name unit_name,r.mes_ano month_value,r.data_inicio,r.data_fim,
        coalesce(r.turnos,0)::integer shifts,coalesce(r.turnos_com_pagamentos,0)::integer reconciled_shifts,
        coalesce(r.bruto,0)::numeric gross_revenue,coalesce(r.pgto_fechado,0)::numeric closed_payment_value,
        coalesce(r.pgto_recebido,0)::numeric received_payment_value,
        coalesce(r.pgto_diferenca,0)::numeric difference,coalesce(r.fonte_ok,false) coverage_complete
      from public.v_lorean_reconciliacao_mensal r
      join public.units u on u.id=r.unit_id
      where r.data_inicio <= v_to and r.data_fim >= v_from
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
    ), page as (
      select * from filtered order by month_value desc,unit_name limit v_limit
    ), by_unit as (
      select unit_name,sum(shifts)::integer shifts,sum(reconciled_shifts)::integer reconciled_shifts,
        sum(gross_revenue) gross_revenue,sum(closed_payment_value) closed_payment_value,
        sum(received_payment_value) received_payment_value,sum(difference) difference,
        bool_and(coverage_complete) coverage_complete
      from filtered group by unit_name order by unit_name
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'month',month_value,'from',data_inicio,'to',data_fim,'shifts',shifts,
      'reconciledShifts',reconciled_shifts,'grossRevenue',gross_revenue,
      'closedPaymentValue',closed_payment_value,'receivedPaymentValue',received_payment_value,
      'difference',difference,'coverageComplete',coverage_complete
    ) order by month_value desc,unit_name) from page),'[]'::jsonb),
    jsonb_build_object(
      'monthCount',(select count(distinct month_value) from filtered),'shifts',coalesce((select sum(shifts) from filtered),0),
      'reconciledShifts',coalesce((select sum(reconciled_shifts) from filtered),0),
      'grossRevenue',coalesce((select sum(gross_revenue) from filtered),0),
      'closedPaymentValue',coalesce((select sum(closed_payment_value) from filtered),0),
      'receivedPaymentValue',coalesce((select sum(received_payment_value) from filtered),0),
      'difference',coalesce((select sum(difference) from filtered),0),
      'coverageComplete',coalesce((select bool_and(coverage_complete) from filtered),false),
      'paymentCoveragePct',case when coalesce((select sum(shifts) from filtered),0)>0
        then round((select sum(reconciled_shifts) from filtered)::numeric/(select sum(shifts) from filtered)*100,2) end,
      'byUnit',coalesce((select jsonb_agg(jsonb_build_object(
        'unitName',unit_name,'shifts',shifts,'reconciledShifts',reconciled_shifts,
        'grossRevenue',gross_revenue,'closedPaymentValue',closed_payment_value,
        'receivedPaymentValue',received_payment_value,'difference',difference,
        'coverageComplete',coverage_complete
      ) order by unit_name) from by_unit),'[]'::jsonb),
      'authorizedUnitCount',(select count(*) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')),
      'unitsWithDataCount',(select count(distinct unit_name) from filtered)
    ) into v_rows,v_summary;
  end if;

  return jsonb_build_object('dataset',p_dataset,'from',v_from,'to',v_to,'grain',p_grain,
    'rowCount',jsonb_array_length(v_rows),'limit',v_limit,'summary',v_summary,'rows',v_rows);
end
$$;

revoke all on function public.ghost_assistant_catalog_v3() from public, anon;
revoke all on function public.ghost_assistant_query_v4(text,date,date,text,text,text,integer) from public, anon;
grant execute on function public.ghost_assistant_catalog_v3() to authenticated;
grant execute on function public.ghost_assistant_query_v4(text,date,date,text,text,text,integer) to authenticated;

comment on function public.ghost_assistant_catalog_v3() is
  'Adds aggregate payment reconciliation to the assistant catalog.';
comment on function public.ghost_assistant_query_v4(text,date,date,text,text,text,integer) is
  'Authorized read-only finance query with deterministic DRE, expense and payment reconciliation summaries.';
