-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Arreglo: la pantalla Aprobaciones no cargaba
--
-- Fallo encontrado el 2026-10-13, preexistente: la pantalla Aprobaciones fallaba al CARGAR
-- («no tienes permiso para hacer esto») en cuanto existía una sola aprobación.
--
-- Causa: las políticas `select_own_or_delegated` y `decide_own_or_delegated` de
-- `approval_requests` llevan dentro un `exists (select 1 from approval_delegation ...)`. Las
-- subconsultas de una política se evalúan con los permisos de QUIEN CONSULTA, y
-- `approval_delegation` no tiene GRANT para `authenticated` — a propósito, el README ya lo
-- decía («tienen política de RLS pero ningún GRANT: hoy nadie del cliente puede leerlas»).
-- Con la tabla de aprobaciones vacía la política nunca se evaluaba, así que el fallo estuvo
-- latente desde que se escribió: se vio al crear la primera aprobación de verdad.
--
-- Arreglo: la comprobación se mueve a una función `security definer`, que se ejecuta como su
-- dueño y por tanto sí puede leer `approval_delegation`. Así:
--   · `approval_delegation` sigue sin ser legible para el cliente (no se le abre nada).
--   · Las delegaciones siguen funcionando de verdad. La alternativa fácil —dar SELECT sobre
--     `approval_delegation`— habría dejado de dar error pero habría roto el comportamiento:
--     con RLS activa y sin política de lectura, la subconsulta no devolvería nada nunca y
--     ninguna delegación valdría. Habría parecido arreglado y no lo estaría.
--
-- Se usa `alter policy` en vez de recrearlas: cambia solo la expresión, sin ventana en la que
-- la tabla se quede sin política.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

create or replace function public.has_approval_delegation(p_specialist_id uuid, p_task_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $f$
  select exists (
    select 1
    from public.approval_delegation d
    where d.delegate_profile_id = auth.uid()
      and d.revoked_at is null
      and current_date between d.starts_on and d.ends_on
      and (d.specialist_id = p_specialist_id or d.flow_task_key = p_task_key)
  )
$f$;

revoke all on function public.has_approval_delegation(uuid, text) from public, anon;
grant execute on function public.has_approval_delegation(uuid, text) to authenticated, service_role;

-- Misma condición que antes, con la subconsulta encapsulada.
alter policy select_own_or_delegated on public.approval_requests
  using (
    assigned_to = auth.uid()
    or public.has_approval_delegation(specialist_id, task_key)
  );

-- `authenticated` ya no tiene UPDATE sobre la tabla (ver `2026-10-13_approval_resume.sql`:
-- se decide por `decide_approval`), así que esta política es inalcanzable para un cliente.
-- Se corrige igual para que no quede una expresión que falla si algún día se repone el UPDATE.
alter policy decide_own_or_delegated on public.approval_requests
  using (
    assigned_to = auth.uid()
    or public.has_approval_delegation(specialist_id, task_key)
  );

-- ---------------------------------------------------------------------
-- Para revertir (vuelve a dejar la pantalla rota en cuanto haya una aprobación):
--   alter policy select_own_or_delegated on public.approval_requests
--     using (assigned_to = auth.uid() or exists (
--       select 1 from approval_delegation d
--        where d.delegate_profile_id = auth.uid() and d.revoked_at is null
--          and current_date between d.starts_on and d.ends_on
--          and (d.specialist_id = approval_requests.specialist_id
--               or d.flow_task_key = approval_requests.task_key)));
--   (ídem decide_own_or_delegated)
--   drop function public.has_approval_delegation(uuid, text);
-- ---------------------------------------------------------------------
