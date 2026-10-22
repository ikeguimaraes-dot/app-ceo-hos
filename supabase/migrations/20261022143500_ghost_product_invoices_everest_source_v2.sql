-- Align Ghost's NF screen with the KPH CMV product source.
-- The finance application reads everest_facade_uniao, where each row is an
-- invoice item. Ghost groups those item rows into one card per DANFE.

create or replace function public.ghost_product_invoices_v1(
  p_unit_id uuid,
  p_month date default current_date,
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
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'operation.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if v_start > current_date then
    raise invalid_parameter_value using message = 'invalid_invoice_month';
  end if;

  with invoice_lines as (
    select
      coalesce(nullif(trim(f.nr_danfe::text), ''), 'Sem número') invoice_number,
      coalesce(f.dt_emissao::date, make_date(f.ano_lancamento, f.mes_lancamento, 1)) issue_date,
      coalesce(nullif(trim(f.fornecedor_nome), ''), 'Fornecedor não identificado') supplier,
      nullif(trim(f.cfop::text), '') cfop,
      greatest(coalesce(f.v_total_danfe, 0), 0)::numeric invoice_total,
      greatest(coalesce(f.v_total_embalagem, f.v_custo_total, 0), 0)::numeric item_total
    from public.everest_facade_uniao f
    where f.unit_id = p_unit_id
      and f.mes_lancamento = extract(month from v_start)::integer
      and f.ano_lancamento = extract(year from v_start)::integer
  ), grouped as (
    select
      md5(concat_ws('|', p_unit_id::text, invoice_number, issue_date::text, supplier)) id,
      invoice_number,
      issue_date,
      supplier,
      string_agg(distinct cfop, ', ' order by cfop) cfop,
      null::text status,
      case when max(invoice_total) > 0 then max(invoice_total) else sum(item_total) end total_value,
      count(*)::integer item_count
    from invoice_lines
    group by invoice_number, issue_date, supplier
  ), totals as (
    select
      coalesce(sum(total_value), 0) total_purchased,
      count(*)::integer invoice_count,
      count(distinct supplier)::integer supplier_count
    from grouped
  ), page as (
    select * from grouped
    order by issue_date desc, total_value desc
    limit v_limit
  )
  select jsonb_build_object(
    'updatedAt', now(),
    'periodStart', v_start,
    'periodEnd', v_end,
    'totalPurchased', t.total_purchased,
    'invoiceCount', t.invoice_count,
    'supplierCount', t.supplier_count,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'invoiceNumber', p.invoice_number,
      'issueDate', p.issue_date,
      'supplier', p.supplier,
      'cfop', p.cfop,
      'status', p.status,
      'totalValue', p.total_value,
      'itemCount', p.item_count
    ) order by p.issue_date desc, p.total_value desc) from page p), '[]'::jsonb)
  ) into v_result
  from totals t;

  return v_result;
end
$$;

revoke all on function public.ghost_product_invoices_v1(uuid,date,integer) from public, anon;
grant execute on function public.ghost_product_invoices_v1(uuid,date,integer) to authenticated;

comment on function public.ghost_product_invoices_v1(uuid,date,integer) is
  'Authorized product invoices grouped from the same Everest facade used by KPH CMV.';
