-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 016 · Crear y duplicar en el catálogo
--
-- Filtros por tipo de tarea (proceso y patrón):
-- - catalog_list_processes: los procesos en su orden.
-- - catalog_list_tasks: + filtros p_process_id / p_pattern y columnas de proceso y patrón.
-- - catalog_list_job_role_tasks: + primary_pattern.
-- - catalog_get_task: + proceso, patrón, riesgo y estado (cabecera de la ficha y asistente).
-- Crear:
-- - catalog_create_task: tarea interna en borrador; opcionalmente enlazada ya a un rol.
-- Duplicar (siempre nace en borrador; lo publicado no se toca):
-- - catalog_duplicate_composition: copia con sus slots, como versión siguiente de la misma clave.
-- - catalog_duplicate_block: bloque nuevo con el mismo tipo, para otra variante de stack.
-- - catalog_duplicate_contract: versión siguiente del mismo contrato, o contrato nuevo con otra clave.
-- Misma regla que el resto del catálogo: is_platform_admin() en servidor.
-- =====================================================================

create or replace function public.catalog_list_processes()
returns table(id text, name text, domain_id text, sequence_ord int)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query select p.id, p.name, p.domain_id, p.sequence_ord from catalog.process p
               order by p.domain_id, p.sequence_ord nulls last, p.name;
end $$;

drop function if exists public.catalog_list_tasks(text, text, boolean, int, int);
create function public.catalog_list_tasks(
  p_query text default null,
  p_domain_id text default null,
  p_only_used boolean default false,
  p_limit int default 50,
  p_offset int default 0,
  p_process_id text default null,
  p_pattern text default null)
returns table(id uuid, task_code text, statement text, process_id text, process_name text, primary_pattern text,
              role_count int, component_count int, composition_count int, total_count bigint)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.task_code, t.statement, t.process_id, p.name, t.primary_pattern,
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
  order by coalesce(p.sequence_ord, 999999), t.task_code
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end $$;

