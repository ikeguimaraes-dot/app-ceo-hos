-- Pure server aggregation regression; not a substitute for real Auth/HTTP tests.
do $$
declare result jsonb; days jsonb;
begin
 days:='[
 {"unitName":"A","date":"2026-10-05","revenue":100,"restaurantRevenue":80,"eventsRevenue":20,"goal":100,"customers":2,"provisional":false,"shifts":[]},
 {"unitName":"B","date":"2026-10-05","revenue":200,"restaurantRevenue":200,"eventsRevenue":0,"goal":200,"customers":4,"provisional":false,"shifts":[]},
 {"unitName":"A","date":"2026-10-12","revenue":0,"restaurantRevenue":0,"eventsRevenue":0,"goal":100,"customers":0,"provisional":false,"shifts":[]},
 {"unitName":"B","date":"2026-10-12","revenue":0,"restaurantRevenue":0,"eventsRevenue":0,"goal":200,"customers":0,"provisional":false,"shifts":[]},
 {"unitName":"A","date":"2026-10-19","revenue":900,"restaurantRevenue":900,"eventsRevenue":0,"goal":100,"customers":4,"provisional":false,"shifts":[]},
 {"unitName":"B","date":"2026-10-19","revenue":null,"restaurantRevenue":null,"eventsRevenue":null,"goal":null,"customers":null,"provisional":false,"shifts":[]}
 ]';
 result:=ghost_private.assistant_finance_aggregate_v1(days,'["A","B"]','2026-10-05','2026-10-19','weekday',100,1000);
 assert jsonb_array_length(result->'rows')=7,'return all seven weekdays';
 assert (result#>>'{rows,0,averageRevenue}')::numeric=150,'average complete daily group totals, including registered zero';
 assert (result#>>'{rows,0,sampleDays}')::int=2,'incomplete group day excluded';
 assert (result#>>'{rows,0,excludedDays}')::int=1,'missing day disclosed';
 assert result#>'{rows,1,averageRevenue}'='null'::jsonb,'no Tuesday evidence is unknown, not zero';
 assert result#>'{summary,goal}'='null'::jsonb,'missing goal must not silently become a partial group goal';
 assert (result#>>'{summary,reportedRevenue}')::numeric=1200,'known revenue retained separately from complete-day averages';
 assert (result#>>'{summary,monthGoalProgressPct}')::numeric=120,'full-month denominator and percentage points';
 result:=ghost_private.assistant_finance_aggregate_v1(days,'["A","B"]','2026-10-05','2026-10-19','day',1,null);
 assert (result->>'truncated')::boolean,'paging disclosed';
 assert (result->>'totalRows')::int=3,'total count not page size';
 assert (result#>>'{summary,reportedRevenue}')::numeric=1200,'summary independent of paging';
 result:=ghost_private.assistant_finance_aggregate_v1('[{"unitName":"A","date":"2026-10-05","revenue":10,"restaurantRevenue":10,"eventsRevenue":0,"goal":100,"shifts":[]}]','["A"]','2026-10-05','2026-10-05','unit',100,1000);
 assert result#>>'{rows,0,goalPosition}'='below','deficit direction explicit';
 assert (result#>>'{rows,0,absoluteDifference}')::numeric=90,'deficit magnitude computed by server';
 assert (result#>>'{rows,0,absoluteGoalDeviationPct}')::numeric=90,'negative deviation may be written as a positive shortfall';
 assert not has_function_privilege('authenticated','ghost_private.assistant_finance_aggregate_v1(jsonb,jsonb,date,date,text,integer,numeric)','execute'),'composer private';
 assert not has_function_privilege('anon','public.ghost_assistant_finance_analysis_v1(date,date,text,text,boolean,integer)','execute'),'anonymous denied';
 assert not has_function_privilege('anon','public.ghost_assistant_compare_v1(text,date,date,date,date,text,text,boolean)','execute'),'anonymous comparison denied';
end $$;
-- Authorization logic with an existing restricted role, inside rollback.
-- This verifies SQL guards, not a real mobile partner login.
begin;
do $$
declare partner uuid;
begin
 select ur.user_id into partner from public.user_roles ur join public.roles r on r.id=ur.role_id
 where lower(r.name)='socio_readonly' limit 1;
 if partner is null then raise exception 'restricted test role missing'; end if;
 perform set_config('request.jwt.claim.sub',partner::text,true);
 begin
   perform public.ghost_assistant_finance_analysis_v1('2026-10-01','2026-10-31');
   raise exception 'restricted role reached finance analysis';
 exception when insufficient_privilege then null; end;
 begin
   perform public.ghost_assistant_compare_v1('financeiro','2026-10-01','2026-10-31','2026-09-01','2026-09-30');
   raise exception 'restricted role reached comparison';
 exception when insufficient_privilege then null; end;
 begin
   perform public.ghost_assistant_coverage_v1('financeiro');
   raise exception 'restricted role reached coverage';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
