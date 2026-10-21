-- Reconcile push ownership across token rotation and shared-device handoff.
-- Operational logs intentionally contain only bounded technical metadata.

alter table ghost_private.device_installations
  add column if not exists last_seen_at timestamptz;

update ghost_private.device_installations
set last_seen_at = updated_at
where last_seen_at is null;

alter table ghost_private.device_installations
  alter column last_seen_at set default now(),
  alter column last_seen_at set not null;

-- Retire duplicate active ownership before enforcing installation uniqueness.
with ranked as (
  select id, row_number() over (
    partition by app_environment, installation_id
    order by last_seen_at desc, updated_at desc, id desc
  ) as position
  from ghost_private.device_installations
  where revoked_at is null
)
update ghost_private.device_installations i
set revoked_at = now(), updated_at = now()
from ranked r
where i.id = r.id and r.position > 1;

create unique index if not exists ghost_device_active_installation_unique
  on ghost_private.device_installations(app_environment, installation_id)
  where revoked_at is null;

create table if not exists ghost_private.operation_logs (
  request_id uuid primary key,
  operation text not null,
  outcome text not null,
  code text not null,
  duration_ms integer not null,
  claimed_count integer not null default 0,
  receipt_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint ghost_operation_known check (operation in ('push.worker')),
  constraint ghost_operation_outcome check (outcome in ('success','error')),
  constraint ghost_operation_code check (code ~ '^[a-z][a-z0-9_]{0,63}$'),
  constraint ghost_operation_duration check (duration_ms between 0 and 3600000),
  constraint ghost_operation_counts check (
    claimed_count between 0 and 100 and receipt_count between 0 and 300
  )
);

alter table ghost_private.operation_logs enable row level security;
revoke all on ghost_private.operation_logs from public, anon, authenticated;

create or replace function public.ghost_reconcile_installation_v1(
  p_installation_id uuid,
  p_expo_token text,
  p_platform text,
  p_app_environment text,
  p_app_version text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_reconciled integer := 0;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_is_active(v_user_id) then
    raise insufficient_privilege using message = 'inactive_user';
  end if;
  if not exists (
    select 1 from public.units u
    where ghost_private.user_has_capability(v_user_id, u.id, 'notifications.read')
  ) then
    raise insufficient_privilege using message = 'linked_user_required';
  end if;
  if p_installation_id is null
    or p_platform not in ('ios','android')
    or p_app_environment not in ('local','preview','production')
    or length(p_expo_token) not between 20 and 512
    or length(p_app_version) not between 1 and 40
  then
    raise invalid_parameter_value using message = 'invalid_installation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_app_environment || ':installation:' || p_installation_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_app_environment || ':token:' || p_expo_token, 0)
  );

  update ghost_private.device_installations
  set revoked_at = now(), updated_at = now()
  where revoked_at is null
    and app_environment = p_app_environment
    and (
      installation_id = p_installation_id
      or expo_token = p_expo_token
    )
    and not (user_id = v_user_id and installation_id = p_installation_id);
  get diagnostics v_reconciled = row_count;

  insert into ghost_private.device_installations(
    user_id, installation_id, expo_token, platform, app_environment,
    app_version, last_seen_at, revoked_at, updated_at
  ) values (
    v_user_id, p_installation_id, p_expo_token, p_platform, p_app_environment,
    p_app_version, now(), null, now()
  )
  on conflict (user_id, installation_id) do update set
    expo_token = excluded.expo_token,
    platform = excluded.platform,
    app_environment = excluded.app_environment,
    app_version = excluded.app_version,
    last_seen_at = now(),
    revoked_at = null,
    updated_at = now()
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'registeredAt', now(),
    'reconciledBindings', v_reconciled
  );
end
$$;

-- Keep the v1 entry point safe for already distributed clients.
create or replace function public.ghost_register_installation_v1(
  p_installation_id uuid,
  p_expo_token text,
  p_platform text,
  p_app_environment text,
  p_app_version text
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select public.ghost_reconcile_installation_v1(
    p_installation_id, p_expo_token, p_platform, p_app_environment, p_app_version
  )
$$;

create or replace function public.ghost_internal_operation_log_v1(
  p_request_id uuid,
  p_operation text,
  p_outcome text,
  p_code text,
  p_duration_ms integer,
  p_claimed_count integer default 0,
  p_receipt_count integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  insert into ghost_private.operation_logs(
    request_id, operation, outcome, code, duration_ms, claimed_count, receipt_count
  ) values (
    p_request_id, p_operation, p_outcome, p_code, p_duration_ms,
    p_claimed_count, p_receipt_count
  )
  on conflict (request_id) do nothing;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.ghost_internal_push_cleanup_v1()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_events integer;
  v_stale_installations integer;
  v_installations integer;
  v_logs integer;
begin
  delete from ghost_private.push_events
  where expires_at < now() - interval '7 days'
     or created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;

  update ghost_private.device_installations
  set revoked_at = now(), updated_at = now()
  where revoked_at is null and last_seen_at < now() - interval '45 days';
  get diagnostics v_stale_installations = row_count;

  delete from ghost_private.device_installations
  where revoked_at < now() - interval '90 days';
  get diagnostics v_installations = row_count;

  delete from ghost_private.operation_logs
  where created_at < now() - interval '30 days';
  get diagnostics v_logs = row_count;

  return jsonb_build_object(
    'eventsDeleted', v_events,
    'staleInstallationsRevoked', v_stale_installations,
    'installationsDeleted', v_installations,
    'operationLogsDeleted', v_logs
  );
end
$$;

revoke all on function public.ghost_reconcile_installation_v1(uuid,text,text,text,text) from public, anon;
grant execute on function public.ghost_reconcile_installation_v1(uuid,text,text,text,text) to authenticated;
revoke all on function public.ghost_register_installation_v1(uuid,text,text,text,text) from public, anon;
grant execute on function public.ghost_register_installation_v1(uuid,text,text,text,text) to authenticated;
revoke all on function public.ghost_internal_operation_log_v1(uuid,text,text,text,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.ghost_internal_operation_log_v1(uuid,text,text,text,integer,integer,integer)
  to service_role;
revoke all on function public.ghost_internal_push_cleanup_v1() from public, anon, authenticated;
grant execute on function public.ghost_internal_push_cleanup_v1() to service_role;
