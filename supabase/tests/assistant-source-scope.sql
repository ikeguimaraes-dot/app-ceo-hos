-- Server scope regression with claims in rollback. Real Auth tests are separate.
begin;
do $$
declare actor uuid; blocked text; version integer; catalog jsonb; result jsonb;
begin
 select ur.user_id into actor from public.user_roles ur where exists(
   select 1 from public.units u where ghost_private.user_has_capability(ur.user_id,u.id,'assistant.ask')) limit 1;
 if actor is null then raise exception 'assistant test actor missing'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 foreach blocked in array array['despesas','dre_mensal','dre_detalhes','pessoas','folha_resumo','reservas','eventos','caixas','contratos','compras_pedidos','recebimentos','operacao_diaria','ausencias','manutencao','planos_acao','pedidos_venda','pagamentos','descontos','cancelamentos','conciliacao_pagamentos'] loop
   for version in 1..4 loop
     begin
       execute format('select public.ghost_assistant_query_v%s($1)',version) into result using blocked;
       raise exception 'blocked source reached query v%: %',version,blocked;
     exception when invalid_parameter_value then
       assert sqlerrm='assistant_source_not_allowed','unexpected rejection reason';
     end;
   end loop;
 end loop;
 for version in 1..3 loop
   execute format('select public.ghost_assistant_catalog_v%s()',version) into catalog;
   assert not exists(select 1 from jsonb_array_elements(catalog->'datasets') d
     where not ghost_private.assistant_source_allowed_v1(d->>'name')),'catalog advertises an unapproved source';
 end loop;
 begin
   perform public.ghost_assistant_compare_v1('despesas','2026-10-01','2026-10-31','2026-09-01','2026-09-30');
   raise exception 'comparison read demonstration expenses';
 exception when invalid_parameter_value then assert sqlerrm='assistant_source_not_allowed'; end;
 begin
   perform public.ghost_assistant_coverage_v1('despesas');
   raise exception 'coverage read demonstration expenses';
 exception when invalid_parameter_value then assert sqlerrm='assistant_source_not_allowed'; end;
 begin
   perform public.ghost_assistant_compare_v2('despesas','2026-10-01','2026-10-31','2026-09-01','2026-09-30');
   raise exception 'new comparison read demonstration expenses';
 exception when invalid_parameter_value then assert sqlerrm='assistant_source_not_allowed'; end;
 begin
   perform public.ghost_assistant_coverage_v2('dre_mensal');
   raise exception 'new coverage read demonstration DRE';
 exception when invalid_parameter_value then assert sqlerrm='assistant_source_not_allowed'; end;
 assert not has_function_privilege('authenticated','ghost_private.assistant_source_allowed_v1(text)','execute'),'policy helper must remain private';
end $$;
rollback;
