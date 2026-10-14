-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 024 · Contratar un especialista para un cliente
--
-- Hueco real encontrado al montar Marketing para Vrutal-lab (2026-10-10): no existía ningún
-- camino, ni RPC ni pantalla, para dar de alta un `tenant_specialist` nuevo — la pestaña
-- Especialistas de la ficha de cliente era de solo lectura (`SpecialistsTab.tsx`). Esta
-- migración no crea tablas (`tenant_specialist` ya existe, en uso desde antes de esta sesión);
-- solo añade el único camino de escritura, con el mismo guardián que `staff_upsert_tenant_instance`
-- (019) y `staff_reply_ticket` (023): staff_can_access_tenant + has_permission('tenants.write', ...).
-- =====================================================================

create or replace function public.staff_contract_specialist(p_tenant_id uuid, p_job_role_key text)
returns uuid
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare
  v_version int;
  v_id uuid;
begin
  if not staff_can_access_tenant(p_tenant_id) or not has_permission('tenants.write', p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select version into v_version from catalog.job_role where key = p_job_role_key order by version desc limit 1;
  if v_version is null then
    raise exception 'No existe el rol de catálogo «%»', p_job_role_key using errcode = '23514';
  end if;

  if exists (
    select 1 from public.tenant_specialist
     where tenant_id = p_tenant_id and job_role_key = p_job_role_key and status = 'contracted') then
    raise exception 'Este cliente ya tiene «%» contratado', p_job_role_key using errcode = '23505';
  end if;

  insert into public.tenant_specialist (tenant_id, job_role_key, job_role_version, status, contracted_at)
  values (p_tenant_id, p_job_role_key, v_version, 'contracted', now())
  returning id into v_id;

  return v_id;
end $$;

revoke execute on function public.staff_contract_specialist(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_contract_specialist(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.staff_contract_specialist(uuid, text);
-- ---------------------------------------------------------------------
