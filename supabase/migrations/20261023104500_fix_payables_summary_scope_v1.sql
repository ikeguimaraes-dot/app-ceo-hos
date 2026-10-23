-- Keep summary cards relative to today while the list follows the selected due-date period.

create or replace function public.ghost_payables_v3(
  p_unit_id uuid default null,
  p_status text default 'open',
  p_from date default current_date,
  p_to date default current_date,
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
  v_today date := timezone('America/Sao_Paulo', now())::date;
  v_from date := coalesce(p_from, v_today);
  v_to date := coalesce(p_to, v_from);
  v_status text := coalesce(nullif(lower(p_status), ''), 'open');
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_unit_ids uuid[];
  v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if v_status not in ('open', 'upcoming', 'overdue', 'paid') then
    raise invalid_parameter_value using message = 'invalid_payables_status';
  end if;
  if v_from > v_to or v_to - v_from > 366 then
    raise invalid_parameter_value using message = 'invalid_payables_period';
  end if;

  select coalesce(array_agg(u.id), array[]::uuid[]) into v_unit_ids
  from public.units u
  where ghost_private.user_has_capability(v_user_id, u.id, 'dashboard.read');

  if p_unit_id is not null and not (p_unit_id = any(v_unit_ids)) then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if cardinality(v_unit_ids) = 0 then raise insufficient_privilege using message = 'unit_capability_denied'; end if;

  with titles as (
    select t.id, t.unit_id, u.name unit_name,
      coalesce(nullif(t.fornecedor_nome, ''), 'Fornecedor não identificado') supplier,
      coalesce(nullif(t.documento, ''), t.nr_titulo::text, t.nr_nota::text, 'Sem documento') document,
      t.dt_vencimento::date due_date, t.dt_liquidacao::date paid_date,
      (t.dt_liquidacao is not null or lower(coalesce(t.ds_situacao, '')) = 'liquidado') is_paid,
      greatest(case when t.dt_liquidacao is not null or lower(coalesce(t.ds_situacao, '')) = 'liquidado'
        then coalesce(t.vl_pagamento, t.vl_titulo, 0)
        else coalesce(t.vl_saldo, t.vl_titulo, 0) end, 0)::numeric amount,
      nullif(t.ds_forma_pagamento, '') payment_method
    from public.everest_titulos_fornecedor_completo t
    join public.units u on u.id = t.unit_id
    where t.unit_id = any(v_unit_ids) and (p_unit_id is null or t.unit_id = p_unit_id)
  ), relevant as (
    select * from titles where amount > 0
  ), all_open as (
    select * from relevant where not is_paid
  ), period_titles as (
    select * from relevant where due_date between v_from and v_to
  ), period_open as (
    select * from period_titles where not is_paid
  ), filtered as (
    select * from period_titles where case v_status
      when 'paid' then is_paid
      when 'overdue' then not is_paid and due_date < v_today
      when 'upcoming' then not is_paid and due_date >= v_today
      else not is_paid end
  ), listed as (
    select * from filtered order by
      case when v_status = 'paid' then paid_date end desc nulls last,
      case when v_status <> 'paid' then due_date end asc nulls last,
      amount desc, id limit v_limit
  )
  select jsonb_build_object(
    'updatedAt', now(), 'asOf', v_today,
    'scope', case when p_unit_id is null then 'all' else 'unit' end,
    'openAmount', coalesce((select sum(amount) from period_open), 0),
    'overdueAmount', coalesce((select sum(amount) from all_open where due_date < v_today), 0),
    'dueTodayAmount', coalesce((select sum(amount) from all_open where due_date = v_today), 0),
    'next7DaysAmount', coalesce((select sum(amount) from all_open where due_date > v_today and due_date <= v_today + 7), 0),
    'paidAmount', coalesce((select sum(amount) from period_titles where is_paid), 0),
    'openCount', (select count(*) from period_open),
    'overdueCount', (select count(*) from all_open where due_date < v_today),
    'paidCount', (select count(*) from period_titles where is_paid),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'unitId', unit_id, 'unitName', unit_name, 'supplier', supplier,
      'document', document, 'dueDate', due_date, 'paidDate', paid_date, 'amount', amount,
      'status', case when is_paid then 'paid' when due_date < v_today then 'overdue'
        when due_date = v_today then 'due_today' else 'upcoming' end,
      'daysOverdue', case when not is_paid and due_date < v_today then v_today - due_date else 0 end,
      'paymentMethod', payment_method
    ) order by case when v_status = 'paid' then paid_date end desc nulls last,
      case when v_status <> 'paid' then due_date end asc nulls last, amount desc, id) from listed), '[]'::jsonb)
  ) into v_result;
  return v_result;
end
$$;

revoke all on function public.ghost_payables_v3(uuid,text,date,date,integer) from public, anon;
grant execute on function public.ghost_payables_v3(uuid,text,date,date,integer) to authenticated;
comment on function public.ghost_payables_v3(uuid,text,date,date,integer) is
  'Read-only authorized-unit accounts payable filtered by an explicit due-date period.';
