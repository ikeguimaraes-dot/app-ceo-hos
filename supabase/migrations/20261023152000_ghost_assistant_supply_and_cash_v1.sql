-- Authorized semantic contracts for recipe costs, goods receipts and cash
-- registers. Raw tables remain inaccessible to the mobile client and model.

alter table ghost_private.assistant_requests
  drop constraint if exists ghost_assistant_quality_metrics;
alter table ghost_private.assistant_requests
  add constraint ghost_assistant_quality_metrics check (
    tool_call_count between 0 and 20
    and validation_attempts between 0 and 3
    and latency_ms between 0 and 120000
    and cardinality(datasets) <= 26
  );

create or replace function public.ghost_assistant_finish_v2(
  p_request_id uuid,
  p_outcome text,
  p_code text,
  p_model text,
  p_prompt_tokens integer default 0,
  p_completion_tokens integer default 0,
  p_datasets text[] default '{}',
  p_tool_call_count integer default 0,
  p_validation_attempts integer default 0,
  p_latency_ms integer default 0
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if cardinality(coalesce(p_datasets,'{}')) > 26
    or p_tool_call_count not between 0 and 20
    or p_validation_attempts not between 0 and 3
    or p_latency_ms not between 0 and 120000
    or exists (
      select 1 from unnest(coalesce(p_datasets,'{}')) d
      where d !~ '^[a-z][a-z0-9_]{0,63}$'
    ) then
    raise invalid_parameter_value using message = 'invalid_assistant_quality_metrics';
  end if;

  v_result := public.ghost_assistant_finish_v1(
    p_request_id,p_outcome,p_code,p_model,p_prompt_tokens,p_completion_tokens
  );
  update ghost_private.assistant_requests r
  set datasets = coalesce(p_datasets,'{}'),
      tool_call_count = p_tool_call_count,
      validation_attempts = p_validation_attempts,
      latency_ms = p_latency_ms
  where r.request_id = p_request_id and r.user_id = v_user_id;
  return v_result;
end
$$;

create or replace function public.ghost_assistant_catalog_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
begin
  v_base := public.ghost_assistant_catalog_v1();
  return jsonb_set(v_base,'{datasets}',coalesce(v_base->'datasets','[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'name','fichas_tecnicas','capability','operation.read','dateField','calculatedAt',
      'description','Fichas técnicas Everest por prato e casa. Custos só são expostos quando custo_confiavel=true; composição e ingredientes sem custo permanecem sinalizados.',
      'fields',jsonb_build_array('unitName','dishName','yield','trustedCost','costPerKg','costReliable','compositionClosed','missingIngredientCount','calculatedAt')
    ),
    jsonb_build_object(
      'name','recebimentos','capability','operation.read','dateField','receivedAt',
      'description','Recebimentos de mercadorias ligados a pedidos e fornecedores. Quantidades mantêm sua unidade de medida e nunca são somadas entre unidades incompatíveis.',
      'fields',jsonb_build_array('unitName','orderNumber','supplier','receivedAt','receiptStatus','itemName','measurementUnit','orderedQuantity','receivedQuantity','itemStatus','divergent')
    ),
    jsonb_build_object(
      'name','caixas','capability','dashboard.read','dateField','date',
      'description','Fechamentos de caixa do Lorean por casa, dia e turno, sem operador ou CPF. difference é a diferença registrada entre total fechado e recebido.',
      'fields',jsonb_build_array('unitName','date','shift','registerCount','closedValue','receivedValue','difference','openRegisterCount','firstOpening','lastClosing')
    )
  ),true);
end
$$;

