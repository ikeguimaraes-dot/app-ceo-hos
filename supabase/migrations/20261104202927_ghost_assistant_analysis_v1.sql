-- Read-only executive analysis. Reuse the dashboard's financial definitions,
-- goal inheritance and authenticated events source, rather than duplicating them.
create function ghost_private.assistant_finance_aggregate_v1(p_days jsonb,p_units jsonb,p_from date,p_to date,p_group_by text,p_limit integer,p_month_goal numeric)
returns jsonb language sql immutable security invoker set search_path='' as $fn$
with days as (
  select d->>'unitName' unit_name,(d->>'date')::date business_date,
    (d->>'revenue')::numeric revenue,(d->>'restaurantRevenue')::numeric restaurant_revenue,
    (d->>'eventsRevenue')::numeric events_revenue,(d->>'goal')::numeric goal,
    (d->>'customers')::numeric customers,(d->>'provisional')::boolean provisional,
    d->'shifts' shifts
  from jsonb_array_elements(p_days) d
), group_days as (
  select business_date,sum(revenue) revenue,sum(restaurant_revenue) restaurant_revenue,sum(events_revenue) events_revenue,
    count(revenue)::int reporting_units,count(*)::int selected_units,
    count(revenue)=jsonb_array_length(p_units) complete,
    case when count(goal)=count(*) then sum(goal) end goal,bool_or(provisional) provisional
  from days group by business_date
), weekdays as (
  select extract(isodow from business_date)::int weekday,
    count(*)::int calendar_days,count(*) filter(where complete)::int sample_days,
    count(*) filter(where not complete)::int excluded_days,
    round(avg(revenue) filter(where complete),2) average_revenue,
    sum(revenue) filter(where complete) total_revenue,
    round(avg(restaurant_revenue) filter(where complete),2) average_restaurant_revenue,
    round(avg(events_revenue) filter(where complete),2) average_events_revenue
  from group_days group by extract(isodow from business_date)
), by_unit as (
  select unit_name,sum(revenue) revenue,sum(restaurant_revenue) restaurant_revenue,
    sum(events_revenue) events_revenue,case when count(goal)=count(*) then sum(goal) end goal,sum(customers) customers,
    count(revenue)::int days_with_data,count(*)::int calendar_days,bool_or(provisional) provisional
  from days group by unit_name
), by_unit_weekday as (
  select unit_name,extract(isodow from business_date)::int weekday,
    round(avg(revenue),2) average_revenue,count(revenue)::int sample_days,count(*)-count(revenue) excluded_days
  from days group by unit_name,extract(isodow from business_date)
), by_month as (
  select to_char(business_date,'YYYY-MM') period_month,sum(revenue) revenue,case when count(goal)=count(*) then sum(goal) end goal,
    count(*) filter(where complete)::int complete_days,count(*)::int calendar_days
  from group_days group by to_char(business_date,'YYYY-MM')
), weekday_rows as (
  select jsonb_build_object('weekday',n,'label',(array['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'])[n],
    'averageRevenue',w.average_revenue,'totalRevenue',w.total_revenue,
    'averageRestaurantRevenue',w.average_restaurant_revenue,'averageEventsRevenue',w.average_events_revenue,
    'sampleDays',coalesce(w.sample_days,0),'calendarDays',coalesce(w.calendar_days,0),'excludedDays',coalesce(w.excluded_days,0)) value
  from generate_series(1,7) n left join weekdays w on w.weekday=n
), unit_rows as (
  select jsonb_build_object('unitName',unit_name,'reportedRevenue',revenue,'restaurantRevenue',restaurant_revenue,
    'eventsRevenue',events_revenue,'goal',goal,'difference',revenue-goal,
    'goalProgressPct',case when goal>0 then round(100*revenue/goal,2) end,
    'customers',customers,'averageTicket',case when customers>0 then round(restaurant_revenue/customers,2) end,
    'daysWithData',days_with_data,'calendarDays',calendar_days,'provisional',provisional) value
  from by_unit order by unit_name
), selected_rows as (
  select value from weekday_rows where p_group_by='weekday'
  union all select value from unit_rows where p_group_by='unit'
  union all select jsonb_build_object('date',business_date,'reportedRevenue',revenue,'reportingUnits',reporting_units,
    'selectedUnits',selected_units,'complete',complete,'goal',goal,'provisional',provisional)
    from group_days where p_group_by='day'
  union all select jsonb_build_object('month',period_month,'reportedRevenue',revenue,'goal',goal,
    'completeDays',complete_days,'calendarDays',calendar_days) from by_month where p_group_by='month'
), page as (select value from selected_rows order by (value->>'weekday')::int nulls last,value->>'date',value->>'month',value->>'unitName' limit p_limit)
select jsonb_build_object('dataset','financeiro','from',p_from,'to',p_to,'groupBy',p_group_by,
  'source','Mesmas regras de faturamento e metas da Home; eventos MISE quando incluídos.',
  'rowCount',(select count(*) from page),'totalRows',(select count(*) from selected_rows),
  'truncated',(select count(*) from selected_rows)>p_limit,
  'rows',coalesce((select jsonb_agg(value) from page),'[]'::jsonb),
  'summary',jsonb_build_object(
    'reportedRevenue',(select sum(revenue) from group_days),
    'restaurantRevenue',(select sum(restaurant_revenue) from group_days),'eventsRevenue',(select sum(events_revenue) from group_days),
    'goal',(select case when count(goal)=count(*) then sum(goal) end from group_days),'difference',(select case when count(goal)=count(*) then sum(revenue)-sum(goal) end from group_days),
    'goalProgressPct',(select case when count(goal)=count(*) and sum(goal)>0 then round(100*sum(revenue)/sum(goal),2) end from group_days),
    'monthGoal',p_month_goal,'monthGoalProgressPct',(select case when p_month_goal>0 then round(100*sum(revenue)/p_month_goal,2) end from group_days),
    'authorizedUnits',p_units,'authorizedUnitCount',jsonb_array_length(p_units),
    'completeWeeks',case when (p_to-p_from+1)%7=0 then (p_to-p_from+1)/7 end,'calendarDays',(select count(*) from group_days),'completeDays',(select count(*) from group_days where complete),
    'incompleteDays',(select count(*) from group_days where not complete),
    'firstDateWithData',(select min(business_date) from group_days where reporting_units>0),
    'lastDateWithData',(select max(business_date) from group_days where reporting_units>0),
    'provisional',coalesce((select bool_or(provisional) from group_days),false),
    'byUnit',coalesce((select jsonb_agg(value) from unit_rows),'[]'::jsonb),
    'byShift',coalesce((select jsonb_agg(jsonb_build_object('name',name,'revenue',revenue)) from (select s->>'name' name,sum((s->>'revenue')::numeric) revenue from days cross join lateral jsonb_array_elements(shifts) s group by s->>'name') t),'[]'::jsonb),
    'byWeekday',coalesce((select jsonb_agg(value) from weekday_rows),'[]'::jsonb),
    'byUnitWeekday',coalesce((select jsonb_agg(jsonb_build_object('unitName',unit_name,'weekday',weekday,
      'averageRevenue',average_revenue,'sampleDays',sample_days,'excludedDays',excluded_days) order by unit_name,weekday) from by_unit_weekday),'[]'::jsonb),
    'averagePolicy','Média do grupo = média dos totais diários apenas nas datas com receita conhecida em todas as casas selecionadas. Zero registrado é válido; ausência é excluída. Não somar médias individuais.'
  ))
