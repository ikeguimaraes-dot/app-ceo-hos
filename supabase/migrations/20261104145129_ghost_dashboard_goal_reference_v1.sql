-- Match the KPH workdays API: use the requested month's weekday goal when
-- present, otherwise the same weekday from the latest earlier reference month.
-- Exact-date overrides remain first priority in the original dashboard queries.
-- No goal rows are copied, updated or inserted by this migration.
create function ghost_private.weekday_goal_reference_v1(p_unit_id uuid,p_day date)
returns numeric language sql stable security invoker set search_path='' as $fn$
  with requested as (
    select to_char(p_day,'YYYY-MM') period,extract(dow from p_day)::integer weekday
  ), exact as (
    select s.meta from public.metas_dia_semana s,requested r
    where s.unit_id=p_unit_id and s.competencia=r.period and s.dia_semana=r.weekday
  )
  select case when exists(select 1 from exact) then (select meta from exact)
    else (
      select s.meta from public.metas_dia_semana s,requested r
      where s.unit_id=p_unit_id and s.dia_semana=r.weekday
        and s.competencia=(select max(previous.competencia)
          from public.metas_dia_semana previous
          where previous.unit_id=p_unit_id and previous.competencia<r.period)
    ) end
$fn$;
revoke all on function ghost_private.weekday_goal_reference_v1(uuid,date) from public,anon,authenticated;

-- Update only the weekday-goal lookup. Guard against unexpected definition drift.
-- Public wrappers keep their existing authentication, unit checks and redaction.
do $migration$
declare version integer; definition text; lookup_pattern text;
begin
  lookup_pattern:=$pattern$\(select s\.meta from public\.metas_dia_semana s\s+where s\.unit_id\s*=\s*p_unit_id\s+and s\.competencia\s*=\s*to_char\((d\.business_date|v_start),\s*'YYYY-MM'\)\s+and s\.dia_semana\s*=\s*extract\(dow from (d\.business_date|days\.day_value)\)::(?:integer|int)\)$pattern$;
  for version in 1..3 loop
    definition:=pg_get_functiondef(to_regprocedure(format('ghost_private.dashboard_full_v%s(uuid,date)',version)));
    if (select count(*) from regexp_matches(definition,lookup_pattern,'g'))<>1 then
      raise exception 'dashboard_goal_lookup_shape_changed: v%',version;
    end if;
    definition:=regexp_replace(definition,lookup_pattern,
      'ghost_private.weekday_goal_reference_v1(p_unit_id,\2)','g');
    execute definition;
  end loop;
end $migration$;
