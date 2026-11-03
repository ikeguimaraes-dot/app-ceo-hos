-- Server-side regression: pure composition only; no business tables modified.
begin;
do $$
declare
  base jsonb := jsonb_build_object('periodStart','2026-10-01','periodEnd','2026-10-31',
    'revenue',48225.4,'grossRevenue',48225.4,'netRevenue',45000,'averageTicket',309.14,
    'goal',100000,'portfolioSnapshot',jsonb_build_object('asOf','2026-10-31',
      'accumulatedRevenue',48225.4,'accumulatedGoal',100000),
    'series',jsonb_build_array(
      jsonb_build_object('date','2026-10-27','revenue',48225.4,'shifts',jsonb_build_array(
        jsonb_build_object('id','lunch','name','almoco','revenue',20253.06),
        jsonb_build_object('id','dinner','name','jantar','revenue',27972.34))),
      jsonb_build_object('date','2026-10-28','revenue',null,'shifts','[]'::jsonb)));
  result jsonb; rejected boolean;
begin
  result := ghost_private.dashboard_with_events_v1(base,'[{"date":"2026-10-27","revenue":26200}]');
  assert (result->>'revenue')::numeric=74425.4, 'monthly total must include events once';
  assert (result #>> '{series,0,revenue}')::numeric=74425.4, 'reference screenshot daily total';
  assert (result #>> '{series,0,shifts,0,revenue}')::numeric=20253.06, 'lunch is not inflated by events';
  assert (result #>> '{series,0,shifts,1,revenue}')::numeric=27972.34, 'dinner is not inflated by events';
  assert result #>> '{series,0,shifts,2,name}'='eventos', 'event row required';
  assert (result #>> '{series,0,shifts,2,revenue}')::numeric=26200, 'event row amount';
  assert (result #>> '{portfolioSnapshot,accumulatedRevenue}')::numeric=74425.4, 'home snapshot';
  assert (result #>> '{portfolioSnapshot,difference}')::numeric=-25574.6, 'snapshot target difference';
  assert (result->>'goalProgress')::numeric=.744254, 'target progress';
  assert result #>> '{series,1,revenue}' is null, 'absence must stay absence';
  assert (result->>'netRevenue')::numeric=45000, 'do not invent net event revenue';
  assert (result->>'averageTicket')::numeric=309.14, 'restaurant ticket stays restaurant-only';
  result := ghost_private.dashboard_with_events_v1(base,'[{"date":"2026-10-28","revenue":100}]');
  assert (result #>> '{series,1,revenue}')::numeric=100, 'events-only day is included';
  assert result #>> '{series,1,shifts,0,name}'='eventos', 'events-only detail';
  assert (result #>> '{series,0,shifts,2,revenue}')::numeric=0, 'restaurant day without events shows zero events';
  result := ghost_private.dashboard_with_events_v1(base,'[]');
  assert (result->>'revenue')::numeric=48225.4, 'no-events month remains unchanged';
  result := ghost_private.dashboard_with_events_v1(base,'[{"date":"2026-10-28","revenue":0}]');
  assert (result #>> '{series,1,revenue}')::numeric=0, 'legitimate zero event is data';
  rejected:=false;
  begin perform ghost_private.dashboard_with_events_v1(base,'[{"date":"2026-10-27","revenue":-1}]');
  exception when invalid_parameter_value then rejected:=true; end;
  assert rejected, 'negative source is rejected';
  rejected:=false;
  begin perform ghost_private.dashboard_with_events_v1(base,'[{"date":"2026-10-27","revenue":1},{"date":"2026-10-27","revenue":1}]');
  exception when invalid_parameter_value then rejected:=true; end;
  assert rejected, 'duplicate source day is rejected';
  rejected:=false;
  begin perform ghost_private.dashboard_with_events_v1(base,'[{"date":"2026-11-01","revenue":1}]');
  exception when invalid_parameter_value then rejected:=true; end;
  assert rejected, 'out-of-period event is rejected';
end $$;
rollback;
