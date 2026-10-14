-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · is_active: solo Admin y Vrutal
--
-- Regla: activar, desactivar y reactivar a una persona solo lo hacen
--   · el Admin de la empresa (sobre OTRA persona), y
--   · Vrutal (service_role / SQL de Vrutal, donde auth.uid() es null).
-- Un usuario nunca toca su propio is_active, tampoco un Admin (evita
-- dejar la empresa sin administrador por accidente).
--
-- Además, desactivar corta el acceso de verdad en el servidor:
--   · my_role() devuelve null a una cuenta desactivada (is_admin() = false).
--   · Una política RESTRICTIVE por tabla exige is_active_user().
--     Excepción: una cuenta desactivada puede leer SU PROPIA fila de
--     profiles, para que la app le diga «cuenta desactivada».
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- NOTA: db/plantillas/vrutal_client_project_template.sql está desfasado
-- respecto a la base real (p. ej. handle_new_user, tablas nuevas).
-- Regenerarlo desde la base viva antes del próximo cliente.
-- =====================================================================

-- 1. Cuenta desactivada = sin rol.
create or replace function public.my_role()
returns text
language sql stable security definer set search_path = public, pg_temp as $f$
  select role from public.profiles where id = auth.uid() and is_active
$f$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false)
$f$;

revoke all on function public.is_active_user() from public;
grant execute on function public.is_active_user() to authenticated, service_role;

-- 2. Quién puede cambiar is_active.
create or replace function public.guard_profile_is_active()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if new.is_active is distinct from old.is_active then
    -- Vrutal (service_role o SQL de Vrutal): no hay usuario en la sesión.
    if auth.uid() is null then
      return new;
    end if;
    if new.id = auth.uid() then
      raise exception 'No puedes activar ni desactivar tu propia cuenta.' using errcode = '42501';
    end if;
    if not public.is_admin() then
      raise exception 'Solo un administrador puede activar o desactivar cuentas.' using errcode = '42501';
    end if;
  end if;
  return new;
end $f$;

drop trigger if exists trg_guard_profile_is_active on public.profiles;
create trigger trg_guard_profile_is_active
  before update on public.profiles
  for each row execute function public.guard_profile_is_active();

-- 3. Cuenta desactivada = sin datos. Políticas restrictivas (se suman con AND a las que ya hay).
do $do$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity and tablename <> 'profiles'
  loop
    execute format('drop policy if exists active_only on public.%I', t);
    execute format(
      'create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active_user())', t);
  end loop;
end $do$;

-- profiles: leer (a todo el equipo activo y a uno mismo) y actualizar (solo cuentas activas).
drop policy if exists active_only_select on public.profiles;
create policy active_only_select on public.profiles
  as restrictive for select to authenticated
  using (public.is_active_user() or id = auth.uid());

drop policy if exists active_only_update on public.profiles;
create policy active_only_update on public.profiles
  as restrictive for update to authenticated
  using (public.is_active_user());

-- Tablas nuevas que se creen después NO heredan esto: añadir su política active_only
-- (o repetir el bloque do de arriba) en la misma migración que las cree.

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop trigger trg_guard_profile_is_active on public.profiles;
--   drop function public.guard_profile_is_active();
--   do $$ declare t text; begin
--     for t in select tablename from pg_tables where schemaname='public' and rowsecurity loop
--       execute format('drop policy if exists active_only on public.%I', t); end loop; end $$;
--   drop policy active_only_select on public.profiles;
--   drop policy active_only_update on public.profiles;
--   drop function public.is_active_user();
--   create or replace function public.my_role() returns text language sql stable security definer
--     set search_path = public, pg_temp as $f$ select role from public.profiles where id = auth.uid() $f$;
-- ---------------------------------------------------------------------