$fn$;
revoke all on function ghost_private.assistant_finance_aggregate_v1(jsonb,jsonb,date,date,text,integer,numeric) from public,anon,authenticated;

create function public.ghost_assistant_finance_analysis_v1(
 p_from date,p_to date,p_unit text default null,p_group_by text default 'unit',p_include_events boolean default true,p_limit integer default 100)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare
 v_user uuid:=auth.uid(); v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
 v_unit record; v_month date; v_data jsonb; v_point jsonb; v_days jsonb:='[]'; v_units jsonb:='[]';
 v_month_goal numeric:=0; v_goal numeric; v_events numeric; v_shifts jsonb;
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
   for v_month in select d::date from generate_series(date_trunc('month',p_from),date_trunc('month',p_to),interval '1 month') d loop
     if p_include_events then v_data:=public.ghost_dashboard_v5(v_unit.id,v_month);
     else v_data:=public.ghost_dashboard_v3(v_unit.id,v_month); end if;
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

-- Compare database-computed metrics; neither the client nor the model calculates
-- financial deltas. Each underlying call independently validates scope.
create function public.ghost_assistant_compare_v1(p_dataset text,p_from date,p_to date,p_baseline_from date,p_baseline_to date,p_unit text default null,p_search text default null,p_include_events boolean default true)
returns jsonb language plpgsql volatile security definer set search_path='' as $fn$
declare a jsonb; b jsonb; metrics jsonb:='[]'; by_unit jsonb:='[]'; metric text; av numeric; bv numeric; u jsonb; bu jsonb; key_name text;
begin
 if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
 if not exists(select 1 from public.units u where u.active and ghost_private.user_has_capability(auth.uid(),u.id,'assistant.ask')) then
   raise insufficient_privilege using message='assistant_capability_denied'; end if;
 if p_dataset is null or p_dataset not in ('financeiro','despesas') or p_from is null or p_to is null or p_baseline_from is null or p_baseline_to is null
   or p_from>p_to or p_baseline_from>p_baseline_to or p_to-p_from>122 or p_baseline_to-p_baseline_from>122 then
   raise invalid_parameter_value using message='invalid_assistant_comparison'; end if;
 if p_dataset='financeiro' then
   a:=public.ghost_assistant_finance_analysis_v1(p_from,p_to,p_unit,'unit',p_include_events,100);
   b:=public.ghost_assistant_finance_analysis_v1(p_baseline_from,p_baseline_to,p_unit,'unit',p_include_events,100);
 else
   a:=public.ghost_assistant_query_v4(p_dataset,p_from,p_to,p_unit,p_search,'month',1);
   b:=public.ghost_assistant_query_v4(p_dataset,p_baseline_from,p_baseline_to,p_unit,p_search,'month',1);
 end if;
 foreach metric in array case when p_dataset='financeiro' then array['reportedRevenue','restaurantRevenue','eventsRevenue','goal','difference'] else array['totalValue','expenseCount'] end loop
   av:=(a#>>array['summary',metric])::numeric; bv:=(b#>>array['summary',metric])::numeric;
   metrics:=metrics||jsonb_build_array(jsonb_build_object('metric',metric,'current',av,'baseline',bv,'difference',av-bv,
     'changePct',case when bv<>0 then round(100*(av-bv)/abs(bv),2) end));
 end loop;
 key_name:=case when p_dataset='financeiro' then 'reportedRevenue' else 'totalValue' end;
 for u in select value from jsonb_array_elements(a#>'{summary,byUnit}') loop
   select value into bu from jsonb_array_elements(b#>'{summary,byUnit}') where value->>'unitName'=u->>'unitName';
   av:=(u->>key_name)::numeric; bv:=(bu->>key_name)::numeric;
   by_unit:=by_unit||jsonb_build_array(jsonb_build_object('unitName',u->>'unitName','metric',key_name,'current',av,'baseline',bv,
     'difference',av-bv,'changePct',case when bv<>0 then round(100*(av-bv)/abs(bv),2) end));
 end loop;
 return jsonb_build_object('dataset',p_dataset,'from',p_from,'to',p_to,'baselineFrom',p_baseline_from,'baselineTo',p_baseline_to,
   'current',a->'summary','baseline',b->'summary','metrics',metrics,'byUnit',by_unit,
   'sameDuration',p_to-p_from=p_baseline_to-p_baseline_from,'updatedAt',now());
end $fn$;
revoke all on function public.ghost_assistant_compare_v1(text,date,date,date,date,text,text,boolean) from public,anon;
grant execute on function public.ghost_assistant_compare_v1(text,date,date,date,date,text,text,boolean) to authenticated;
