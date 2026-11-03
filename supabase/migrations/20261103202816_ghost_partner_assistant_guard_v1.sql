-- Quality telemetry is also an assistant module, even though it is user-owned.
do $migration$
declare definition text;
begin
  definition:=pg_get_functiondef('public.ghost_assistant_quality_v1(integer)'::regprocedure);
  if position('if p_days not between' in definition)=0 then raise exception 'quality_guard_shape_changed'; end if;
  execute replace(definition,'if p_days not between',
    'if not exists(select 1 from public.units u where ghost_private.user_has_capability(v_user_id,u.id,''assistant.ask'')) then raise insufficient_privilege using message=''assistant_capability_denied''; end if; if p_days not between');
end $migration$;
