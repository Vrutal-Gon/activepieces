-- =====================================================================
-- VRUTAL 1st · Migración 012 · Ficha de cliente (Fase 2)
--
-- Todas aplican staff_can_access_tenant (superadmin/admin: todo; ops: su cartera).
-- - staff_get_tenant: + datos fiscales/dirección, alta, referencias y can_edit.
-- - staff_update_tenant: edita datos de ficha. Exige además el permiso
--   'tenants.write' (hoy: superadmin y ops; admin no lo tiene → decisión pendiente).
-- - staff_list_tenant_specialists: + nombre del rol, última versión activa del
--   catálogo (para ver si va atrasado) y flujos encendidos/total.
-- - staff_list_tenant_reporting: reportes y KPIs disponibles para los roles
--   contratados, con su estado en el cliente (enabled/disabled/null = no activado).
--
-- Cambia el tipo de retorno de dos funciones de la 009: por eso drop + create.
-- =====================================================================

drop function if exists public.staff_get_tenant(uuid);
create function public.staff_get_tenant(p_tenant_id uuid)
returns table(id uuid, name text, legal_name text, tax_id text, status text, industry text, size_employees int,
              email text, phone text, website text, address_line text, city text, postal_code text,
              region text, country text, is_internal boolean, data_plane_status text,
              holded_contact_id text, supabase_project_ref text, account_manager_profile_id uuid,
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
         t.holded_contact_id, t.supabase_project_ref, t.account_manager_profile_id,
         t.created_at, has_permission('tenants.write', t.id)
  from public.tenants t
  where t.id = p_tenant_id and t.deleted_at is null;
end $$;

create or replace function public.staff_update_tenant(
  p_tenant_id uuid, p_name text, p_legal_name text, p_tax_id text, p_industry text, p_size_employees int,
  p_email text, p_phone text, p_website text, p_address_line text, p_city text, p_postal_code text,
  p_region text, p_country text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_website text := nullif(trim(p_website), '');
  v_email text := nullif(trim(p_email), '');
begin
  if not staff_can_access_tenant(p_tenant_id) or not has_permission('tenants.write', p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'El nombre es obligatorio' using errcode = '23514';
  end if;
  if p_size_employees is not null and p_size_employees < 0 then
    raise exception 'El tamaño no puede ser negativo' using errcode = '23514';
  end if;
  if v_website is not null and v_website !~* '^https?://[^\s]+$' then
    raise exception 'La web debe empezar por http:// o https://' using errcode = '23514';
  end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Email no válido' using errcode = '23514';
  end if;
  update public.tenants set
    name = trim(p_name),
    legal_name = nullif(trim(p_legal_name), ''),
    tax_id = nullif(trim(p_tax_id), ''),
    industry = nullif(trim(p_industry), ''),
    size_employees = p_size_employees,
    email = v_email,
    phone = nullif(trim(p_phone), ''),
    website = v_website,
    address_line = nullif(trim(p_address_line), ''),
    city = nullif(trim(p_city), ''),
    postal_code = nullif(trim(p_postal_code), ''),
    region = nullif(trim(p_region), ''),
    country = nullif(upper(trim(p_country)), '')
  where id = p_tenant_id and deleted_at is null;
  if not found then
    raise exception 'Cliente no encontrado' using errcode = 'P0002';
  end if;
end $$;

drop function if exists public.staff_list_tenant_specialists(uuid);
create function public.staff_list_tenant_specialists(p_tenant_id uuid)
returns table(id uuid, job_role_key text, job_role_name text, job_role_version int, latest_active_version int,
              status text, contracted_at timestamptz, notes text, flows_enabled int, flows_total int)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select s.id, s.job_role_key,
         (select j.name from catalog.job_role j where j.key = s.job_role_key and j.version = s.job_role_version),
         s.job_role_version,
         (select max(j.version) from catalog.job_role j where j.key = s.job_role_key and j.status::text = 'active'),
         s.status::text, s.contracted_at, s.notes,
         (select count(*) from public.tenant_specialist_flow f
           where f.tenant_specialist_id = s.id and f.status::text = 'enabled')::int,
         (select count(*) from public.tenant_specialist_flow f where f.tenant_specialist_id = s.id)::int
  from public.tenant_specialist s
  where s.tenant_id = p_tenant_id
  order by s.contracted_at desc;
end $$;

create or replace function public.staff_list_tenant_reporting(p_tenant_id uuid)
returns table(kind text, job_role_key text, report_key text, item_key text, name text, description text, status text)
language plpgsql stable security definer set search_path = public, catalog, pg_temp as $$
#variable_conflict use_column
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  with contracted as (
    select ts.id as specialist_id, ts.job_role_key as role_key
    from public.tenant_specialist ts
    where ts.tenant_id = p_tenant_id and ts.status::text = 'contracted'
  )
  select 'report'::text, rd.job_role_key, rd.key, rd.key, rd.name, rd.description,
         (select tre.status::text from public.tenant_report_enablement tre
           join contracted c2 on c2.specialist_id = tre.tenant_specialist_id
           where tre.job_role_key = rd.job_role_key and tre.report_key = rd.key
           limit 1)
  from catalog.report_definition rd
  where rd.job_role_key in (select c.role_key from contracted c)
  union all
  select 'kpi'::text, kd.job_role_key, kd.report_key, kd.key, kd.name, kd.explanation,
         (select tke.status::text from public.tenant_kpi_enablement tke
           join contracted c2 on c2.specialist_id = tke.tenant_specialist_id
           where tke.job_role_key = kd.job_role_key and tke.kpi_key = kd.key
           limit 1)
  from catalog.kpi_definition kd
  where kd.job_role_key in (select c.role_key from contracted c)
  order by 2, 3, 1 desc, 4;
end $$;

revoke execute on function public.staff_get_tenant(uuid) from public, anon;
revoke execute on function public.staff_update_tenant(uuid, text, text, text, text, int, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.staff_list_tenant_specialists(uuid) from public, anon;
revoke execute on function public.staff_list_tenant_reporting(uuid) from public, anon;
grant execute on function public.staff_get_tenant(uuid) to authenticated;
grant execute on function public.staff_update_tenant(uuid, text, text, text, text, int, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.staff_list_tenant_specialists(uuid) to authenticated;
grant execute on function public.staff_list_tenant_reporting(uuid) to authenticated;
