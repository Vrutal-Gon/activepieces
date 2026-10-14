-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-08_integrations_social.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Aplica la migración, la prueba y TERMINA CON UN ERROR A PROPÓSITO,
-- así que Postgres revierte todo: no queda nada aplicado ni ningún secreto en el Vault.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Requiere 2026-10-06_integrations_vault.sql ya aplicada (usa integration_store_secret
-- para crear el dato de prueba) — si no lo está, aplicarla primero (o pegarla antes aquí).
--
-- Antes de ejecutar: sustituir admin_id por el id del admin del proyecto
--   select id, role, is_active from public.profiles;
-- =====================================================================
do $do$
declare
  r text := '';
  v_id uuid;
  v_plain text;
  admin_id constant text := 'ff4b1313-e086-4815-b03c-2d9b3a0f6752';
begin
  -- ===== migración (copia de 2026-10-08_integrations_social.sql) =====
  create or replace function public.integration_read_secret(p_provider text)
  returns text language plpgsql security definer set search_path = public, vault, pg_temp as $f$
  declare v_ref text; v_secret text;
  begin
    select secret_ref into v_ref from public.integrations where provider = p_provider;
    if v_ref is null then return null; end if;
    select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_ref::uuid;
    return v_secret;
  end $f$;
  revoke all on function public.integration_read_secret(text) from public, anon, authenticated;
  grant execute on function public.integration_read_secret(text) to service_role;

  -- ===== datos de prueba =====
  set local role service_role;
  v_id := public.integration_store_secret('postiz', 'platform', 'clave-postiz-de-prueba');
  reset role;

  -- ===== pruebas =====
  -- 1. service_role lee la clave real
  set local role service_role;
  v_plain := public.integration_read_secret('postiz');
  reset role;
  r := r || format('1) service_role lee: %s (esperado clave-postiz-de-prueba) | ', v_plain);

  -- 2. Un proveedor sin fila: null, no error
  set local role service_role;
  v_plain := public.integration_read_secret('no-existe');
  reset role;
  r := r || format('2) proveedor inexistente: %s (esperado null) | ', coalesce(v_plain, 'null'));

  -- 3. El Admin, con su sesión, no puede ejecutar la función
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.integration_read_secret('postiz');
    r := r || '3) ADMIN LEE EL SECRETO: PERMITIDO (MAL)';
  exception when others then r := r || '3) admin lee el secreto: bloqueado (esperado bloqueado)'; end;
  reset role;

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
