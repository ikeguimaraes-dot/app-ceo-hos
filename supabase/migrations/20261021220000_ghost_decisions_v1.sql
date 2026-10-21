-- Ghost Phase 2D: transactional decisions with resource-scoped capabilities,
-- optimistic concurrency, idempotency, and a private immutable audit trail.

alter table ghost_private.role_capabilities
  drop constraint if exists ghost_role_capability_known;
alter table ghost_private.role_capabilities
  add constraint ghost_role_capability_known check (capability in (
    'dashboard.read', 'pending.read', 'operation.read', 'people.read',
    'notifications.read', 'maintenance.decide', 'punch.decide'
  ));

insert into ghost_private.role_capabilities (role_id, capability)
select r.id, 'maintenance.decide'
from public.roles r
where lower(r.name) in (
  'founder','ceo','diretor','gm','gerente geral','gerente adjunto','coo'
)
or (jsonb_typeof(r.permissions) = 'array' and exists (
  select 1 from jsonb_array_elements_text(r.permissions) p(value)
  where p.value in ('*','manutencao.aprovacao','operacao.aprovacao')
))
or (jsonb_typeof(r.permissions) = 'object'
  and coalesce((r.permissions ->> 'can_approve_maintenance')::boolean, false))
on conflict do nothing;

insert into ghost_private.role_capabilities (role_id, capability)
select r.id, 'punch.decide'
from public.roles r
where lower(r.name) in (
  'founder','ceo','diretor','gm','gerente geral','gerente adjunto','coo'
)
or (jsonb_typeof(r.permissions) = 'array' and exists (
  select 1 from jsonb_array_elements_text(r.permissions) p(value)
  where p.value in ('*','ponto.aprovacao')
))
or (jsonb_typeof(r.permissions) = 'object'
  and coalesce((r.permissions ->> 'can_approve_punch')::boolean, false))
on conflict do nothing;

create table ghost_private.decision_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  resource_kind text not null check (resource_kind in ('maintenance','punch')),
  resource_id uuid not null,
  item_id text not null,
  decision text not null check (decision in ('approve','reject')),
  reason text,
  expected_version text not null,
  previous_state text not null,
  resulting_state text not null,
  result_version text not null,
  idempotency_key text not null,
  decided_at timestamptz not null default now(),
  response jsonb not null,
  unique (user_id, idempotency_key),
  check (length(item_id) between 3 and 100),
  check (length(idempotency_key) between 16 and 200),
  check (reason is null or length(reason) between 1 and 500),
  check (decision <> 'reject' or reason is not null)
);

create index ghost_decision_audit_resource_idx
  on ghost_private.decision_audit(resource_kind, resource_id, decided_at desc);

alter table ghost_private.decision_audit enable row level security;
revoke all on ghost_private.decision_audit from public, anon, authenticated;

create function ghost_private.reject_decision_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'decision_audit_is_immutable';
end
$$;

create trigger ghost_decision_audit_immutable
before update or delete on ghost_private.decision_audit
for each row execute function ghost_private.reject_decision_audit_mutation();

revoke all on function ghost_private.reject_decision_audit_mutation()
  from public, anon, authenticated;

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
    select 'maintenance:' || a.id::text id, 'maintenance' kind,
      coalesce(nullif(a.servico,''), 'Manutenção para aprovar') title,
      concat_ws(' · ', nullif(a.categoria,''), nullif(a.local,''), to_char(a.data_solicitacao,'DD/MM/YYYY')) detail,
      case when upper(a.prioridade) in ('URGENTE','ALTA') then 'attention' else 'normal' end priority,
      md5(concat_ws('|',a.id::text,upper(a.aprovado),a.updated_at::text)) version,
      ghost_private.user_has_capability(v_user_id,p_unit_id,'maintenance.decide') "canDecide",
      a.created_at sort_at
    from public.manutencao_aprovacoes a
    where a.unit_id = p_unit_id and upper(a.aprovado) = 'PENDENTE'
    union all
    select 'punch:' || p.id::text, 'punch', 'Ajuste de ponto',
      concat_ws(' · ', to_char(p.data_referencia,'DD/MM/YYYY'), nullif(p.motivo,'')),
      'attention',
      md5(concat_ws('|',p.id::text,lower(p.status),p.created_at::text,coalesce(p.aprovado_em::text,''))),
      ghost_private.user_has_capability(v_user_id,p_unit_id,'punch.decide'),
      p.created_at
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
      'id',id,'kind',kind,'title',title,'detail',detail,'priority',priority,
      'version',version,'canDecide',"canDecide"
    ) order by sort_at desc, id desc) from visible), '[]'::jsonb),
    'nextCursor', case when (select count(*) from page) > v_limit then (
      select encode(convert_to(jsonb_build_object('at',sort_at,'id',id)::text,'utf8'),'hex') from boundary
    ) else null end,
    'updatedAt', now()
  ) into v_result;
  return v_result;
end
$$;

