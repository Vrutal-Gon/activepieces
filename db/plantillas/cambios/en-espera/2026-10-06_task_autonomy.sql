-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Autonomía por tarea
--
-- El Admin del cliente decide, tarea a tarea, si el especialista pide aprobación o actúa solo
-- (p. ej. «Registrar lead en el CRM»: al principio con aprobación; tras muchas aprobadas, automática).
--
-- Niveles (de menos a más autonomía):
--   suggest               Sugiere: propone y lo hace una persona.
--   execute_with_approval Ejecuta con aprobación: prepara y espera el visto bueno.
--   autonomous            Autónoma: ejecuta sin pedir permiso.
--
-- Reglas (las aplica el SERVIDOR, no la pantalla):
--   1. Vrutal fija un TECHO por especialista, con lo que ya controla: su nivel de autonomía y su fase.
--        especialista no activo, o read_only            -> techo suggest
--        draft_for_approval                             -> techo execute_with_approval
--        auto_low_risk / full_autonomy en fase 01 o 02  -> techo execute_with_approval
--        auto_low_risk / full_autonomy desde fase 03    -> techo autonomous
--   2. El Admin elige nivel hasta ese techo, y puede bajarlo cuando quiera.
--   3. El nivel efectivo = el elegido por el Admin (o el del catálogo si no ha elegido), recortado al techo.
--      Si Vrutal baja el techo después, el efecto es inmediato aunque el Admin hubiera elegido más.
--   4. Cada cambio queda en audit_log (quién, cuándo, de qué nivel a cuál).
--
-- El catálogo (catalog_flow_ro) lo reescribe la sincronización con Vrutal1st cada 15 min: por eso lo que
-- elige el cliente va en una tabla propia (task_autonomy_setting) que la sincronización no toca.
--
-- CONTRATO CON LOS FLUJOS: el bloque «Pide permiso» (gate) de Activepieces debe leer
-- task_autonomy_effective.effective_level de su tarea al ejecutarse:
--   suggest / execute_with_approval -> crear la aprobación y esperar;  autonomous -> seguir sin pedirla.
--
-- PENDIENTE en Vrutal1st: un techo POR TAREA (hoy es por especialista), para que una tarea sensible
-- (mover dinero, borrar) pueda exigir siempre aprobación aunque el especialista sea autónomo.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. Orden de los niveles y techo de un especialista.
create or replace function public.autonomy_rank(p_level text)
returns int
language sql immutable as $f$
  select case p_level when 'suggest' then 1 when 'execute_with_approval' then 2 when 'autonomous' then 3 end
$f$;

create or replace function public.autonomy_ceiling(p_specialist uuid)
returns text
language sql stable security definer set search_path = public, pg_temp as $f$
  select case
    when s.status <> 'active' then 'suggest'
    when s.autonomy_level = 'read_only' then 'suggest'
    when s.autonomy_level = 'draft_for_approval' then 'execute_with_approval'
    when s.phase in ('01_AUDIT', '02_PILOT') then 'execute_with_approval'
    else 'autonomous'
  end
  from public.specialists s
  where s.id = p_specialist
$f$;

revoke all on function public.autonomy_rank(text), public.autonomy_ceiling(uuid) from public, anon;
grant execute on function public.autonomy_rank(text), public.autonomy_ceiling(uuid) to authenticated, service_role;

-- 2. Lo que elige el cliente. Solo se escribe con set_task_autonomy().
create table if not exists public.task_autonomy_setting (
  specialist_id uuid not null,
  task_key      text not null,
  autonomy_level text not null check (autonomy_level in ('suggest', 'execute_with_approval', 'autonomous')),
  set_by        uuid references public.profiles(id),
  set_at        timestamptz not null default now(),
  primary key (specialist_id, task_key),
  foreign key (specialist_id, task_key) references public.catalog_flow_ro (specialist_id, task_key) on delete cascade
);

alter table public.task_autonomy_setting enable row level security;

drop policy if exists task_autonomy_select_team on public.task_autonomy_setting;
create policy task_autonomy_select_team on public.task_autonomy_setting
  for select to authenticated using (true);

-- Cuenta desactivada = sin datos (misma regla que el resto de tablas).
drop policy if exists active_only on public.task_autonomy_setting;
create policy active_only on public.task_autonomy_setting
  as restrictive for all to authenticated using (public.is_active_user());

revoke all on public.task_autonomy_setting from anon, authenticated;
grant select on public.task_autonomy_setting to authenticated;
grant all on public.task_autonomy_setting to service_role;

