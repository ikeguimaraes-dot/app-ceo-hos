-- KPH development project. Serena source is deployed separately (supabase/serena).
create extension if not exists http with schema extensions;

create table if not exists ghost_private.serena_units (
  unit_id uuid primary key references public.units(id),
  restaurant_id text not null unique
);
alter table ghost_private.serena_units enable row level security;
revoke all on ghost_private.serena_units from public, anon, authenticated;
insert into ghost_private.serena_units(unit_id,restaurant_id) values
 ('f2a6c9f8-929f-447b-9f77-edd8dad19bd0','freneze'),
 ('674eac8c-5a38-4a42-aa60-0a666387909b','meet_and_eat'),
 ('f9c6c7fc-2ecc-4f79-98ce-c3118b670182','madonna_cucina')
on conflict(unit_id) do update set restaurant_id=excluded.restaurant_id;

create or replace function public.ghost_reservations_authorize_v1(p_unit_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_restaurant text;
begin
 if auth.uid() is null then raise insufficient_privilege using message='authentication_required'; end if;
 if not ghost_private.user_has_capability(auth.uid(),p_unit_id,'operation.read') then
   raise insufficient_privilege using message='unit_capability_denied';
 end if;
 select restaurant_id into v_restaurant from ghost_private.serena_units where unit_id=p_unit_id;
 return jsonb_build_object('unitId',p_unit_id,'restaurantId',v_restaurant);
end $$;
revoke all on function public.ghost_reservations_authorize_v1(uuid) from public,anon;
grant execute on function public.ghost_reservations_authorize_v1(uuid) to authenticated;

create or replace function public.ghost_reservations_v1(p_unit_id uuid,p_date date)
returns jsonb language plpgsql volatile security definer set search_path=''
as $$
declare v_scope jsonb; v_auth text; v_response extensions.http_response; v_payload jsonb;
begin
 v_scope:=public.ghost_reservations_authorize_v1(p_unit_id);
 if p_date is null or p_date < date '2000-01-01' or p_date > current_date + 730 then
   raise invalid_parameter_value using message='invalid_reservation_date';
 end if;
 if v_scope->>'restaurantId' is null then
   return jsonb_build_object('unitId',p_unit_id,'date',p_date,'connected',false,'updatedAt',now(),
     'total',0,'guests',0,'confirmed',0,'pending',0,'cancelled',0,'items','[]'::jsonb);
 end if;
 v_auth:=current_setting('request.headers',true)::jsonb->>'authorization';
 if v_auth is null or v_auth not like 'Bearer %' then
   raise insufficient_privilege using message='authentication_required';
 end if;
 select * into v_response from extensions.http((
   'POST','https://czoakcsntfxmqfssubbe.supabase.co/functions/v1/ghost-reservations',
   array[extensions.http_header('Authorization',v_auth)],'application/json',
   jsonb_build_object('unitId',p_unit_id,'date',p_date)::text
 )::extensions.http_request);
 if v_response.status in (401,403) then raise insufficient_privilege using message='unit_capability_denied'; end if;
 if v_response.status<>200 then raise exception using message='serena_unavailable',errcode='P0001'; end if;
 v_payload:=v_response.content::jsonb;
 if v_payload->>'unitId' is distinct from p_unit_id::text or v_payload->>'date' is distinct from p_date::text then
   raise exception using message='serena_scope_mismatch',errcode='P0001';
 end if;
 return v_payload;
end $$;
revoke all on function public.ghost_reservations_v1(uuid,date) from public,anon;
grant execute on function public.ghost_reservations_v1(uuid,date) to authenticated;