create or replace function public.ghost_decide_pending_v1(
  p_unit_id uuid,
  p_item_id text,
  p_decision text,
  p_reason text,
  p_expected_version text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_kind text;
  v_resource_id uuid;
  v_reason text := nullif(btrim(p_reason), '');
  v_state text;
  v_previous_version text;
  v_result_version text;
  v_decided_at timestamptz := clock_timestamp();
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_approved_at timestamptz;
  v_result jsonb;
  v_existing ghost_private.decision_audit%rowtype;
begin
  if v_user_id is null then raise insufficient_privilege using message = 'authentication_required'; end if;
  if p_decision not in ('approve','reject') then
    raise sqlstate 'PT400' using message = 'invalid_decision';
  end if;
  if p_decision = 'reject' and v_reason is null then
    raise sqlstate 'PT400' using message = 'decision_reason_required';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise sqlstate 'PT400' using message = 'decision_reason_too_long';
  end if;
  if p_expected_version is null or p_expected_version !~ '^[0-9a-f]{32}$' then
    raise sqlstate 'PT400' using message = 'invalid_expected_version';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 200 then
    raise sqlstate 'PT400' using message = 'invalid_idempotency_key';
  end if;
  if p_item_id is null or p_item_id !~ '^(maintenance|punch):[0-9a-f-]{36}$' then
    raise sqlstate 'PT404' using message = 'pending_item_not_found';
  end if;

  v_kind := split_part(p_item_id, ':', 1);
  begin
    v_resource_id := split_part(p_item_id, ':', 2)::uuid;
  exception when invalid_text_representation then
    raise sqlstate 'PT404' using message = 'pending_item_not_found';
  end;

  if not ghost_private.user_has_capability(
    v_user_id, p_unit_id,
    case v_kind when 'maintenance' then 'maintenance.decide' else 'punch.decide' end
  ) then
    raise insufficient_privilege using message = 'unit_capability_denied';
  end if;

  select * into v_existing
  from ghost_private.decision_audit a
  where a.user_id = v_user_id and a.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.unit_id = p_unit_id
      and v_existing.item_id = p_item_id
      and v_existing.decision = p_decision
      and v_existing.reason is not distinct from v_reason
      and v_existing.expected_version = p_expected_version then
      return v_existing.response;
    end if;
    raise sqlstate 'PT409' using message = 'idempotency_conflict';
  end if;

  if v_kind = 'maintenance' then
    select upper(a.aprovado), a.updated_at
      into v_state, v_updated_at
    from public.manutencao_aprovacoes a
    where a.id = v_resource_id and a.unit_id = p_unit_id
    for update;
    if not found then raise sqlstate 'PT404' using message = 'pending_item_not_found'; end if;
    v_previous_version := md5(concat_ws('|',v_resource_id::text,v_state,v_updated_at::text));
  else
    select lower(p.status), p.created_at, p.aprovado_em
      into v_state, v_created_at, v_approved_at
    from public.punch_adjustment_requests p
    join public.employees e on e.id = p.employee_id
    where p.id = v_resource_id and e.unit_id = p_unit_id
    for update of p;
    if not found then raise sqlstate 'PT404' using message = 'pending_item_not_found'; end if;
    v_previous_version := md5(concat_ws('|',v_resource_id::text,v_state,v_created_at::text,coalesce(v_approved_at::text,'')));
  end if;

  select * into v_existing
  from ghost_private.decision_audit a
  where a.user_id = v_user_id and a.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.unit_id = p_unit_id
      and v_existing.item_id = p_item_id
      and v_existing.decision = p_decision
      and v_existing.reason is not distinct from v_reason
      and v_existing.expected_version = p_expected_version then
      return v_existing.response;
    end if;
    raise sqlstate 'PT409' using message = 'idempotency_conflict';
  end if;

  if (v_kind = 'maintenance' and v_state <> 'PENDENTE')
    or (v_kind = 'punch' and v_state <> 'pendente') then
    raise sqlstate 'PT409' using message = 'pending_already_decided';
  end if;
  if v_previous_version <> p_expected_version then
    raise sqlstate 'PT409' using message = 'pending_version_conflict';
  end if;

  if v_kind = 'maintenance' then
    update public.manutencao_aprovacoes
    set aprovado = case p_decision when 'approve' then 'SIM' else 'NAO' end,
        aprovado_por = v_user_id,
        data_aprovacao = current_date
    where id = v_resource_id
    returning updated_at into v_updated_at;
    v_result_version := md5(concat_ws('|',v_resource_id::text,
      case p_decision when 'approve' then 'SIM' else 'NAO' end,v_updated_at::text));
  else
    update public.punch_adjustment_requests
    set status = case p_decision when 'approve' then 'aprovado' else 'rejeitado' end,
        aprovado_por = v_user_id,
        aprovado_em = v_decided_at
    where id = v_resource_id
    returning aprovado_em into v_approved_at;
    v_result_version := md5(concat_ws('|',v_resource_id::text,
      case p_decision when 'approve' then 'aprovado' else 'rejeitado' end,
      v_created_at::text,v_approved_at::text));
  end if;

  v_result := jsonb_build_object(
    'itemId', p_item_id,
    'state', case p_decision when 'approve' then 'approved' else 'rejected' end,
    'version', v_result_version,
    'decidedAt', v_decided_at
  );

  insert into ghost_private.decision_audit(
    user_id,unit_id,resource_kind,resource_id,item_id,decision,reason,
    expected_version,previous_state,resulting_state,result_version,
    idempotency_key,decided_at,response
  ) values (
    v_user_id,p_unit_id,v_kind,v_resource_id,p_item_id,p_decision,v_reason,
    p_expected_version,v_state,
    case when v_kind='maintenance' then
      case p_decision when 'approve' then 'SIM' else 'NAO' end
    else case p_decision when 'approve' then 'aprovado' else 'rejeitado' end end,
    v_result_version,p_idempotency_key,v_decided_at,v_result
  );
  return v_result;
end
$$;

revoke all on function public.ghost_pending_items_v2(uuid,text,integer) from public, anon;
revoke all on function public.ghost_decide_pending_v1(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.ghost_pending_items_v2(uuid,text,integer) to authenticated;
grant execute on function public.ghost_decide_pending_v1(uuid,text,text,text,text,text) to authenticated;

comment on table ghost_private.decision_audit is 'Private append-only Ghost decision audit and idempotency ledger.';
comment on function public.ghost_decide_pending_v1(uuid,text,text,text,text,text) is 'Atomic, resource-scoped pending decision with optimistic concurrency and idempotency.';
