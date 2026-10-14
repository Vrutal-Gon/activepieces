-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 021 · URL de instancia local
-- Las instancias en local (*.localhost, LAB08 Anexo B) van por http. El resto, solo https.
-- =====================================================================

create or replace function public.staff_upsert_tenant_instance(
  p_tenant_id uuid, p_host text, p_public_url text, p_template_version text,
  p_ap_version text, p_app_version text, p_notes text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) or not has_permission('tenants.write', p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  -- https siempre, salvo instancias en local (*.localhost), que van por http.
  if nullif(trim(p_public_url), '') is not null
     and p_public_url !~ '^https://'
     and p_public_url !~ '^http://([a-z0-9-]+\.)*localhost(:[0-9]+)?(/|$)' then
    raise exception 'La URL del cliente debe empezar por https:// (http solo para *.localhost)' using errcode = '23514';
  end if;
  insert into public.tenant_instance(tenant_id, host, public_url, template_version, ap_version, app_version,
                                     notes, updated_at, updated_by)
  values (p_tenant_id, nullif(trim(p_host), ''), nullif(trim(p_public_url), ''), nullif(trim(p_template_version), ''),
          nullif(trim(p_ap_version), ''), nullif(trim(p_app_version), ''), nullif(trim(p_notes), ''), now(), auth.uid())
  on conflict (tenant_id) do update set
    host = excluded.host, public_url = excluded.public_url, template_version = excluded.template_version,
    ap_version = excluded.ap_version, app_version = excluded.app_version, notes = excluded.notes,
    updated_at = now(), updated_by = auth.uid();
end $$;
