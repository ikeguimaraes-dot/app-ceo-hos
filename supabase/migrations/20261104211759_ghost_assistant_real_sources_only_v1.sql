-- Owner-selected business scope. Demonstration DRE/expense tables and other
-- modules must never be a fallback for this assistant, including legacy RPCs.
create function ghost_private.assistant_source_allowed_v1(p_dataset text)
returns boolean language sql immutable security invoker set search_path='' as $fn$
 select coalesce(p_dataset=any(array['financeiro','compras_notas','compras_itens','vendas_produtos','contas_pagar','fichas_tecnicas','inventarios']),false)
$fn$;
revoke all on function ghost_private.assistant_source_allowed_v1(text) from public,anon,authenticated;

do $migration$
declare f regprocedure; definition text; pos integer; guard text;
begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname ~ '^ghost_assistant_query_v[1-4]$'
 loop
   definition:=pg_get_functiondef(f);
   pos:=strpos(definition,E'\nbegin\n');
   if pos=0 then raise exception 'assistant_query_guard_shape_changed: %',f; end if;
   guard:=$guard$
  if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
  if not ghost_private.assistant_source_allowed_v1(p_dataset) then
    raise invalid_parameter_value using message='assistant_source_not_allowed';
  end if;
$guard$;
   execute overlay(definition placing E'\nbegin\n'||guard from pos for 7);
 end loop;
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('ghost_assistant_compare_v1','ghost_assistant_coverage_v1')
 loop
   definition:=pg_get_functiondef(f); pos:=strpos(definition,E'\nbegin\n');
   if pos=0 then raise exception 'assistant_analysis_guard_shape_changed: %',f; end if;
   guard:=$guard$
 if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
 if p_dataset is distinct from 'financeiro' then raise invalid_parameter_value using message='assistant_source_not_allowed'; end if;
$guard$;
   execute overlay(definition placing E'\nbegin\n'||guard from pos for 7);
 end loop;
end $migration$;

-- Preserve existing versioned metadata contracts but filter every public catalog.
do $migration$
declare v integer; definition text;
begin
 for v in 1..3 loop
   definition:=pg_get_functiondef(to_regprocedure(format('public.ghost_assistant_catalog_v%s()',v)));
   execute replace(definition,format('public.ghost_assistant_catalog_v%s()',v),format('ghost_private.assistant_original_catalog_v%s()',v));
   execute format('revoke all on function ghost_private.assistant_original_catalog_v%s() from public,anon,authenticated',v);
   execute format($wrapper$
    create or replace function public.ghost_assistant_catalog_v%s()
    returns jsonb language plpgsql stable security definer set search_path='' as $body$
    declare result jsonb;
    begin
      result:=ghost_private.assistant_original_catalog_v%s();
      return jsonb_set(jsonb_set(result,'{datasets}',coalesce((
        select jsonb_agg(case when d->>'name'='financeiro' then d||jsonb_build_object(
          'description','Receita e metas com as regras da Home; usar analisar_financeiro, incluindo eventos por padrão.',
          'fields',jsonb_build_array('reportedRevenue','restaurantRevenue','eventsRevenue','goal','monthGoal','goalProgressPct','monthGoalProgressPct')) else d end order by ord)
        from jsonb_array_elements(result->'datasets') with ordinality entries(d,ord)
        where ghost_private.assistant_source_allowed_v1(d->>'name')),'[]'::jsonb)),
        '{rules}',jsonb_build_array(
          'Somente CMV/produtos (compras e vendas), receita/metas, contas a pagar, fichas técnicas e inventários.',
          'DRE e despesas demonstrativas não são fontes válidas e não podem ser usadas como alternativa.',
          'Cada consulta revalida usuário, casa e capability. Sem acesso direto a tabelas.',
          'Compras por competência não equivalem a despesas pagas nem a CMV consumido.',
          'Datas civis YYYY-MM-DD; limite de 200 linhas, com summaries calculados no servidor.'));
    end $body$;
   $wrapper$,v,v);
 end loop;
end $migration$;
notify pgrst,'reload schema';
