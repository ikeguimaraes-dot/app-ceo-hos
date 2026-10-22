-- Ghost executive assistant: capability-gated, read-only and auditable without
-- storing prompts, answers or business context.

alter table ghost_private.role_capabilities
  drop constraint if exists ghost_role_capability_known;
alter table ghost_private.role_capabilities
  add constraint ghost_role_capability_known check (capability in (
    'dashboard.read', 'pending.read', 'operation.read', 'people.read',
    'notifications.read', 'maintenance.decide', 'punch.decide',
    'assistant.ask'
  ));

insert into ghost_private.role_capabilities(role_id, capability)
select distinct rc.role_id, 'assistant.ask'
from ghost_private.role_capabilities rc
where rc.capability in (
  'dashboard.read', 'pending.read', 'operation.read', 'people.read'
)
on conflict do nothing;

create table if not exists ghost_private.assistant_requests (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  status text not null default 'started',
  code text not null default 'started',
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ghost_assistant_status check (status in ('started','success','error')),
  constraint ghost_assistant_code check (code ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint ghost_assistant_model check (model is null or length(model) between 1 and 120),
  constraint ghost_assistant_tokens check (
    prompt_tokens between 0 and 100000
    and completion_tokens between 0 and 10000
  )
);

create index if not exists ghost_assistant_user_created_idx
  on ghost_private.assistant_requests(user_id, created_at desc);

alter table ghost_private.assistant_requests enable row level security;
revoke all on ghost_private.assistant_requests from public, anon, authenticated;

create or replace function public.ghost_assistant_begin_v1(
  p_unit_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_user uuid;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if p_unit_id is null or p_request_id is null then
    raise invalid_parameter_value using message = 'invalid_assistant_request';
  end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'assistant.ask') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ghost-assistant:' || v_user_id::text, 0)
  );

  select r.user_id into v_existing_user
  from ghost_private.assistant_requests r
  where r.request_id = p_request_id;
  if found then
    if v_existing_user <> v_user_id then
      raise insufficient_privilege using message = 'assistant_request_denied';
    end if;
    return jsonb_build_object('requestId', p_request_id, 'replayed', true);
  end if;

  if (
    select count(*) from ghost_private.assistant_requests r
    where r.user_id = v_user_id and r.created_at > now() - interval '1 minute'
  ) >= 8 or (
    select count(*) from ghost_private.assistant_requests r
    where r.user_id = v_user_id and r.created_at > now() - interval '1 day'
  ) >= 100 then
    raise sqlstate 'PT429' using message = 'assistant_rate_limited';
  end if;

  delete from ghost_private.assistant_requests
  where created_at < now() - interval '30 days';

  insert into ghost_private.assistant_requests(request_id, user_id, unit_id)
  values (p_request_id, v_user_id, p_unit_id);

  return jsonb_build_object('requestId', p_request_id, 'replayed', false);
end
$$;

create or replace function public.ghost_assistant_finish_v1(
  p_request_id uuid,
  p_outcome text,
  p_code text,
  p_model text,
  p_prompt_tokens integer default 0,
  p_completion_tokens integer default 0
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
  if p_outcome not in ('success','error')
    or p_code !~ '^[a-z][a-z0-9_]{0,63}$'
    or length(p_model) not between 1 and 120
    or p_prompt_tokens not between 0 and 100000
    or p_completion_tokens not between 0 and 10000 then
    raise invalid_parameter_value using message = 'invalid_assistant_result';
  end if;

  update ghost_private.assistant_requests r
  set status = p_outcome,
      code = p_code,
      model = p_model,
      prompt_tokens = p_prompt_tokens,
      completion_tokens = p_completion_tokens,
      completed_at = now()
  where r.request_id = p_request_id
    and r.user_id = v_user_id
    and r.status = 'started';
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise invalid_parameter_value using message = 'assistant_request_not_found';
  end if;

  return jsonb_build_object('ok', true);
end
$$;

revoke all on function public.ghost_assistant_begin_v1(uuid,uuid) from public, anon;
revoke all on function public.ghost_assistant_finish_v1(uuid,text,text,text,integer,integer) from public, anon;
grant execute on function public.ghost_assistant_begin_v1(uuid,uuid) to authenticated;
grant execute on function public.ghost_assistant_finish_v1(uuid,text,text,text,integer,integer) to authenticated;

comment on table ghost_private.assistant_requests is
  'Metadata-only Ghost assistant audit and rate limits; no prompts, answers or business context.';
comment on function public.ghost_assistant_begin_v1(uuid,uuid) is
  'Authorizes one read-only assistant request for a unit and enforces per-user limits.';
comment on function public.ghost_assistant_finish_v1(uuid,text,text,text,integer,integer) is
  'Finalizes metadata-only assistant usage for the authenticated request owner.';
