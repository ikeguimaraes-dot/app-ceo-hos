-- Quality telemetry, explicit user feedback and database-computed financial
-- summaries for Ghost IA. Prompts, answers and business rows remain unstored.

alter table ghost_private.assistant_requests
  add column if not exists datasets text[] not null default '{}',
  add column if not exists tool_call_count integer not null default 0,
  add column if not exists validation_attempts integer not null default 0,
  add column if not exists latency_ms integer not null default 0,
  add column if not exists helpful boolean,
  add column if not exists feedback_at timestamptz;

alter table ghost_private.assistant_requests
  drop constraint if exists ghost_assistant_quality_metrics;
alter table ghost_private.assistant_requests
  add constraint ghost_assistant_quality_metrics check (
    tool_call_count between 0 and 20
    and validation_attempts between 0 and 3
    and latency_ms between 0 and 120000
    and cardinality(datasets) <= 23
  );

create or replace function public.ghost_assistant_finish_v2(
  p_request_id uuid,
  p_outcome text,
  p_code text,
  p_model text,
  p_prompt_tokens integer default 0,
  p_completion_tokens integer default 0,
  p_datasets text[] default '{}',
  p_tool_call_count integer default 0,
  p_validation_attempts integer default 0,
  p_latency_ms integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if cardinality(coalesce(p_datasets,'{}')) > 23
    or p_tool_call_count not between 0 and 20
    or p_validation_attempts not between 0 and 3
    or p_latency_ms not between 0 and 120000
    or exists (
      select 1 from unnest(coalesce(p_datasets,'{}')) d
      where d !~ '^[a-z][a-z0-9_]{0,63}$'
    ) then
    raise invalid_parameter_value using message = 'invalid_assistant_quality_metrics';
  end if;

  v_result := public.ghost_assistant_finish_v1(
    p_request_id,p_outcome,p_code,p_model,p_prompt_tokens,p_completion_tokens
  );

  update ghost_private.assistant_requests r
  set datasets = coalesce(p_datasets,'{}'),
      tool_call_count = p_tool_call_count,
      validation_attempts = p_validation_attempts,
      latency_ms = p_latency_ms
  where r.request_id = p_request_id and r.user_id = v_user_id;
  return v_result;
end
$$;

create or replace function public.ghost_assistant_feedback_v1(
  p_request_id uuid,
  p_helpful boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if p_request_id is null or p_helpful is null then
    raise invalid_parameter_value using message = 'invalid_assistant_feedback';
  end if;

  update ghost_private.assistant_requests r
  set helpful = p_helpful, feedback_at = now()
  where r.request_id = p_request_id
    and r.user_id = v_user_id
    and r.status = 'success'
    and r.created_at > now() - interval '30 days';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise invalid_parameter_value using message = 'assistant_request_not_found';
  end if;
  return jsonb_build_object('ok',true);
end
$$;

create or replace function public.ghost_assistant_query_v2(
  p_dataset text,
  p_from date default null,
  p_to date default null,
  p_unit text default null,
  p_search text default null,
  p_grain text default 'day',
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_summary jsonb;
begin
  v_result := public.ghost_assistant_query_v1(
    p_dataset,p_from,p_to,p_unit,p_search,p_grain,p_limit
  );
  if p_dataset <> 'financeiro' then return v_result; end if;

  with rows as (
    select * from jsonb_to_recordset(coalesce(v_result->'rows','[]'::jsonb)) as x(
      "unitName" text,
      "reportedRevenue" numeric,
      "closedRevenue" numeric,
      "receivedRevenue" numeric,
      "grossRevenue" numeric,
      "netRevenue" numeric,
      discount numeric,
      tips numeric,
      cost numeric,
      profit numeric,
      customers numeric,
      goal numeric,
      provisional boolean
    )
  ), by_unit as (
    select "unitName" unit_name,
      coalesce(sum("reportedRevenue"),0) revenue,
      coalesce(sum(goal),0) goal,
      coalesce(sum(customers),0) customers,
      bool_or(coalesce(provisional,false)) provisional
    from rows group by "unitName"
  )
  select jsonb_build_object(
    'reportedRevenue',coalesce(sum(revenue),0),
    'goal',coalesce(sum(goal),0),
    'goalProgress',case when sum(goal)>0 then round(sum(revenue)/sum(goal)*100,2) end,
    'customers',coalesce(sum(customers),0),
    'averageTicket',case when sum(customers)>0 then round(sum(revenue)/sum(customers),2) end,
    'provisional',bool_or(provisional),
    'byUnit',coalesce(jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'reportedRevenue',revenue,'goal',goal,
      'goalProgress',case when goal>0 then round(revenue/goal*100,2) end,
      'customers',customers,
      'averageTicket',case when customers>0 then round(revenue/customers,2) end,
      'provisional',provisional
    ) order by unit_name),'[]'::jsonb)
  ) into v_summary from by_unit;

  return jsonb_set(v_result,'{summary}',coalesce(v_summary,'{}'::jsonb),true);
end
$$;

revoke all on function public.ghost_assistant_finish_v2(uuid,text,text,text,integer,integer,text[],integer,integer,integer) from public, anon;
revoke all on function public.ghost_assistant_feedback_v1(uuid,boolean) from public, anon;
revoke all on function public.ghost_assistant_query_v2(text,date,date,text,text,text,integer) from public, anon;
grant execute on function public.ghost_assistant_finish_v2(uuid,text,text,text,integer,integer,text[],integer,integer,integer) to authenticated;
grant execute on function public.ghost_assistant_feedback_v1(uuid,boolean) to authenticated;
grant execute on function public.ghost_assistant_query_v2(text,date,date,text,text,text,integer) to authenticated;

comment on function public.ghost_assistant_feedback_v1(uuid,boolean) is
  'Stores explicit helpful/not-helpful feedback for an assistant request owned by the authenticated user.';
comment on function public.ghost_assistant_query_v2(text,date,date,text,text,text,integer) is
  'Adds database-computed financial totals and ratios to the authorized Ghost assistant semantic query.';
