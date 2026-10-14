-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 015 · Ficha de tarea (centro del flujo de Plataforma)
--
-- - catalog_list_tasks: lista paginada de tareas con búsqueda, filtro por
--   departamento (el de los roles que la usan: casi ninguna tarea tiene proceso)
--   y conteos de roles, componentes y composiciones. total_count = total filtrado.
-- - catalog_list_task_roles: roles (versiones de job_role) que usan una tarea,
--   con su clasificación. Alimenta la pestaña Roles y el contexto ?rol= de la ficha.
-- Misma regla que el resto del catálogo: solo is_platform_admin().
-- =====================================================================

create or replace function public.catalog_list_tasks(
  p_query text default null,
  p_domain_id text default null,
  p_only_used boolean default false,
  p_limit int default 50,
  p_offset int default 0)
returns table(id uuid, task_code text, statement text,
              role_count int, component_count int, composition_count int, total_count bigint)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.task_code, t.statement,
         (select count(*) from catalog.job_role_task jrt where jrt.task_id = t.id)::int,
         (select count(*) from catalog.task_component tc where tc.task_id = t.id)::int,
         (select count(*) from catalog.task_composition c where c.task_id = t.id)::int,
         count(*) over ()
  from catalog.task t
  where (coalesce(p_query, '') = ''
         or t.task_code ilike '%' || p_query || '%' or t.statement ilike '%' || p_query || '%')
    and (p_domain_id is null or exists (
           select 1 from catalog.job_role_task jrt
           join catalog.job_role j on j.id = jrt.job_role_id
           where jrt.task_id = t.id and j.domain_id = p_domain_id))
    and (not coalesce(p_only_used, false) or exists (
           select 1 from catalog.job_role_task jrt where jrt.task_id = t.id))
  order by t.task_code
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end $$;

create or replace function public.catalog_list_task_roles(p_task_id uuid)
returns table(job_role_id uuid, key text, name text, version int, status text,
              domain_id text, domain_name text, effect_classification text, criticality text)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select j.id, j.key, j.name, j.version, j.status, j.domain_id, d.name,
         jrt.effect_classification, jrt.criticality
  from catalog.job_role_task jrt
  join catalog.job_role j on j.id = jrt.job_role_id
  left join catalog.domain d on d.id = j.domain_id
  where jrt.task_id = p_task_id
  order by d.name nulls last, j.name, j.version desc;
end $$;

revoke execute on function public.catalog_list_tasks(text, text, boolean, int, int) from public, anon;
revoke execute on function public.catalog_list_task_roles(uuid) from public, anon;
grant execute on function public.catalog_list_tasks(text, text, boolean, int, int) to authenticated;
grant execute on function public.catalog_list_task_roles(uuid) to authenticated;
