-- Replace demonstration expense comparisons with explicit comparisons of real
-- purchases. The two concepts are deliberately not treated as interchangeable.
create function public.ghost_assistant_compare_v2(p_dataset text,p_from date,p_to date,p_baseline_from date,p_baseline_to date,p_unit text default null,p_search text default null,p_include_events boolean default true)
returns jsonb language plpgsql volatile security definer set search_path='' set statement_timeout='30s' as $fn$
declare a jsonb; b jsonb; metrics jsonb:='[]'; by_unit jsonb:='[]'; metric text; av numeric; bv numeric; u jsonb; bu jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
 if not exists(select 1 from public.units u where u.active and ghost_private.user_has_capability(auth.uid(),u.id,'assistant.ask')) then raise insufficient_privilege using message='assistant_capability_denied'; end if;
 if p_dataset='financeiro' then return public.ghost_assistant_compare_v1(p_dataset,p_from,p_to,p_baseline_from,p_baseline_to,p_unit,p_search,p_include_events); end if;
 if p_dataset is null or p_dataset not in ('compras_itens','compras_notas') then raise invalid_parameter_value using message='assistant_source_not_allowed'; end if;
 if p_from is null or p_to is null or p_baseline_from is null or p_baseline_to is null or p_from>p_to or p_baseline_from>p_baseline_to or p_to-p_from>122 or p_baseline_to-p_baseline_from>122 then
   raise invalid_parameter_value using message='invalid_assistant_comparison'; end if;
 a:=public.ghost_assistant_query_v4(p_dataset,p_from,p_to,p_unit,p_search,'month',1);
 b:=public.ghost_assistant_query_v4(p_dataset,p_baseline_from,p_baseline_to,p_unit,p_search,'month',1);
 foreach metric in array array['totalValue','invoiceCount'] loop
   av:=(a#>>array['summary',metric])::numeric; bv:=(b#>>array['summary',metric])::numeric;
   metrics:=metrics||jsonb_build_array(jsonb_build_object('metric',metric,'current',av,'baseline',bv,'difference',av-bv,
     'absoluteDifference',abs(av-bv),'changeDirection',case when av>bv then 'increase' when av<bv then 'decrease' when av=bv then 'unchanged' end,
     'changePct',case when bv<>0 then round(100*(av-bv)/abs(bv),2) end,
     'absoluteChangePct',case when bv<>0 then abs(round(100*(av-bv)/abs(bv),2)) end));
 end loop;
 for u in select value from jsonb_array_elements(a#>'{summary,byUnit}') loop
   select value into bu from jsonb_array_elements(b#>'{summary,byUnit}') where value->>'unitName'=u->>'unitName';
   av:=(u->>'totalValue')::numeric; bv:=(bu->>'totalValue')::numeric;
   by_unit:=by_unit||jsonb_build_array(jsonb_build_object('unitName',u->>'unitName','metric','totalValue','current',av,'baseline',bv,
     'difference',av-bv,'absoluteDifference',abs(av-bv),
     'changeDirection',case when av>bv then 'increase' when av<bv then 'decrease' when av=bv then 'unchanged' end,
     'changePct',case when bv<>0 then round(100*(av-bv)/abs(bv),2) end,
     'absoluteChangePct',case when bv<>0 then abs(round(100*(av-bv)/abs(bv),2)) end));
 end loop;
 return jsonb_build_object('dataset',p_dataset,'from',p_from,'to',p_to,'baselineFrom',p_baseline_from,'baselineTo',p_baseline_to,
   'current',a->'summary','baseline',b->'summary','metrics',metrics,'byUnit',by_unit,'sameDuration',p_to-p_from=p_baseline_to-p_baseline_from,
   'note','Compras pelas notas Everest por competência. Não equivale a despesa paga nem a CMV consumido. Ausência de registros não comprova zero.', 'updatedAt',now());
end $fn$;
revoke all on function public.ghost_assistant_compare_v2(text,date,date,date,date,text,text,boolean) from public,anon;
grant execute on function public.ghost_assistant_compare_v2(text,date,date,date,date,text,text,boolean) to authenticated;

-- Discovery covers only the seven approved real sources. This allows the agent
-- to find the latest inventory/recipe date without fetching years of item rows.
create function public.ghost_assistant_coverage_v2(p_dataset text,p_unit text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $fn$
declare v_user uuid:=auth.uid(); result jsonb; capability text;
begin
 if v_user is null then raise insufficient_privilege using message='authentication_required'; end if;
 if not ghost_private.assistant_source_allowed_v1(p_dataset) then raise invalid_parameter_value using message='assistant_source_not_allowed'; end if;
 if not exists(select 1 from public.units u where u.active and ghost_private.user_has_capability(v_user,u.id,'assistant.ask')) then raise insufficient_privilege using message='assistant_capability_denied'; end if;
 if length(coalesce(p_unit,''))>120 then raise invalid_parameter_value using message='invalid_coverage_query'; end if;
 capability:=case when p_dataset in ('financeiro','vendas_produtos') then 'dashboard.read' when p_dataset='contas_pagar' then 'payables.read' else 'operation.read' end;
 with units as (
   select u.id,u.name from public.units u join public.brands b on b.id=u.brand_id join public.groups g on g.id=b.group_id
   where u.active and ghost_private.user_has_capability(v_user,u.id,'assistant.ask') and ghost_private.user_has_capability(v_user,u.id,capability)
     and (p_unit is null or lower(public.unaccent(concat_ws(' ',u.name,b.name,g.name))) like '%'||lower(public.unaccent(p_unit))||'%')
 ), dates as (
   select w.unit_id,w.data data from public.lorean_workdays w join units u on u.id=w.unit_id where p_dataset='financeiro'
   union all select w.unit_id,w.data from public.lorean_produtos_dia p join public.lorean_workdays w on w.id=p.workday_id_fk join units u on u.id=w.unit_id where p_dataset='vendas_produtos'
   union all select f.unit_id,make_date(f.ano_lancamento,f.mes_lancamento,1) from public.everest_facade_uniao f join units u on u.id=f.unit_id where p_dataset in ('compras_itens','compras_notas')
   union all select t.unit_id,coalesce(t.dt_vencimento,t.dt_competencia,t.dt_lancamento) from public.everest_titulos_fornecedor_completo t join units u on u.id=t.unit_id where p_dataset='contas_pagar'
   union all select i.unit_id,i.dt_inventario from public.everest_inventarios i join units u on u.id=i.unit_id where p_dataset='inventarios'
   union all select c.unit_id,c.calculado_em::date from public.everest_fichas_tecnicas_custo c join units u on u.id=c.unit_id where p_dataset='fichas_tecnicas'
 ), by_unit as (
   select u.name,min(d.data) first_date,max(d.data) last_date,count(d.data) records from units u left join dates d on d.unit_id=u.id group by u.name
 ) select jsonb_build_object('dataset',p_dataset,'firstDate',(select min(data) from dates),'lastDate',(select max(data) from dates),
   'authorizedUnitCount',(select count(*) from units),'byUnit',coalesce((select jsonb_agg(jsonb_build_object('unitName',name,
   'firstDate',first_date,'lastDate',last_date,'recordCount',records) order by name) from by_unit),'[]'::jsonb),
   'note','Cobertura da fonte real aprovada; não comprova completude. Para inventário mais recente, use as últimas datas por casa. Compras usam competência; fichas usam data de cálculo.') into result;
 if (result->>'authorizedUnitCount')::int=0 then raise insufficient_privilege using message='unit_capability_denied'; end if;
 return result;
end $fn$;
revoke all on function public.ghost_assistant_coverage_v2(text,text) from public,anon;
grant execute on function public.ghost_assistant_coverage_v2(text,text) to authenticated;
notify pgrst,'reload schema';
