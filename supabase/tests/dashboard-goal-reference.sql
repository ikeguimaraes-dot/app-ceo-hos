-- Read-only regression against the existing monthly reference data.
-- No financial rows, identities or source goals are inserted/updated.
do $$
declare sample record; wanted numeric; actual numeric; matched integer:=0;
begin
  for sample in
    select unit_id,competencia,dia_semana,meta
    from public.metas_dia_semana where competencia='2026-10'
  loop
    -- October 2026 starts on Thursday (4); select one exact date per weekday.
    actual:=ghost_private.weekday_goal_reference_v1(sample.unit_id,
      date '2026-10-01'+((sample.dia_semana-4+7)%7));
    if actual is distinct from sample.meta then raise exception 'exact_month_goal_changed'; end if;
    matched:=matched+1;
  end loop;
  if matched=0 then raise exception 'missing_reference_fixtures'; end if;

  for sample in
    select u.id,d.day_value from public.units u
    cross join lateral generate_series(date '2026-11-01',date '2026-11-30',interval '1 day') d(day_value)
    where u.name in ('Meet & Eat','Match Point','Madonna SP Itaim','Frêneze')
  loop
    -- Prefer an explicit November weekday, otherwise use the prior reference.
    if exists(select 1 from public.metas_dia_semana s where s.unit_id=sample.id
      and s.competencia='2026-11' and s.dia_semana=extract(dow from sample.day_value)::int) then
      select s.meta into wanted from public.metas_dia_semana s where s.unit_id=sample.id
        and s.competencia='2026-11' and s.dia_semana=extract(dow from sample.day_value)::int;
    else
      select s.meta into wanted from public.metas_dia_semana s where s.unit_id=sample.id
        and s.competencia=(select max(p.competencia) from public.metas_dia_semana p
          where p.unit_id=sample.id and p.competencia<'2026-11')
        and s.dia_semana=extract(dow from sample.day_value)::int;
    end if;
    actual:=ghost_private.weekday_goal_reference_v1(sample.id,sample.day_value::date);
    if actual is distinct from wanted then raise exception 'inherited_weekday_mismatch'; end if;
    -- A month before any reference must never inherit a later month's targets.
    if ghost_private.weekday_goal_reference_v1(sample.id,date '2000-01-01') is not null then
      raise exception 'future_goal_reference_used';
    end if;
  end loop;
  if ghost_private.weekday_goal_reference_v1('00000000-0000-0000-0000-000000000000',date '2026-11-01') is not null then
    raise exception 'cross_unit_goal_reference';
  end if;
  if has_function_privilege('anon','ghost_private.weekday_goal_reference_v1(uuid,date)','execute')
    or has_function_privilege('authenticated','ghost_private.weekday_goal_reference_v1(uuid,date)','execute') then
    raise exception 'private_goal_lookup_exposed';
  end if;
end $$;