create or replace function public.ghost_assistant_query_v3(
  p_dataset text,
  p_from date default null,
  p_to date default null,
  p_unit text default null,
  p_search text default null,
  p_grain text default 'day',
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_from date := coalesce(p_from,date_trunc('month',current_date)::date);
  v_to date := coalesce(p_to,current_date);
begin
  if p_dataset not in ('fichas_tecnicas','recebimentos','caixas') then
    return public.ghost_assistant_query_v2(p_dataset,p_from,p_to,p_unit,p_search,p_grain,p_limit);
  end if;
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if v_from > v_to or v_from < date '2000-01-01' or v_to > current_date + 366
    or p_grain not in ('day','month') or length(coalesce(p_unit,'')) > 120
    or length(coalesce(p_search,'')) > 120 then
    raise invalid_parameter_value using message = 'invalid_assistant_query';
  end if;

  if p_dataset = 'fichas_tecnicas' then
    with filtered as (
      select u.name unit_name,f.nome_prato dish_name,f.rendimento yield_value,
        case when coalesce(c.custo_confiavel,false) then f.custo_total end trusted_cost,
        case when coalesce(c.custo_confiavel,false) then f.custo_por_kg end cost_per_kg,
        coalesce(c.custo_confiavel,false) cost_reliable,
        coalesce(f.composicao_fechada,false) composition_closed,
        case when jsonb_typeof(coalesce(c.ingredientes_sem_custo,'[]'::jsonb))='array'
          then jsonb_array_length(coalesce(c.ingredientes_sem_custo,'[]'::jsonb)) else 0 end missing_ingredient_count,
        f.calculado_em calculated_at
      from public.v_fichas_tecnicas_custo f
      join public.everest_fichas_tecnicas_custo c on c.id=f.id
      join public.units u on u.id=f.unit_id
      where f.calculado_em::date between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and (p_search is null or lower(public.unaccent(f.nome_prato)) like '%'||lower(public.unaccent(p_search))||'%')
    ), page as (
      select * from filtered order by cost_reliable desc,dish_name,unit_name limit v_limit
    ), by_unit as (
      select unit_name,count(*)::integer recipe_count,
        count(*) filter(where cost_reliable)::integer reliable_cost_count,
        count(*) filter(where composition_closed)::integer closed_composition_count,
        count(*) filter(where missing_ingredient_count>0)::integer recipes_with_missing_costs
      from filtered group by unit_name order by unit_name
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'dishName',dish_name,'yield',yield_value,
      'trustedCost',trusted_cost,'costPerKg',cost_per_kg,'costReliable',cost_reliable,
      'compositionClosed',composition_closed,'missingIngredientCount',missing_ingredient_count,
      'calculatedAt',calculated_at
    ) order by cost_reliable desc,dish_name,unit_name) from page),'[]'::jsonb),
    jsonb_build_object(
      'recipeCount',(select count(*) from filtered),
      'reliableCostCount',(select count(*) from filtered where cost_reliable),
      'closedCompositionCount',(select count(*) from filtered where composition_closed),
      'recipesWithMissingCosts',(select count(*) from filtered where missing_ingredient_count>0),
      'authorizedUnitCount',(select count(*) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')),
      'unitsWithDataCount',(select count(distinct unit_name) from filtered),
      'missingUnits',coalesce((select jsonb_agg(u.name order by u.name) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and not exists(select 1 from filtered f where f.unit_name=u.name)),'[]'::jsonb),
      'byUnit',coalesce((select jsonb_agg(jsonb_build_object(
        'unitName',unit_name,'recipeCount',recipe_count,'reliableCostCount',reliable_cost_count,
        'closedCompositionCount',closed_composition_count,'recipesWithMissingCosts',recipes_with_missing_costs
      ) order by unit_name) from by_unit),'[]'::jsonb)
    ) into v_rows,v_summary;

  elsif p_dataset = 'recebimentos' then
    with filtered as (
      select u.name unit_name,o.numero order_number,o.fornecedor supplier,
        r.created_at received_at,r.status receipt_status,ri.nome item_name,
        ri.unidade measurement_unit,ri.quantidade_pedida ordered_quantity,
        ri.quantidade_recebida received_quantity,ri.status item_status,
        coalesce(ri.quantidade_recebida,0) <> coalesce(ri.quantidade_pedida,0) divergent
      from public.recebimentos r
      join public.units u on u.id=r.unit_id
      left join public.purchase_orders o on o.id=r.pedido_id and o.unit_id=r.unit_id
      left join public.recebimento_itens ri on ri.recebimento_id=r.id
      where r.created_at::date between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and (p_search is null or lower(public.unaccent(concat_ws(' ',o.numero,o.fornecedor,r.status,ri.nome,ri.status))) like '%'||lower(public.unaccent(p_search))||'%')
    ), page as (
      select * from filtered order by received_at desc,unit_name,item_name limit v_limit
    ), by_unit as (
      select unit_name,count(distinct concat_ws('|',order_number,received_at::text))::integer receipt_count,
        count(item_name)::integer item_line_count,count(*) filter(where divergent)::integer divergent_item_count
      from filtered group by unit_name order by unit_name
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'orderNumber',order_number,'supplier',supplier,'receivedAt',received_at,
      'receiptStatus',receipt_status,'itemName',item_name,'measurementUnit',measurement_unit,
      'orderedQuantity',ordered_quantity,'receivedQuantity',received_quantity,'itemStatus',item_status,'divergent',divergent
    ) order by received_at desc,unit_name,item_name) from page),'[]'::jsonb),
    jsonb_build_object(
      'receiptCount',(select count(distinct concat_ws('|',unit_name,order_number,received_at::text)) from filtered),
      'itemLineCount',(select count(item_name) from filtered),
      'divergentItemCount',(select count(*) from filtered where divergent),
      'authorizedUnitCount',(select count(*) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')),
      'unitsWithDataCount',(select count(distinct unit_name) from filtered),
      'missingUnits',coalesce((select jsonb_agg(u.name order by u.name) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'operation.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and not exists(select 1 from filtered f where f.unit_name=u.name)),'[]'::jsonb),
      'byUnit',coalesce((select jsonb_agg(jsonb_build_object(
        'unitName',unit_name,'receiptCount',receipt_count,'itemLineCount',item_line_count,
        'divergentItemCount',divergent_item_count
      ) order by unit_name) from by_unit),'[]'::jsonb)
    ) into v_rows,v_summary;

  else
    with filtered as (
      select u.name unit_name,w.data,w.turno shift,c.abertura_at opening_at,c.fechamento_at closing_at,
        coalesce(c.total_fechado,0)::numeric closed_value,
        coalesce(c.total_recebido,0)::numeric received_value,
        coalesce(c.diferenca,0)::numeric difference,c.fechamento_at is null is_open
      from public.lorean_caixas c
      join public.lorean_workdays w on w.id=c.workday_id_fk
      join public.units u on u.id=w.unit_id
      where w.data between v_from and v_to
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and (p_search is null or lower(public.unaccent(coalesce(w.turno,''))) like '%'||lower(public.unaccent(p_search))||'%')
    ), grouped as (
      select unit_name,data,shift,count(*)::integer register_count,sum(closed_value) closed_value,
        sum(received_value) received_value,sum(difference) difference,
        count(*) filter(where is_open)::integer open_register_count,
        min(opening_at) first_opening,max(closing_at) last_closing
      from filtered group by unit_name,data,shift
    ), page as (
      select * from grouped order by data desc,unit_name,shift limit v_limit
    ), by_unit as (
      select unit_name,sum(register_count)::integer register_count,sum(closed_value) closed_value,
        sum(received_value) received_value,sum(difference) difference,
        sum(open_register_count)::integer open_register_count
      from grouped group by unit_name order by unit_name
    )
    select coalesce((select jsonb_agg(jsonb_build_object(
      'unitName',unit_name,'date',data,'shift',shift,'registerCount',register_count,
      'closedValue',closed_value,'receivedValue',received_value,'difference',difference,
      'openRegisterCount',open_register_count,'firstOpening',first_opening,'lastClosing',last_closing
    ) order by data desc,unit_name,shift) from page),'[]'::jsonb),
    jsonb_build_object(
      'registerCount',coalesce((select sum(register_count) from grouped),0),
      'closedValue',coalesce((select sum(closed_value) from grouped),0),
      'receivedValue',coalesce((select sum(received_value) from grouped),0),
      'difference',coalesce((select sum(difference) from grouped),0),
      'openRegisterCount',coalesce((select sum(open_register_count) from grouped),0),
      'authorizedUnitCount',(select count(*) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')),
      'unitsWithDataCount',(select count(distinct unit_name) from grouped),
      'missingUnits',coalesce((select jsonb_agg(u.name order by u.name) from public.units u where u.active
        and ghost_private.user_has_capability(v_user_id,u.id,'assistant.ask')
        and ghost_private.user_has_capability(v_user_id,u.id,'dashboard.read')
        and (p_unit is null or lower(public.unaccent(u.name)) like '%'||lower(public.unaccent(p_unit))||'%')
        and not exists(select 1 from grouped g where g.unit_name=u.name)),'[]'::jsonb),
      'byUnit',coalesce((select jsonb_agg(jsonb_build_object(
        'unitName',unit_name,'registerCount',register_count,'closedValue',closed_value,
        'receivedValue',received_value,'difference',difference,'openRegisterCount',open_register_count
      ) order by unit_name) from by_unit),'[]'::jsonb)
    ) into v_rows,v_summary;
  end if;

  return jsonb_build_object('dataset',p_dataset,'from',v_from,'to',v_to,'grain',p_grain,
    'rowCount',jsonb_array_length(v_rows),'limit',v_limit,'summary',v_summary,'rows',v_rows);
end
$$;

revoke all on function public.ghost_assistant_catalog_v2() from public, anon;
revoke all on function public.ghost_assistant_query_v3(text,date,date,text,text,text,integer) from public, anon;
grant execute on function public.ghost_assistant_catalog_v2() to authenticated;
grant execute on function public.ghost_assistant_query_v3(text,date,date,text,text,text,integer) to authenticated;

comment on function public.ghost_assistant_catalog_v2() is
  'Adds safe semantic contracts for recipe costs, goods receipts and cash registers.';
comment on function public.ghost_assistant_query_v3(text,date,date,text,text,text,integer) is
  'Authorized read-only semantic query including recipe costs, goods receipts and cash registers.';
