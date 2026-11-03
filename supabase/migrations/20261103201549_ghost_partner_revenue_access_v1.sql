-- Separate revenue/targets from payables and restaurant operational metrics.
-- No identities or credentials belong in this schema migration.
alter table ghost_private.role_capabilities drop constraint ghost_role_capability_known;
alter table ghost_private.role_capabilities add constraint ghost_role_capability_known check (capability in (
  'dashboard.read','dashboard.details','payables.read','pending.read','operation.read',
  'people.read','notifications.read','maintenance.decide','punch.decide','assistant.ask'
));
-- Preserve existing full dashboard access, except the explicitly read-only partner role.
insert into ghost_private.role_capabilities(role_id,capability)
select rc.role_id,c.capability from ghost_private.role_capabilities rc
join public.roles r on r.id=rc.role_id
cross join (values ('payables.read'),('dashboard.details')) c(capability)
where rc.capability='dashboard.read' and lower(r.name)<>'socio_readonly'
on conflict do nothing;
delete from ghost_private.role_capabilities rc using public.roles r
where rc.role_id=r.id and lower(r.name)='socio_readonly' and rc.capability<>'dashboard.read';

-- Legacy bootstrap keeps its original capability vocabulary. The new version
-- includes the explicit permissions; accessVersion already hashes role capabilities.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.ghost_bootstrap_v1()'::regprocedure);
  execute replace(definition,'public.ghost_bootstrap_v1()','public.ghost_bootstrap_v2()');
  if position('where u.active is true' in definition)=0 then raise exception 'bootstrap_shape_changed'; end if;
  execute replace(definition,'where u.active is true',
    'where u.active is true and rc.capability not in (''payables.read'',''dashboard.details'')');
end $migration$;
revoke all on function public.ghost_bootstrap_v2() from public,anon;
grant execute on function public.ghost_bootstrap_v2() to authenticated;

-- Harden every still-callable finance version, including old installed clients.
do $migration$
declare f regprocedure; definition text;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname ~ '^ghost_(payables_v[1-3]|cash_flow_week_v[1-2])$'
  loop
    definition:=pg_get_functiondef(f);
    if position('''dashboard.read''' in definition)=0 then raise exception 'finance_guard_shape_changed: %',f; end if;
    execute replace(definition,'''dashboard.read''','''payables.read''');
  end loop;
end $migration$;

-- An allowlist, rather than subtracting known sensitive fields, prevents future
-- additions to full dashboards from accidentally entering the partner response.
create function ghost_private.dashboard_revenue_only_v1(p_data jsonb)
returns jsonb language sql immutable set search_path='' as $fn$
select jsonb_build_object(
  'updatedAt',p_data->'updatedAt','periodStart',p_data->'periodStart','periodEnd',p_data->'periodEnd',
  'revenue',p_data->'revenue','goal',p_data->'goal','goalProgress',p_data->'goalProgress',
  'hasData',p_data->'hasData','provisional',p_data->'provisional',
  'eventsRevenue',coalesce(p_data->'eventsRevenue','0'::jsonb),'projection',p_data->'projection',
  'grossRevenue',null,'netRevenue',null,'receivedRevenue',null,'discount',null,'tips',null,
  'customers',null,'averageTicket',null,
  'summary','Faturamento e metas das casas autorizadas.',
  'portfolioSnapshot',case when jsonb_typeof(p_data->'portfolioSnapshot')='object' then
    jsonb_build_object('asOf',p_data#>'{portfolioSnapshot,asOf}',
      'monthGoal',p_data#>'{portfolioSnapshot,monthGoal}',
      'accumulatedGoal',p_data#>'{portfolioSnapshot,accumulatedGoal}',
      'accumulatedRevenue',p_data#>'{portfolioSnapshot,accumulatedRevenue}',
      'difference',p_data#>'{portfolioSnapshot,difference}','deviation',p_data#>'{portfolioSnapshot,deviation}')
    else null end,
  'series',coalesce((select jsonb_agg(jsonb_build_object(
    'date',d->'date','revenue',d->'revenue','goal',d->'goal','provisional',d->'provisional',
    'received',null,'debt',null,'discount',null,'tips',null,'customers',null,'averageTicket',null,'cmvPercentage',null,
    'shifts',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s->'id','name',s->'name','revenue',s->'revenue','derived',s->'derived',
      'tips',null,'customers',null,'averageTicket',null) order by sn)
      from jsonb_array_elements(d->'shifts') with ordinality shifts(s,sn)), '[]'::jsonb)
    ) order by dn) from jsonb_array_elements(p_data->'series') with ordinality days(d,dn)), '[]'::jsonb)
)
$fn$;
revoke all on function ghost_private.dashboard_revenue_only_v1(jsonb) from public,anon,authenticated;

-- Keep the full implementation private and authorize/redact all public versions.
-- Internal chaining stays private so intermediate financial computations are unchanged.
do $migration$
declare v integer; j integer; definition text; volatility text;
begin
  for v in 1..4 loop
    definition:=pg_get_functiondef(to_regprocedure(format('public.ghost_dashboard_v%s(uuid,date)',v)));
    for j in 1..4 loop
      definition:=replace(definition,format('public.ghost_dashboard_v%s',j),format('ghost_private.dashboard_full_v%s',j));
    end loop;
    execute definition;
    execute format('revoke all on function ghost_private.dashboard_full_v%s(uuid,date) from public,anon,authenticated',v);
  end loop;
  for v in 1..4 loop
    volatility:=case when v=4 then 'volatile' else 'stable' end;
    execute format($wrapper$
      create or replace function public.ghost_dashboard_v%s(p_unit_id uuid,p_month date default current_date)
      returns jsonb language plpgsql %s security definer set search_path='' as $body$
      declare result jsonb;
      begin
        if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
        if not ghost_private.user_has_capability(auth.uid(),p_unit_id,'dashboard.read') then
          raise insufficient_privilege using message='unit_capability_denied';
        end if;
        result:=ghost_private.dashboard_full_v%s(p_unit_id,p_month);
        if not ghost_private.user_has_capability(auth.uid(),p_unit_id,'dashboard.details') then
          result:=ghost_private.dashboard_revenue_only_v1(result);
        end if;
        return result;
      end $body$;
    $wrapper$,v,volatility,v);
  end loop;
end $migration$;
