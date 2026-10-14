-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-06_client_manager_role.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Aplica la migración, la prueba y TERMINA CON UN ERROR A PROPÓSITO,
-- así que Postgres revierte todo: no queda nada aplicado.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Antes de ejecutar: sustituir admin_id y user_id por ids reales del proyecto
--   select id, role, is_active from public.profiles;
-- user_id debe ser una cuenta client_user activa que no sea admin_id:
-- se le sube a client_manager solo dentro de esta transacción (se revierte).
-- =====================================================================
do $do$
declare
  r text := '';
  n int;
  v boolean;
  admin_id constant text := 'ff4b1313-e086-4815-b03c-2d9b3a0f6752';
  user_id  constant text := '00000000-0000-0000-0000-000000000000';
begin
  -- ===== migración (copia de 2026-10-06_client_manager_role.sql) =====
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles add constraint profiles_role_check
    check (role in ('client_admin', 'client_manager', 'client_user'));

  create or replace function public.is_manager() returns boolean language sql stable security definer set search_path = public, pg_temp as $f$
    select coalesce(public.my_role() = 'client_manager', false) $f$;
  revoke all on function public.is_manager() from public;
  grant execute on function public.is_manager() to authenticated, service_role;

  create or replace function public.is_admin_or_manager() returns boolean language sql stable security definer set search_path = public, pg_temp as $f$
    select coalesce(public.my_role() in ('client_admin', 'client_manager'), false) $f$;
  revoke all on function public.is_admin_or_manager() from public;
  grant execute on function public.is_admin_or_manager() to authenticated, service_role;

  -- ===== preparación: el usuario de prueba pasa a manager, con service_role (sin RLS) =====
  update public.profiles set role = 'client_manager' where id = user_id::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'user_id no encontrado o no es client_user: revisa el id antes de la prueba'; end if;

  -- ===== pruebas, como el Manager =====
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.is_manager() into v;          r := r || format('1) is_manager (manager): %s (esperado true) | ', v);
  select public.is_admin() into v;            r := r || format('2) is_admin (manager): %s (esperado false) | ', v);
  select public.is_admin_or_manager() into v; r := r || format('3) is_admin_or_manager (manager): %s (esperado true) | ', v);
  begin
    update public.profiles set is_active = false where id = admin_id::uuid;
    r := r || '4) MANAGER DESACTIVA AL ADMIN: PERMITIDO (MAL) | ';
  exception when others then r := r || format('4) manager desactiva al admin: bloqueado [%s] (esperado bloqueado) | ', sqlerrm); end;
  begin
    update public.profiles set role = 'client_admin' where id = user_id::uuid;
    r := r || '5) MANAGER SE ASCIENDE A ADMIN: PERMITIDO (MAL) | ';
  exception when others then r := r || format('5) manager se asciende a si mismo: bloqueado [%s] (esperado bloqueado) | ', sqlerrm); end;
  reset role;

  -- ===== pruebas, como el Admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.is_manager() into v;          r := r || format('6) is_manager (admin): %s (esperado false) | ', v);
  select public.is_admin_or_manager() into v; r := r || format('7) is_admin_or_manager (admin): %s (esperado true) | ', v);
  begin
    update public.profiles set role = 'client_user' where id = user_id::uuid;
    get diagnostics n = row_count;
    r := r || format('8) admin baja al manager a usuario: filas=%s (esperado 1) | ', n);
  exception when others then r := r || format('8) admin baja al manager a usuario: bloqueado [%s] (esperado permitido) | ', sqlerrm); end;
  reset role;

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
