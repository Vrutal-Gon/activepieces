-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · rol Manager
--
-- Añade un tercer rol de cliente, `client_manager`, entre `client_user`
-- y `client_admin`:
--   · NO gestiona equipo, integraciones ni facturación -- eso sigue
--     siendo exclusivo de `client_admin` (sin cambios en esas pantallas
--     ni en sus políticas: is_admin() se queda como está).
--   · SÍ podrá leer y editar el perfil de la empresa que alimenta a los
--     flujos (competidores, estrategia de precio, foco de SEM...) --
--     las tablas de esa parte son un cambio aparte, todavía en diseño;
--     esta migración solo abre el rol y su función de comprobación
--     para que ese cambio pueda apoyarse en `is_manager()`.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. El check constraint de profiles.role admite el nuevo valor.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('client_admin', 'client_manager', 'client_user'));

-- 2. Funciones de comprobación, mismo patrón que is_admin().
create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select coalesce(public.my_role() = 'client_manager', false)
$f$;

revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated, service_role;

create or replace function public.is_admin_or_manager()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select coalesce(public.my_role() in ('client_admin', 'client_manager'), false)
$f$;

revoke all on function public.is_admin_or_manager() from public;
grant execute on function public.is_admin_or_manager() to authenticated, service_role;

-- Nota: profiles_update_self_or_admin, guard_profile_is_active y
-- active_only siguen exigiendo is_admin() a secas -- un Manager no
-- cambia roles ni activa/desactiva cuentas, igual que un Usuario.

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.is_admin_or_manager();
--   drop function public.is_manager();
--   alter table public.profiles drop constraint profiles_role_check;
--   alter table public.profiles add constraint profiles_role_check
--     check (role in ('client_admin', 'client_user'));
--   (falla si queda alguna fila con role = 'client_manager': pasarla a
--    client_user primero)
-- ---------------------------------------------------------------------
