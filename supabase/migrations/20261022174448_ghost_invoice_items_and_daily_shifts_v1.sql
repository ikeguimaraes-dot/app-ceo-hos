-- Mobile drill-downs backed by the same KPH sources used on the finance pages.

create or replace function public.ghost_product_invoices_v1(p_unit_id uuid,p_month date default current_date,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_start date := date_trunc('month',coalesce(p_month,current_date))::date;
  v_end date := (date_trunc('month',coalesce(p_month,current_date))+interval '1 month - 1 day')::date;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message='authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id,p_unit_id,'operation.read') then raise insufficient_privilege using message='unit_capability_denied'; end if;
  if v_start > current_date then raise invalid_parameter_value using message='invalid_invoice_month'; end if;
  with invoice_lines as (
    select
      md5(concat_ws('|',p_unit_id::text,coalesce(f.nr_danfe::text,''),coalesce(f.item_codigo,''),f.id::text)) line_id,
      coalesce(nullif(trim(f.nr_danfe::text),''),'Sem número') invoice_number,
      coalesce(f.dt_emissao::date,make_date(f.ano_lancamento,f.mes_lancamento,1)) issue_date,
      coalesce(nullif(trim(f.fornecedor_nome),''),'Fornecedor não identificado') supplier,
      nullif(trim(f.cfop::text),'') cfop,
      greatest(coalesce(f.v_total_danfe,0),0)::numeric invoice_total,
      greatest(abs(coalesce(f.v_total_embalagem,f.v_custo_total,0)),0)::numeric item_total,
      coalesce(nullif(trim(f.item_descricao),''),nullif(trim(f.desc_gerencial),''),'Item sem descrição') item_description,
      nullif(trim(f.desc_gerencial),'') category,
      f.q_embalagem::numeric quantity,
      nullif(trim(f.unidade_medida),'') unit_name,
      coalesce(f.v_custo_compra,f.v_custo_medio)::numeric unit_cost,
      f.perc_variacao::numeric variation,
      f.entra_cmv_cfop included_in_cmv
    from public.everest_facade_uniao f
    where f.unit_id=p_unit_id and f.mes_lancamento=extract(month from v_start)::integer and f.ano_lancamento=extract(year from v_start)::integer
  ), grouped as (
    select md5(concat_ws('|',p_unit_id::text,invoice_number,issue_date::text,supplier)) id,invoice_number,issue_date,supplier,
      string_agg(distinct cfop,', ' order by cfop) cfop,null::text status,
      case when max(invoice_total)>0 then max(invoice_total) else sum(item_total) end total_value,count(*)::integer item_count,
      jsonb_agg(jsonb_build_object('id',line_id,'description',item_description,'category',category,'quantity',quantity,'unit',unit_name,'unitCost',unit_cost,'totalCost',item_total,'variation',variation,'includedInCmv',included_in_cmv) order by item_description) items
    from invoice_lines group by invoice_number,issue_date,supplier
  ), totals as (
    select coalesce(sum(total_value),0) total_purchased,count(*)::integer invoice_count,count(distinct supplier)::integer supplier_count from grouped
  ), page as (
    select * from grouped order by issue_date desc,total_value desc limit v_limit
  )
  select jsonb_build_object('updatedAt',now(),'periodStart',v_start,'periodEnd',v_end,'totalPurchased',t.total_purchased,'invoiceCount',t.invoice_count,'supplierCount',t.supplier_count,
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'invoiceNumber',p.invoice_number,'issueDate',p.issue_date,'supplier',p.supplier,'cfop',p.cfop,'status',p.status,'totalValue',p.total_value,'itemCount',p.item_count,'items',p.items) order by p.issue_date desc,p.total_value desc) from page p),'[]'::jsonb))
  into v_result from totals t;
  return v_result;
end $$;

