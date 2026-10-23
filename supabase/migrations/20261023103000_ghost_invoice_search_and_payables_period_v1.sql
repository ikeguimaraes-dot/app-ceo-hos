-- Server-side NF search and explicit due-date periods for the mobile finance views.

create or replace function public.ghost_product_invoices_v2(
  p_unit_id uuid,
  p_month date default current_date,
  p_search text default null,
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
  v_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month - 1 day')::date;
  v_search text := lower(nullif(trim(coalesce(p_search, '')), ''));
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'operation.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if v_start > current_date then raise invalid_parameter_value using message = 'invalid_invoice_month'; end if;

  with invoice_lines as (
    select
      md5(concat_ws('|', p_unit_id::text, coalesce(f.nr_danfe::text, ''), coalesce(f.dt_emissao::date::text, ''), coalesce(f.fornecedor_nome, ''))) invoice_id,
      md5(concat_ws('|', p_unit_id::text, coalesce(f.nr_danfe::text, ''), coalesce(f.item_codigo, ''), f.id::text)) line_id,
      coalesce(nullif(trim(f.nr_danfe::text), ''), 'Sem número') invoice_number,
      coalesce(f.dt_emissao::date, make_date(f.ano_lancamento, f.mes_lancamento, 1)) issue_date,
      coalesce(nullif(trim(f.fornecedor_nome), ''), 'Fornecedor não identificado') supplier,
      nullif(trim(f.cfop::text), '') cfop,
      greatest(coalesce(f.v_total_danfe, 0), 0)::numeric invoice_total,
      greatest(abs(coalesce(f.v_total_embalagem, f.v_custo_total, 0)), 0)::numeric item_total,
      coalesce(nullif(trim(f.item_descricao), ''), nullif(trim(f.desc_gerencial), ''), 'Item sem descrição') item_description,
      nullif(trim(f.desc_gerencial), '') category,
      nullif(trim(f.item_codigo), '') item_code,
      f.q_embalagem::numeric quantity,
      nullif(trim(f.unidade_medida), '') unit_name,
      coalesce(f.v_custo_compra, f.v_custo_medio)::numeric unit_cost,
      f.perc_variacao::numeric variation,
      f.entra_cmv_cfop included_in_cmv
    from public.everest_facade_uniao f
    where f.unit_id = p_unit_id
      and f.mes_lancamento = extract(month from v_start)::integer
      and f.ano_lancamento = extract(year from v_start)::integer
  ), grouped as (
    select invoice_id id, invoice_number, issue_date, supplier,
      string_agg(distinct cfop, ', ' order by cfop) cfop, null::text status,
      case when max(invoice_total) > 0 then max(invoice_total) else sum(item_total) end total_value,
      count(*)::integer item_count,
      jsonb_agg(jsonb_build_object(
        'id', line_id, 'description', item_description, 'category', category,
        'quantity', quantity, 'unit', unit_name, 'unitCost', unit_cost,
        'totalCost', item_total, 'variation', variation, 'includedInCmv', included_in_cmv
      ) order by item_description) items
    from invoice_lines
    group by invoice_id, invoice_number, issue_date, supplier
  ), matching as (
    select distinct l.invoice_id
    from invoice_lines l
    where v_search is null
      or lower(concat_ws(' ', l.invoice_number, l.supplier, l.cfop, l.item_code, l.item_description, l.category)) like '%' || v_search || '%'
  ), totals as (
    select coalesce(sum(total_value), 0) total_purchased, count(*)::integer invoice_count,
      count(distinct supplier)::integer supplier_count
    from grouped
  ), page as (
    select g.* from grouped g join matching m on m.invoice_id = g.id
    order by g.issue_date desc, g.total_value desc limit v_limit
  )
  select jsonb_build_object(
    'updatedAt', now(), 'periodStart', v_start, 'periodEnd', v_end,
    'totalPurchased', t.total_purchased, 'invoiceCount', t.invoice_count, 'supplierCount', t.supplier_count,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'invoiceNumber', p.invoice_number, 'issueDate', p.issue_date,
      'supplier', p.supplier, 'cfop', p.cfop, 'status', p.status,
      'totalValue', p.total_value, 'itemCount', p.item_count, 'items', p.items
    ) order by p.issue_date desc, p.total_value desc) from page p), '[]'::jsonb)
  ) into v_result from totals t;
  return v_result;
end
$$;

revoke all on function public.ghost_product_invoices_v2(uuid,date,text,integer) from public, anon;
grant execute on function public.ghost_product_invoices_v2(uuid,date,text,integer) to authenticated;
comment on function public.ghost_product_invoices_v2(uuid,date,text,integer) is
  'Read-only authorized-unit invoice search by product, supplier, item code, CFOP or invoice number.';

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
    select * from titles where amount > 0 and due_date between v_from and v_to
  ), open_titles as (
    select * from relevant where not is_paid
  ), filtered as (
    select * from relevant where case v_status
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
    'openAmount', coalesce((select sum(amount) from open_titles), 0),
    'overdueAmount', coalesce((select sum(amount) from open_titles where due_date < v_today), 0),
    'dueTodayAmount', coalesce((select sum(amount) from open_titles where due_date = v_today), 0),
    'next7DaysAmount', coalesce((select sum(amount) from open_titles where due_date > v_today and due_date <= v_today + 7), 0),
    'paidAmount', coalesce((select sum(amount) from relevant where is_paid), 0),
    'openCount', (select count(*) from open_titles),
    'overdueCount', (select count(*) from open_titles where due_date < v_today),
    'paidCount', (select count(*) from relevant where is_paid),
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
