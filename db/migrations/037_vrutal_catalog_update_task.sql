-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · Migración 037 · Editar una tarea desde el panel
--
-- Hueco encontrado el 2026-10-16 al intentar usar el filtro de Estado que añadió la 035:
-- **no existía ninguna RPC que edite una tarea**. Las de autoría eran `catalog_create_task`
-- (crea) y `catalog_link_task_role` / `catalog_link_task_component` (enlazan). Ninguna
-- cambia `status`, ni `process_id`, ni `primary_pattern`.
--
-- Tres consecuencias que se arrastraban en silencio:
--   · El filtro de Estado era de SOLO LECTURA: se veían los borradores y no se podía validar
--     ninguno. Y las 1.094 tareas están en `draft`, así que el estado no distinguía nada.
--   · Las ~1.000 tareas con `process_id` null (import crudo de O*NET y APQC) **no se podían
--     curar en la UI**, aunque la 018 dijera en su cabecera «los roles y sus tareas se curan
--     después desde el panel». El panel no podía.
--   · La única vía era SQL a mano, que es justo lo que el founder quiere dejar de hacer.
--
-- DOS REGLAS QUE LA RPC IMPONE, NO SUGIERE:
--
-- 1. **`task_code` no se toca.** Es la identidad, opaca e inmutable
--    (`docs/arquitectura/VRUTAL_OS_Modelo_Datos_Roles_Tareas.md:155`). `source` y
--    `source_code` tampoco: son la trazabilidad al origen (el `SOC.TaskID` de O*NET, el
--    `3.4.3.2` de APQC, el `VRL-MKT-C03` de las internas).
--
-- 2. **El enunciado de una tarea `validated` no se cambia en sitio.** Eso es una VERSIÓN
--    nueva (misma `task_code`, `version` + 1), que es lo que describe el modelo de datos en
--    sus líneas 478-480: «Las tareas no se sobrescriben. `version` incrementa, la anterior
--    pasa a DEPRECATED… y las instancias de cliente ancladas a la versión antigua aparecen
--    en el informe de deuda de versión».
--
--    Ese camino **todavía no tiene implementación**: no existe `catalog_new_task_version` y
--    `catalog.task_version_history` no recibe un solo insert en todo el repositorio. Así que
--    aquí se RECHAZA con un error legible, en vez de permitir una edición silenciosa que
--    dejaría a los clientes ejecutando un enunciado que ya no existe. El resto de campos
--    (clasificación: proceso, patrón, riesgo, estado) sí se puede ajustar en una validada:
--    son metadatos de catálogo, no el trabajo que el especialista ejecuta.
--
-- Todos los parámetros son opcionales y `null` significa «no lo cambies» (via `coalesce`),
-- para que el front pueda enviar solo lo que el usuario tocó.
-- =====================================================================

create or replace function public.catalog_update_task(
  p_task_id uuid,
  p_statement text default null,
  p_process_id text default null,
  p_primary_pattern text default null,
  p_risk text default null,
  p_reversible boolean default null,
  p_requires_approval boolean default null,
  p_customer_facing boolean default null,
  p_touches_budget boolean default null,
  p_status text default null)
returns void
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare
  v_status_actual text;
  v_statement_actual text;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;

  select status, statement into v_status_actual, v_statement_actual
    from catalog.task where id = p_task_id;
  if v_status_actual is null then
    raise exception 'Esa tarea no existe' using errcode = 'P0002';
  end if;

  if p_statement is not null
     and trim(p_statement) is distinct from v_statement_actual
     and v_status_actual = 'validated' then
    raise exception 'No se cambia el enunciado de una tarea validada: eso es una version nueva. Duplica la tarea o pide la RPC de versionado.'
      using errcode = '23514';
  end if;

  if p_statement is not null and length(trim(p_statement)) < 10 then
    raise exception 'Describe la tarea en una frase (minimo 10 caracteres)' using errcode = '23514';
  end if;

  if p_status is not null and p_status not in ('draft','validated','deprecated') then
    raise exception 'Estado no valido' using errcode = '23514';
  end if;

  update catalog.task set
    statement         = coalesce(trim(p_statement), statement),
    process_id        = coalesce(nullif(p_process_id, ''), process_id),
    primary_pattern   = coalesce(nullif(p_primary_pattern, ''), primary_pattern),
    risk              = coalesce(p_risk, risk),
    reversible        = coalesce(p_reversible, reversible),
    requires_approval = coalesce(p_requires_approval, requires_approval),
    customer_facing   = coalesce(p_customer_facing, customer_facing),
    touches_budget    = coalesce(p_touches_budget, touches_budget),
    status            = coalesce(p_status, status)
  where id = p_task_id;
end $$;

revoke all on function public.catalog_update_task(uuid, text, text, text, text, boolean, boolean, boolean, boolean, text) from anon;
grant execute on function public.catalog_update_task(uuid, text, text, text, text, boolean, boolean, boolean, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- Probado al aplicar (3/3): tarea inexistente rechazada, estado inventado rechazado,
-- enunciado de menos de 10 caracteres rechazado.
--
-- Front que acompaña: pestaña **Ficha** en el panel de tarea
-- (`Panel-Vrutal1st/src/pages/task/FichaTab.tsx`), con enunciado, proceso, patrón, riesgo y
-- estado. El `task_code` se muestra con un «no se edita» al lado. En una tarea validada el
-- enunciado sale deshabilitado con la explicación de por qué.
--
-- NO expone `reversible`, `requires_approval`, `customer_facing` ni `touches_budget`: la RPC
-- los acepta, pero `catalog_get_task` no los devuelve, así que el formulario no puede
-- mostrar su valor actual. Añadirlos exige tocar también esa función (cambia su retorno, con
-- su drop). Se hará cuando haga falta de verdad.
--
-- Para revertir: drop function public.catalog_update_task(...). El front dejaría de compilar
-- hasta quitar la pestaña Ficha.
-- ---------------------------------------------------------------------
