-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · handle_new_user no conocía el rol Manager
--
-- Bug encontrado el 2026-10-15 al regenerar la plantilla desde la base viva.
--
-- El rol Manager se añadió el 2026-10-06 (`2026-10-06_client_manager_role.sql`): tercer
-- valor de `profiles.role`, entre Usuario y Admin. Ese cambio actualizó el check constraint,
-- `is_manager()`, `is_admin_or_manager()`, la pantalla de Equipo y la Edge Function
-- `team-invite`. Pero NO actualizó `handle_new_user()`, que es el trigger que crea el perfil
-- cuando alguien acepta una invitación.
--
-- Consecuencia: la función solo aceptaba 'client_admin' y 'client_user', y cualquier otro
-- valor caía al `else` → 'client_user'. Así que invitar a alguien como Manager lo creaba
-- como **Usuario normal**, en silencio. No da error en ningún sitio: el Admin ve que invitó
-- a un Manager y la persona entra con permisos de usuario.
--
-- Nadie lo ha sufrido todavía porque Vrutal-labs solo tiene una cuenta (el Admin), así que
-- no se ha invitado a ningún Manager. Se arregla antes de que pase.
--
-- Es el mismo patrón que ya costó caro el 2026-10-13: nada falla al arrancar, solo al usarse.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_full_name text;
begin
  -- app_metadata solo lo escribe el service_role (Vrutal). Fuente de verdad del rol.
  v_role := new.raw_app_meta_data ->> 'role';
  v_full_name := new.raw_user_meta_data ->> 'full_name';

  insert into public.profiles (id, role, full_name)
    values (
      new.id,
      case when v_role in ('client_admin','client_manager','client_user') then v_role else 'client_user' end,
      v_full_name
    );
  return new;
end $function$;

-- ---------------------------------------------------------------------
-- Para revertir: volver a poner la lista sin 'client_manager' en el `case`.
--   (volvería a crear como Usuario normal a quien se invite como Manager)
-- ---------------------------------------------------------------------
