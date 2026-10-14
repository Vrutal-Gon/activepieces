-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-05_is_active_solo_admin.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Aplica la migración, la prueba y TERMINA CON UN ERROR A PROPÓSITO,
-- así que Postgres revierte todo: no queda nada aplicado.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Antes de ejecutar: sustituir admin_id por el id del admin del proyecto
--   select id, role, is_active from public.profiles;
-- =====================================================================
do $do$
declare
  r text := '';
  t text;
  n int;
  v boolean;
  admin_id constant text := 'ff4b1313-e086-4815-b03c-2d9b3a0f6752';
begin
  -- ===== migración (copia de 2026-10-05_is_active_solo_admin.sql) =====
  create or replace function public.my_role() returns text language sql stable security definer set search_path = public, pg_temp as $f$
    select role from public.profiles where id = auth.uid() and is_active $f$;
  create or replace function public.is_active_user() returns boolean language sql stable security definer set search_path = public, pg_temp as $f$
    select coalesce((select is_active from public.profiles where id = auth.uid()), false) $f$;
  revoke all on function public.is_active_user() from public;
  grant execute on function public.is_active_user() to authenticated, service_role;

  create or replace function public.guard_profile_is_active() returns trigger language plpgsql security definer set search_path = public, pg_temp as $f$
  begin
    if new.is_active is distinct from old.is_active then
      if auth.uid() is null then return new; end if;
      if new.id = auth.uid() then raise exception 'No puedes activar ni desactivar tu propia cuenta.' using errcode = '42501'; end if;
      if not public.is_admin() then raise exception 'Solo un administrador puede activar o desactivar cuentas.' using errcode = '42501'; end if;
    end if;
    return new;
  end $f$;
  drop trigger if exists trg_guard_profile_is_active on public.profiles;
  create trigger trg_guard_profile_is_active before update on public.profiles for each row execute function public.guard_profile_is_active();

  for t in select tablename from pg_tables where schemaname = 'public' and rowsecurity and tablename <> 'profiles' loop
    execute format('drop policy if exists active_only on public.%I', t);
    execute format('create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active_user())', t);
  end loop;
  drop policy if exists active_only_select on public.profiles;
  create policy active_only_select on public.profiles as restrictive for select to authenticated using (public.is_active_user() or id = auth.uid());
  drop policy if exists active_only_update on public.profiles;
  create policy active_only_update on public.profiles as restrictive for update to authenticated using (public.is_active_user());

  -- ===== pruebas =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.specialists;  r := r || format('1) admin activo ve specialists: %s (esperado 2) | ', n);
  select public.is_admin() into v;                  r := r || format('is_admin: %s (esperado true) | ', v);
  begin
    update public.profiles set is_active = false where id = admin_id::uuid;
    r := r || '2) ADMIN SE DESACTIVA A SI MISMO: PERMITIDO (MAL) | ';
  exception when others then r := r || format('2) admin se desactiva a si mismo: bloqueado [%s] (esperado bloqueado) | ', sqlerrm); end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set is_active = false where id = admin_id::uuid;
  r := r || '3) Vrutal desactiva la cuenta: permitido | ';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.specialists;   r := r || format('4) desactivada ve specialists: %s (esperado 0) | ', n);
  select count(*) into n from public.profiles;      r := r || format('5) desactivada ve profiles: %s (esperado 1, la suya) | ', n);
  select public.is_admin() into v;                  r := r || format('6) is_admin desactivada: %s (esperado false) | ', v);
  begin
    update public.profiles set is_active = true where id = admin_id::uuid;
    get diagnostics n = row_count;
    r := r || format('7) SE REACTIVA SOLA: filas=%s (esperado 0 filas o error) | ', n);
  exception when others then r := r || format('7) se reactiva sola: bloqueado [%s] (esperado bloqueado) | ', sqlerrm); end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set is_active = true where id = admin_id::uuid;
  r := r || '8) Vrutal reactiva: permitido';
  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
