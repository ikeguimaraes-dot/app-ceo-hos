-- Explicit monthly attainment. Legacy goalProgress remains a period-to-date
-- measure for older clients; do not silently change its denominator.
create function ghost_private.dashboard_month_progress_v1(p_dashboard jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $fn$
  select p_dashboard || jsonb_build_object('monthGoalProgress',
    case when (p_dashboard#>>'{portfolioSnapshot,monthGoal}')::numeric>0
      and (p_dashboard->>'revenue')::numeric is not null
    then (p_dashboard->>'revenue')::numeric /
      (p_dashboard#>>'{portfolioSnapshot,monthGoal}')::numeric
    else null end)
$fn$;
revoke all on function ghost_private.dashboard_month_progress_v1(jsonb) from public,anon,authenticated;

create function public.ghost_dashboard_v5(p_unit_id uuid,p_month date default current_date)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
begin
  if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
  if not ghost_private.user_has_capability(auth.uid(),p_unit_id,'dashboard.read') then
    raise insufficient_privilege using message='unit_capability_denied';
  end if;
  -- v4 revalidates access, includes event revenue, and minimizes partner data.
  return ghost_private.dashboard_month_progress_v1(public.ghost_dashboard_v4(p_unit_id,p_month));
end $fn$;
revoke all on function public.ghost_dashboard_v5(uuid,date) from public,anon;
grant execute on function public.ghost_dashboard_v5(uuid,date) to authenticated;
comment on function public.ghost_dashboard_v5(uuid,date) is
  'Authorized dashboard with explicit full-month attainment; accumulated position retains its own as-of date.';
