-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 008 · Panel de staff: quién soy, equipo y cartera
--
-- - staff_whoami(): identidad, roles y permisos de plataforma de quien llama.
--   El panel la usa para pintar la UI; NO es frontera: cada RPC comprueba lo suyo.
-- - staff_list(): miembros del equipo Vrutal (roles de scope 'platform'). Lee el
--   email de auth.users, por eso es security definer y solo para superadmin/admin.
-- - staff_list_tenants(p_only_mine): clientes con su gestor de cuenta.
--   Superadmin/admin eligen "todos" o "mi cartera"; platform_ops SIEMPRE recibe
--   solo su cartera, lo pida o no (el filtro lo impone el servidor, no el panel).
-- - staff_set_tenant_account_manager(): asigna/quita el gestor de un cliente.
--
-- Se usa has_platform_role() con claves explícitas (no is_platform_admin()) para
-- que quede escrito aquí mismo qué rol puede qué.
-- =====================================================================

create or replace function public.staff_whoami()
returns table(profile_id uuid, email text, full_name text, role_keys text[], role_names text[], permission_keys text[])
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id,
         u.email::text,
         p.full_name,
         array(select r.key from public.user_roles ur join public.roles r on r.id = ur.role_id
               where ur.profile_id = p.id and r.scope = 'platform' order by r.key),
         array(select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id
               where ur.profile_id = p.id and r.scope = 'platform' order by r.key),
         array(select distinct pm.key
               from public.user_roles ur
               join public.roles r on r.id = ur.role_id
               join public.role_permissions rp on rp.role_id = r.id
               join public.permissions pm on pm.id = rp.permission_id
               where ur.profile_id = p.id and r.scope = 'platform'
               order by pm.key)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid() and p.deleted_at is null;
$$;

create or replace function public.staff_list()
returns table(profile_id uuid, email text, full_name text, status text, role_keys text[], created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not has_platform_role(array['platform_superadmin', 'platform_admin']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select p.id,
         u.email::text,
         p.full_name,
         p.status::text,
         array(select r.key from public.user_roles ur join public.roles r on r.id = ur.role_id
               where ur.profile_id = p.id and r.scope = 'platform' order by r.key),
         p.created_at,
         u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.deleted_at is null
    and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                where ur.profile_id = p.id and r.scope = 'platform')
  order by p.full_name nulls last, u.email;
end $$;

create or replace function public.staff_list_tenants(p_only_mine boolean default false)
returns table(id uuid, name text, legal_name text, status text, industry text, is_internal boolean,
              data_plane_status text, account_manager_profile_id uuid, account_manager_name text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_only_mine boolean := coalesce(p_only_mine, false);
begin
  if has_platform_role(array['platform_superadmin', 'platform_admin']) then
    null; -- ven todo; filtran si quieren
  elsif has_platform_role(array['platform_ops']) then
    v_only_mine := true; -- ops: solo su cartera, siempre
  else
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
    and (not v_only_mine or t.account_manager_profile_id = auth.uid())
  order by t.name;
end $$;

create or replace function public.staff_set_tenant_account_manager(p_tenant_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not has_platform_role(array['platform_superadmin', 'platform_admin']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_profile_id is not null and not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.profile_id = p_profile_id and r.scope = 'platform'
  ) then
    raise exception 'El gestor debe ser miembro del equipo Vrutal' using errcode = '23514';
  end if;
  update public.tenants set account_manager_profile_id = p_profile_id
  where id = p_tenant_id and deleted_at is null;
  if not found then
    raise exception 'Cliente no encontrado' using errcode = 'P0002';
  end if;
end $$;

-- Solo usuarios con sesión. Supabase concede EXECUTE a anon por defecto: se retira.
revoke execute on function public.staff_whoami() from public, anon;
revoke execute on function public.staff_list() from public, anon;
revoke execute on function public.staff_list_tenants(boolean) from public, anon;
revoke execute on function public.staff_set_tenant_account_manager(uuid, uuid) from public, anon;
grant execute on function public.staff_whoami() to authenticated;
grant execute on function public.staff_list() to authenticated;
grant execute on function public.staff_list_tenants(boolean) to authenticated;
grant execute on function public.staff_set_tenant_account_manager(uuid, uuid) to authenticated;
