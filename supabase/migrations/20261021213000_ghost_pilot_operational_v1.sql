-- Ghost Phase 2C: opaque cursor pagination, minimized operational summaries,
-- access revocation, and an opt-in pilot allowlist. No client table grants.

create table if not exists ghost_private.pilot_config (
  singleton boolean primary key default true check (singleton),
  enforced boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists ghost_private.pilot_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into ghost_private.pilot_config(singleton, enforced)
values (true, false)
on conflict (singleton) do nothing;

revoke all on ghost_private.pilot_config, ghost_private.pilot_members from public, anon, authenticated;

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
  and (
    not coalesce((select c.enforced from ghost_private.pilot_config c where c.singleton), false)
    or exists (
      select 1 from ghost_private.pilot_members m
      where m.user_id = p_user_id
        and m.enabled
        and (m.expires_at is null or m.expires_at > now())
    )
  )
$$;

revoke all on function ghost_private.user_is_active(uuid) from public, anon, authenticated;

create or replace function ghost_private.user_access_version(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(concat_ws('|',
    coalesce((select s.active::text from ghost_private.account_status s where s.user_id=p_user_id), 'true'),
    coalesce((select c.enforced::text from ghost_private.pilot_config c where c.singleton), 'false'),
    coalesce((select m.enabled::text || ':' || coalesce(m.expires_at::text,'') from ghost_private.pilot_members m where m.user_id=p_user_id), 'none'),
    coalesce((
      select string_agg(u.id::text || ':' || rc.capability, ',' order by u.id, rc.capability)
      from public.units u
      join public.brands b on b.id=u.brand_id
      join public.user_roles ur on ur.user_id=p_user_id
        and (ur.unit_id=u.id or ur.brand_id=u.brand_id or ur.group_id=b.group_id)
      join ghost_private.role_capabilities rc on rc.role_id=ur.role_id
      where u.active is true
    ), 'none')
  ))
$$;

revoke all on function ghost_private.user_access_version(uuid) from public, anon, authenticated;

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
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  select nullif(btrim(p.nome), '') into v_display_name from public.profiles p where p.id=v_user_id;
  v_display_name := coalesce(v_display_name, 'Usuário Ghost');
  v_access_version := ghost_private.user_access_version(v_user_id);

  if not ghost_private.user_is_active(v_user_id) then
    return jsonb_build_object('userId',v_user_id,'displayName',v_display_name,
      'status','inactive','accessVersion',v_access_version,'units','[]'::jsonb);
  end if;

  with scoped as (
    select u.id,u.name,b.name brand,g.name "group",rc.capability
    from public.units u
    join public.brands b on b.id=u.brand_id
    join public.groups g on g.id=b.group_id
    join public.user_roles ur on ur.user_id=v_user_id
      and (ur.unit_id=u.id or ur.brand_id=u.brand_id or ur.group_id=b.group_id)
    join ghost_private.role_capabilities rc on rc.role_id=ur.role_id
    where u.active is true
  ), per_unit as (
    select id,name,brand,"group",jsonb_agg(distinct capability order by capability) capabilities
    from scoped group by id,name,brand,"group"
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',name,'brand',brand,'group',"group",'capabilities',capabilities
  ) order by name),'[]'::jsonb) into v_units from per_unit;

  return jsonb_build_object('userId',v_user_id,'displayName',v_display_name,
    'status',case when jsonb_array_length(v_units)=0 then 'unlinked' else 'active' end,
    'accessVersion',v_access_version,'units',v_units);
end
$$;

revoke all on function public.ghost_bootstrap_v1() from public, anon;
grant execute on function public.ghost_bootstrap_v1() to authenticated;

create or replace function public.ghost_pending_items_v2(
  p_unit_id uuid,
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cursor_at timestamptz;
  v_cursor_id text;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'pending.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if p_cursor is not null then
    begin
      if length(p_cursor) > 512 or p_cursor !~ '^[0-9a-f]+$' then raise exception 'bad cursor'; end if;
      select (c->>'at')::timestamptz, c->>'id' into v_cursor_at, v_cursor_id
      from (select convert_from(decode(p_cursor, 'hex'), 'utf8')::jsonb c) decoded;
      if v_cursor_at is null or v_cursor_id is null then raise exception 'bad cursor'; end if;
    exception when others then
      raise invalid_parameter_value using message = 'invalid_cursor';
    end;
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
    select 'punch:' || p.id::text, 'Ajuste de ponto',
      concat_ws(' · ', to_char(p.data_referencia,'DD/MM/YYYY'), nullif(p.motivo,'')),
      'attention', p.created_at
    from public.punch_adjustment_requests p
    join public.employees e on e.id = p.employee_id
    where e.unit_id = p_unit_id and lower(p.status) = 'pendente'
  ), page as (
    select * from items
    where v_cursor_at is null or (sort_at, id) < (v_cursor_at, v_cursor_id)
    order by sort_at desc, id desc limit v_limit + 1
  ), visible as (
    select * from page order by sort_at desc, id desc limit v_limit
  ), boundary as (
    select * from visible order by sort_at, id limit 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'title',title,'detail',detail,'priority',priority
    ) order by sort_at desc, id desc) from visible), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page) > v_limit then (
      select encode(convert_to(jsonb_build_object('at',sort_at,'id',id)::text,'utf8'),'hex') from boundary
    ) else null end,
    'updatedAt', now()
  ) into v_result;
  return v_result;