drop function if exists public.catalog_list_job_role_tasks(uuid);
create function public.catalog_list_job_role_tasks(p_job_role_id uuid)
returns table(task_id uuid, task_code text, statement text, effect_classification text, criticality text,
              time_weight_pct numeric, process_id text, process_name text, process_sequence integer,
              primary_pattern text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select jrt.task_id, t.task_code, t.statement, jrt.effect_classification, jrt.criticality,
           jrt.time_weight_pct, p.id, p.name, p.sequence_ord, t.primary_pattern
    from catalog.job_role_task jrt
    join catalog.task t on t.id = jrt.task_id
    left join catalog.process p on p.id = t.process_id
    where jrt.job_role_id = p_job_role_id
    order by coalesce(p.sequence_ord, 999999), t.task_code;
end $$;

drop function if exists public.catalog_get_task(uuid);
create function public.catalog_get_task(p_task_id uuid)
returns table(id uuid, task_code text, statement text, process_id text, process_name text,
              primary_pattern text, risk text, status text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query select t.id, t.task_code, t.statement, t.process_id, p.name, t.primary_pattern, t.risk, t.status
               from catalog.task t left join catalog.process p on p.id = t.process_id
               where t.id = p_task_id;
end $$;

create or replace function public.catalog_create_task(
  p_statement text,
  p_process_id text,
  p_primary_pattern text,
  p_risk text default 'low',
  p_reversible boolean default true,
  p_requires_approval boolean default false,
  p_customer_facing boolean default false,
  p_touches_budget boolean default false,
  p_job_role_id uuid default null)
returns uuid
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare v_id uuid;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if length(trim(coalesce(p_statement, ''))) < 10 then
    raise exception 'Describe la tarea en una frase (mínimo 10 caracteres)' using errcode = '23514';
  end if;
  insert into catalog.task(source, statement, language, process_id, primary_pattern, risk, reversible,
                           requires_approval, customer_facing, touches_budget, status, owner)
  values ('internal', trim(p_statement), 'es', nullif(p_process_id, ''), nullif(p_primary_pattern, ''),
          coalesce(p_risk, 'low'), p_reversible, coalesce(p_requires_approval, false),
          coalesce(p_customer_facing, false), coalesce(p_touches_budget, false), 'draft', 'Vrutal Labs')
  returning id into v_id;
  if p_job_role_id is not null then
    insert into catalog.job_role_task(job_role_id, task_id, effect_classification, criticality)
    values (p_job_role_id, v_id, case when p_reversible then 'reversible' else 'irreversible' end, 'standard');
  end if;
  return v_id;
end $$;

create or replace function public.catalog_duplicate_composition(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare src catalog.task_composition; v_id uuid; v int;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into src from catalog.task_composition where id = p_id;
  if src.id is null then raise exception 'composición inexistente' using errcode = '23503'; end if;
  select coalesce(max(c.version), 0) + 1 into v from catalog.task_composition c
   where c.task_id = src.task_id and c.key = src.key;
  insert into catalog.task_composition(task_id, task_version, key, version, name, pattern, changelog)
  values (src.task_id, (select t.version from catalog.task t where t.id = src.task_id), src.key, v, src.name,
          src.pattern, 'Copia de v' || src.version)
  returning id into v_id;
  insert into catalog.task_composition_slot(composition_id, position, slot_key, kind, optional,
                                            component_version_id, applies_when, is_default)
  select v_id, s.position, s.slot_key, s.kind, s.optional, s.component_version_id, s.applies_when, s.is_default
    from catalog.task_composition_slot s where s.composition_id = p_id;
  return v_id;
end $$;

create or replace function public.catalog_duplicate_block(p_component_id uuid, p_name text, p_variant jsonb default '{}'::jsonb)
returns uuid
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare src catalog.component; v_id uuid;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into src from catalog.component where id = p_component_id;
  if src.id is null then raise exception 'bloque inexistente' using errcode = '23503'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'El bloque nuevo necesita nombre' using errcode = '23514';
  end if;
  insert into catalog.component(name, comp_type, runtime, owner, maturity, target_system, kind, variant)
  values (trim(p_name), src.comp_type, src.runtime, src.owner, 'prototype', src.target_system, src.kind,
          coalesce(p_variant, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- p_new_key null: versión siguiente del mismo contrato. Con clave: contrato nuevo v1.
create or replace function public.catalog_duplicate_contract(p_key text, p_version int, p_new_key text default null)
returns table(key text, version int)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare src catalog.contract; k text; v int;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select * into src from catalog.contract c where c.key = p_key and c.version = p_version;
  if src.key is null then raise exception 'contrato inexistente' using errcode = '23503'; end if;
  k := coalesce(nullif(trim(p_new_key), ''), src.key);
  if k <> src.key and exists (select 1 from catalog.contract c where c.key = k) then
    raise exception 'Ya existe un contrato %: usa otra clave o crea una versión nueva de ese', k using errcode = '23505';
  end if;
  select coalesce(max(c.version), 0) + 1 into v from catalog.contract c where c.key = k;
  insert into catalog.contract(key, version, description, json_schema)
  values (k, v, src.description, src.json_schema);
  return query select k, v;
end $$;

revoke execute on function public.catalog_list_processes() from public, anon;
revoke execute on function public.catalog_list_tasks(text, text, boolean, int, int, text, text) from public, anon;
revoke execute on function public.catalog_list_job_role_tasks(uuid) from public, anon;
revoke execute on function public.catalog_get_task(uuid) from public, anon;
revoke execute on function public.catalog_create_task(text, text, text, text, boolean, boolean, boolean, boolean, uuid) from public, anon;
revoke execute on function public.catalog_duplicate_composition(uuid) from public, anon;
revoke execute on function public.catalog_duplicate_block(uuid, text, jsonb) from public, anon;
revoke execute on function public.catalog_duplicate_contract(text, int, text) from public, anon;
grant execute on function public.catalog_list_processes() to authenticated;
grant execute on function public.catalog_list_tasks(text, text, boolean, int, int, text, text) to authenticated;
grant execute on function public.catalog_list_job_role_tasks(uuid) to authenticated;
grant execute on function public.catalog_get_task(uuid) to authenticated;
grant execute on function public.catalog_create_task(text, text, text, text, boolean, boolean, boolean, boolean, uuid) to authenticated;
grant execute on function public.catalog_duplicate_composition(uuid) to authenticated;
grant execute on function public.catalog_duplicate_block(uuid, text, jsonb) to authenticated;
grant execute on function public.catalog_duplicate_contract(text, int, text) to authenticated;
