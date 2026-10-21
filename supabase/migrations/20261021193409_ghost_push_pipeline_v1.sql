-- Ghost push pipeline v1. User-facing access remains RPC-only. Queue, tokens,
-- tickets and receipts stay in the unexposed ghost_private schema.

create table if not exists ghost_private.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  categories text[] not null default array['pending','operation','people','system']::text[],
  quiet_start time,
  quiet_end time,
  timezone text not null default 'America/Sao_Paulo',
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint ghost_notification_categories_known check (
    categories <@ array['pending','operation','people','system']::text[]
  ),
  constraint ghost_notification_quiet_pair check (
    (quiet_start is null) = (quiet_end is null)
  ),
  constraint ghost_notification_timezone_length check (length(timezone) between 1 and 80)
);

create table if not exists ghost_private.push_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  target text not null default '/',
  title text not null default 'Ghost',
  body text not null default 'Você tem uma nova atualização.',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint ghost_push_category_known check (
    category in ('pending','operation','people','system')
  ),
  constraint ghost_push_target_known check (target in ('/','/pending','/notifications')),
  constraint ghost_push_copy_length check (
    length(title) between 1 and 80 and length(body) between 1 and 180
  )
);

create table if not exists ghost_private.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references ghost_private.push_events(id) on delete cascade,
  installation_id uuid not null references ghost_private.device_installations(id) on delete cascade,
  status text not null default 'queued',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  expo_ticket_id text,
  provider_status text,
  last_error_code text,
  receipt_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, installation_id),
  constraint ghost_push_delivery_status check (
    status in ('queued','processing','sent','accepted','retry','failed')
  ),
  constraint ghost_push_attempts check (attempts between 0 and 5),
  constraint ghost_push_error_length check (
    last_error_code is null or length(last_error_code) <= 100
  )
);

create index if not exists ghost_push_delivery_ready_idx
  on ghost_private.push_deliveries(next_attempt_at, created_at)
  where status in ('queued','retry');
create index if not exists ghost_push_delivery_receipt_idx
  on ghost_private.push_deliveries(last_attempt_at)
  where status = 'sent' and expo_ticket_id is not null;

revoke all on all tables in schema ghost_private from public, anon, authenticated;

create or replace function public.ghost_notification_preferences_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_preferences ghost_private.notification_preferences%rowtype;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_is_active(v_user_id) or not exists (
    select 1 from public.units u
    where ghost_private.user_has_capability(v_user_id, u.id, 'notifications.read')
  ) then
    raise insufficient_privilege using message = 'notifications_capability_denied';
  end if;
  select * into v_preferences
  from ghost_private.notification_preferences p where p.user_id = v_user_id;

  return jsonb_build_object(
    'categories', coalesce(v_preferences.categories, array['pending','operation','people','system']::text[]),
    'quietStart', case when v_preferences.quiet_start is null then null else to_char(v_preferences.quiet_start, 'HH24:MI') end,
    'quietEnd', case when v_preferences.quiet_end is null then null else to_char(v_preferences.quiet_end, 'HH24:MI') end,
    'timezone', coalesce(v_preferences.timezone, 'America/Sao_Paulo'),
    'version', coalesce(v_preferences.version, 0)
  );
end
$$;

