-- =====================================================================
-- VRUTAL 1st · Migración 011 · 2FA obligatoria para el staff (servidor)
--
-- has_platform_role() y has_permission() solo devuelven true si la sesión está
-- verificada con segundo factor (claim aal = 'aal2' del JWT de Supabase).
-- Como is_superadmin(), is_platform_admin(), todas las RPC del panel y las
-- políticas RLS se apoyan en ellas, una contraseña robada sin el segundo factor
-- no da acceso a nada, ni desde el panel ni llamando a la API a mano.
--
-- ORDEN: ejecutar SOLO después de haber activado tu 2FA en el panel.
-- Si pierdes el móvil: desde el SQL Editor (no pasa por estas funciones)
--   delete from auth.mfa_factors where user_id = (select id from auth.users where email = '<tu correo>');
-- y vuelve a configurarla al entrar.
--
-- Sin efecto en procesos server-to-server: service_role no tiene auth.uid(),
-- así que estas funciones ya devolvían false para él.
-- =====================================================================

create or replace function public.has_platform_role(p_keys text[])
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
    select 1
    from public.user_roles ur
    join public.roles r    on r.id = ur.role_id and r.scope = 'platform'
    join public.profiles p on p.id = ur.profile_id and p.status = 'active' and p.deleted_at is null
    where ur.profile_id = auth.uid()
      and ur.tenant_id is null
      and r.key = any (p_keys)
  );
$function$;

create or replace function public.has_permission(perm_key text, t_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
    select 1
    from public.user_roles ur
    join public.roles r            on r.id = ur.role_id and r.scope = 'platform'
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions pm     on pm.id = rp.permission_id
    join public.profiles p         on p.id = ur.profile_id and p.status = 'active' and p.deleted_at is null
    where ur.profile_id = auth.uid()
      and pm.key = perm_key
      and (ur.tenant_id is null or ur.tenant_id = t_id)
  );
$function$;

-- create or replace conserva los permisos existentes; el trigger de la 010 retira anon/PUBLIC igualmente.
