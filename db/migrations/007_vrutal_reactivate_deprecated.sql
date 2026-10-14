-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 007 · Reactivar lo deprecado (solo superadmin)
--
-- "Deprecado" = no usar en composiciones nuevas. El contenido sigue inmutable,
-- así que reactivarlo (deprecated -> validated) no pierde nada. Antes el panel no
-- ofrecía esa vía y un clic accidental parecía irreversible.
-- Regla: cualquier salida de 'deprecated' exige is_superadmin(). Volver a draft
-- sigue prohibido (trigger guard_published_immutable).
-- =====================================================================

create or replace function public.catalog_set_contract_status(p_key text, p_version int, p_status text)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare cur text;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select status into cur from catalog.contract where key = p_key and version = p_version;
  if cur = 'deprecated' and p_status <> 'deprecated' and not is_superadmin() then
    raise exception 'Solo un superadmin puede reactivar lo deprecado' using errcode = '42501';
  end if;
  update catalog.contract set status = p_status where key = p_key and version = p_version;
end $$;

create or replace function public.catalog_set_component_version_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare cur text;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select status into cur from catalog.component_version where id = p_id;
  if cur = 'deprecated' and p_status <> 'deprecated' and not is_superadmin() then
    raise exception 'Solo un superadmin puede reactivar lo deprecado' using errcode = '42501';
  end if;
  if p_status = 'validated' and exists (select 1 from catalog.component_version v where v.id = p_id and v.artifact_ref is null) then
    raise exception 'Una versión sin artefacto no se puede publicar: indica su referencia' using errcode = '23514';
  end if;
  update catalog.component_version set status = p_status where id = p_id;
end $$;

create or replace function public.catalog_set_composition_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare cur text;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select status into cur from catalog.task_composition where id = p_id;
  if cur = 'deprecated' and p_status <> 'deprecated' and not is_superadmin() then
    raise exception 'Solo un superadmin puede reactivar lo deprecado' using errcode = '42501';
  end if;
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