create or replace function public.ghost_notification_preferences_update_v1(
  p_categories text[],
  p_quiet_start time,
  p_quiet_end time,
  p_timezone text,
  p_expected_version bigint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_version bigint;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_is_active(v_user_id) or not exists (
    select 1 from public.units u
    where ghost_private.user_has_capability(v_user_id, u.id, 'notifications.read')
  ) then
    raise insufficient_privilege using message = 'notifications_capability_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  if p_categories is null
    or not p_categories <@ array['pending','operation','people','system']::text[]
    or (p_quiet_start is null) <> (p_quiet_end is null)
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
  then
    raise invalid_parameter_value using message = 'invalid_notification_preferences';
  end if;

  select version into v_current_version
  from ghost_private.notification_preferences where user_id = v_user_id for update;
  v_current_version := coalesce(v_current_version, 0);
  if p_expected_version is distinct from v_current_version then
    raise serialization_failure using message = 'notification_preferences_conflict';
  end if;

  insert into ghost_private.notification_preferences(
    user_id, categories, quiet_start, quiet_end, timezone, version, updated_at
  ) values (
    v_user_id, p_categories, p_quiet_start, p_quiet_end, p_timezone, 1, now()
  )
  on conflict (user_id) do update set
    categories = excluded.categories,
    quiet_start = excluded.quiet_start,
    quiet_end = excluded.quiet_end,
    timezone = excluded.timezone,
    version = ghost_private.notification_preferences.version + 1,
    updated_at = now()
  returning version into v_current_version;

  return jsonb_build_object('ok', true, 'version', v_current_version, 'updatedAt', now());
end
$$;

create or replace function ghost_private.enqueue_notification_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if ghost_private.user_is_active(new.user_id) then
    insert into ghost_private.push_events(
      dedupe_key, user_id, category, target, title, body
    ) values (
      'notification:' || new.id::text,
      new.user_id,
      case when new.link in ('/pending','pending') then 'pending' else 'system' end,
      case when new.link in ('/pending','pending') then '/pending' else '/notifications' end,
      'Ghost',
      'Você tem uma nova atualização.'
    ) on conflict (dedupe_key) do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists ghost_enqueue_notification_v1 on public.notifications;
create trigger ghost_enqueue_notification_v1
after insert on public.notifications
for each row execute function ghost_private.enqueue_notification_v1();

create or replace function public.ghost_internal_push_claim_v1(p_limit integer default 100)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if p_limit not between 1 and 100 then
    raise invalid_parameter_value using message = 'invalid_batch_limit';
  end if;

  update ghost_private.push_deliveries
  set status = case when attempts < 5 then 'retry' else 'failed' end,
      next_attempt_at = now(),
      last_error_code = 'WorkerLeaseExpired',
      updated_at = now()
  where status = 'processing' and last_attempt_at < now() - interval '15 minutes';

  insert into ghost_private.push_deliveries(event_id, installation_id)
  select e.id, i.id
  from ghost_private.push_events e
  join ghost_private.device_installations i
    on i.user_id = e.user_id and i.revoked_at is null
  left join ghost_private.notification_preferences p on p.user_id = e.user_id
  where e.expires_at > now()
    and e.category = any(coalesce(p.categories, array['pending','operation','people','system']::text[]))
    and ghost_private.user_is_active(e.user_id)
    and exists (
      select 1 from public.units u
      where ghost_private.user_has_capability(e.user_id, u.id, 'notifications.read')
    )
    and (
      p.quiet_start is null
      or case when p.quiet_start < p.quiet_end then
        (now() at time zone p.timezone)::time < p.quiet_start
        or (now() at time zone p.timezone)::time >= p.quiet_end
      else
        (now() at time zone p.timezone)::time >= p.quiet_end
        and (now() at time zone p.timezone)::time < p.quiet_start
      end
    )
  on conflict (event_id, installation_id) do nothing;

  with claimed as (
    select d.id
    from ghost_private.push_deliveries d
    join ghost_private.device_installations i on i.id = d.installation_id
    join ghost_private.push_events e on e.id = d.event_id
    where d.status in ('queued','retry') and d.next_attempt_at <= now()
      and d.attempts < 5 and i.revoked_at is null and e.expires_at > now()
    order by d.created_at
    limit p_limit
    for update of d skip locked
  ), updated as (
    update ghost_private.push_deliveries d set
      status = 'processing', attempts = attempts + 1,
      last_attempt_at = now(), updated_at = now()
    from claimed c
    where d.id = c.id
    returning d.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'deliveryId', d.id,
    'token', i.expo_token,
    'title', e.title,
    'body', e.body,
    'target', e.target,
    'eventId', e.id,
    'category', e.category
  ) order by d.created_at), '[]'::jsonb)
  into v_result
  from updated d
  join ghost_private.device_installations i on i.id = d.installation_id
  join ghost_private.push_events e on e.id = d.event_id;

  return v_result;
end
$$;