-- 3. Nivel efectivo de cada tarea: lo que deben leer la app y los flujos.
create or replace view public.task_autonomy_effective with (security_invoker = true) as
select
  f.specialist_id,
  f.task_key,
  f.autonomy_level                                   as catalog_level,
  o.autonomy_level                                   as override_level,
  public.autonomy_ceiling(f.specialist_id)           as ceiling_level,
  case
    when public.autonomy_rank(coalesce(o.autonomy_level, f.autonomy_level))
         <= public.autonomy_rank(public.autonomy_ceiling(f.specialist_id))
      then coalesce(o.autonomy_level, f.autonomy_level)
    else public.autonomy_ceiling(f.specialist_id)
  end                                                as effective_level
from public.catalog_flow_ro f
left join public.task_autonomy_setting o
       on o.specialist_id = f.specialist_id and o.task_key = f.task_key;

revoke all on public.task_autonomy_effective from anon, authenticated;
grant select on public.task_autonomy_effective to authenticated, service_role;

-- 4. Cambiar el nivel de una tarea. Solo un Admin activo; nunca por encima del techo.
create or replace function public.set_task_autonomy(p_specialist uuid, p_task text, p_level text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_catalog text;
  v_ceiling text;
  v_prev text;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar esto.' using errcode = '42501';
  end if;
  if public.autonomy_rank(p_level) is null then
    raise exception 'Nivel no válido.' using errcode = '22023';
  end if;

  select autonomy_level into v_catalog
    from public.catalog_flow_ro
   where specialist_id = p_specialist and task_key = p_task and status = 'enabled';
  if v_catalog is null then
    raise exception 'La tarea no existe o está desactivada.' using errcode = '22023';
  end if;

  v_ceiling := public.autonomy_ceiling(p_specialist);
  if public.autonomy_rank(p_level) > public.autonomy_rank(v_ceiling) then
    raise exception 'Vrutal todavía no permite este nivel para este especialista.' using errcode = '42501';
  end if;

  select effective_level into v_prev
    from public.task_autonomy_effective
   where specialist_id = p_specialist and task_key = p_task;

  insert into public.task_autonomy_setting (specialist_id, task_key, autonomy_level, set_by, set_at)
  values (p_specialist, p_task, p_level, auth.uid(), now())
  on conflict (specialist_id, task_key)
  do update set autonomy_level = excluded.autonomy_level, set_by = excluded.set_by, set_at = excluded.set_at;

  insert into public.audit_log (actor_type, actor_label, action, target_table, target_id, reason)
  values ('client_user',
          (select email from auth.users where id = auth.uid()),
          'task.autonomy_changed',
          'task_autonomy_setting',
          p_specialist::text || ':' || p_task,
          coalesce(v_prev, '?') || ' -> ' || p_level);
end $f$;

revoke all on function public.set_task_autonomy(uuid, text, text) from public, anon;
grant execute on function public.set_task_autonomy(uuid, text, text) to authenticated, service_role;

-- 5. Historial de decisiones por tarea: cuántas aprobadas, rechazadas y cuántas aprobadas SEGUIDAS
--    desde el último rechazo (lo que indica si la tarea ya es fiable). Solo Admin.
create or replace function public.task_approval_record()
returns table (
  specialist_id uuid,
  task_key text,
  approved bigint,
  rejected bigint,
  approved_streak bigint,
  last_decided_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $f$
  with last_rejection as (
    select a.specialist_id, a.task_key, max(a.decided_at) as at
      from public.approval_requests a
     where a.status = 'rejected'
     group by a.specialist_id, a.task_key
  )
  select r.specialist_id,
         r.task_key,
         count(*) filter (where r.status = 'approved'),
         count(*) filter (where r.status = 'rejected'),
         count(*) filter (where r.status = 'approved' and (j.at is null or r.decided_at > j.at)),
         max(r.decided_at)
    from public.approval_requests r
    left join last_rejection j on j.specialist_id = r.specialist_id and j.task_key = r.task_key
   where public.is_admin()
     and r.task_key is not null
     and r.status in ('approved', 'rejected')
   group by r.specialist_id, r.task_key
$f$;

revoke all on function public.task_approval_record() from public, anon;
grant execute on function public.task_approval_record() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.task_approval_record();
--   drop function public.set_task_autonomy(uuid, text, text);
--   drop view public.task_autonomy_effective;
--   drop table public.task_autonomy_setting;
--   drop function public.autonomy_ceiling(uuid);
--   drop function public.autonomy_rank(text);
-- ---------------------------------------------------------------------
