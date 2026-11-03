-- Additive contract: older clients continue to use v3 unchanged.
create or replace function public.ghost_events_authorize_v1(p_unit_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
  if not ghost_private.user_has_capability(auth.uid(),p_unit_id,'dashboard.read') then
    raise insufficient_privilege using message='unit_capability_denied';
  end if;
  return jsonb_build_object('unitId',p_unit_id);
end $$;
revoke all on function public.ghost_events_authorize_v1(uuid) from public,anon;
grant execute on function public.ghost_events_authorize_v1(uuid) to authenticated;

-- Pure server-side composition; never exposed through the Data API.
create or replace function ghost_private.dashboard_with_events_v1(p_base jsonb,p_events jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_series jsonb := '[]'; v_point jsonb; v_event numeric; v_revenue numeric;
  v_total numeric; v_event_total numeric := 0; v_days integer := 0;
  v_as_of date := (p_base #>> '{portfolioSnapshot,asOf}')::date;
  v_acc_events numeric := 0; v_acc_revenue numeric; v_goal numeric;
  v_month_end date := (date_trunc('month',(p_base->>'periodStart')::date)+interval '1 month - 1 day')::date;
  v_snapshot jsonb := p_base->'portfolioSnapshot';
begin
  if jsonb_typeof(p_events) is distinct from 'array' then
    raise invalid_parameter_value using message='invalid_events_response';
  end if;
  -- Reject malformed, out-of-period, duplicate or negative source values.
  if exists(select 1 from jsonb_array_elements(p_events) e
      where jsonb_typeof(e->'date') is distinct from 'string'
        or (e->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
        or jsonb_typeof(e->'revenue') is distinct from 'number'
        or (e->>'revenue')::numeric < 0
        or (e->>'date')::date not between (p_base->>'periodStart')::date and (p_base->>'periodEnd')::date)
    or exists(select 1 from jsonb_array_elements(p_events) e group by e->>'date' having count(*)>1) then
    raise invalid_parameter_value using message='invalid_events_response';
  end if;
  for v_point in select value from jsonb_array_elements(p_base->'series') loop
    select (e->>'revenue')::numeric into v_event
      from jsonb_array_elements(p_events) e where e->>'date'=v_point->>'date';
    v_revenue := (v_point->>'revenue')::numeric;
    if v_revenue is not null or v_event is not null then
      v_revenue := coalesce(v_revenue,0)+coalesce(v_event,0);
      v_total := coalesce(v_total,0)+v_revenue; v_days := v_days+1;
      v_point := v_point || jsonb_build_object('revenue',v_revenue,
        'shifts',coalesce(v_point->'shifts','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'id','events:'||(v_point->>'date'),'name','eventos','revenue',coalesce(v_event,0),
          'tips',0,'customers',null,'averageTicket',null,'derived',false)));
    end if;
    v_event_total := v_event_total+coalesce(v_event,0);
    if (v_point->>'date')::date<=v_as_of then v_acc_events:=v_acc_events+coalesce(v_event,0); end if;
    v_series := v_series || jsonb_build_array(v_point);
  end loop;
  if v_as_of is not null then
    v_acc_revenue := (v_snapshot->>'accumulatedRevenue')::numeric;
    if v_acc_revenue is not null or exists(select 1 from jsonb_array_elements(p_events) e where (e->>'date')::date<=v_as_of) then
      v_acc_revenue := coalesce(v_acc_revenue,0)+v_acc_events;
    end if;
    v_goal := (v_snapshot->>'accumulatedGoal')::numeric;
    v_snapshot := v_snapshot || jsonb_build_object('accumulatedRevenue',v_acc_revenue,
      'difference',v_acc_revenue-v_goal,
      'deviation',case when v_goal<>0 then (v_acc_revenue-v_goal)/v_goal else null end);
  end if;
  v_goal := (p_base->>'goal')::numeric;
  return p_base || jsonb_build_object('series',v_series,'revenue',v_total,'eventsRevenue',v_event_total,
    'hasData',v_total is not null,
    'grossRevenue',case when v_event_total=0 then (p_base->>'grossRevenue')::numeric
      when (p_base->>'grossRevenue') is null and (p_base->>'revenue') is not null then null
      else coalesce((p_base->>'grossRevenue')::numeric,0)+v_event_total end,
    'goalProgress',case when v_goal>0 then v_total/v_goal else null end,
    'projection',case when v_total is null then null when (p_base->>'periodEnd')::date=v_month_end then v_total
      when v_days>0 then v_total/v_days*extract(day from v_month_end) else null end,
    'portfolioSnapshot',v_snapshot);
end $$;
revoke all on function ghost_private.dashboard_with_events_v1(jsonb,jsonb) from public,anon,authenticated;

create or replace function public.ghost_dashboard_v4(p_unit_id uuid,p_month date default current_date)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_base jsonb; v_headers jsonb; v_auth text; v_response extensions.http_response; v_body jsonb;
begin
  -- Authorize before calling either source. v3 revalidates as well.
  perform public.ghost_events_authorize_v1(p_unit_id);
  v_base := public.ghost_dashboard_v3(p_unit_id,p_month);
  v_headers := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  v_auth := v_headers->>'authorization';
  if v_auth is null or v_auth not like 'Bearer %' then
    raise insufficient_privilege using message='authentication_required';
  end if;
  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','8000');
    select * into v_response from extensions.http((
      'POST','https://rpavxnjchfmeiacnumpk.supabase.co/functions/v1/ghost-events-revenue',
      array[extensions.http_header('Authorization',v_auth)],'application/json',
      jsonb_build_object('unitId',p_unit_id,'start',v_base->>'periodStart','end',v_base->>'periodEnd')::text
    )::extensions.http_request);
  exception when others then
    raise external_routine_exception using message='events_source_unavailable';
  end;
  if v_response.status in (401,403) then raise insufficient_privilege using message='unit_capability_denied'; end if;
  if v_response.status<>200 then raise external_routine_exception using message='events_source_unavailable'; end if;
  v_body := v_response.content::jsonb;
  if v_body->>'unitId' is distinct from p_unit_id::text
    or v_body->>'start' is distinct from v_base->>'periodStart'
    or v_body->>'end' is distinct from v_base->>'periodEnd' then
    raise external_routine_exception using message='invalid_events_response';
  end if;
  return ghost_private.dashboard_with_events_v1(v_base,v_body->'days');
end $$;
revoke all on function public.ghost_dashboard_v4(uuid,date) from public,anon;
grant execute on function public.ghost_dashboard_v4(uuid,date) to authenticated;
comment on function public.ghost_dashboard_v4(uuid,date) is
  'Authorized Lorean restaurant plus MISE events revenue, with daily event rows and consolidated totals. Event source outages fail explicitly.';
