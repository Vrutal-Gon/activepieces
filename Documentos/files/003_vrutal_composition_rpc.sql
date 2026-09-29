-- =====================================================================
-- VRUTAL 1st · Migración 003 · RPC del modelo de composición (002)
--
-- Convenciones heredadas de las catalog_* existentes:
--   SECURITY DEFINER, search_path fijo, comprobación de rol dentro:
--   is_platform_admin() para leer/escribir, is_superadmin() para borrar.
-- Diferencia deliberada: EXECUTE se revoca a PUBLIC y anon (las catalog_*
-- anteriores no tienen ACL y quedan ejecutables por anon).
-- =====================================================================

-- Contratos ------------------------------------------------------------
create or replace function public.catalog_list_contracts()
returns table(key text, version int, description text, json_schema jsonb, status text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query select c.key, c.version, c.description, c.json_schema, c.status
                 from catalog.contract c order by c.key, c.version;
end $$;

create or replace function public.catalog_create_contract(p_key text, p_description text, p_json_schema jsonb default '{}'::jsonb)
returns int language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare v int;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select coalesce(max(c.version), 0) + 1 into v from catalog.contract c where c.key = p_key;
  insert into catalog.contract(key, version, description, json_schema) values (p_key, v, p_description, coalesce(p_json_schema, '{}'::jsonb));
  return v;
end $$;

create or replace function public.catalog_update_contract(p_key text, p_version int, p_description text, p_json_schema jsonb)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update catalog.contract set description = p_description, json_schema = coalesce(p_json_schema, '{}'::jsonb)
   where key = p_key and version = p_version;
end $$;

create or replace function public.catalog_set_contract_status(p_key text, p_version int, p_status text)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update catalog.contract set status = p_status where key = p_key and version = p_version;
end $$;

-- Bloques y sus versiones ------------------------------------------------
create or replace function public.catalog_list_blocks()
returns table(component_id uuid, name text, comp_type text, maturity text, kind text, variant jsonb, version_count bigint, latest_version int)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query
    select c.id, c.name, c.comp_type, c.maturity, c.kind, c.variant,
           (select count(*) from catalog.component_version v where v.component_id = c.id),
           (select max(v.version) from catalog.component_version v where v.component_id = c.id)
      from catalog.component c order by c.kind nulls last, c.name;
end $$;

create or replace function public.catalog_set_component_block(p_id uuid, p_kind text, p_variant jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update catalog.component set kind = nullif(p_kind, ''), variant = coalesce(p_variant, '{}'::jsonb) where id = p_id;
end $$;

create or replace function public.catalog_list_component_versions(p_component_id uuid)
returns table(id uuid, version int, status text, artifact_ref text, output_contract_key text, output_contract_version int,
              consumes text[], changelog text, created_at timestamptz)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query select v.id, v.version, v.status, v.artifact_ref, v.output_contract_key, v.output_contract_version,
                      v.consumes, v.changelog, v.created_at
                 from catalog.component_version v where v.component_id = p_component_id order by v.version desc;
end $$;

create or replace function public.catalog_create_component_version(
  p_component_id uuid, p_changelog text, p_artifact_ref text default null,
  p_output_contract_key text default null, p_output_contract_version int default null, p_consumes text[] default '{}')
returns uuid language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare v_id uuid; v int;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select coalesce(max(x.version), 0) + 1 into v from catalog.component_version x where x.component_id = p_component_id;
  insert into catalog.component_version(component_id, version, changelog, artifact_ref, output_contract_key, output_contract_version, consumes)
  values (p_component_id, v, p_changelog, nullif(p_artifact_ref, ''), nullif(p_output_contract_key, ''),
          case when nullif(p_output_contract_key, '') is null then null else p_output_contract_version end,
          coalesce(p_consumes, '{}'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.catalog_update_component_version(
  p_id uuid, p_changelog text, p_artifact_ref text, p_output_contract_key text, p_output_contract_version int, p_consumes text[])
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update catalog.component_version
     set changelog = p_changelog, artifact_ref = nullif(p_artifact_ref, ''),
         output_contract_key = nullif(p_output_contract_key, ''),
         output_contract_version = case when nullif(p_output_contract_key, '') is null then null else p_output_contract_version end,
         consumes = coalesce(p_consumes, '{}')
   where id = p_id;
end $$;

create or replace function public.catalog_set_component_version_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update catalog.component_version set status = p_status where id = p_id;
end $$;

create or replace function public.catalog_delete_component_version(p_id uuid)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_superadmin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  delete from catalog.component_version where id = p_id;
end $$;

-- Composiciones ----------------------------------------------------------
create or replace function public.catalog_list_compositions(p_task_id uuid)
returns table(id uuid, key text, version int, name text, pattern text, status text, task_version int, changelog text, slot_count bigint)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query select c.id, c.key, c.version, c.name, c.pattern, c.status, c.task_version, c.changelog,
                      (select count(*) from catalog.task_composition_slot s where s.composition_id = c.id)
                 from catalog.task_composition c where c.task_id = p_task_id order by c.key, c.version desc;
end $$;

create or replace function public.catalog_create_composition(p_task_id uuid, p_key text, p_name text, p_pattern text, p_changelog text)
returns uuid language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare v_id uuid; v int; tv int;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select t.version into tv from catalog.task t where t.id = p_task_id;
  if tv is null then raise exception 'tarea inexistente' using errcode = '23503'; end if;
  select coalesce(max(c.version), 0) + 1 into v from catalog.task_composition c where c.task_id = p_task_id and c.key = p_key;
  insert into catalog.task_composition(task_id, task_version, key, version, name, pattern, changelog)
  values (p_task_id, tv, p_key, v, p_name, p_pattern, p_changelog) returning id into v_id;
  return v_id;
end $$;

create or replace function public.catalog_check_composition(p_id uuid)
returns table(severity text, slot_key text, message text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;

  if not exists (select 1 from catalog.task_composition_slot s where s.composition_id = p_id) then
    return query select 'error'::text, null::text, 'La composición no tiene slots'::text;
    return;
  end if;

  return query
    select 'error'::text, s.slot_key, 'Las opciones de este slot tienen distinta posición o tipo'::text
      from catalog.task_composition_slot s where s.composition_id = p_id
     group by s.slot_key having count(distinct s.position) > 1 or count(distinct s.kind) > 1;

  return query
    select (case when v.status = 'deprecated' then 'error' else 'warning' end)::text, s.slot_key,
           ('El bloque ' || c.name || ' v' || v.version || ' está en estado ' || v.status)::text
      from catalog.task_composition_slot s
      join catalog.component_version v on v.id = s.component_version_id
      join catalog.component c on c.id = v.component_id
     where s.composition_id = p_id and v.status <> 'validated';

  return query
    select 'error'::text, s.slot_key,
           ('El bloque ' || c.name || ' consume ' || k || ' y ningún slot anterior lo produce')::text
      from catalog.task_composition_slot s
      join catalog.component_version v on v.id = s.component_version_id
      join catalog.component c on c.id = v.component_id
     cross join lateral unnest(v.consumes) as k
     where s.composition_id = p_id
       and not exists (
         select 1 from catalog.task_composition_slot s2
           join catalog.component_version v2 on v2.id = s2.component_version_id
          where s2.composition_id = p_id and s2.position < s.position and v2.output_contract_key = k);

  return query
    select 'warning'::text, s.slot_key, 'Varias opciones sin condición de aplicación: no se sabrá cuál elegir'::text
      from catalog.task_composition_slot s
     where s.composition_id = p_id and s.applies_when = '{}'::jsonb
     group by s.slot_key having count(*) > 1;
end $$;

create or replace function public.catalog_set_composition_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_status = 'validated' then
    if exists (select 1 from public.catalog_check_composition(p_id) r where r.severity = 'error') then
      raise exception 'La composición tiene errores: revisa la comprobación antes de publicar' using errcode = '23514';
    end if;
    if exists (select 1 from catalog.task_composition_slot s join catalog.component_version v on v.id = s.component_version_id
                where s.composition_id = p_id and v.status <> 'validated') then
      raise exception 'Todos los bloques deben estar validated para publicar la composición' using errcode = '23514';
    end if;
  end if;
  update catalog.task_composition set status = p_status where id = p_id;
end $$;

create or replace function public.catalog_delete_composition(p_id uuid)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_superadmin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  delete from catalog.task_composition where id = p_id;
end $$;

-- Slots --------------------------------------------------------------------
create or replace function public.catalog_list_composition_slots(p_composition_id uuid)
returns table(id uuid, "position" int, slot_key text, kind text, optional boolean, is_default boolean, applies_when jsonb,
              component_version_id uuid, component_id uuid, component_name text, variant jsonb,
              version int, version_status text, output_contract text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query
    select s.id, s.position, s.slot_key, s.kind, s.optional, s.is_default, s.applies_when,
           v.id, c.id, c.name, c.variant, v.version, v.status,
           case when v.output_contract_key is null then null else v.output_contract_key || '@' || v.output_contract_version end
      from catalog.task_composition_slot s
      join catalog.component_version v on v.id = s.component_version_id
      join catalog.component c on c.id = v.component_id
     where s.composition_id = p_composition_id order by s.position, s.slot_key, c.name;
end $$;

create or replace function public.catalog_add_composition_slot(
  p_composition_id uuid, p_position int, p_slot_key text, p_kind text, p_component_version_id uuid,
  p_optional boolean default false, p_applies_when jsonb default '{}'::jsonb, p_is_default boolean default false)
returns uuid language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare v_id uuid;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  insert into catalog.task_composition_slot(composition_id, position, slot_key, kind, component_version_id, optional, applies_when, is_default)
  values (p_composition_id, p_position, p_slot_key, p_kind, p_component_version_id, p_optional, coalesce(p_applies_when, '{}'::jsonb), p_is_default)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.catalog_remove_composition_slot(p_slot_id uuid)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  delete from catalog.task_composition_slot where id = p_slot_id;
end $$;

-- Permisos de ejecución: solo usuarios autenticados (la comprobación de rol va dentro) ------------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in (
       'catalog_list_contracts','catalog_create_contract','catalog_update_contract','catalog_set_contract_status',
       'catalog_list_blocks','catalog_set_component_block','catalog_list_component_versions',
       'catalog_create_component_version','catalog_update_component_version','catalog_set_component_version_status',
       'catalog_delete_component_version','catalog_list_compositions','catalog_create_composition',
       'catalog_check_composition','catalog_set_composition_status','catalog_delete_composition',
       'catalog_list_composition_slots','catalog_add_composition_slot','catalog_remove_composition_slot')
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;
