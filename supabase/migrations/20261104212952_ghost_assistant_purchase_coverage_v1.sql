-- Coverage needs note dates, not every product/cost/sync join in the item facade.
-- This is the same current-note origin used by everest_facade_uniao; require an
-- item so the set of covered notes matches the facade's mandatory item join.
do $migration$
declare definition text; old_query text; new_query text;
begin
 definition:=pg_get_functiondef('public.ghost_assistant_coverage_v2(text,text)'::regprocedure);
 old_query:=$old$union all select f.unit_id,make_date(f.ano_lancamento,f.mes_lancamento,1) from public.everest_facade_uniao f join units u on u.id=f.unit_id where p_dataset in ('compras_itens','compras_notas')$old$;
 new_query:=$new$union all select en.unit_id,date_trunc('month',en.dt_lancamento)::date from public.everest_notas_recebidas_atuais en join units u on u.id=en.unit_id where p_dataset in ('compras_itens','compras_notas') and exists(select 1 from public.everest_notas_recebidas_itens ni where ni.nota_id=en.id)$new$;
 if strpos(definition,old_query)=0 then raise exception 'purchase_coverage_shape_changed'; end if;
 execute replace(definition,old_query,new_query);
end $migration$;
notify pgrst,'reload schema';