end
$$;

create or replace function public.ghost_notifications_v2(
  p_unit_id uuid,
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cursor_at timestamptz;
  v_cursor_id uuid;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'notifications.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  if p_cursor is not null then
    begin
      if length(p_cursor) > 512 or p_cursor !~ '^[0-9a-f]+$' then raise exception 'bad cursor'; end if;
      select (c->>'at')::timestamptz, (c->>'id')::uuid into v_cursor_at, v_cursor_id
      from (select convert_from(decode(p_cursor, 'hex'), 'utf8')::jsonb c) decoded;
      if v_cursor_at is null or v_cursor_id is null then raise exception 'bad cursor'; end if;
    exception when others then
      raise invalid_parameter_value using message = 'invalid_cursor';
    end;
  end if;

  with page as (
    select n.* from public.notifications n
    where n.user_id = v_user_id
      and (v_cursor_at is null or (n.criado_em, n.id) < (v_cursor_at, v_cursor_id))
    order by n.criado_em desc, n.id desc limit v_limit + 1
  ), visible as (
    select * from page order by criado_em desc, id desc limit v_limit
  ), boundary as (
    select * from visible order by criado_em, id limit 1
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'title',titulo,'body',coalesce(mensagem,''),'read',lida,
      'target',case when link in ('/pending','pending') then '/pending' else '/' end,
      'createdAt',criado_em
    ) order by criado_em desc, id desc) from visible), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page) > v_limit then (
      select encode(convert_to(jsonb_build_object('at',criado_em,'id',id)::text,'utf8'),'hex') from boundary
    ) else null end,
    'updatedAt', now()
  ) into v_result;
  return v_result;
end
$$;

create or replace function public.ghost_operation_summary_v1(p_unit_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'operation.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  select jsonb_build_object(
    'updatedAt', now(),
    'pendingMaintenance', count(*) filter (where upper(a.aprovado) = 'PENDENTE'),
    'attentionMaintenance', count(*) filter (where upper(a.aprovado) = 'PENDENTE' and upper(a.prioridade) in ('URGENTE','ALTA')),
    'oldestPendingDate', min(a.data_solicitacao) filter (where upper(a.aprovado) = 'PENDENTE')
  ) into v_result
  from public.manutencao_aprovacoes a where a.unit_id = p_unit_id;
  return v_result;
end
$$;

create or replace function public.ghost_people_summary_v1(p_unit_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user_id uuid := auth.uid(); v_result jsonb;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if not ghost_private.user_has_capability(v_user_id, p_unit_id, 'people.read') then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;
  select jsonb_build_object(
    'updatedAt', now(),
    'headcount', (select count(*) from public.employees e where e.unit_id = p_unit_id and e.ativo is true),
    'pendingPunchAdjustments', (
      select count(*) from public.punch_adjustment_requests p
      join public.employees e on e.id = p.employee_id
      where e.unit_id = p_unit_id and lower(p.status) = 'pendente'
    )
  ) into v_result;
  return v_result;
end
$$;

revoke all on function public.ghost_pending_items_v2(uuid,text,integer) from public, anon;
revoke all on function public.ghost_notifications_v2(uuid,text,integer) from public, anon;
revoke all on function public.ghost_operation_summary_v1(uuid) from public, anon;
revoke all on function public.ghost_people_summary_v1(uuid) from public, anon;
grant execute on function public.ghost_pending_items_v2(uuid,text,integer) to authenticated;
grant execute on function public.ghost_notifications_v2(uuid,text,integer) to authenticated;
grant execute on function public.ghost_operation_summary_v1(uuid) to authenticated;
grant execute on function public.ghost_people_summary_v1(uuid) to authenticated;

comment on function public.ghost_pending_items_v2(uuid,text,integer) is 'Ghost v2 pending page with an opaque keyset cursor and unit capability check.';
comment on function public.ghost_notifications_v2(uuid,text,integer) is 'Ghost v2 notification page scoped to auth.uid with an opaque keyset cursor.';
comment on function public.ghost_operation_summary_v1(uuid) is 'Ghost minimized maintenance counts for an authorized unit; no financial or record detail.';
comment on function public.ghost_people_summary_v1(uuid) is 'Ghost minimized people counts for an authorized unit; no employee identity or payroll data.';
