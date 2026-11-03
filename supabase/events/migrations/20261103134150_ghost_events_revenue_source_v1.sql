-- Aggregates only the financial fields already used by the KPH web dashboard.
-- This source RPC is callable only by the Events Edge Function's server identity.
create or replace function public.ghost_events_revenue_source_v1(
  p_unit_id uuid, p_start date, p_end date
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_house text; v_days jsonb;
begin
  if p_start is null or p_end is null or p_end < p_start
     or p_start <> date_trunc('month',p_start)::date
     or p_end >= (p_start + interval '1 month')::date then
    raise invalid_parameter_value using message='invalid_events_period';
  end if;
  v_house := case p_unit_id
    when '674eac8c-5a38-4a42-aa60-0a666387909b' then 'MEET & EAT'
    when '970db6d9-9ff9-4284-9f76-9fbeb494ea04' then 'Match'
    when 'f9c6c7fc-2ecc-4f79-98ce-c3118b670182' then 'MADONNA CUCINA'
    when 'f2a6c9f8-929f-447b-9f77-edd8dad19bd0' then 'Frêneze'
  end;
  if v_house is null then return '[]'::jsonb; end if;
  if exists (
    select 1 from public.eventos e
    cross join lateral (values(e.custo_evento),(e.valor_cobrado),(e.extras_valor)) a(amount)
    where e.casa=v_house and e.data_inicio between p_start and p_end
      and lower(coalesce(e.status,'')) <> 'cancelado'
      and (a.amount < 0 or a.amount::text in ('NaN','Infinity','-Infinity'))
  ) then raise data_exception using message='invalid_event_amount'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',d.date,'revenue',d.revenue) order by d.date),'[]'::jsonb)
  into v_days from (
    select e.data_inicio date,
      sum(round(coalesce(e.custo_evento,0)*100) + round(coalesce(e.valor_cobrado,0)*100)
        + round(coalesce(e.extras_valor,0)*100))/100 revenue
    from public.eventos e
    where e.casa=v_house and e.data_inicio between p_start and p_end
      and lower(coalesce(e.status,'')) <> 'cancelado'
    group by e.data_inicio
  ) d;
  return v_days;
end $$;
revoke all on function public.ghost_events_revenue_source_v1(uuid,date,date) from public,anon,authenticated;
grant execute on function public.ghost_events_revenue_source_v1(uuid,date,date) to service_role;
