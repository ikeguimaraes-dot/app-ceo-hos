-- Ghost mobile API v1.
-- All client entry points authenticate with auth.uid(), derive unit scope from
-- user_roles, and expose only minimized JSON contracts. Internal tables live in
-- an unexposed schema and have no grants for anon/authenticated.

create schema if not exists ghost_private;
revoke all on schema ghost_private from public, anon, authenticated;

create table if not exists ghost_private.account_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  reason text,
  updated_at timestamptz not null default now(),
  constraint ghost_account_status_reason_length check (reason is null or length(reason) <= 240)
);

create table if not exists ghost_private.role_capabilities (
  role_id uuid not null references public.roles(id) on delete cascade,
  capability text not null,
  primary key (role_id, capability),
  constraint ghost_role_capability_known check (capability in (
    'dashboard.read', 'pending.read', 'operation.read', 'people.read',
    'notifications.read'
  ))
);

create table if not exists ghost_private.device_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id uuid not null,
  expo_token text not null,
  platform text not null,
  app_environment text not null,
  app_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, installation_id),
  unique (app_environment, expo_token),
  constraint ghost_device_platform check (platform in ('ios', 'android')),
  constraint ghost_device_environment check (app_environment in ('local', 'preview', 'production')),
  constraint ghost_device_token_length check (length(expo_token) between 20 and 512),
  constraint ghost_device_version_length check (length(app_version) between 1 and 40)
);

revoke all on all tables in schema ghost_private from public, anon, authenticated;

-- Conservative first mapping. It is data, not client code, and can be reviewed
-- independently as KPH roles evolve. Every linked role may receive personal
-- notifications; business capabilities require an executive, financial,
-- operational, people, or approval permission already present on the role.
insert into ghost_private.role_capabilities (role_id, capability)
select id, 'notifications.read' from public.roles
on conflict do nothing;

insert into ghost_private.role_capabilities (role_id, capability)
select r.id, 'dashboard.read'
from public.roles r
where lower(r.name) in (
  'founder','ceo','diretor','cfo','gm','gerente geral','gerente adjunto',
  'coo','head_financeiro','analista financeiro','socio_readonly'
)
or (jsonb_typeof(r.permissions) = 'array' and exists (
  select 1 from jsonb_array_elements_text(r.permissions) p(value)
  where p.value in ('*','financeiro.*','financeiro.relatorios','relatorios.*')
))
on conflict do nothing;

insert into ghost_private.role_capabilities (role_id, capability)
select r.id, 'pending.read'
from public.roles r
where lower(r.name) in (
  'founder','ceo','diretor','cfo','gm','gerente geral','gerente adjunto','coo'
)
or (jsonb_typeof(r.permissions) = 'array' and exists (
  select 1 from jsonb_array_elements_text(r.permissions) p(value)
  where p.value in ('*','ponto.aprovacao')
))
or (jsonb_typeof(r.permissions) = 'object' and coalesce((r.permissions ->> 'can_approve_punch')::boolean, false))
on conflict do nothing;

insert into ghost_private.role_capabilities (role_id, capability)
select r.id, 'operation.read'
from public.roles r
where lower(r.name) in (
  'founder','ceo','diretor','gm','gerente geral','gerente adjunto','coo',
  'coord. operações','head_operacao','operacional'
)
or (jsonb_typeof(r.permissions) = 'array' and exists (
  select 1 from jsonb_array_elements_text(r.permissions) p(value)
  where p.value = '*' or p.value like 'operac%' or p.value like 'escala.%'
))
on conflict do nothing;

insert into ghost_private.role_capabilities (role_id, capability)
select r.id, 'people.read'
from public.roles r
where lower(r.name) in (
  'founder','ceo','diretor','gm','gerente geral','gerente adjunto','coo',
  'gerente rh','analista de rh','assistente de rh','head_rh','pessoas'
)
or (jsonb_typeof(r.permissions) = 'array' and exists (
  select 1 from jsonb_array_elements_text(r.permissions) p(value)
  where p.value in ('*','pessoas.*','pessoas.unidade')
))
on conflict do nothing;

create or replace function ghost_private.user_is_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.active from ghost_private.account_status s where s.user_id = p_user_id
  ), true)
$$;

