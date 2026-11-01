-- Apply ONLY to Serena czoakcsntfxmqfssubbe. Internal read-only source RPC.
-- SECURITY INVOKER: callable only by the Edge Function's server credential,
-- after a live KPH JWT + unit + capability check. No personal contact data.
create or replace function public.ghost_serena_reservations_source_v1(p_restaurant_id text,p_date date)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if p_restaurant_id not in ('freneze','meet_and_eat','madonna_cucina') or p_restaurant_id is null
   or p_date is null or p_date<date '2000-01-01' or p_date>current_date+730 then
   raise invalid_parameter_value using message='invalid_reservation_scope';
 end if;
 select jsonb_build_object('date',p_date,'connected',true,'updatedAt',now(),
   'total',count(*) filter(where r.status<>'cancelada'),
   'guests',coalesce(sum(r.posicoes) filter(where r.status<>'cancelada'),0),
   'confirmed',count(*) filter(where r.status='confirmada'),
   'pending',count(*) filter(where r.status='pendente'),
   'cancelled',count(*) filter(where r.status='cancelada'),
   'items',coalesce(jsonb_agg(jsonb_build_object('id',r.id,'time',r.hora_inicio,
     'guests',r.posicoes,'status',r.status,'origin',r.origem,'table',r.mesa)
     order by r.hora_inicio nulls last,r.id),'[]'::jsonb)) into v_result
 from public.reservas r where r.restaurant_id=p_restaurant_id and r.data=p_date;
 return v_result;
end $$;
revoke all on function public.ghost_serena_reservations_source_v1(text,date) from public,anon,authenticated;
grant execute on function public.ghost_serena_reservations_source_v1(text,date) to service_role;
