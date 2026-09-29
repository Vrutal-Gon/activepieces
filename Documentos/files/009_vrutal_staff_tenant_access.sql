-- =====================================================================
-- VRUTAL 1st · Migración 009 · Acceso a clientes por cartera (endurecimiento)
--
-- Regla única de acceso de staff a un cliente, escrita en un solo sitio:
--   - platform_superadmin / platform_admin: cualquier cliente.
--   - platform_ops: solo los clientes donde es gestor de cuenta.
--   - cualquier otro: ninguno.
-- El panel deja de leer tablas con from(): la ficha de cliente pasa a RPC que
-- aplican esa regla. (Un filtro .eq('tenant_id') en el navegador no protege nada.)
--
-- Además: el catálogo de permisos deja de ser legible sin sesión.
-- =====================================================================

create or replace function public.staff_can_access_tenant(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when has_platform_role(array['platform_superadmin', 'platform_admin']) then true
    when has_platform_role(array['platform_ops']) then exists (
      select 1 from public.tenants t
      where t.id = p_tenant_id and t.deleted_at is null and t.account_manager_profile_id = auth.uid())
    else false
  end;
$$;

create or replace function public.staff_get_tenant(p_tenant_id uuid)
returns table(id uuid, name text, legal_name text, status text, industry text, size_employees int,
              email text, phone text, website text, country text, region text, is_internal boolean,
              data_plane_status text, account_manager_profile_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.name, t.legal_name, t.status::text, t.industry, t.size_employees,
         t.email, t.phone, t.website, t.country, t.region, t.is_internal,
         t.data_plane_status, t.account_manager_profile_id
  from public.tenants t
  where t.id = p_tenant_id and t.deleted_at is null;
end $$;

create or replace function public.staff_list_tenant_specialists(p_tenant_id uuid)
returns table(id uuid, job_role_key text, job_role_version int, status text, contracted_at timestamptz, notes text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select s.id, s.job_role_key, s.job_role_version, s.status::text, s.contracted_at, s.notes
  from public.tenant_specialist s
  where s.tenant_id = p_tenant_id
  order by s.contracted_at desc;
end $$;

-- staff_list_tenants (008) pasa a usar la misma regla, para que no haya dos versiones de ella.
create or replace function public.staff_list_tenants(p_only_mine boolean default false)
returns table(id uuid, name text, legal_name text, status text, industry text, is_internal boolean,
              data_plane_status text, account_manager_profile_id uuid, account_manager_name text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_sees_all boolean := has_platform_role(array['platform_superadmin', 'platform_admin']);
begin
  if not v_sees_all and not has_platform_role(array['platform_ops']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.name, t.legal_name, t.status::text, t.industry, t.is_internal, t.data_plane_status,
         t.account_manager_profile_id,
         coalesce(m.full_name, mu.email::text)
  from public.tenants t
  left join public.profiles m on m.id = t.account_manager_profile_id
  left join auth.users mu on mu.id = t.account_manager_profile_id
  where t.deleted_at is null
    and (v_sees_all and not coalesce(p_only_mine, false) or t.account_manager_profile_id = auth.uid())
  order by t.name;
end $$;

-- staff_can_access_tenant solo se usa dentro de otras funciones security definer: nadie la llama directamente.
revoke execute on function public.staff_can_access_tenant(uuid) from public, anon, authenticated;
revoke execute on function public.staff_get_tenant(uuid) from public, anon;
revoke execute on function public.staff_list_tenant_specialists(uuid) from public, anon;
grant execute on function public.staff_get_tenant(uuid) to authenticated;
grant execute on function public.staff_list_tenant_specialists(uuid) to authenticated;

-- Catálogo de permisos: solo con sesión (antes la política era USING (true) para cualquiera).
alter policy perms_select on public.permissions to authenticated;
alter policy rp_select on public.role_permissions to authenticated;
revoke select on public.permissions from anon;
revoke select on public.role_permissions from anon;
