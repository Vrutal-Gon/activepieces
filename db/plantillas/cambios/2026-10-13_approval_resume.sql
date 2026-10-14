-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Aprobar desde la pantalla reanuda el flujo
--
-- Decidido el 2026-10-13: el paso «Pide permiso» de los flujos de Activepieces se aprueba
-- en la pantalla Aprobaciones de VrutalOS, no con enlaces de correo. La pantalla y la tabla
-- ya existían; lo que faltaba es el puente para que decidir aquí REANUDE el flujo.
--
-- Por qué así y no con los enlaces de `@activepieces/piece-approval` a secas: la pieza existe
-- en la instancia y es la única forma de pausar un flujo (pausar es capacidad de pieza, un paso
-- CODE no puede), pero sus enlaces de aprobar/rechazar irían por fuera del producto — la
-- pantalla Aprobaciones del cliente se quedaría vacía y no habría rastro en su base. Aquí los
-- enlaces se siguen usando, pero como MECANISMO INTERNO: los guarda esta tabla y los dispara
-- el servidor cuando el cliente pulsa el botón de su panel. El cliente nunca los ve.
--
-- Qué cambia:
--   1. `resume_url`: el enlace que reanuda el flujo. **Sin GRANT para `authenticated`**, igual
--      que `integrations.secret_ref` — quien lo leyera podría reanudar un flujo sin decidir
--      nada, saltándose la aprobación. Solo lo leen `service_role` y la Edge Function.
--   2. `item_decisions`: qué se aprobó y qué no cuando una aprobación lleva VARIOS elementos
--      (F14 adapta una pieza a varios canales y se decide canal por canal, con una sola
--      pausa del flujo). El flujo lo lee al reanudar para quedarse solo con lo aprobado.
--   3. `decide_approval()`: único camino para decidir. Paga la deuda que ya estaba anotada en
--      el README («quien tiene una aprobación asignada podría falsear decided_by/decided_at o
--      tocar payload»): ahora `decided_by` y `decided_at` los fija el servidor, y se retira el
--      UPDATE directo de `authenticated` sobre la tabla.
--
-- El criterio de quién puede decidir es EL MISMO que ya tenían las políticas de UPDATE
-- (`approvals_decide_admin` + `decide_own_or_delegated`): admin, o la aprobación asignada, o
-- una delegación vigente. No se amplía ni se restringe a nadie.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. Columnas nuevas.
alter table public.approval_requests
  add column if not exists resume_url text,
  add column if not exists item_decisions jsonb;

-- 2. Permisos por columna. `authenticated` tenía SELECT y UPDATE sobre la tabla entera (y
-- TRUNCATE/REFERENCES/TRIGGER por defecto de Supabase, que el README ya marcaba para quitar).
-- Se retira todo y se devuelve solo el SELECT de las columnas que la pantalla necesita:
-- `resume_url` queda fuera, y el UPDATE desaparece porque ahora se decide por RPC.
revoke all on public.approval_requests from anon, authenticated;
grant select (
  id, specialist_id, task_key, payload, status, requested_at,
  decided_by, decided_at, assigned_to, requested_by, item_decisions
) on public.approval_requests to authenticated;
grant all on public.approval_requests to service_role;

-- 3. Decidir, en servidor.
create or replace function public.decide_approval(
  p_id uuid,
  p_approve boolean,
  p_item_decisions jsonb default null
)
returns boolean
language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_puede boolean;
  v_filas int;
begin
  if not public.is_active_user() then
    raise exception 'Cuenta no activa.' using errcode = '42501';
  end if;

  -- Mismo criterio que las políticas de UPDATE que ya existían.
  select (
    public.is_admin()
    or a.assigned_to = auth.uid()
    or exists (
      select 1 from public.approval_delegation d
       where d.delegate_profile_id = auth.uid()
         and d.revoked_at is null
         and current_date between d.starts_on and d.ends_on
         and (d.specialist_id = a.specialist_id or d.flow_task_key = a.task_key)
    )
  )
  into v_puede
  from public.approval_requests a
  where a.id = p_id;

  if coalesce(v_puede, false) = false then
    -- Mismo mensaje tanto si no existe como si no hay permiso: no se filtra qué aprobaciones hay.
    raise exception 'No puedes decidir esta aprobación.' using errcode = '42501';
  end if;

  -- `status = 'pending'` en el WHERE: dos personas no pueden decidir la misma aprobación.
  update public.approval_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(),
         decided_at = now(),
         item_decisions = coalesce(p_item_decisions, item_decisions)
   where id = p_id
     and status = 'pending';

  get diagnostics v_filas = row_count;
  return v_filas = 1;
end $f$;

revoke all on function public.decide_approval(uuid, boolean, jsonb) from public, anon;
grant execute on function public.decide_approval(uuid, boolean, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.decide_approval(uuid, boolean, jsonb);
--   grant select, update on public.approval_requests to authenticated;
--   alter table public.approval_requests drop column item_decisions, drop column resume_url;
--   (la pantalla volvería a escribir status/decided_by directamente: ver deuda del README)
-- ---------------------------------------------------------------------
