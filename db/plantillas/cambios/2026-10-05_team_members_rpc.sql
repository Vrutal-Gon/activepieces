-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · team_members()
--
-- La pantalla Equipo (solo Admin) necesita el correo y el último acceso de
-- cada persona. Viven en auth.users, que el front no puede leer. Esta función
-- los expone SOLO a un Admin activo; a cualquier otra persona le devuelve 0 filas.
--
-- Solo lectura. Reversible: drop function public.team_members();
-- Aplicar en cada proyecto de cliente (ver README de esta carpeta).
-- =====================================================================

create or replace function public.team_members()
returns table (
  id uuid,
  full_name text,
  email text,
  role text,
  is_active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language sql stable security definer set search_path = public, auth, pg_temp as $f$
  select p.id, p.full_name, u.email::text, p.role, p.is_active, p.created_at, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at
$f$;

revoke all on function public.team_members() from public, anon;
grant execute on function public.team_members() to authenticated, service_role;
