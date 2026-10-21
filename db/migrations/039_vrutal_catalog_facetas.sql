-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · Migración 039 · Facetas reales sobre el catálogo de tareas
--
-- POR QUÉ. Auditoría de UX del panel, 2026-10-16. El catálogo tiene 1.147 tareas y la lista
-- era prácticamente innavegable, por tres motivos que son de datos, no de interfaz:
--
--   · **1.062 de 1.147 no tienen `process_id`** y 1.054 no tienen `primary_pattern`. Los dos
--     únicos filtros que ofrecía el panel (Departamento y Proceso) alcanzaban por tanto a 85
--     filas. Filtrar escondía el 93 % del catálogo sin decirlo.
--   · Las **665 filas con `source='apqc'` no son tareas**: son nodos de la jerarquía PCF
--     (12 de nivel L1, 33 L2, 142 L3, 478 L4), con enunciados como
--     «L1 | 1.0 Develop Vision and Strategy». Solo 2 están enlazadas a un rol. Mezcladas con
--     las tareas de verdad, contaminan toda búsqueda.
--   · Las 411 de `source='onet'` sí son tareas, pero crudas y en inglés. Tienen
--     `occupation_id` —la única dimensión que las parte en grupos manejables— y el panel no
--     la exponía: `occupation` no aparecía en una sola línea del front.
--
-- Y un contador que mentía: `catalog_list_tasks.component_count` contaba
-- `catalog.task_component`, que tiene **0 filas** (igual que `job_role_task_component`). La
-- columna «Componentes» mostraba 0 en las 1.147 filas. Lo que de verdad enlaza componentes
-- son los slots de las composiciones, así que aquí pasa a ser `step_count`.
--
-- QUÉ HACE.
--
-- 1. `catalog.v_task_enriched` — una sola definición de los derivados de una tarea
--    (ocupación, nivel APQC, nº de roles, nº de composiciones, nº de pasos, y **curada sí o
--    no**). La lista, las facetas y la bandeja de importación leen de aquí, para que no
--    puedan discrepar entre sí sobre qué cuenta como tarea curada.
--
-- 2. `catalog_browse_tasks` — la lista con las facetas que sí particionan el dato
--    (`p_source`, `p_occupation_id`, `p_risk`, `p_apqc_level`, `p_has_composition`,
--    `p_curated`), devolviendo `source`, `occupation_title`, `apqc_level` y `step_count`.
--
--    **Nombre nuevo en vez de reemplazar `catalog_list_tasks`.** Cambiar el retorno de la
--    vieja exigía un `drop function` delante, y el entorno de trabajo no permite ejecutar
--    `drop` contra esta base. `catalog_list_tasks` queda intacta y sin usar desde el front;
--    se puede retirar a mano cuando convenga:
--        drop function public.catalog_list_tasks(text, text, boolean, integer, integer, text, text, text);
--
-- 3. `catalog_task_facets` — los contadores del rail de filtros en UNA llamada. Cada faceta
--    se cuenta aplicando todos los demás filtros pero NO el suyo propio, que es lo que hace
--    que un rail de facetas sea usable: ves cuántas tareas te daría cada otra opción sin
--    perder las que ya tienes seleccionadas.
--
-- 4. `catalog_list_occupations` — las 24 ocupaciones con su recuento.
--
-- 5. `catalog_list_all_compositions` — las composiciones del catálogo con su tarea, sus
--    roles y su nº de pasos. Hasta ahora `/composiciones` en el panel montaba la lista de
--    TAREAS: prometía 10 composiciones y entregaba 1.147 tareas.
--
-- CUIDADO con `title_es`: es NULL en las 24 ocupaciones, así que `occupation_title` cae a
-- `title_en` y la faceta sale en inglés. Traducirlas es trabajo de datos, no de esta
-- migración.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · La vista: una sola verdad sobre qué es una tarea curada
-- ---------------------------------------------------------------------

