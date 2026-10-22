-- Revenue detail and product invoice read models for the Ghost mobile app.
-- Both RPCs remain read-only and enforce the capabilities of the signed-in
-- user for the requested unit before reading the underlying KPH tables.

create or replace function public.ghost_dashboard_v2(
  p_unit_id uuid,
  p_month date default current_date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_month_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month - 1 day')::date;
  v_end date := least(v_month_end, current_date);
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'dashboard.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if v_start > current_date then
    raise invalid_parameter_value using message = 'invalid_dashboard_month';
  end if;

  with days as (
    select generate_series(v_start, v_end, interval '1 day')::date business_date
  ), payment_by_shift as (
    select p.workday_id_fk,
      sum(p.valor_fechado) closed_revenue,
      sum(p.valor_recebido) received_revenue,
      max(p.criado_em) updated_at
    from public.lorean_pagamentos p
    group by p.workday_id_fk
  ), daily as (
    select w.data business_date,
      sum(coalesce(p.closed_revenue, w.receita_bruta, w.previsto)) revenue,
      sum(w.receita_bruta) gross_revenue,
      sum(w.receita_liquida) net_revenue,
      sum(p.received_revenue) received_revenue,
      sum(w.desconto) discount,
      sum(w.gorjeta) tips,
      sum(w.clientes) customers,
      bool_or(p.closed_revenue is null or w.receita_liquida is null) provisional,
      max(greatest(coalesce(p.updated_at, '-infinity'::timestamptz), coalesce(w.criado_em, '-infinity'::timestamptz))) updated_at
    from public.lorean_workdays w
    left join payment_by_shift p on p.workday_id_fk = w.id
    where w.unit_id = p_unit_id and w.data between v_start and v_end
    group by w.data
  ), series as (
    select d.business_date, x.revenue, x.gross_revenue, x.net_revenue,
      x.received_revenue, x.discount, x.tips, x.customers,
      coalesce(x.provisional, false) provisional,
      coalesce(
        (select o.meta from public.metas_dia_override o where o.unit_id = p_unit_id and o.data = d.business_date),
        (select s.meta from public.metas_dia_semana s where s.unit_id = p_unit_id and s.competencia = to_char(d.business_date, 'YYYY-MM') and s.dia_semana = extract(dow from d.business_date)::integer)
      ) goal,
      x.updated_at
    from days d left join daily x on x.business_date = d.business_date
  ), totals as (
    select sum(revenue) revenue, sum(gross_revenue) gross_revenue,
      sum(net_revenue) net_revenue, sum(received_revenue) received_revenue,
      sum(discount) discount, sum(tips) tips, sum(customers) customers,
      count(revenue) data_days,
      case when count(goal) = 0 then null else sum(goal) end goal,
      bool_or(provisional and revenue is not null) provisional,
      max(updated_at) updated_at
    from series
  )
  select jsonb_build_object(
    'updatedAt', coalesce(t.updated_at, now()),
    'periodStart', v_start, 'periodEnd', v_end,
    'revenue', t.revenue, 'grossRevenue', t.gross_revenue,
    'netRevenue', t.net_revenue, 'receivedRevenue', t.received_revenue,
    'discount', t.discount, 'tips', t.tips, 'customers', t.customers,
    'averageTicket', case when t.customers > 0 then t.revenue / t.customers else null end,
    'projection', case when t.revenue is null then null when v_end = v_month_end then t.revenue when t.data_days > 0 then t.revenue / t.data_days * extract(day from v_month_end) else null end,
    'goal', t.goal,
    'goalProgress', case when t.revenue is not null and t.goal > 0 then t.revenue / t.goal else null end,
    'hasData', t.revenue is not null, 'provisional', coalesce(t.provisional, false),
    'series', coalesce((select jsonb_agg(jsonb_build_object('date',s.business_date,'revenue',s.revenue,'goal',s.goal,'provisional',s.provisional) order by s.business_date) from series s), '[]'::jsonb)
  ) into v_result from totals t;
  return v_result;
end
$$;

revoke all on function public.ghost_dashboard_v2(uuid,date) from public, anon;
grant execute on function public.ghost_dashboard_v2(uuid,date) to authenticated;

create or replace function public.ghost_product_invoices_v1(
  p_unit_id uuid,
  p_month date default current_date,
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
  v_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month - 1 day')::date;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'operation.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if v_start > current_date then raise invalid_parameter_value using message = 'invalid_invoice_month'; end if;

  with filtered as (
    select md5(concat_ws('|',i.unit_id::text,i.numero_danfe,i.data_emissao::text,i.fornecedor_nome,coalesce(i.valor_total,0)::text)) id,
      coalesce(nullif(i.numero_danfe,''),'Sem número') invoice_number,
      i.data_emissao issue_date,
      coalesce(nullif(i.fornecedor_nome,''),'Fornecedor não identificado') supplier,
      nullif(i.cfop,'') cfop, nullif(i.situacao,'') status,
      greatest(coalesce(i.valor_total,0),0)::numeric total_value
    from public.purchase_invoices i
    where i.unit_id = p_unit_id and i.data_emissao between v_start and v_end
  ), totals as (
    select coalesce(sum(total_value),0) total_purchased, count(*) invoice_count,
      count(distinct supplier) supplier_count from filtered
  ), page as (
    select * from filtered order by issue_date desc, total_value desc limit v_limit
  )
  select jsonb_build_object(
    'updatedAt', now(), 'periodStart', v_start, 'periodEnd', v_end,
    'totalPurchased', t.total_purchased, 'invoiceCount', t.invoice_count,
    'supplierCount', t.supplier_count,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'invoiceNumber',p.invoice_number,'issueDate',p.issue_date,
      'supplier',p.supplier,'cfop',p.cfop,'status',p.status,'totalValue',p.total_value
    ) order by p.issue_date desc,p.total_value desc) from page p), '[]'::jsonb)
  ) into v_result from totals t;
  return v_result;
end
$$;

revoke all on function public.ghost_product_invoices_v1(uuid,date,integer) from public, anon;
grant execute on function public.ghost_product_invoices_v1(uuid,date,integer) to authenticated;

comment on function public.ghost_dashboard_v2(uuid,date) is 'Authorized monthly revenue dashboard with detailed revenue indicators.';
comment on function public.ghost_product_invoices_v1(uuid,date,integer) is 'Authorized product invoice list scoped by unit and month.';
