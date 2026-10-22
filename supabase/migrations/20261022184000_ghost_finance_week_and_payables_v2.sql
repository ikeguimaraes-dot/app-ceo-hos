-- Consolidated accounts payable and Monday-Sunday sales cash-flow contracts.
-- An omitted unit means every unit the authenticated user can read.

create or replace function public.ghost_payables_v2(
  p_unit_id uuid default null,
  p_status text default 'open',
  p_as_of date default current_date,
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
  v_as_of date := coalesce(p_as_of, timezone('America/Sao_Paulo', now())::date);
  v_status text := coalesce(nullif(lower(p_status), ''), 'open');
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_unit_ids uuid[];
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if v_status not in ('open', 'upcoming', 'overdue', 'paid') then
    raise invalid_parameter_value using message = 'invalid_payables_status';
  end if;

  select coalesce(array_agg(u.id), array[]::uuid[])
    into v_unit_ids
  from public.units u
  where ghost_private.user_has_capability(v_user_id, u.id, 'dashboard.read');

  if p_unit_id is not null and not (p_unit_id = any(v_unit_ids)) then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if cardinality(v_unit_ids) = 0 then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  with titles as (
    select
      t.id,
      t.unit_id,
      u.name unit_name,
      coalesce(nullif(t.fornecedor_nome, ''), 'Fornecedor não identificado') supplier,
      coalesce(nullif(t.documento, ''), t.nr_titulo::text, t.nr_nota::text, 'Sem documento') document,
      t.dt_vencimento due_date,
      t.dt_liquidacao paid_date,
      (t.dt_liquidacao is not null or lower(coalesce(t.ds_situacao, '')) = 'liquidado') is_paid,
      greatest(case
        when t.dt_liquidacao is not null or lower(coalesce(t.ds_situacao, '')) = 'liquidado'
          then coalesce(t.vl_pagamento, t.vl_titulo, 0)
        else coalesce(t.vl_saldo, t.vl_titulo, 0)
      end, 0)::numeric amount,
      nullif(t.ds_forma_pagamento, '') payment_method
    from public.everest_titulos_fornecedor_completo t
    join public.units u on u.id = t.unit_id
    where t.unit_id = any(v_unit_ids)
      and (p_unit_id is null or t.unit_id = p_unit_id)
  ), relevant as (
    select * from titles where amount > 0
  ), open_titles as (
    select * from relevant where not is_paid
  ), filtered as (
    select * from relevant
    where case v_status
      when 'paid' then is_paid
      when 'overdue' then not is_paid and due_date < v_as_of
      when 'upcoming' then not is_paid and (due_date is null or due_date >= v_as_of)
      else not is_paid
    end
  ), listed as (
    select * from filtered
    order by
      case when v_status = 'paid' then paid_date end desc nulls last,
      case when v_status <> 'paid' then due_date end asc nulls last,
      amount desc,
      id
    limit v_limit
  )
  select jsonb_build_object(
    'updatedAt', now(),
    'asOf', v_as_of,
    'scope', case when p_unit_id is null then 'all' else 'unit' end,
    'openAmount', coalesce((select sum(amount) from open_titles), 0),
    'overdueAmount', coalesce((select sum(amount) from open_titles where due_date < v_as_of), 0),
    'dueTodayAmount', coalesce((select sum(amount) from open_titles where due_date = v_as_of), 0),
    'next7DaysAmount', coalesce((select sum(amount) from open_titles where due_date > v_as_of and due_date <= v_as_of + 7), 0),
    'paidAmount', coalesce((select sum(amount) from relevant where is_paid), 0),
    'openCount', (select count(*) from open_titles),
    'overdueCount', (select count(*) from open_titles where due_date < v_as_of),
    'paidCount', (select count(*) from relevant where is_paid),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'unitId', unit_id,
      'unitName', unit_name,
      'supplier', supplier,
      'document', document,
      'dueDate', due_date,
      'paidDate', paid_date,
      'amount', amount,
      'status', case
        when is_paid then 'paid'
        when due_date < v_as_of then 'overdue'
        when due_date = v_as_of then 'due_today'
        else 'upcoming'
      end,
      'daysOverdue', case when not is_paid and due_date < v_as_of then v_as_of - due_date else 0 end,
      'paymentMethod', payment_method
    ) order by
      case when v_status = 'paid' then paid_date end desc nulls last,
      case when v_status <> 'paid' then due_date end asc nulls last,
      amount desc,
      id) from listed), '[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.ghost_payables_v2(uuid,text,date,integer) from public, anon;
grant execute on function public.ghost_payables_v2(uuid,text,date,integer) to authenticated;
comment on function public.ghost_payables_v2(uuid,text,date,integer) is
  'Read-only authorized-unit accounts payable summary with open, upcoming, overdue and paid lists.';