create or replace function ghost_private.user_has_capability(
  p_user_id uuid,
  p_unit_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ghost_private.user_is_active(p_user_id)
    and exists (
      select 1
      from public.units u
      join public.brands b on b.id = u.brand_id
      join public.user_roles ur on ur.user_id = p_user_id
        and (ur.unit_id = u.id or ur.brand_id = u.brand_id or ur.group_id = b.group_id)
      join ghost_private.role_capabilities rc on rc.role_id = ur.role_id
      where u.id = p_unit_id
        and u.active is true
        and rc.capability = p_capability
    )
$$;

revoke all on function ghost_private.user_is_active(uuid) from public, anon, authenticated;
revoke all on function ghost_private.user_has_capability(uuid,uuid,text) from public, anon, authenticated;

create or replace function public.ghost_bootstrap_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_units jsonb;
  v_display_name text;
  v_access_version text;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;

  select nullif(btrim(p.nome), '') into v_display_name
  from public.profiles p where p.id = v_user_id;
  v_display_name := coalesce(v_display_name, 'Usuário Ghost');

  if not ghost_private.user_is_active(v_user_id) then
    return jsonb_build_object(
      'userId', v_user_id,
      'displayName', v_display_name,
      'status', 'inactive',
      'accessVersion', md5(v_user_id::text || ':inactive'),
      'units', '[]'::jsonb
    );
  end if;

  with scoped as (
    select u.id, u.name, b.name brand, g.name "group", rc.capability
    from public.units u
    join public.brands b on b.id = u.brand_id
    join public.groups g on g.id = b.group_id
    join public.user_roles ur on ur.user_id = v_user_id
      and (ur.unit_id = u.id or ur.brand_id = u.brand_id or ur.group_id = b.group_id)
    join ghost_private.role_capabilities rc on rc.role_id = ur.role_id
    where u.active is true
  ), per_unit as (
    select id, name, brand, "group", jsonb_agg(distinct capability order by capability) capabilities
    from scoped group by id, name, brand, "group"
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'brand', brand, 'group', "group", 'capabilities', capabilities
  ) order by name), '[]'::jsonb)
  into v_units from per_unit;

  select md5(coalesce(string_agg(
    ur.id::text || ':' || ur.role_id::text || ':' || coalesce(ur.unit_id::text,'') || ':' ||
    coalesce(ur.brand_id::text,'') || ':' || coalesce(ur.group_id::text,''),
    '|' order by ur.id
  ), 'none')) into v_access_version
  from public.user_roles ur where ur.user_id = v_user_id;

  return jsonb_build_object(
    'userId', v_user_id,
    'displayName', v_display_name,
    'status', case when jsonb_array_length(v_units) = 0 then 'unlinked' else 'active' end,
    'accessVersion', v_access_version,
    'units', v_units
  );
end
$$;

create or replace function public.ghost_dashboard_v1(
  p_unit_id uuid,
  p_month date default current_date
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
  v_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date;
  v_revenue numeric;
  v_goal numeric;
  v_updated_at timestamptz;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'dashboard.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  select sum(lp.valor_fechado), max(coalesce(lp.criado_em, w.criado_em))
  into v_revenue, v_updated_at
  from public.lorean_workdays w
  join public.lorean_pagamentos lp on lp.workday_id_fk = w.id
  where w.unit_id = p_unit_id and w.data >= v_start and w.data < v_end;

  with days as (
    select d::date as day_value from generate_series(v_start, v_end - 1, interval '1 day') d
  )
  select case when count(m.meta) = 0 then null else sum(m.meta) end
  into v_goal
  from days
  left join lateral (
    select coalesce(
      (select o.meta from public.metas_dia_override o where o.unit_id=p_unit_id and o.data=days.day_value),
      (select s.meta from public.metas_dia_semana s where s.unit_id=p_unit_id
        and s.competencia=to_char(v_start,'YYYY-MM') and s.dia_semana=extract(dow from days.day_value)::int)
    ) meta
  ) m on true;

  return jsonb_build_object(
    'updatedAt', coalesce(v_updated_at, now()),
    'revenue', v_revenue,
    'goal', v_goal,
    'goalProgress', case when v_revenue is not null and v_goal > 0 then v_revenue / v_goal else null end,
    'hasData', v_revenue is not null
  );
end
$$;

create or replace function public.ghost_pending_items_v1(p_unit_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'pending.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  with items as (
    select 'maintenance:' || a.id::text id,
      coalesce(nullif(a.servico,''), 'Manutenção para aprovar') title,
      concat_ws(' · ', nullif(a.categoria,''), nullif(a.local,''), to_char(a.data_solicitacao,'DD/MM/YYYY')) detail,
      case when upper(a.prioridade) in ('URGENTE','ALTA') then 'attention' else 'normal' end priority,
      a.created_at sort_at
    from public.manutencao_aprovacoes a
    where a.unit_id = p_unit_id and upper(a.aprovado) = 'PENDENTE'
    union all
    select 'punch:' || p.id::text,
      'Ajuste de ponto',
      concat_ws(' · ', to_char(p.data_referencia,'DD/MM/YYYY'), nullif(p.motivo,'')),
      'attention', p.created_at
    from public.punch_adjustment_requests p
    join public.employees e on e.id = p.employee_id
    where e.unit_id = p_unit_id and lower(p.status) = 'pendente'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'title',title,'detail',detail,'priority',priority
  ) order by sort_at desc), '[]'::jsonb)
  into v_items from (select * from items order by sort_at desc limit 100) limited;
  return v_items;