create or replace view catalog.v_task_enriched as
select
  t.id,
  t.task_code,
  t.statement,
  t.source,
  t.source_code,
  t.occupation_id,
  t.process_id,
  t.primary_pattern,
  t.risk,
  t.status,
  t.apqc_process_path,
  p.name                                   as process_name,
  p.domain_id                              as process_domain_id,
  coalesce(o.title_es, o.title_en)         as occupation_title,
  -- 'L1'..'L4' en las filas de APQC; null en el resto. Es el nivel del árbol PCF.
  case when t.source = 'apqc' then nullif(split_part(t.apqc_process_path, ' ', 1), '') end as apqc_level,
  (select count(*) from catalog.job_role_task jrt where jrt.task_id = t.id)::int           as role_count,
  (select count(*) from catalog.task_composition c where c.task_id = t.id)::int            as composition_count,
  (select count(*)
     from catalog.task_composition_slot s
     join catalog.task_composition c on c.id = s.composition_id
    where c.task_id = t.id)::int                                                           as step_count,
  -- Curada = alguien ya la ha tocado. Es el corte entre Biblioteca e Importaciones.
  (t.source = 'internal'
   or t.process_id is not null
   or t.primary_pattern is not null
   or exists (select 1 from catalog.job_role_task jrt where jrt.task_id = t.id))           as curated
from catalog.task t
left join catalog.process p    on p.id = t.process_id
left join catalog.occupation o on o.id = t.occupation_id;

comment on view catalog.v_task_enriched is
  'Tarea + sus derivados de navegación. Única definición de «curada»: la usan '
  'catalog_browse_tasks, catalog_task_facets y la bandeja de importación del panel.';

-- La vista no se expone directamente: se lee desde funciones SECURITY DEFINER que
-- comprueban is_platform_admin(). Sin grants a anon ni a authenticated.
revoke all on catalog.v_task_enriched from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2 · La lista de tareas, con las facetas que sí parten el catálogo (nombre nuevo: sin drop)
-- ---------------------------------------------------------------------

create or replace function public.catalog_browse_tasks(
  p_query           text    default null,
  p_domain_id       text    default null,
  p_only_used       boolean default null,
  p_limit           integer default 50,
  p_offset          integer default 0,
  p_process_id      text    default null,
  p_pattern         text    default null,
  p_status          text    default null,
  p_source          text[]  default null,
  p_occupation_id   uuid    default null,
  p_risk            text    default null,
  p_apqc_level      text    default null,
  p_has_composition boolean default null,
  p_curated         boolean default null
)
returns table (
  id               uuid,
  task_code        text,
  statement        text,
  source           text,
  process_id       text,
  process_name     text,
  primary_pattern  text,
  risk             text,
  status           text,
  occupation_title text,
  apqc_level       text,
  role_count       int,
  step_count       int,
  composition_count int,
  total_count      bigint
)
language plpgsql
stable
security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select t.id, t.task_code, t.statement, t.source, t.process_id, t.process_name,
         t.primary_pattern, t.risk, t.status, t.occupation_title, t.apqc_level,
         t.role_count, t.step_count, t.composition_count,
         count(*) over ()
    from catalog.v_task_enriched t
   where (coalesce(p_query, '') = ''
          or t.task_code ilike '%' || p_query || '%'
          or t.statement ilike '%' || p_query || '%')
     and (p_source is null          or t.source = any (p_source))
     and (p_status is null          or t.status = p_status)
     and (p_pattern is null         or t.primary_pattern = p_pattern)
     and (p_process_id is null      or t.process_id = p_process_id)
     and (p_risk is null            or t.risk = p_risk)
     and (p_occupation_id is null   or t.occupation_id = p_occupation_id)
     and (p_apqc_level is null      or t.apqc_level = p_apqc_level)
     and (p_curated is null         or t.curated = p_curated)
     and (p_has_composition is null or (t.composition_count > 0) = p_has_composition)
     -- Tri-estado: null = todas, true = usadas por algún rol, false = huérfanas.
     and (p_only_used is null       or (t.role_count > 0) = p_only_used)
     and (p_domain_id is null or exists (
            select 1 from catalog.job_role_task jrt
              join catalog.job_role j on j.id = jrt.job_role_id
             where jrt.task_id = t.id and j.domain_id = p_domain_id))
   order by t.task_code
   limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
end $function$;

