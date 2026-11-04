create or replace function public.ghost_assistant_finance_analysis_v1(
 p_from date,p_to date,p_unit text default null,p_group_by text default 'unit',p_include_events boolean default true,p_limit integer default 100)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 v_user uuid:=auth.uid(); v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
 v_unit record; v_month date; v_data jsonb; v_point jsonb; v_days jsonb:='[]'; v_units jsonb:='[]';
 v_month_goal numeric:=0; v_goal numeric; v_events numeric; v_shifts jsonb; v_event_days jsonb; v_auth text; v_response extensions.http_response; v_body jsonb;
begin
 if v_user is null then raise insufficient_privilege using message='authentication_required'; end if;
 if not exists(select 1 from public.units u where u.active and ghost_private.user_has_capability(v_user,u.id,'assistant.ask')) then
   raise insufficient_privilege using message='assistant_capability_denied'; end if;
 if p_from is null or p_to is null or p_from>p_to or p_from<date '2000-01-01' or p_to>=v_today
   or p_to-p_from>122 or p_group_by is null or p_group_by not in ('unit','day','weekday','month')
   or p_limit is null or p_limit not between 1 and 200 or p_include_events is null or length(coalesce(p_unit,''))>120 then
   raise invalid_parameter_value using message='invalid_assistant_analysis'; end if;
 for v_unit in select u.id,u.name from public.units u join public.brands b on b.id=u.brand_id join public.groups g on g.id=b.group_id
   where u.active and ghost_private.user_has_capability(v_user,u.id,'assistant.ask')
   and ghost_private.user_has_capability(v_user,u.id,'dashboard.read')
   and (p_unit is null or lower(public.unaccent(concat_ws(' ',u.name,b.name,g.name))) like '%'||lower(public.unaccent(p_unit))||'%') order by u.name
 loop
   v_units:=v_units||jsonb_build_array(v_unit.name);
   if jsonb_array_length(v_units)>20 then raise invalid_parameter_value using message='portfolio_too_large'; end if;
   -- One bounded events request per house, instead of one per house/month.
   v_event_days:='[]';
   if p_include_events then
     v_auth:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'authorization';
     if v_auth is null or v_auth not like 'Bearer %' then raise insufficient_privilege using message='authentication_required'; end if;
     begin
       perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','8000');
       select * into v_response from extensions.http((
         'POST','https://rpavxnjchfmeiacnumpk.supabase.co/functions/v1/ghost-events-revenue',
         array[extensions.http_header('Authorization',v_auth)],'application/json',
         jsonb_build_object('unitId',v_unit.id,'start',p_from,'end',p_to)::text
       )::extensions.http_request);
     exception when others then raise external_routine_exception using message='events_source_unavailable'; end;
     if v_response.status in (401,403) then raise insufficient_privilege using message='unit_capability_denied'; end if;
     if v_response.status<>200 then raise external_routine_exception using message='events_source_unavailable'; end if;
     v_body:=v_response.content::jsonb;
     if v_body->>'unitId' is distinct from v_unit.id::text or v_body->>'start' is distinct from p_from::text or v_body->>'end' is distinct from p_to::text
       or jsonb_typeof(v_body->'days') is distinct from 'array' then raise external_routine_exception using message='invalid_events_response'; end if;
     v_event_days:=v_body->'days';
     if exists(select 1 from jsonb_array_elements(v_event_days) e where jsonb_typeof(e->'revenue') is distinct from 'number'
       or (e->>'revenue')::numeric<0 or (e->>'date')::date not between p_from and p_to)
       or exists(select 1 from jsonb_array_elements(v_event_days) e group by e->>'date' having count(*)>1) then
       raise external_routine_exception using message='invalid_events_response'; end if;
   end if;
   for v_month in select d::date from generate_series(date_trunc('month',p_from),date_trunc('month',p_to),interval '1 month') d loop
     v_data:=public.ghost_dashboard_v3(v_unit.id,v_month);
     if p_include_events then
       select coalesce(jsonb_agg(e),'[]') into v_body from jsonb_array_elements(v_event_days) e
         where (e->>'date')::date between (v_data->>'periodStart')::date and (v_data->>'periodEnd')::date;
       v_data:=ghost_private.dashboard_with_events_v1(v_data,v_body);
     end if;
     if date_trunc('month',p_from)=date_trunc('month',p_to) then
       v_goal:=(v_data#>>'{portfolioSnapshot,monthGoal}')::numeric;
       v_month_goal:=v_month_goal+v_goal;
     end if;
     for v_point in select value from jsonb_array_elements(v_data->'series') where (value->>'date')::date between p_from and p_to loop
       select coalesce(sum((s->>'revenue')::numeric),0) into v_events from jsonb_array_elements(v_point->'shifts') s where s->>'name'='eventos';
       select coalesce(jsonb_agg(jsonb_build_object('name',s->'name','revenue',s->'revenue')),'[]') into v_shifts from jsonb_array_elements(v_point->'shifts') s;
       v_days:=v_days||jsonb_build_array(jsonb_build_object('unitName',v_unit.name,'date',v_point->'date',
         'revenue',v_point->'revenue','restaurantRevenue',(v_point->>'revenue')::numeric-v_events,
         'eventsRevenue',case when v_point->>'revenue' is not null then v_events end,
         'goal',v_point->'goal','customers',v_point->'customers','provisional',v_point->'provisional','shifts',v_shifts));
     end loop;
   end loop;
 end loop;
 if jsonb_array_length(v_units)=0 then raise insufficient_privilege using message='unit_capability_denied'; end if;
 return ghost_private.assistant_finance_aggregate_v1(v_days,v_units,p_from,p_to,p_group_by,p_limit,
   case when date_trunc('month',p_from)=date_trunc('month',p_to) then v_month_goal end)
   ||jsonb_build_object('includesEvents',p_include_events,'updatedAt',now());
end $fn$;
revoke all on function public.ghost_assistant_finance_analysis_v1(date,date,text,text,boolean,integer) from public,anon;
grant execute on function public.ghost_assistant_finance_analysis_v1(date,date,text,text,boolean,integer) to authenticated;


-- Correct an overescaped legacy month regex that excluded valid DRE records.
do $migration$
declare definition text; updated text;
begin
 definition:=pg_get_functiondef('public.ghost_assistant_query_v4(text,date,date,text,text,text,integer)'::regprocedure);
 updated:=regexp_replace(definition,'d[.]mes_ano ~ [^\n]+','d.mes_ano ~ ''^[0-9]{4}-[0-9]{1,2}$''','g');
 if updated=definition then raise exception 'dre_month_predicate_shape_changed'; end if;
 execute updated;
end $migration$;
