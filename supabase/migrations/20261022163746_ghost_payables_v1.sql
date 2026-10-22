-- Read-only accounts payable projection for Ghost. The client receives a
-- minimized contract and never accesses the financial source view directly.

create or replace function public.ghost_payables_v1(
  p_unit_id uuid,
  p_as_of date default current_date,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_as_of date := coalesce(p_as_of, current_date);
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'dashboard.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  with open_titles as (
    select
      t.id,
      coalesce(nullif(t.fornecedor_nome, ''), 'Fornecedor não identificado') supplier,
      coalesce(nullif(t.documento, ''), t.nr_titulo::text, t.nr_nota::text, 'Sem documento') document,
      t.dt_vencimento due_date,
      greatest(coalesce(t.vl_saldo, t.vl_titulo, 0), 0)::numeric amount,
      nullif(t.ds_forma_pagamento, '') payment_method
    from public.everest_titulos_fornecedor_completo t
    where t.unit_id = p_unit_id
      and t.dt_liquidacao is null
      and coalesce(t.vl_saldo, t.vl_titulo, 0) > 0
  ), listed as (
    select * from open_titles
    order by due_date asc nulls last, amount desc, id
    limit v_limit
  )
  select jsonb_build_object(
    'updatedAt', now(),
    'asOf', v_as_of,
    'openAmount', coalesce((select sum(amount) from open_titles), 0),
    'overdueAmount', coalesce((select sum(amount) from open_titles where due_date < v_as_of), 0),
    'dueTodayAmount', coalesce((select sum(amount) from open_titles where due_date = v_as_of), 0),
    'next7DaysAmount', coalesce((select sum(amount) from open_titles where due_date > v_as_of and due_date <= v_as_of + 7), 0),
    'openCount', (select count(*) from open_titles),
    'overdueCount', (select count(*) from open_titles where due_date < v_as_of),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id,
      'supplier', supplier,
      'document', document,
      'dueDate', due_date,
      'amount', amount,
      'status', case
        when due_date < v_as_of then 'overdue'
        when due_date = v_as_of then 'due_today'
        else 'upcoming'
      end,
      'daysOverdue', case when due_date < v_as_of then v_as_of - due_date else 0 end,
      'paymentMethod', payment_method
    ) order by due_date asc nulls last, amount desc, id) from listed), '[]'::jsonb)
  ) into v_result;

  return v_result;
end
$$;

revoke all on function public.ghost_payables_v1(uuid,date,integer) from public, anon;
grant execute on function public.ghost_payables_v1(uuid,date,integer) to authenticated;
comment on function public.ghost_payables_v1(uuid,date,integer) is
  'Read-only, unit-scoped accounts payable summary and prioritized title list for Ghost.';