end
$$;

create or replace function public.ghost_notifications_v1(p_unit_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'notifications.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'title',n.titulo,'body',coalesce(n.mensagem,''),'read',n.lida,
    'target',case when n.link in ('/pending','pending') then '/pending' else '/' end,
    'createdAt',n.criado_em
  ) order by n.criado_em desc), '[]'::jsonb)
  into v_items
  from (select * from public.notifications where user_id=v_user_id order by criado_em desc limit 100) n;
  return v_items;
end
$$;

create or replace function public.ghost_notification_mark_read_v1(p_id uuid, p_unit_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_changed integer;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'notifications.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  update public.notifications set lida=true where id=p_id and user_id=v_user_id;
  get diagnostics v_changed = row_count;
  if v_changed = 0 then raise no_data_found using message = 'notification_not_found'; end if;
  return jsonb_build_object('ok',true,'readAt',now());
end
$$;

create or replace function public.ghost_register_installation_v1(
  p_installation_id uuid,
  p_expo_token text,
  p_platform text,
  p_app_environment text,
  p_app_version text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_id uuid;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_is_active(v_user_id) then raise insufficient_privilege using message = 'inactive_user'; end if;
  if p_platform not in ('ios','android') or p_app_environment not in ('local','preview','production')
    or length(p_expo_token) not between 20 and 512 or length(p_app_version) not between 1 and 40 then
    raise invalid_parameter_value using message = 'invalid_installation';
  end if;
  insert into ghost_private.device_installations(
    user_id,installation_id,expo_token,platform,app_environment,app_version,revoked_at
  ) values (v_user_id,p_installation_id,p_expo_token,p_platform,p_app_environment,p_app_version,null)
  on conflict (user_id,installation_id) do update set
    expo_token=excluded.expo_token, platform=excluded.platform,
    app_environment=excluded.app_environment, app_version=excluded.app_version,
    revoked_at=null, updated_at=now()
  returning id into v_id;
  return jsonb_build_object('id',v_id,'registeredAt',now());
end
$$;

create or replace function public.ghost_unregister_installation_v1(p_installation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_changed integer;
begin
  if v_user_id is null then return jsonb_build_object('ok',true); end if;
  update ghost_private.device_installations set revoked_at=now(),updated_at=now()
  where user_id=v_user_id and installation_id=p_installation_id and revoked_at is null;
  get diagnostics v_changed = row_count;
  return jsonb_build_object('ok',true,'revoked',v_changed > 0);
end
$$;

revoke all on function public.ghost_bootstrap_v1() from public, anon;
revoke all on function public.ghost_dashboard_v1(uuid,date) from public, anon;
revoke all on function public.ghost_pending_items_v1(uuid) from public, anon;
revoke all on function public.ghost_notifications_v1(uuid) from public, anon;
revoke all on function public.ghost_notification_mark_read_v1(uuid,uuid) from public, anon;
revoke all on function public.ghost_register_installation_v1(uuid,text,text,text,text) from public, anon;
revoke all on function public.ghost_unregister_installation_v1(uuid) from public, anon;

grant execute on function public.ghost_bootstrap_v1() to authenticated;
grant execute on function public.ghost_dashboard_v1(uuid,date) to authenticated;
grant execute on function public.ghost_pending_items_v1(uuid) to authenticated;
grant execute on function public.ghost_notifications_v1(uuid) to authenticated;
grant execute on function public.ghost_notification_mark_read_v1(uuid,uuid) to authenticated;
grant execute on function public.ghost_register_installation_v1(uuid,text,text,text,text) to authenticated;
grant execute on function public.ghost_unregister_installation_v1(uuid) to authenticated;

comment on function public.ghost_bootstrap_v1() is 'Ghost v1 bootstrap; auth.uid-derived user, unit scopes, and server capabilities.';
comment on function public.ghost_dashboard_v1(uuid,date) is 'Ghost v1 minimized dashboard; scoped server-side revenue and goal calculation.';
comment on function public.ghost_pending_items_v1(uuid) is 'Ghost v1 read-only pending items scoped to an authorized unit.';
