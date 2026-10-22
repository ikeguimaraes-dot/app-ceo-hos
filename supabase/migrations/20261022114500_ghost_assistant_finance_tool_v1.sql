-- Date-aware financial read model for the Ghost assistant. The function
-- derives the complete authorized portfolio from auth.uid() and never accepts
-- unit IDs from the client or model.

create or replace function public.ghost_assistant_finance_v1(
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if p_from is null or p_to is null or p_from > p_to
    or p_to - p_from > 92 or p_to > current_date then
    raise invalid_parameter_value using message = 'invalid_finance_period';
  end if;

  with scoped_units as (
    select distinct u.id, u.name, b.name brand, g.name "group"
    from public.units u
    join public.brands b on b.id = u.brand_id
    join public.groups g on g.id = b.group_id
    where u.active is true
      and ghost_private.user_has_capability(v_user_id, u.id, 'assistant.ask')
      and ghost_private.user_has_capability(v_user_id, u.id, 'dashboard.read')
  ), days as (
    select generate_series(p_from, p_to, interval '1 day')::date business_date
  ), workdays as (
    select w.unit_id, w.data business_date,
      sum(w.receita_bruta) "grossRevenue",
      sum(w.receita_liquida) "netRevenue",
      sum(w.desconto) discount,
      sum(w.gorjeta) tips,
      sum(w.custo) cost,
      sum(w.lucro) profit,
      sum(w.clientes) customers,
      case when sum(w.clientes) > 0
        then sum(w.receita_liquida) / sum(w.clientes)
        else null end "averageTicket",
      count(*) "workdayCount",
      bool_or(coalesce(w.qualidade_suspeito, false)) "qualityWarning",
      max(w.criado_em) "updatedAt"
    from public.lorean_workdays w
    join scoped_units u on u.id = w.unit_id
    where w.data between p_from and p_to
    group by w.unit_id, w.data
  ), payments as (
    select w.unit_id, w.data business_date,
      sum(p.valor_fechado) "closedRevenue",
      sum(p.valor_recebido) "receivedRevenue",
      sum(p.diferenca) difference,
      max(p.criado_em) "updatedAt"
    from public.lorean_workdays w
    join scoped_units u on u.id = w.unit_id
    join public.lorean_pagamentos p on p.workday_id_fk = w.id
    where w.data between p_from and p_to
    group by w.unit_id, w.data
  ), rows as (
    select u.name, u.brand, u."group", d.business_date,
      p."closedRevenue", p."receivedRevenue", p.difference,
      w."grossRevenue", w."netRevenue", w.discount, w.tips, w.cost,
      w.profit, w.customers, w."averageTicket", w."workdayCount",
      coalesce(w."qualityWarning", false) "qualityWarning",
      coalesce(p."updatedAt", w."updatedAt") "updatedAt",
      coalesce(
        (select o.meta from public.metas_dia_override o
          where o.unit_id = u.id and o.data = d.business_date),
        (select s.meta from public.metas_dia_semana s
          where s.unit_id = u.id
            and s.competencia = to_char(d.business_date, 'YYYY-MM')
            and s.dia_semana = extract(dow from d.business_date)::integer)
      ) goal
    from scoped_units u cross join days d
    left join workdays w on w.unit_id = u.id and w.business_date = d.business_date
    left join payments p on p.unit_id = u.id and p.business_date = d.business_date
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'timezone', 'America/Sao_Paulo',
    'currency', 'BRL',
    'updatedAt', now(),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'unitName', name,
      'brand', brand,
      'group', "group",
      'date', business_date,
      'closedRevenue', "closedRevenue",
      'receivedRevenue', "receivedRevenue",
      'grossRevenue', "grossRevenue",
      'netRevenue', "netRevenue",
      'discount', discount,
      'tips', tips,
      'cost', cost,
      'profit', profit,
      'customers', customers,
      'averageTicket', "averageTicket",
      'goal', goal,
      'difference', difference,
      'workdayCount', "workdayCount",
      'hasData', "workdayCount" is not null,
      'qualityWarning', "qualityWarning",
      'updatedAt', "updatedAt"
    ) order by business_date, name), '[]'::jsonb)
  ) into v_result
  from rows;

  return v_result;
end
$$;

revoke all on function public.ghost_assistant_finance_v1(date,date) from public, anon;
grant execute on function public.ghost_assistant_finance_v1(date,date) to authenticated;

comment on function public.ghost_assistant_finance_v1(date,date) is
  'Authorized portfolio financial facts by day for the Ghost assistant, limited to 93 days.';
