-- =====================================================================
-- VRUTAL 1st · Migración 004
-- Crear un bloque en un solo paso y poder borrar contratos en draft.
-- Motivo: en el panel un bloque solo se podía crear en Componentes y luego
-- tipar en Bloques; un contrato mal creado no se podía deshacer.
-- Mismas convenciones que 003 (SECURITY DEFINER, rol dentro, sin EXECUTE a anon).
-- =====================================================================

create or replace function public.catalog_create_block(
  p_name text, p_kind text, p_variant jsonb default '{}'::jsonb,
  p_owner text default 'Vrutal Labs', p_comp_type text default 'activepieces_flow')
returns uuid language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare v_id uuid;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if nullif(p_kind, '') is null then raise exception 'Un bloque necesita un tipo' using errcode = '23514'; end if;
  insert into catalog.component(name, comp_type, owner, kind, variant)
  values (p_name, p_comp_type, p_owner, p_kind, coalesce(p_variant, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- Solo contratos en draft y que ninguna versión de bloque use (lo publicado no se borra: se depreca).
create or replace function public.catalog_delete_contract(p_key text, p_version int)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_superadmin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  delete from catalog.contract where key = p_key and version = p_version;
end $$;

revoke all on function public.catalog_create_block(text, text, jsonb, text, text) from public, anon;
revoke all on function public.catalog_delete_contract(text, int) from public, anon;
grant execute on function public.catalog_create_block(text, text, jsonb, text, text) to authenticated, service_role;
grant execute on function public.catalog_delete_contract(text, int) to authenticated, service_role;
