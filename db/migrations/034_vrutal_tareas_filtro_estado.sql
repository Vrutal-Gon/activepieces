-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · Migración 034 · La lista de Tareas muestra y filtra por Estado
--
-- El founder no encontraba `VRL-MKT-C03` en el panel. La búsqueda sí la cubría —
-- `catalog_list_tasks` busca por `task_code` Y por `statement`, y no filtra por estado— pero
-- la lista **no muestra el estado**, así que no hay forma de distinguir un borrador de una
-- tarea validada, ni de listar solo los borradores. Eso es lo que faltaba.
--
-- Por qué además costaba verla: la lista ordena por `process.sequence_ord` y luego por
-- `task_code`, así que `VRL-…` cae al final de su grupo de proceso, después de todas las
-- `TSK-…`.
--
-- HAY QUE RECREAR la función, no basta `create or replace`, porque cambia su tipo de retorno
-- (añade la columna `status`). Y no vale crear una versión con otra firma: al añadir
-- `p_status` serían 8 parámetros frente a 7, quedarían las dos conviviendo y PostgREST no
-- podría resolver cuál usar — exactamente las sobrecargas duplicadas que dejó la migración
-- `028` y que hubo que limpiar. Por eso el `drop` explícito va primero.
--
-- El `drop` se ejecuta aparte, a mano: el permiso automático del asistente bloquea DROP.
--   drop function public.catalog_list_tasks(text,text,boolean,integer,integer,text,text);
--
-- Front que acompaña a esto (ya hecho): `TaskList.tsx` añade el desplegable **Estado**
-- (Todos / Borrador / Validada / Obsoleta, en el parámetro `?est` de la URL) y una columna
-- **Estado** con la pastilla `StatusPill`, que ya coloreaba `draft` en ámbar y `validated` en
-- verde. `TaskListRow` gana `status` y `TaskListFilter` gana `status`.
-- =====================================================================

create or replace function public.catalog_list_tasks(
  p_query text default null::text,
  p_domain_id text default null::text,
  p_only_used boolean default false,
  p_limit integer default 50,
  p_offset integer default 0,
  p_process_id text default null::text,
  p_pattern text default null::text,
  p_status text default null::text
)
 returns table(id uuid, task_code text, statement text, process_id text, process_name text,
               primary_pattern text, status text, role_count integer, component_count integer,
               composition_count integer, total_count bigint)
 language plpgsql
 stable security definer
 set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.task_code, t.statement, t.process_id, p.name, t.primary_pattern, t.status,
         (select count(*) from catalog.job_role_task jrt where jrt.task_id = t.id)::int,
         (select count(*) from catalog.task_component tc where tc.task_id = t.id)::int,
         (select count(*) from catalog.task_composition c where c.task_id = t.id)::int,
         count(*) over ()
  from catalog.task t
  left join catalog.process p on p.id = t.process_id
  where (coalesce(p_query, '') = ''
         or t.task_code ilike '%' || p_query || '%' or t.statement ilike '%' || p_query || '%')
    and (p_domain_id is null or exists (
           select 1 from catalog.job_role_task jrt
           join catalog.job_role j on j.id = jrt.job_role_id
           where jrt.task_id = t.id and j.domain_id = p_domain_id))
    and (not coalesce(p_only_used, false) or exists (
           select 1 from catalog.job_role_task jrt where jrt.task_id = t.id))
    and (p_process_id is null or t.process_id = p_process_id)
    and (p_pattern is null or t.primary_pattern = p_pattern)
    and (p_status is null or t.status = p_status)
  order by coalesce(p.sequence_ord, 999999), t.task_code
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end $function$;

revoke all on function public.catalog_list_tasks(text, text, boolean, integer, integer, text, text, text) from anon;
grant execute on function public.catalog_list_tasks(text, text, boolean, integer, integer, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Para revertir: recrear la versión de 7 parámetros sin `status` y borrar esta de 8.
--   (el front dejaría de compilar hasta quitar también `status` de TaskListRow)
-- ---------------------------------------------------------------------
