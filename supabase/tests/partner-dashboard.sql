-- Pure minimization regression: no writes, no identities, no external calls.
do $$
declare source jsonb; result jsonb;
begin
  source:='{"updatedAt":"2026-11-03T12:00:00Z","periodStart":"2026-10-01","periodEnd":"2026-10-31","revenue":74425.40,"goal":40000,"goalProgress":1.86,"hasData":true,"provisional":false,"eventsRevenue":26200,"projection":74425.40,"grossRevenue":80000,"netRevenue":70000,"receivedRevenue":71000,"discount":111,"tips":222,"customers":156,"averageTicket":309,"futureSensitiveField":"hidden","portfolioSnapshot":{"asOf":"2026-10-31","monthGoal":100000,"accumulatedGoal":90000,"accumulatedRevenue":74425.40,"difference":-15574.60,"deviation":-0.17,"private":"hidden"},"series":[{"date":"2026-10-27","revenue":74425.40,"goal":40000,"provisional":false,"received":1,"debt":2,"discount":3,"tips":4,"customers":5,"averageTicket":6,"cmvPercentage":7,"private":"hidden","shifts":[{"id":"event","name":"eventos","revenue":26200,"derived":false,"tips":99,"customers":100,"averageTicket":9,"private":"hidden"}]}]}';
  result:=ghost_private.dashboard_revenue_only_v1(source);
  if result->'revenue'<>source->'revenue' or result->'goal'<>source->'goal'
    or result->'eventsRevenue'<>source->'eventsRevenue'
    or result#>'{series,0,shifts,0,revenue}'<>'26200'::jsonb
    or result#>'{portfolioSnapshot,accumulatedRevenue}'<>source#>'{portfolioSnapshot,accumulatedRevenue}' then
    raise exception 'partner_revenue_or_goals_changed';
  end if;
  if result::text like '%hidden%' or result->'tips'<>'null'::jsonb
    or result#>'{series,0,debt}'<>'null'::jsonb
    or result#>'{series,0,cmvPercentage}'<>'null'::jsonb
    or result#>'{series,0,shifts,0,tips}'<>'null'::jsonb then
    raise exception 'partner_sensitive_field_leak';
  end if;
  if has_function_privilege('authenticated','ghost_private.dashboard_revenue_only_v1(jsonb)','execute')
    or has_function_privilege('authenticated','ghost_private.dashboard_full_v4(uuid,date)','execute') then
    raise exception 'private_dashboard_exposed';
  end if;
end $$;
