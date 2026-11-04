-- Discovery metadata is scoped exactly like the underlying financial datasets.
-- No financial rows, identities or raw schema are exposed.
create function public.ghost_assistant_coverage_v1(p_dataset text,p_unit text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid(); result jsonb;
begin
 if v_user is null then raise insufficient_privilege using message='authentication_required'; end if;
 if not exists(select 1 from public.units u where u.active and ghost_private.user_has_capability(v_user,u.id,'assistant.ask')) then
   raise insufficient_privilege using message='assistant_capability_denied'; end if;
 if p_dataset is null or p_dataset not in ('financeiro','despesas','dre_mensal') or length(coalesce(p_unit,''))>120 then
   raise invalid_parameter_value using message='invalid_coverage_query'; end if;
 with units as (
   select u.id,u.name from public.units u join public.brands b on b.id=u.brand_id join public.groups g on g.id=b.group_id
   where u.active and ghost_private.user_has_capability(v_user,u.id,'assistant.ask')
     and ghost_private.user_has_capability(v_user,u.id,'dashboard.read')
     and (p_unit is null or lower(public.unaccent(concat_ws(' ',u.name,b.name,g.name))) like '%'||lower(public.unaccent(p_unit))||'%')
 ), dates as (
   select w.unit_id,w.data data from public.lorean_workdays w join units u on u.id=w.unit_id where p_dataset='financeiro'
   union all select d.unit_id,d.data_competencia from public.dre_despesa_detalhada d join units u on u.id=d.unit_id where p_dataset='despesas'
   union all select d.unit_id,make_date(split_part(d.mes_ano,'-',1)::int,split_part(d.mes_ano,'-',2)::int,1)
     from public.dre_mensal d join units u on u.id=d.unit_id where p_dataset='dre_mensal' and d.mes_ano ~ '^[0-9]{4}-[0-9]{1,2}$'
 ), by_unit as (
   select u.name,min(d.data) first_date,max(d.data) last_date,count(d.data) records
   from units u left join dates d on d.unit_id=u.id group by u.name
 ) select jsonb_build_object('dataset',p_dataset,'firstDate',(select min(data) from dates),'lastDate',(select max(data) from dates),
   'authorizedUnitCount',(select count(*) from units),'byUnit',coalesce((select jsonb_agg(jsonb_build_object('unitName',name,
   'firstDate',first_date,'lastDate',last_date,'recordCount',records) order by name) from by_unit),'[]'::jsonb),
   'note',case when p_dataset='financeiro' then 'Cobertura de restaurante Lorean. Eventos são consultados separadamente na análise consolidada.'
     else 'Faixa de registros importados; não comprova completude de todos os dias ou competência.' end) into result;
 if (result->>'authorizedUnitCount')::int=0 then raise insufficient_privilege using message='unit_capability_denied'; end if;
 return result;
end $fn$;
revoke all on function public.ghost_assistant_coverage_v1(text,text) from public,anon;
grant execute on function public.ghost_assistant_coverage_v1(text,text) to authenticated;
