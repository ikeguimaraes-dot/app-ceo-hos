-- Adds the month goal and the accumulated position through yesterday to the
-- dashboard contract used by the home portfolio. The existing dashboard v2
-- remains available for older clients.

create or replace function public.ghost_dashboard_v3(
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
  v_start date := date_trunc('month',coalesce(p_month,current_date))::date;
  v_month_end date := (date_trunc('month',coalesce(p_month,current_date)) + interval '1 month - 1 day')::date;
  v_as_of date := least(v_month_end,current_date - 1);
  v_base jsonb;
  v_month_goal numeric;
  v_accumulated_goal numeric;
  v_accumulated_revenue numeric;
  v_difference numeric;
  v_deviation numeric;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_has_capability(v_user_id,p_unit_id,'dashboard.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if v_start > current_date then
    raise invalid_parameter_value using message = 'invalid_dashboard_month';
  end if;

  v_base := public.ghost_dashboard_v2(p_unit_id,p_month);

  with month_days as (
    select generate_series(v_start,v_month_end,interval '1 day')::date business_date
  ), goals as (
    select d.business_date,
      coalesce(
        (select o.meta from public.metas_dia_override o
          where o.unit_id=p_unit_id and o.data=d.business_date),
        (select s.meta from public.metas_dia_semana s
          where s.unit_id=p_unit_id
            and s.competencia=to_char(d.business_date,'YYYY-MM')
            and s.dia_semana=extract(dow from d.business_date)::integer)
      )::numeric goal
    from month_days d
  )
  select
    case when count(goal)=0 then null else sum(goal) end,
    case when count(goal) filter(where business_date<=v_as_of)=0 then null
      else sum(goal) filter(where business_date<=v_as_of) end
  into v_month_goal,v_accumulated_goal
  from goals;

  if v_as_of >= v_start then
    select sum(coalesce(w.receita_bruta,w.previsto))::numeric
    into v_accumulated_revenue
    from public.lorean_workdays w
    where w.unit_id=p_unit_id and w.data between v_start and v_as_of;
  end if;

  if v_accumulated_revenue is not null and v_accumulated_goal is not null then
    v_difference := v_accumulated_revenue-v_accumulated_goal;
    if v_accumulated_goal<>0 then
      v_deviation := v_difference/v_accumulated_goal;
    end if;
  end if;

  return v_base || jsonb_build_object(
    'portfolioSnapshot',jsonb_build_object(
      'asOf',case when v_as_of>=v_start then v_as_of else null end,
      'monthGoal',v_month_goal,
      'accumulatedGoal',v_accumulated_goal,
      'accumulatedRevenue',v_accumulated_revenue,
      'difference',v_difference,
      'deviation',v_deviation
    )
  );
end
$$;

revoke all on function public.ghost_dashboard_v3(uuid,date) from public,anon;
grant execute on function public.ghost_dashboard_v3(uuid,date) to authenticated;

comment on function public.ghost_dashboard_v3(uuid,date) is
  'Authorized dashboard with month goal and accumulated revenue position through yesterday for the portfolio home.';
