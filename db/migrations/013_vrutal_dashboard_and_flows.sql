-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 013 · Dashboard de flota y flujos por cliente
--
-- - staff_dashboard_overview(p_only_mine): una fila por cliente con lo que el
--   plano de control ya sabe (especialistas, flujos, versiones atrasadas).
--   Misma regla de cartera que staff_list_tenants: ops solo ve lo suyo.
--   Lo que depende del latido de los VPS (errores, VPS caído, tickets, coste)
--   NO sale de aquí: llegará cuando exista el latido.
-- - staff_list_tenant_flows(p_tenant_id): flujos (tareas) de cada especialista
--   del cliente con su autonomía y estado.
-- - staff_get_tenant: + nombre y región del proyecto Supabase (pestaña Infraestructura).
-- =====================================================================

create or replace function public.staff_dashboard_overview(p_only_mine boolean default false)
returns table(tenant_id uuid, name text, status text, is_internal boolean, data_plane_status text,
              account_manager_profile_id uuid, account_manager_name text,
              specialists_active int, specialists_paused int, specialists_behind int, flows_enabled int)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
declare
  v_sees_all boolean := has_platform_role(array['platform_superadmin', 'platform_admin']);
begin
  if not v_sees_all and not has_platform_role(array['platform_ops']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.name, t.status::text, t.is_internal, t.data_plane_status,
         t.account_manager_profile_id,
         coalesce(m.full_name, mu.email::text),
         (select count(*) from public.tenant_specialist s
           where s.tenant_id = t.id and s.status::text = 'contracted')::int,
         (select count(*) from public.tenant_specialist s
           where s.tenant_id = t.id and s.status::text = 'paused')::int,
         (select count(*) from public.tenant_specialist s
           where s.tenant_id = t.id and s.status::text = 'contracted'
             and s.job_role_version < (select max(j.version) from catalog.job_role j
                                        where j.key = s.job_role_key and j.status::text = 'active'))::int,
         (select count(*) from public.tenant_specialist_flow f
           join public.tenant_specialist s on s.id = f.tenant_specialist_id
           where s.tenant_id = t.id and s.status::text = 'contracted' and f.status::text = 'enabled')::int
  from public.tenants t
  left join public.profiles m on m.id = t.account_manager_profile_id
  left join auth.users mu on mu.id = t.account_manager_profile_id
  where t.deleted_at is null
    and (v_sees_all and not coalesce(p_only_mine, false) or t.account_manager_profile_id = auth.uid())
  order by t.name;
end $$;

create or replace function public.staff_list_tenant_flows(p_tenant_id uuid)
returns table(specialist_id uuid, job_role_key text, task_code text, statement text, task_version int,
              autonomy_level text, status text)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select s.id, s.job_role_key, t.task_code, t.statement, t.version::int,
         f.autonomy_level::text, f.status::text
  from public.tenant_specialist_flow f
  join public.tenant_specialist s on s.id = f.tenant_specialist_id
  join catalog.task t on t.id = f.task_id
  where s.tenant_id = p_tenant_id
  order by s.job_role_key, t.task_code;
end $$;

drop function if exists public.staff_get_tenant(uuid);
create function public.staff_get_tenant(p_tenant_id uuid)
returns table(id uuid, name text, legal_name text, tax_id text, status text, industry text, size_employees int,
              email text, phone text, website text, address_line text, city text, postal_code text,
              region text, country text, is_internal boolean, data_plane_status text,
              holded_contact_id text, supabase_project_ref text, supabase_project_name text,
              supabase_project_region text, account_manager_profile_id uuid,
              created_at timestamptz, can_edit boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select t.id, t.name, t.legal_name, t.tax_id, t.status::text, t.industry, t.size_employees,
         t.email, t.phone, t.website, t.address_line, t.city, t.postal_code,
         t.region, t.country, t.is_internal, t.data_plane_status,
         t.holded_contact_id, t.supabase_project_ref, t.supabase_project_name,
         t.supabase_project_region, t.account_manager_profile_id,
         t.created_at, has_permission('tenants.write', t.id)
  from public.tenants t
  where t.id = p_tenant_id and t.deleted_at is null;
end $$;

revoke execute on function public.staff_dashboard_overview(boolean) from public, anon;
revoke execute on function public.staff_list_tenant_flows(uuid) from public, anon;
revoke execute on function public.staff_get_tenant(uuid) from public, anon;
grant execute on function public.staff_dashboard_overview(boolean) to authenticated;
grant execute on function public.staff_list_tenant_flows(uuid) to authenticated;
grant execute on function public.staff_get_tenant(uuid) to authenticated;

-- Refresca la caché de PostgREST para que la API vea las funciones nuevas al momento.
notify pgrst, 'reload schema';