revoke all on function public.catalog_browse_tasks(text, text, boolean, integer, integer, text, text, text, text[], uuid, text, text, boolean, boolean) from anon;
grant execute on function public.catalog_browse_tasks(text, text, boolean, integer, integer, text, text, text, text[], uuid, text, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3 · Los contadores del rail de filtros, en una sola llamada
--
-- Cada faceta se cuenta con todos los filtros puestos MENOS el suyo. Por eso los flags se
-- calculan una vez en `cand` y luego cada bloque combina los que le tocan: si contases cada
-- faceta con su propio filtro aplicado, al elegir «fuente = onet» las demás fuentes saldrían
-- a 0 y no podrías cambiar de opinión sin borrar el filtro a ciegas.
-- ---------------------------------------------------------------------

create or replace function public.catalog_task_facets(
  p_query           text    default null,
  p_domain_id       text    default null,
  p_only_used       boolean default null,
  p_process_id      text    default null,
  p_pattern         text    default null,
  p_status          text    default null,
  p_source          text[]  default null,
  p_occupation_id   uuid    default null,
  p_risk            text    default null,
  p_apqc_level      text    default null,
  p_has_composition boolean default null,
  p_curated         boolean default null
)
returns table (facet text, value text, label text, n int)
language plpgsql
stable
security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  with cand as (
    select t.*,
           (coalesce(p_query, '') = ''
            or t.task_code ilike '%' || p_query || '%'
            or t.statement ilike '%' || p_query || '%')                      as f_query,
           (p_source is null          or t.source = any (p_source))          as f_source,
           (p_status is null          or t.status = p_status)                as f_status,
           (p_pattern is null         or t.primary_pattern = p_pattern)      as f_pattern,
           (p_process_id is null      or t.process_id = p_process_id)        as f_process,
           (p_risk is null            or t.risk = p_risk)                    as f_risk,
           (p_occupation_id is null   or t.occupation_id = p_occupation_id)  as f_occupation,
           (p_apqc_level is null      or t.apqc_level = p_apqc_level)        as f_level,
           (p_curated is null         or t.curated = p_curated)              as f_curated,
           (p_has_composition is null or (t.composition_count > 0) = p_has_composition) as f_comp,
           (p_only_used is null       or (t.role_count > 0) = p_only_used)   as f_used,
           (p_domain_id is null or exists (
              select 1 from catalog.job_role_task jrt
                join catalog.job_role j on j.id = jrt.job_role_id
               where jrt.task_id = t.id and j.domain_id = p_domain_id))      as f_domain
      from catalog.v_task_enriched t
  )
  select 'source', c.source, c.source, count(*)::int
    from cand c
   where c.f_query and c.f_status and c.f_pattern and c.f_process and c.f_risk
     and c.f_occupation and c.f_level and c.f_curated and c.f_comp and c.f_used and c.f_domain
   group by c.source

  union all
  select 'status', c.status, c.status, count(*)::int
    from cand c
   where c.f_query and c.f_source and c.f_pattern and c.f_process and c.f_risk
     and c.f_occupation and c.f_level and c.f_curated and c.f_comp and c.f_used and c.f_domain
   group by c.status

  union all
  select 'pattern', c.primary_pattern, c.primary_pattern, count(*)::int
    from cand c
   where c.primary_pattern is not null
     and c.f_query and c.f_source and c.f_status and c.f_process and c.f_risk
     and c.f_occupation and c.f_level and c.f_curated and c.f_comp and c.f_used and c.f_domain
   group by c.primary_pattern

  union all
  select 'process', c.process_id, c.process_name, count(*)::int
    from cand c
   where c.process_id is not null
     and c.f_query and c.f_source and c.f_status and c.f_pattern and c.f_risk
     and c.f_occupation and c.f_level and c.f_curated and c.f_comp and c.f_used and c.f_domain
   group by c.process_id, c.process_name

  union all
  select 'risk', c.risk, c.risk, count(*)::int
    from cand c
   where c.risk is not null
     and c.f_query and c.f_source and c.f_status and c.f_pattern and c.f_process
     and c.f_occupation and c.f_level and c.f_curated and c.f_comp and c.f_used and c.f_domain
   group by c.risk

  union all
  select 'occupation', c.occupation_id::text, c.occupation_title, count(*)::int
    from cand c
   where c.occupation_id is not null
     and c.f_query and c.f_source and c.f_status and c.f_pattern and c.f_process and c.f_risk
     and c.f_level and c.f_curated and c.f_comp and c.f_used and c.f_domain
   group by c.occupation_id, c.occupation_title

  union all
  select 'apqc_level', c.apqc_level, c.apqc_level, count(*)::int
    from cand c
   where c.apqc_level is not null
     and c.f_query and c.f_source and c.f_status and c.f_pattern and c.f_process and c.f_risk
     and c.f_occupation and c.f_curated and c.f_comp and c.f_used and c.f_domain
   group by c.apqc_level

  union all
  select 'curated', c.curated::text, case when c.curated then 'Curadas' else 'Sin curar' end, count(*)::int
    from cand c
   where c.f_query and c.f_source and c.f_status and c.f_pattern and c.f_process and c.f_risk
     and c.f_occupation and c.f_level and c.f_comp and c.f_used and c.f_domain
   group by c.curated

  union all
  select 'has_composition', (c.composition_count > 0)::text,
         case when c.composition_count > 0 then 'Con composición' else 'Sin composición' end, count(*)::int
    from cand c
   where c.f_query and c.f_source and c.f_status and c.f_pattern and c.f_process and c.f_risk
     and c.f_occupation and c.f_level and c.f_curated and c.f_used and c.f_domain
   group by (c.composition_count > 0)

  union all
  select 'used_by_role', (c.role_count > 0)::text,
         case when c.role_count > 0 then 'Usada por un rol' else 'Sin rol' end, count(*)::int
    from cand c
   where c.f_query and c.f_source and c.f_status and c.f_pattern and c.f_process and c.f_risk
     and c.f_occupation and c.f_level and c.f_curated and c.f_comp and c.f_domain
   group by (c.role_count > 0)

  order by 1, 4 desc, 3;
end $function$;

revoke all on function public.catalog_task_facets(text, text, boolean, text, text, text, text[], uuid, text, text, boolean, boolean) from anon;
grant execute on function public.catalog_task_facets(text, text, boolean, text, text, text, text[], uuid, text, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 4 · Ocupaciones (la faceta que parte las 411 de O*NET en grupos manejables)
-- ---------------------------------------------------------------------

create or replace function public.catalog_list_occupations()
returns table (id uuid, source text, source_code text, title text, task_count int)
language plpgsql
stable
security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select o.id, o.source, o.source_code,
           coalesce(o.title_es, o.title_en),   -- title_es está vacío en las 24: sale en inglés
           (select count(*) from catalog.task t where t.occupation_id = o.id)::int
      from catalog.occupation o
     order by coalesce(o.title_es, o.title_en);
end $function$;

revoke all on function public.catalog_list_occupations() from anon;
grant execute on function public.catalog_list_occupations() to authenticated;

-- ---------------------------------------------------------------------
-- 5 · Las composiciones del catálogo, de verdad
-- ---------------------------------------------------------------------

create or replace function public.catalog_list_all_compositions(
  p_query  text default null,
  p_status text default null
)
returns table (
  id          uuid,
  key         text,
  version     integer,
  name        text,
  pattern     text,
  status      text,
  slot_count  int,
  step_count  int,
  task_id     uuid,
  task_code   text,
  statement   text,
  role_names  text
)
language plpgsql
stable
security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select c.id, c.key, c.version, c.name, c.pattern, c.status,
           (select count(*) from catalog.task_composition_slot s where s.composition_id = c.id)::int,
           -- Pasos = posiciones distintas. Un paso puede tener varias opciones por stack.
           (select count(distinct s.position) from catalog.task_composition_slot s where s.composition_id = c.id)::int,
           t.id, t.task_code, t.statement,
           (select string_agg(distinct j.name, ' · ' order by j.name)
              from catalog.job_role_task jrt
              join catalog.job_role j on j.id = jrt.job_role_id
             where jrt.task_id = t.id)
      from catalog.task_composition c
      join catalog.task t on t.id = c.task_id
     where (coalesce(p_query, '') = ''
            or c.name ilike '%' || p_query || '%'
            or c.key ilike '%' || p_query || '%'
            or t.task_code ilike '%' || p_query || '%'
            or t.statement ilike '%' || p_query || '%')
       and (p_status is null or c.status = p_status)
     order by c.status, c.name;
end $function$;

revoke all on function public.catalog_list_all_compositions(text, text) from anon;
grant execute on function public.catalog_list_all_compositions(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Aplicada el 2026-10-17 contra apmhvqlvwjcrwfaixgju y comprobada objeto a objeto en
-- pg_proc / pg_views. Corte real de la vista: 94 tareas curadas, 1.053 sin curar.
--
-- Para revertir: drop de las cuatro funciones y de la vista. `catalog_list_tasks` sigue
-- en pie, así que la base vuelve sola a su estado anterior; el front dejaría de compilar
-- hasta revertir también TaskList, ImportInbox y CompositionList.
-- ---------------------------------------------------------------------

-- =====================================================================
-- SEGUNDA PARTE · Seguir el hilo y saber qué falta
--
-- Aplicada el 2026-10-17 junto con lo anterior. Sale del mismo trabajo de UX: el catálogo
-- es un árbol y solo se podía bajar por él. De un bloque no había forma de llegar a las
-- composiciones que lo montan, de un contrato no se sabía quién lo produce, y no existía
-- ninguna consulta que dijera qué le falta a un rol para estar construido.
-- =====================================================================

-- Dónde se monta un bloque: composición, paso, tarea y roles.
-- OJO: la columna se llama `slot_position`, no `position`: `position` es palabra reservada
-- y Postgres rechaza la definición del RETURNS TABLE.
create or replace function public.catalog_block_usage(p_component_id uuid)
returns table (
  composition_id uuid, composition_name text, composition_status text,
  slot_key text, slot_position integer, component_version integer, version_status text,
  task_id uuid, task_code text, statement text, role_names text
)
language plpgsql stable security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.status, s.slot_key, s.position, v.version, v.status,
           t.id, t.task_code, t.statement,
           (select string_agg(distinct j.name, ' · ')
              from catalog.job_role_task jrt
              join catalog.job_role j on j.id = jrt.job_role_id
             where jrt.task_id = t.id)
      from catalog.task_composition_slot s
      join catalog.component_version v on v.id = s.component_version_id
      join catalog.task_composition c   on c.id = s.composition_id
      join catalog.task t               on t.id = c.task_id
     where v.component_id = p_component_id
     order by c.name, s.position;
end $function$;

revoke all on function public.catalog_block_usage(uuid) from anon;
grant execute on function public.catalog_block_usage(uuid) to authenticated;

-- Quién produce y quién consume un contrato. Un contrato sin productor es una composición
-- que nunca validará, y eso solo se descubría al pulsar «Comprobar».
create or replace function public.catalog_contract_usage(p_key text, p_version integer default null)
returns table (
  relation text, component_id uuid, component_name text, comp_type text,
  version integer, version_status text
)
language plpgsql stable security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select 'produce'::text, c.id, c.name, c.comp_type, v.version, v.status
      from catalog.component_version v
      join catalog.component c on c.id = v.component_id
     where v.output_contract_key = p_key
       and (p_version is null or v.output_contract_version = p_version)
    union all
    select 'consume'::text, c.id, c.name, c.comp_type, v.version, v.status
      from catalog.component_version v
      join catalog.component c on c.id = v.component_id
     where p_key = any (coalesce(v.consumes, '{}'::text[]))
     order by 1, 3, 5;
end $function$;

revoke all on function public.catalog_contract_usage(text, integer) from anon;
grant execute on function public.catalog_contract_usage(text, integer) to authenticated;

-- Buscador global. Antes indexaba dos cosas (clientes y roles) en el navegador y una sola
-- vez: tareas, composiciones, bloques, contratos y sistemas no se podían encontrar desde
-- ningún sitio. Las tareas se limitan a las curadas, el mismo corte que la biblioteca.
create or replace function public.catalog_global_search(p_query text, p_limit integer default 8)
returns table (kind text, label text, detail text, href text)
language plpgsql stable security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
declare
  q text := '%' || coalesce(p_query, '') || '%';
  n int := least(greatest(coalesce(p_limit, 8), 1), 20);
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if coalesce(p_query, '') = '' then return; end if;

  return query (select 'Rol'::text, j.name, j.key || ' · v' || j.version, '/roles/' || j.key
                  from catalog.job_role j
                 where j.name ilike q or j.key ilike q order by j.name limit n);

  return query (select 'Tarea'::text, t.statement, t.task_code || ' · ' || t.source,
                       '/tareas/' || t.id || '/composiciones'
                  from catalog.v_task_enriched t
                 where t.curated and (t.statement ilike q or t.task_code ilike q)
                 order by t.task_code limit n);

  return query (select 'Composicion'::text, c.name, c.key || ' v' || c.version || ' · ' || c.status,
                       '/tareas/' || c.task_id || '/composiciones'
                  from catalog.task_composition c
                 where c.name ilike q or c.key ilike q order by c.name limit n);

  return query (select 'Bloque'::text, b.name, coalesce(b.kind, b.comp_type), '/bloques?b=' || b.id
                  from catalog.component b where b.name ilike q order by b.name limit n);

  return query (select 'Contrato'::text, k.key, 'v' || k.version || ' · ' || k.status,
                       '/bloques?vista=contratos'
                  from catalog.contract k
                 where k.key ilike q or k.description ilike q order by k.key limit n);

  return query (select 'Sistema'::text, s.name, s.system_category, '/sistemas/' || s.id
                  from catalog.system_option s
                 where s.name ilike q or s.system_category ilike q order by s.name limit n);
end $function$;

revoke all on function public.catalog_global_search(text, integer) from anon;
grant execute on function public.catalog_global_search(text, integer) to authenticated;

-- Mata el N+1 del editor de composiciones: pedía una RPC por bloque solo para pintar el
-- desplegable de un paso.
create or replace function public.catalog_list_component_versions_bulk(p_component_ids uuid[])
returns table (
  id uuid, component_id uuid, version integer, status text,
  artifact_ref text, output_contract_key text, output_contract_version integer,
  consumes text[], changelog text
)
language plpgsql stable security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select v.id, v.component_id, v.version, v.status, v.artifact_ref,
           v.output_contract_key, v.output_contract_version, v.consumes, v.changelog
      from catalog.component_version v
     where v.component_id = any (coalesce(p_component_ids, '{}'::uuid[]))
     order by v.component_id, v.version desc;
end $function$;

revoke all on function public.catalog_list_component_versions_bulk(uuid[]) from anon;
grant execute on function public.catalog_list_component_versions_bulk(uuid[]) to authenticated;

-- Qué le falta a cada tarea de un rol para estar montada. Es la lista de pendientes del
-- catálogo, y hasta ahora no existía en ninguna parte: la ficha del rol decía cuántas
-- tareas tenía, no cuántas estaban construidas.
create or replace function public.catalog_role_readiness(p_job_role_id uuid)
returns table (
  task_id uuid, task_code text, statement text,
  process_name text, primary_pattern text, effect_classification text, criticality text,
  composition_count int, step_count int, published_count int, stage text
)
language plpgsql stable security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select t.id, t.task_code, t.statement, t.process_name, t.primary_pattern,
           jrt.effect_classification, jrt.criticality,
           t.composition_count, t.step_count,
           (select count(*) from catalog.task_composition c
             where c.task_id = t.id and c.status = 'published')::int,
           case
             when (select count(*) from catalog.task_composition c
                    where c.task_id = t.id and c.status = 'published') > 0 then 'lista'
             when t.composition_count > 0                                  then 'composicion_borrador'
             when t.primary_pattern is null                                then 'sin_patron'
             when t.process_id is null                                     then 'sin_proceso'
             else 'sin_composicion'
           end
      from catalog.job_role_task jrt
      join catalog.v_task_enriched t on t.id = jrt.task_id
     where jrt.job_role_id = p_job_role_id
     order by t.task_code;
end $function$;

revoke all on function public.catalog_role_readiness(uuid) from anon;
grant execute on function public.catalog_role_readiness(uuid) to authenticated;

-- Los tres números de la tarjeta de cada especialista, sobre su última versión.
create or replace function public.catalog_role_progress()
returns table (role_key text, tasks int, with_composition int, published int)
language plpgsql stable security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    with ultima as (
      select distinct on (j.key) j.key, j.id
        from catalog.job_role j order by j.key, j.version desc
    )
    select u.key,
           (select count(*) from catalog.job_role_task jrt where jrt.job_role_id = u.id)::int,
           (select count(*) from catalog.job_role_task jrt
              where jrt.job_role_id = u.id
                and exists (select 1 from catalog.task_composition c where c.task_id = jrt.task_id))::int,
           (select count(*) from catalog.job_role_task jrt
              where jrt.job_role_id = u.id
                and exists (select 1 from catalog.task_composition c
                             where c.task_id = jrt.task_id and c.status = 'published'))::int
      from ultima u;
end $function$;

revoke all on function public.catalog_role_progress() from anon;
grant execute on function public.catalog_role_progress() to authenticated;

-- ---------------------------------------------------------------------
-- Estado del catálogo el día que se aplicó, medido, no estimado:
--   · 94 tareas curadas · 1.053 sin curar (662 nodos APQC, 391 de O*NET)
--   · 10 composiciones, TODAS en borrador: ningún rol tiene una sola tarea «lista»
--   · data_entry_clerk v3 (55 tareas) y data_entry_clerk_sales v1 (56) no tienen ni una
--     composición; search_marketing y marketing_analyst tienen 4 cada uno, en borrador
-- ---------------------------------------------------------------------
