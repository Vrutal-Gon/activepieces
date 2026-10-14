-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-06_task_autonomy.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Aplica la migración, la prueba y TERMINA CON UN ERROR A PROPÓSITO,
-- así que Postgres revierte todo: no queda nada aplicado, ni cambios de fase
-- ni aprobaciones de prueba.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Antes de ejecutar: sustituir admin_id por el id del admin del proyecto
--   select id, role, is_active from public.profiles;
-- =====================================================================
do $do$
declare
  r text := '';
  n bigint;
  s text;
  spec uuid;
  task text;
  v_a bigint; v_r bigint; v_s bigint;
  admin_id constant text := 'ff4b1313-e086-4815-b03c-2d9b3a0f6752';

  -- Intenta cambiar el nivel como Admin y devuelve «ok» o el motivo del rechazo.
  -- (función local simulada con bloque anónimo en cada prueba)
begin
  -- ===== migración (copia de 2026-10-06_task_autonomy.sql) =====
  create or replace function public.autonomy_rank(p_level text) returns int language sql immutable as $f$
    select case p_level when 'suggest' then 1 when 'execute_with_approval' then 2 when 'autonomous' then 3 end $f$;
  create or replace function public.autonomy_ceiling(p_specialist uuid) returns text
  language sql stable security definer set search_path = public, pg_temp as $f$
    select case
      when s.status <> 'active' then 'suggest'
      when s.autonomy_level = 'read_only' then 'suggest'
      when s.autonomy_level = 'draft_for_approval' then 'execute_with_approval'
      when s.phase in ('01_AUDIT', '02_PILOT') then 'execute_with_approval'
      else 'autonomous' end
    from public.specialists s where s.id = p_specialist $f$;
  revoke all on function public.autonomy_rank(text), public.autonomy_ceiling(uuid) from public, anon;
  grant execute on function public.autonomy_rank(text), public.autonomy_ceiling(uuid) to authenticated, service_role;

  create table if not exists public.task_autonomy_setting (
    specialist_id uuid not null, task_key text not null,
    autonomy_level text not null check (autonomy_level in ('suggest', 'execute_with_approval', 'autonomous')),
    set_by uuid references public.profiles(id), set_at timestamptz not null default now(),
    primary key (specialist_id, task_key),
    foreign key (specialist_id, task_key) references public.catalog_flow_ro (specialist_id, task_key) on delete cascade);
  alter table public.task_autonomy_setting enable row level security;
  drop policy if exists task_autonomy_select_team on public.task_autonomy_setting;
  create policy task_autonomy_select_team on public.task_autonomy_setting for select to authenticated using (true);
  drop policy if exists active_only on public.task_autonomy_setting;
  create policy active_only on public.task_autonomy_setting as restrictive for all to authenticated using (public.is_active_user());
  revoke all on public.task_autonomy_setting from anon, authenticated;
  grant select on public.task_autonomy_setting to authenticated;
  grant all on public.task_autonomy_setting to service_role;

  create or replace view public.task_autonomy_effective with (security_invoker = true) as
  select f.specialist_id, f.task_key, f.autonomy_level as catalog_level, o.autonomy_level as override_level,
    public.autonomy_ceiling(f.specialist_id) as ceiling_level,
    case when public.autonomy_rank(coalesce(o.autonomy_level, f.autonomy_level)) <= public.autonomy_rank(public.autonomy_ceiling(f.specialist_id))
      then coalesce(o.autonomy_level, f.autonomy_level) else public.autonomy_ceiling(f.specialist_id) end as effective_level
  from public.catalog_flow_ro f
  left join public.task_autonomy_setting o on o.specialist_id = f.specialist_id and o.task_key = f.task_key;
  revoke all on public.task_autonomy_effective from anon, authenticated;
  grant select on public.task_autonomy_effective to authenticated, service_role;

  create or replace function public.set_task_autonomy(p_specialist uuid, p_task text, p_level text) returns void
  language plpgsql security definer set search_path = public, pg_temp as $f$
  declare v_catalog text; v_ceiling text; v_prev text;
  begin
    if not public.is_admin() then raise exception 'Solo un administrador puede cambiar esto.' using errcode = '42501'; end if;
    if public.autonomy_rank(p_level) is null then raise exception 'Nivel no válido.' using errcode = '22023'; end if;
    select autonomy_level into v_catalog from public.catalog_flow_ro where specialist_id = p_specialist and task_key = p_task and status = 'enabled';
    if v_catalog is null then raise exception 'La tarea no existe o está desactivada.' using errcode = '22023'; end if;
    v_ceiling := public.autonomy_ceiling(p_specialist);
    if public.autonomy_rank(p_level) > public.autonomy_rank(v_ceiling) then
      raise exception 'Vrutal todavía no permite este nivel para este especialista.' using errcode = '42501'; end if;
    select effective_level into v_prev from public.task_autonomy_effective where specialist_id = p_specialist and task_key = p_task;
    insert into public.task_autonomy_setting (specialist_id, task_key, autonomy_level, set_by, set_at)
    values (p_specialist, p_task, p_level, auth.uid(), now())
    on conflict (specialist_id, task_key) do update set autonomy_level = excluded.autonomy_level, set_by = excluded.set_by, set_at = excluded.set_at;
    insert into public.audit_log (actor_type, actor_label, action, target_table, target_id, reason)
    values ('client_user', (select email from auth.users where id = auth.uid()), 'task.autonomy_changed', 'task_autonomy_setting',
            p_specialist::text || ':' || p_task, coalesce(v_prev, '?') || ' -> ' || p_level);
  end $f$;
  revoke all on function public.set_task_autonomy(uuid, text, text) from public, anon;
  grant execute on function public.set_task_autonomy(uuid, text, text) to authenticated, service_role;

  create or replace function public.task_approval_record()
  returns table (specialist_id uuid, task_key text, approved bigint, rejected bigint, approved_streak bigint, last_decided_at timestamptz)
  language sql stable security definer set search_path = public, pg_temp as $f$
    with last_rejection as (
      select a.specialist_id, a.task_key, max(a.decided_at) as at from public.approval_requests a where a.status = 'rejected' group by a.specialist_id, a.task_key)
    select r.specialist_id, r.task_key,
           count(*) filter (where r.status = 'approved'), count(*) filter (where r.status = 'rejected'),
           count(*) filter (where r.status = 'approved' and (j.at is null or r.decided_at > j.at)), max(r.decided_at)
      from public.approval_requests r
      left join last_rejection j on j.specialist_id = r.specialist_id and j.task_key = r.task_key
     where public.is_admin() and r.task_key is not null and r.status in ('approved', 'rejected')
     group by r.specialist_id, r.task_key $f$;
  revoke all on function public.task_approval_record() from public, anon;
  grant execute on function public.task_approval_record() to authenticated, service_role;

  -- ===== pruebas =====
  select specialist_id, task_key into spec, task from public.catalog_flow_ro where status = 'enabled' order by task_key limit 1;
  update public.specialists set autonomy_level = 'read_only', phase = '01_AUDIT', status = 'active' where id = spec;

  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Especialista solo lectura y en auditoría: techo = suggest
  begin perform public.set_task_autonomy(spec, task, 'execute_with_approval'); r := r || '1a) MAL: subir con techo suggest | ';
  exception when others then r := r || '1a) read_only/01: execute_with_approval bloqueado (esperado bloqueado) | '; end;
  begin perform public.set_task_autonomy(spec, task, 'suggest'); r := r || '1b) read_only/01: suggest permitido (esperado permitido) | ';
  exception when others then r := r || format('1b) MAL: suggest bloqueado [%s] | ', sqlerrm); end;

  -- 2. draft_for_approval: techo = execute_with_approval
  reset role; update public.specialists set autonomy_level = 'draft_for_approval' where id = spec;
  set local role authenticated;
  begin perform public.set_task_autonomy(spec, task, 'execute_with_approval'); r := r || '2a) draft: execute_with_approval permitido (esperado permitido) | ';
  exception when others then r := r || format('2a) MAL: bloqueado [%s] | ', sqlerrm); end;
  begin perform public.set_task_autonomy(spec, task, 'autonomous'); r := r || '2b) MAL: autonomous con techo execute_with_approval | ';
  exception when others then r := r || '2b) draft: autonomous bloqueado (esperado bloqueado) | '; end;

  -- 3. full_autonomy pero en fase de piloto: techo = execute_with_approval; desde fase 03: autonomous
  reset role; update public.specialists set autonomy_level = 'full_autonomy', phase = '02_PILOT' where id = spec;
  set local role authenticated;
  begin perform public.set_task_autonomy(spec, task, 'autonomous'); r := r || '3a) MAL: autonomous en fase 02 | ';
  exception when others then r := r || '3a) full_autonomy en fase 02: autonomous bloqueado (esperado bloqueado) | '; end;
  reset role; update public.specialists set phase = '03_LIMITED' where id = spec;
  set local role authenticated;
  begin perform public.set_task_autonomy(spec, task, 'autonomous'); r := r || '3b) full_autonomy en fase 03: autonomous permitido (esperado permitido) | ';
  exception when others then r := r || format('3b) MAL: bloqueado [%s] | ', sqlerrm); end;
  select effective_level into s from public.task_autonomy_effective where specialist_id = spec and task_key = task;
  r := r || format('3c) nivel efectivo: %s (esperado autonomous) | ', s);
  reset role;
  select count(*) into n from public.audit_log where action = 'task.autonomy_changed' and target_id = spec::text || ':' || task;
  r := r || format('3d) filas en audit_log: %s (esperado 3: suggest, execute_with_approval, autonomous) | ', n);

  -- 4. Vrutal baja el techo después: el efecto es inmediato aunque el Admin hubiera elegido autonomous
  update public.specialists set autonomy_level = 'read_only', phase = '01_AUDIT' where id = spec;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select effective_level into s from public.task_autonomy_effective where specialist_id = spec and task_key = task;
  r := r || format('4) techo bajado por Vrutal, nivel efectivo: %s (esperado suggest) | ', s);

  -- 5. El Admin no escribe directamente en la tabla
  begin insert into public.task_autonomy_setting (specialist_id, task_key, autonomy_level) values (spec, 'x', 'autonomous'); r := r || '5a) MAL: INSERT directo | ';
  exception when others then r := r || '5a) insert directo bloqueado (esperado bloqueado) | '; end;
  begin update public.task_autonomy_setting set autonomy_level = 'autonomous'; r := r || '5b) MAL: UPDATE directo | ';
  exception when others then r := r || '5b) update directo bloqueado (esperado bloqueado) | '; end;
  begin delete from public.task_autonomy_setting; r := r || '5c) MAL: DELETE directo | ';
  exception when others then r := r || '5c) delete directo bloqueado (esperado bloqueado) | '; end;
  select count(*) into n from public.task_autonomy_effective;
  r := r || format('5d) el admin lee la vista: %s filas (esperado el total del catálogo) | ', n);

  -- 6. Quien no es Admin
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.set_task_autonomy(spec, task, 'suggest'); r := r || '6a) MAL: no-admin cambia nivel | ';
  exception when others then r := r || '6a) no-admin no cambia nivel (esperado bloqueado) | '; end;
  select count(*) into n from public.task_approval_record();
  r := r || format('6b) no-admin ve historial: %s filas (esperado 0) | ', n);

  -- 7. Historial: 3 aprobadas, 1 rechazada, 2 aprobadas -> aprobadas 5, rechazadas 1, seguidas 2
  reset role;
  insert into public.approval_requests (specialist_id, task_key, status, decided_at) values
    (spec, task, 'approved', now() - interval '10 days'), (spec, task, 'approved', now() - interval '9 days'),
    (spec, task, 'approved', now() - interval '8 days'), (spec, task, 'rejected', now() - interval '7 days'),
    (spec, task, 'approved', now() - interval '6 days'), (spec, task, 'approved', now() - interval '5 days');
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select approved, rejected, approved_streak into v_a, v_r, v_s from public.task_approval_record() where specialist_id = spec and task_key = task;
  r := r || format('7) historial: aprobadas=%s rechazadas=%s seguidas=%s (esperado 5, 1, 2)', v_a, v_r, v_s);
  reset role;

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
