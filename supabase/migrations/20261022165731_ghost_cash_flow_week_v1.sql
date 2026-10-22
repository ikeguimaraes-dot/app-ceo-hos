-- Weekly read-only cash-flow projection for Ghost. Revenue is recognized on
-- D+1 and weekend maturities are displayed on the next business day, matching
-- the established KPH Financeiro projection.

create or replace function public.ghost_cash_flow_week_v1(
  p_unit_id uuid,
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
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'dashboard.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  v_start := v_today + (v_offset * 7);
  v_end := v_start + 6;

  with days as (
    select generated::date as flow_date
    from generate_series(v_start, v_end, interval '1 day') generated
  ), revenues as (
    select (w.data + 1)::date as flow_date,
      sum(greatest(coalesce(w.receita_bruta, 0), 0))::numeric as incoming
    from public.lorean_workdays w
    where w.unit_id = p_unit_id
      and w.data between v_start - 1 and v_end - 1
    group by w.data
  ), payable_dates as (
    select case extract(isodow from t.dt_vencimento)
        when 6 then t.dt_vencimento + 2
        when 7 then t.dt_vencimento + 1
        else t.dt_vencimento
      end as flow_date,
      greatest(coalesce(t.vl_saldo, t.vl_titulo, 0), 0)::numeric as amount
    from public.everest_titulos_fornecedor_completo t
    where t.unit_id = p_unit_id
      and t.dt_liquidacao is null
      and coalesce(t.fluxo_de_caixa, true)
      and coalesce(t.vl_saldo, t.vl_titulo, 0) > 0
      and t.dt_vencimento between v_start and v_end
  ), outgoings as (
    select flow_date, sum(amount)::numeric as outgoing
    from payable_dates
    group by flow_date
  ), flows as (
    select d.flow_date,
      coalesce(r.incoming, 0)::numeric as incoming,
      coalesce(o.outgoing, 0)::numeric as outgoing
    from days d
    left join revenues r using (flow_date)
    left join outgoings o using (flow_date)
  ), balanced as (
    select flow_date, incoming, outgoing,
      sum(incoming - outgoing) over (order by flow_date rows unbounded preceding)::numeric as balance
    from flows
  )
  select jsonb_build_object(
    'updatedAt', now(),
    'weekStart', v_start,
    'weekEnd', v_end,
    'incoming', coalesce(sum(incoming), 0),
    'outgoing', coalesce(sum(outgoing), 0),
    'balance', coalesce(sum(incoming - outgoing), 0),
    'goesNegative', coalesce(bool_or(balance < 0), false),
    'days', coalesce(jsonb_agg(jsonb_build_object(
      'date', flow_date,
      'incoming', incoming,
      'outgoing', outgoing,
      'balance', balance
    ) order by flow_date), '[]'::jsonb)
  ) into v_result
  from balanced;

  return v_result;
end
$$;

revoke all on function public.ghost_cash_flow_week_v1(uuid,integer) from public, anon;
grant execute on function public.ghost_cash_flow_week_v1(uuid,integer) to authenticated;
comment on function public.ghost_cash_flow_week_v1(uuid,integer) is
  'Read-only, unit-scoped weekly cash-flow projection for Ghost; revenue D+1 and open payables only.';