create or replace function public.ghost_dashboard_v2(p_unit_id uuid,p_month date default current_date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_start date := date_trunc('month',coalesce(p_month,current_date))::date;
  v_month_end date := (date_trunc('month',coalesce(p_month,current_date))+interval '1 month - 1 day')::date;
  v_end date := least(v_month_end,current_date);
  v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message='authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id,p_unit_id,'dashboard.read') then raise insufficient_privilege using message='unit_capability_denied'; end if;
  if v_start > current_date then raise invalid_parameter_value using message='invalid_dashboard_month'; end if;
  with days as (
    select generate_series(v_start,v_end,interval '1 day')::date business_date
  ), workdays as (
    select w.* from public.lorean_workdays w where w.unit_id=p_unit_id and w.data between v_start and v_end
  ), payments as (
    select p.workday_id_fk,sum(p.valor_fechado) closed_revenue,sum(p.valor_recebido) received_revenue,max(p.criado_em) updated_at
    from public.lorean_pagamentos p join workdays w on w.id=p.workday_id_fk group by p.workday_id_fk
  ), horario_classified as (
    select h.workday_id_fk,case when h.hora>=17 or h.hora<6 then 'jantar' else 'almoco' end shift_name,
      sum(coalesce(h.consumo,0)) consumption,sum(coalesce(h.gorjeta,0)) tips
    from public.lorean_horarios h join workdays w on w.id=h.workday_id_fk
    where coalesce(h.consumo,0)>0 and h.hora between 0 and 23 group by h.workday_id_fk,shift_name
  ), horario_valid as (
    select h.workday_id_fk from public.lorean_horarios h join workdays w on w.id=h.workday_id_fk
    group by h.workday_id_fk having bool_and(coalesce(h.consumo,0)>=0 and (coalesce(h.consumo,0)=0 or h.hora between 0 and 23)) and sum(coalesce(h.consumo,0))>0
  ), turno_classified as (
    select t.workday_id_fk,
      case when lower(coalesce(t.turno,'')) like '%noite%' then 'jantar' when lower(coalesce(t.turno,'')) like '%manh%' or lower(coalesce(t.turno,'')) like '%tarde%' then 'almoco' end shift_name,
      sum(coalesce(t.consumo,0)) consumption,sum(coalesce(t.gorjeta,0)) tips,
      case when count(t.clientes)=count(*) then sum(t.clientes)::numeric else null end customers
    from public.lorean_turnos t join workdays w on w.id=t.workday_id_fk
    where coalesce(t.consumo,0)>0 group by t.workday_id_fk,shift_name
  ), turno_valid as (
    select t.workday_id_fk from public.lorean_turnos t join workdays w on w.id=t.workday_id_fk
    group by t.workday_id_fk having bool_and(coalesce(t.consumo,0)>=0 and (coalesce(t.consumo,0)=0 or lower(coalesce(t.turno,'')) like '%noite%' or lower(coalesce(t.turno,'')) like '%manh%' or lower(coalesce(t.turno,'')) like '%tarde%')) and sum(coalesce(t.consumo,0))>0
  ), derived_source as (
    select h.workday_id_fk,h.shift_name,h.consumption,h.tips,null::numeric customers,true derived
    from horario_classified h join horario_valid v using(workday_id_fk)
    union all
    select t.workday_id_fk,t.shift_name,t.consumption,t.tips,t.customers,true derived
    from turno_classified t join turno_valid v using(workday_id_fk)
    where not exists(select 1 from horario_valid h where h.workday_id_fk=t.workday_id_fk)
  ), derived_calc as (
    select s.*,sum(s.consumption) over(partition by s.workday_id_fk) total_consumption,
      sum(s.consumption) filter(where s.shift_name='almoco') over(partition by s.workday_id_fk) lunch_consumption
    from derived_source s where s.shift_name is not null
  ), derived_shifts as (
    select w.id||'::'||d.shift_name id,w.data,d.shift_name,
      case when d.shift_name='jantar' and d.lunch_consumption is not null then coalesce(w.receita_bruta,w.previsto,0)-round(coalesce(w.receita_bruta,w.previsto,0)*d.lunch_consumption/d.total_consumption,2)
        else round(coalesce(w.receita_bruta,w.previsto,0)*d.consumption/d.total_consumption,2) end revenue,
      d.tips,d.customers,case when d.customers>0 then (case when d.shift_name='jantar' and d.lunch_consumption is not null then coalesce(w.receita_bruta,w.previsto,0)-round(coalesce(w.receita_bruta,w.previsto,0)*d.lunch_consumption/d.total_consumption,2) else round(coalesce(w.receita_bruta,w.previsto,0)*d.consumption/d.total_consumption,2) end)/d.customers else null end average_ticket,true derived
    from derived_calc d join workdays w on w.id=d.workday_id_fk where coalesce(w.turno,'dia_inteiro')='dia_inteiro'
  ), shift_rows as (
    select w.id::text id,w.data,case when lower(coalesce(w.turno,'')) in ('almoco','almoço') then 'almoco' when lower(coalesce(w.turno,''))='jantar' then 'jantar' else 'dia_inteiro' end shift_name,
      coalesce(w.receita_bruta,w.previsto,0)::numeric revenue,w.gorjeta::numeric tips,w.clientes::numeric customers,
      case when w.clientes>0 then coalesce(w.receita_bruta,w.previsto,0)/w.clientes else null end average_ticket,false derived
    from workdays w where coalesce(w.turno,'dia_inteiro')<>'dia_inteiro'
    union all select * from derived_shifts
    union all
    select w.id::text,w.data,'dia_inteiro',coalesce(w.receita_bruta,w.previsto,0)::numeric,w.gorjeta::numeric,w.clientes::numeric,
      case when w.clientes>0 then coalesce(w.receita_bruta,w.previsto,0)/w.clientes else null end,false
    from workdays w where coalesce(w.turno,'dia_inteiro')='dia_inteiro' and not exists(select 1 from derived_shifts d where split_part(d.id,'::',1)=w.id::text)
  ), daily as (
    select w.data business_date,sum(coalesce(w.receita_bruta,w.previsto)) revenue,sum(w.receita_bruta) gross_revenue,sum(w.receita_liquida) net_revenue,
      sum(p.received_revenue) received_revenue,sum(coalesce(w.devedor,case when p.received_revenue is not null then coalesce(w.receita_bruta,w.previsto,0)-p.received_revenue else 0 end)) debt,
      sum(w.desconto) discount,sum(w.gorjeta) tips,sum(w.clientes) customers,
      case when sum(coalesce(w.receita_bruta,w.previsto,0))>0 and count(w.cmv_pct)>0 then sum(coalesce(w.custo,coalesce(w.receita_bruta,w.previsto,0)*w.cmv_pct))/sum(coalesce(w.receita_bruta,w.previsto,0)) else null end cmv_percentage,
      bool_or(p.closed_revenue is null or w.receita_liquida is null) provisional,max(greatest(coalesce(p.updated_at,'-infinity'::timestamptz),coalesce(w.criado_em,'-infinity'::timestamptz))) updated_at
    from workdays w left join payments p on p.workday_id_fk=w.id group by w.data
  ), series as (
    select d.business_date,x.revenue,x.gross_revenue,x.net_revenue,x.received_revenue,x.debt,x.discount,x.tips,x.customers,x.cmv_percentage,coalesce(x.provisional,false) provisional,
      coalesce((select o.meta from public.metas_dia_override o where o.unit_id=p_unit_id and o.data=d.business_date),(select s.meta from public.metas_dia_semana s where s.unit_id=p_unit_id and s.competencia=to_char(d.business_date,'YYYY-MM') and s.dia_semana=extract(dow from d.business_date)::integer)) goal,x.updated_at,
      coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.shift_name,'revenue',r.revenue,'tips',r.tips,'customers',r.customers,'averageTicket',r.average_ticket,'derived',r.derived) order by case r.shift_name when 'almoco' then 1 when 'jantar' then 2 else 3 end,r.id) from shift_rows r where r.data=d.business_date),'[]'::jsonb) shifts
    from days d left join daily x on x.business_date=d.business_date
  ), totals as (
    select sum(revenue) revenue,sum(gross_revenue) gross_revenue,sum(net_revenue) net_revenue,sum(received_revenue) received_revenue,sum(discount) discount,sum(tips) tips,sum(customers) customers,count(revenue) data_days,
      case when count(goal)=0 then null else sum(goal) end goal,bool_or(provisional and revenue is not null) provisional,max(updated_at) updated_at from series
  )
  select jsonb_build_object('updatedAt',coalesce(t.updated_at,now()),'periodStart',v_start,'periodEnd',v_end,'revenue',t.revenue,'grossRevenue',t.gross_revenue,'netRevenue',t.net_revenue,'receivedRevenue',t.received_revenue,'discount',t.discount,'tips',t.tips,'customers',t.customers,
    'averageTicket',case when t.customers>0 then t.revenue/t.customers else null end,'projection',case when t.revenue is null then null when v_end=v_month_end then t.revenue when t.data_days>0 then t.revenue/t.data_days*extract(day from v_month_end) else null end,
    'goal',t.goal,'goalProgress',case when t.revenue is not null and t.goal>0 then t.revenue/t.goal else null end,'hasData',t.revenue is not null,'provisional',coalesce(t.provisional,false),
    'series',coalesce((select jsonb_agg(jsonb_build_object('date',s.business_date,'revenue',s.revenue,'goal',s.goal,'provisional',s.provisional,'received',s.received_revenue,'debt',s.debt,'discount',s.discount,'tips',s.tips,'customers',s.customers,'averageTicket',case when s.customers>0 then s.revenue/s.customers else null end,'cmvPercentage',s.cmv_percentage,'shifts',s.shifts) order by s.business_date) from series s),'[]'::jsonb))
  into v_result from totals t;
  return v_result;
end $$;

revoke all on function public.ghost_product_invoices_v1(uuid,date,integer) from public,anon;
grant execute on function public.ghost_product_invoices_v1(uuid,date,integer) to authenticated;
revoke all on function public.ghost_dashboard_v2(uuid,date) from public,anon;
grant execute on function public.ghost_dashboard_v2(uuid,date) to authenticated;
