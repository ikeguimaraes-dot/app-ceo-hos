-- A valid Auth account without an active KPH link must not create a push
-- installation. Unregister intentionally remains available after unlinking.

create or replace function public.ghost_register_installation_v1(
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
declare v_user_id uuid := auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_is_active(v_user_id) then raise insufficient_privilege using message = 'inactive_user'; end if;
  if not exists (
    select 1 from public.units u
    where ghost_private.user_has_capability(v_user_id, u.id, 'notifications.read')
  ) then
    raise insufficient_privilege using message = 'linked_user_required';
  end if;
  if p_platform not in ('ios','android') or p_app_environment not in ('local','preview','production')
    or length(p_expo_token) not between 20 and 512 or length(p_app_version) not between 1 and 40 then
    raise invalid_parameter_value using message = 'invalid_installation';
  end if;
  insert into ghost_private.device_installations(
    user_id,installation_id,expo_token,platform,app_environment,app_version,revoked_at
  ) values (v_user_id,p_installation_id,p_expo_token,p_platform,p_app_environment,p_app_version,null)
  on conflict (user_id,installation_id) do update set
    expo_token=excluded.expo_token, platform=excluded.platform,
    app_environment=excluded.app_environment, app_version=excluded.app_version,
    revoked_at=null, updated_at=now()
  returning id into v_id;
  return jsonb_build_object('id',v_id,'registeredAt',now());
end
$$;

revoke all on function public.ghost_register_installation_v1(uuid,text,text,text,text) from public, anon;
grant execute on function public.ghost_register_installation_v1(uuid,text,text,text,text) to authenticated;

