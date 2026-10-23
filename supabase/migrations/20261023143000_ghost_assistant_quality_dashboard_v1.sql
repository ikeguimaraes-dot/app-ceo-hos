-- Privacy-preserving quality dashboard. It exposes only the authenticated
-- user's metadata and never stores or returns prompts, answers or KPH rows.
create or replace function public.ghost_assistant_quality_v1(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if p_days not between 1 and 30 then
    raise invalid_parameter_value using message = 'invalid_quality_period';
  end if;

  with filtered as (
    select * from ghost_private.assistant_requests r
    where r.user_id = v_user_id
      and r.created_at >= now() - make_interval(days => p_days)
  ), totals as (
    select count(*)::integer total,
      count(*) filter (where status='success')::integer success,
      count(*) filter (where status='error')::integer errors,
      count(*) filter (where code='deterministic')::integer deterministic,
      count(*) filter (where helpful is true)::integer helpful,
      count(*) filter (where helpful is false)::integer unhelpful,
      count(helpful)::integer feedback_count,
      coalesce(round(avg(latency_ms)),0)::integer average_latency_ms
    from filtered
  ), models as (
    select coalesce(model,'não informado') model,
      count(*)::integer requests,
      count(*) filter (where status='success')::integer success,
      count(*) filter (where status='error')::integer errors,
      count(*) filter (where helpful is true)::integer helpful,
      count(helpful)::integer feedback_count,
      coalesce(round(avg(latency_ms)),0)::integer average_latency_ms
    from filtered group by coalesce(model,'não informado')
  ), datasets as (
    select d dataset,count(*)::integer requests
    from filtered f cross join lateral unnest(f.datasets) d
    group by d order by count(*) desc,d
  ), failures as (
    select code,count(*)::integer occurrences
    from filtered where status='error' group by code order by count(*) desc,code
  )
  select jsonb_build_object(
    'days',p_days,'totalRequests',t.total,'successfulRequests',t.success,
    'failedRequests',t.errors,'deterministicRequests',t.deterministic,
    'helpful',t.helpful,'unhelpful',t.unhelpful,'feedbackCount',t.feedback_count,
    'averageLatencyMs',t.average_latency_ms,
    'successRate',case when t.total>0 then round(t.success::numeric/t.total*100,1) else null end,
    'helpfulRate',case when t.feedback_count>0 then round(t.helpful::numeric/t.feedback_count*100,1) else null end,
    'byModel',coalesce((select jsonb_agg(jsonb_build_object(
      'modelId',m.model,'requests',m.requests,'successfulRequests',m.success,
      'failedRequests',m.errors,'helpful',m.helpful,'feedbackCount',m.feedback_count,
      'helpfulRate',case when m.feedback_count>0 then round(m.helpful::numeric/m.feedback_count*100,1) else null end,
      'averageLatencyMs',m.average_latency_ms
    ) order by m.requests desc,m.model) from models m),'[]'::jsonb),
    'byDataset',coalesce((select jsonb_agg(jsonb_build_object('dataset',d.dataset,'requests',d.requests)) from datasets d),'[]'::jsonb),
    'failures',coalesce((select jsonb_agg(jsonb_build_object('code',f.code,'occurrences',f.occurrences)) from failures f),'[]'::jsonb)
  ) into v_result from totals t;
  return v_result;
end
$$;

revoke all on function public.ghost_assistant_quality_v1(integer) from public, anon;
grant execute on function public.ghost_assistant_quality_v1(integer) to authenticated;
comment on function public.ghost_assistant_quality_v1(integer) is
  'Returns prompt-free assistant quality aggregates owned by the authenticated user.';
