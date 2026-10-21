-- Run only after GHOST_PUSH_WORKER_SECRET exists in Edge Function Secrets and
-- the same value exists in Vault as ghost_push_worker_secret.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_job_id bigint;
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'ghost_push_worker_secret'
  ) then
    raise exception 'ghost_push_worker_secret_missing_from_vault';
  end if;

  select jobid into v_job_id
  from cron.job where jobname = 'ghost-push-worker-every-minute';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'ghost-push-worker-every-minute',
  '* * * * *',
  $$select net.http_post(
    url := 'https://iqgrvptrtphvbmvrqntm.supabase.co/functions/v1/ghost-push-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'ghost_push_worker_secret'
        order by created_at desc
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );$$
);