create or replace function public.ghost_internal_push_apply_v1(p_results jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 100 then
    raise invalid_parameter_value using message = 'invalid_push_results';
  end if;

  with results as (
    select
      (x->>'deliveryId')::uuid delivery_id,
      x->>'status' result_status,
      nullif(x->>'ticketId','') ticket_id,
      left(nullif(x->>'errorCode',''), 100) error_code
    from jsonb_array_elements(p_results) x
    where x->>'status' in ('sent','retry','failed')
  )
  update ghost_private.push_deliveries d set
    status = r.result_status,
    expo_ticket_id = r.ticket_id,
    last_error_code = r.error_code,
    next_attempt_at = case when r.result_status = 'retry'
      then now() + make_interval(secs => least(3600, (power(2, d.attempts) * 30)::integer))
      else d.next_attempt_at end,
    updated_at = now()
  from results r where d.id = r.delivery_id and d.status = 'processing';
  get diagnostics v_count = row_count;

  update ghost_private.device_installations i set revoked_at = now(), updated_at = now()
  from ghost_private.push_deliveries d
  where d.installation_id = i.id and d.last_error_code = 'DeviceNotRegistered'
    and i.revoked_at is null;

  return jsonb_build_object('updated', v_count);
end
$$;

create or replace function public.ghost_internal_push_receipts_claim_v1(p_limit integer default 300)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if p_limit not between 1 and 300 then
    raise invalid_parameter_value using message = 'invalid_batch_limit';
  end if;
  with claimed as (
    select id from ghost_private.push_deliveries
    where status = 'sent' and expo_ticket_id is not null
      and last_attempt_at <= now() - interval '15 minutes'
      and receipt_checked_at is null
    order by last_attempt_at limit p_limit
    for update skip locked
  ), updated as (
    update ghost_private.push_deliveries d
    set receipt_checked_at = now(), updated_at = now()
    from claimed c where d.id = c.id
    returning d.id, d.expo_ticket_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'deliveryId', id, 'ticketId', expo_ticket_id
  )), '[]'::jsonb) into v_result from updated;
  return v_result;
end
$$;

create or replace function public.ghost_internal_push_receipts_apply_v1(p_results jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) > 300 then
    raise invalid_parameter_value using message = 'invalid_receipt_results';
  end if;
  with results as (
    select
      (x->>'deliveryId')::uuid delivery_id,
      x->>'status' result_status,
      left(nullif(x->>'errorCode',''), 100) error_code
    from jsonb_array_elements(p_results) x
    where x->>'status' in ('accepted','retry','failed')
  )
  update ghost_private.push_deliveries d set
    status = case when r.result_status = 'retry' then 'sent' else r.result_status end,
    provider_status = case when r.result_status = 'retry' then d.provider_status else r.result_status end,
    last_error_code = r.error_code,
    receipt_checked_at = case when r.result_status = 'retry' then null else d.receipt_checked_at end,
    last_attempt_at = case when r.result_status = 'retry' then now() else d.last_attempt_at end,
    updated_at = now()
  from results r where d.id = r.delivery_id and d.status = 'sent';
  get diagnostics v_count = row_count;

  update ghost_private.device_installations i set revoked_at = now(), updated_at = now()
  from ghost_private.push_deliveries d
  where d.installation_id = i.id and d.last_error_code = 'DeviceNotRegistered'
    and i.revoked_at is null;
  return jsonb_build_object('updated', v_count);
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
  v_installations integer;
begin
  delete from ghost_private.push_events
  where expires_at < now() - interval '7 days'
     or created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;

  delete from ghost_private.device_installations
  where revoked_at < now() - interval '90 days';
  get diagnostics v_installations = row_count;

  return jsonb_build_object(
    'eventsDeleted', v_events,
    'installationsDeleted', v_installations
  );
end
$$;

revoke all on function public.ghost_notification_preferences_v1() from public, anon;
revoke all on function public.ghost_notification_preferences_update_v1(text[],time,time,text,bigint) from public, anon;
grant execute on function public.ghost_notification_preferences_v1() to authenticated;
grant execute on function public.ghost_notification_preferences_update_v1(text[],time,time,text,bigint) to authenticated;

revoke all on function public.ghost_internal_push_claim_v1(integer) from public, anon, authenticated;
revoke all on function public.ghost_internal_push_apply_v1(jsonb) from public, anon, authenticated;
revoke all on function public.ghost_internal_push_receipts_claim_v1(integer) from public, anon, authenticated;
revoke all on function public.ghost_internal_push_receipts_apply_v1(jsonb) from public, anon, authenticated;
revoke all on function public.ghost_internal_push_cleanup_v1() from public, anon, authenticated;
grant execute on function public.ghost_internal_push_claim_v1(integer) to service_role;
grant execute on function public.ghost_internal_push_apply_v1(jsonb) to service_role;
grant execute on function public.ghost_internal_push_receipts_claim_v1(integer) to service_role;
grant execute on function public.ghost_internal_push_receipts_apply_v1(jsonb) to service_role;
grant execute on function public.ghost_internal_push_cleanup_v1() to service_role;

revoke all on function ghost_private.enqueue_notification_v1() from public, anon, authenticated;

comment on function public.ghost_notification_preferences_v1() is
  'Ghost v1 notification preferences for the authenticated user.';
comment on function public.ghost_notification_preferences_update_v1(text[],time,time,text,bigint) is
  'Ghost v1 optimistic update of authenticated-user notification preferences.';
comment on function public.ghost_internal_push_claim_v1(integer) is
  'Service-only push delivery claim with capability, preference, quiet-hour and token checks.';
