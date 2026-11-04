-- User regression: 30,488.45 revenue / 524,000 monthly target = 5.82%, not 80%.
-- Pure composition; no writes to business data or identities.
do $$
declare base jsonb; result jsonb;
begin
  base:=jsonb_build_object('revenue',30488.45,'goal',38000,
    'goalProgress',0.8023276315789474,'eventsRevenue',0,
    'portfolioSnapshot',jsonb_build_object('asOf','2026-11-03','monthGoal',524000,
      'accumulatedRevenue',30488.45,'accumulatedGoal',25000,'difference',5488.45));
  result:=ghost_private.dashboard_month_progress_v1(base);
  assert round((result->>'monthGoalProgress')::numeric*100,2)=5.82,
    'full month denominator must be 524000';
  assert result-'monthGoalProgress'=base,'legacy fields and dated position must remain unchanged';

  result:=ghost_private.dashboard_month_progress_v1(jsonb_set(base,'{revenue}','0'));
  assert (result->>'monthGoalProgress')::numeric=0,'zero revenue is known attainment';
  result:=ghost_private.dashboard_month_progress_v1(jsonb_set(base,'{revenue}','null'));
  assert result->'monthGoalProgress'='null'::jsonb,'missing revenue is not zero';
  result:=ghost_private.dashboard_month_progress_v1(jsonb_set(base,'{portfolioSnapshot,monthGoal}','0'));
  assert result->'monthGoalProgress'='null'::jsonb,'zero goal must not divide';
  result:=ghost_private.dashboard_month_progress_v1(jsonb_set(base,'{portfolioSnapshot,monthGoal}','null'));
  assert result->'monthGoalProgress'='null'::jsonb,'unknown monthly target must remain unknown';
  result:=ghost_private.dashboard_month_progress_v1(jsonb_set(base,'{revenue}','600000'));
  assert (result->>'monthGoalProgress')::numeric>1,'attainment above 100 percent must be retained';
  assert not has_function_privilege('authenticated','ghost_private.dashboard_month_progress_v1(jsonb)','execute'),
    'monthly composer must remain private';
end $$;