create or replace function public.ghost_cash_flow_week_v2(
  p_unit_id uuid default null,
  p_week_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offset integer := least(greatest(coalesce(p_week_offset, 0), 0), 3);
  v_today date := timezone('America/Sao_Paulo', now())::date;
  v_start date;
  v_end date;
  v_unit_ids uuid[];
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select coalesce(array_agg(u.id), array[]::uuid[])
    into v_unit_ids
  from public.units u
  where ghost_private.user_has_capability(v_user_id, u.id, 'dashboard.read');

  if p_unit_id is not null and not (p_unit_id = any(v_unit_ids)) then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if cardinality(v_unit_ids) = 0 then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  v_start := v_today - (extract(isodow from v_today)::integer - 1) + (v_offset * 7);
  v_end := v_start + 6;

  with selected_units as (
    select unnest(case when p_unit_id is null then v_unit_ids else array[p_unit_id] end) unit_id
  ), days as (
    select generated::date flow_date
    from generate_series(v_start, v_end, interval '1 day') generated
  ), sales as (
    select w.unit_id, w.data::date sale_date,
      sum(greatest(coalesce(w.receita_bruta, w.previsto, 0), 0))::numeric revenue
    from public.lorean_workdays w
    where w.unit_id = any(case when p_unit_id is null then v_unit_ids else array[p_unit_id] end)
      and w.data between v_start - 35 and v_end
    group by w.unit_id, w.data
  ), unit_days as (
    select su.unit_id, d.flow_date,
      case when d.flow_date < v_today and current_sale.revenue is not null
        then current_sale.revenue else 0 end::numeric actual_incoming,
      case when d.flow_date < v_today and current_sale.revenue is not null then 0
        else coalesce(history.average_revenue, 0) end::numeric projected_incoming
    from selected_units su
    cross join days d
    left join sales current_sale
      on current_sale.unit_id = su.unit_id and current_sale.sale_date = d.flow_date
    left join lateral (
      select avg(s.revenue)::numeric average_revenue
      from generate_series(1, 5) occurrence
      join sales s on s.unit_id = su.unit_id
        and s.sale_date = d.flow_date - (occurrence * 7)
    ) history on true
  ), incoming_by_day as (
    select flow_date,
      sum(actual_incoming)::numeric actual_incoming,
      sum(projected_incoming)::numeric projected_incoming
    from unit_days
    group by flow_date
  ), outgoings as (
    select t.dt_vencimento::date flow_date,
      sum(greatest(coalesce(t.vl_saldo, t.vl_titulo, 0), 0))::numeric outgoing
    from public.everest_titulos_fornecedor_completo t
    where t.unit_id = any(case when p_unit_id is null then v_unit_ids else array[p_unit_id] end)
      and t.dt_liquidacao is null
      and coalesce(t.fluxo_de_caixa, true)
      and coalesce(t.vl_saldo, t.vl_titulo, 0) > 0
      and t.dt_vencimento between v_start and v_end
    group by t.dt_vencimento
  ), flows as (
    select d.flow_date,
      coalesce(i.actual_incoming, 0)::numeric actual_incoming,
      coalesce(i.projected_incoming, 0)::numeric projected_incoming,
      (coalesce(i.actual_incoming, 0) + coalesce(i.projected_incoming, 0))::numeric incoming,
      coalesce(o.outgoing, 0)::numeric outgoing
    from days d
    left join incoming_by_day i using (flow_date)
    left join outgoings o using (flow_date)
  ), balanced as (
    select *, sum(incoming - outgoing) over (order by flow_date rows unbounded preceding)::numeric balance
    from flows
  )
  select jsonb_build_object(
    'updatedAt', now(),
    'weekStart', v_start,
    'weekEnd', v_end,
    'scope', case when p_unit_id is null then 'all' else 'unit' end,
    'historyWeeks', 5,
    'actualIncoming', coalesce(sum(actual_incoming), 0),
    'projectedIncoming', coalesce(sum(projected_incoming), 0),
    'incoming', coalesce(sum(incoming), 0),
    'outgoing', coalesce(sum(outgoing), 0),
    'balance', coalesce(sum(incoming - outgoing), 0),
    'goesNegative', coalesce(bool_or(balance < 0), false),
    'days', coalesce(jsonb_agg(jsonb_build_object(
      'date', flow_date,
      'actualIncoming', actual_incoming,
      'projectedIncoming', projected_incoming,
      'projected', projected_incoming > 0,
      'incoming', incoming,
      'outgoing', outgoing,
      'balance', balance
    ) order by flow_date), '[]'::jsonb)
  ) into v_result
  from balanced;

  return v_result;
end
$$;

revoke all on function public.ghost_cash_flow_week_v2(uuid,integer) from public, anon;
grant execute on function public.ghost_cash_flow_week_v2(uuid,integer) to authenticated;
comment on function public.ghost_cash_flow_week_v2(uuid,integer) is
  'Read-only Monday-Sunday cash flow using realized sales before today and five-week weekday averages for today and future days.';
