-- Executive dashboard read model for Ghost. Revenue is calculated per shift
-- with the same reconciliation fallback used by the assistant: a reconciled
-- payment wins; otherwise the imported gross/forecast value remains visible
-- and is explicitly marked provisional.

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
  v_end date := least(
    (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month - 1 day')::date,
    current_date
  );
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
      max(p.criado_em) updated_at
    from public.lorean_pagamentos p
    group by p.workday_id_fk
  ), daily as (
    select w.data business_date,
      sum(coalesce(p.closed_revenue, w.receita_bruta, w.previsto)) revenue,
      bool_or(p.closed_revenue is null or w.receita_liquida is null) provisional,
      max(greatest(coalesce(p.updated_at, '-infinity'::timestamptz), coalesce(w.criado_em, '-infinity'::timestamptz))) updated_at
    from public.lorean_workdays w
    left join payment_by_shift p on p.workday_id_fk = w.id
    where w.unit_id = p_unit_id and w.data between v_start and v_end
    group by w.data
  ), series as (
    select d.business_date,
      x.revenue,
      coalesce(x.provisional, false) provisional,
      coalesce(
        (select o.meta from public.metas_dia_override o
          where o.unit_id = p_unit_id and o.data = d.business_date),
        (select s.meta from public.metas_dia_semana s
          where s.unit_id = p_unit_id
            and s.competencia = to_char(d.business_date, 'YYYY-MM')
            and s.dia_semana = extract(dow from d.business_date)::integer)
      ) goal,
      x.updated_at
    from days d
    left join daily x on x.business_date = d.business_date
  ), totals as (
    select
      sum(revenue) revenue,
      case when count(goal) = 0 then null else sum(goal) end goal,
      bool_or(provisional and revenue is not null) provisional,
      max(updated_at) updated_at
    from series
  )
  select jsonb_build_object(
    'updatedAt', coalesce(t.updated_at, now()),
    'periodStart', v_start,
    'periodEnd', v_end,
    'revenue', t.revenue,
    'goal', t.goal,
    'goalProgress', case when t.revenue is not null and t.goal > 0 then t.revenue / t.goal else null end,
    'hasData', t.revenue is not null,
    'provisional', coalesce(t.provisional, false),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', s.business_date,
        'revenue', s.revenue,
        'goal', s.goal,
        'provisional', s.provisional
      ) order by s.business_date)
      from series s
    ), '[]'::jsonb)
  ) into v_result
  from totals t;

  return v_result;
end
$$;

revoke all on function public.ghost_dashboard_v2(uuid,date) from public, anon;
grant execute on function public.ghost_dashboard_v2(uuid,date) to authenticated;

comment on function public.ghost_dashboard_v2(uuid,date) is
  'Authorized month-to-date dashboard with daily revenue series and explicit reconciliation status.';
