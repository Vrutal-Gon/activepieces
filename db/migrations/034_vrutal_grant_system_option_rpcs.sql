-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO lo ejecutes en el VrutalOS de ningún cliente.
-- VRUTAL 1st · Migración 034 · Devolver el EXECUTE que se llevó el event trigger de la 010
--
-- Síntoma: en el panel, el Stack de Vrutal-lab no deja crear un sistema nuevo —
-- "permission denied for function catalog_create_system_option".
--
-- Causa: la migración 028 añadió `p_provider_key` a
-- `catalog_create_system_option` / `catalog_update_system_option`. Cambiar la lista de
-- argumentos hace que `create or replace` sea un CREATE FUNCTION nuevo, no un reemplazo. El
-- event trigger `revoke_anon_function_exec` (010) le quita PUBLIC a toda función nueva de
-- `public`/`catalog`, y la 028 no volvió a conceder EXECUTE a `authenticated` (sí lo hizo
-- para `catalog_list_system_options`, por eso la lista se ve y el guardar falla).
-- Comprobado contra la base el 2026-10-15: proacl = {postgres=X/postgres} en las dos.
--
-- La autorización de verdad no cambia: sigue dentro de la función
-- (`is_platform_admin()` al crear, `is_superadmin()` al editar).
-- =====================================================================

grant execute on function public.catalog_create_system_option(text,text,text,text,text,text) to authenticated;
grant execute on function public.catalog_update_system_option(uuid,text,text,text,text,text,text) to authenticated;

revoke execute on function public.catalog_create_system_option(text,text,text,text,text,text) from public, anon;
revoke execute on function public.catalog_update_system_option(uuid,text,text,text,text,text,text) from public, anon;

-- ---------------------------------------------------------------------
-- Para revertir:
--   revoke execute on function public.catalog_create_system_option(text,text,text,text,text,text) from authenticated;
--   revoke execute on function public.catalog_update_system_option(uuid,text,text,text,text,text,text) from authenticated;
--   (volvería el "permission denied" del panel)
-- ---------------------------------------------------------------------
