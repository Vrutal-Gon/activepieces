-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-06_integrations_vault.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Aplica la migración, la prueba y TERMINA CON UN ERROR A PROPÓSITO,
-- así que Postgres revierte todo: no queda nada aplicado ni ningún secreto en el Vault.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Antes de ejecutar: sustituir admin_id por el id del admin del proyecto
--   select id, role, is_active from public.profiles;
-- =====================================================================
do $do$
declare
  r text := '';
  n int;
  v_id uuid;
  v_ref text;
  v_plain text;
  v_ref2 text;
  admin_id constant text := 'ff4b1313-e086-4815-b03c-2d9b3a0f6752';
begin
  -- ===== migración (copia de 2026-10-06_integrations_vault.sql) =====
  alter table public.integrations
    add column if not exists validated_at timestamptz,
    add column if not exists last_error text;
  create unique index if not exists integrations_provider_key on public.integrations (provider);

  revoke all on public.integrations from anon, authenticated;
  grant select (id, integration_type, provider, config, status, validated_at, last_error, created_at)
    on public.integrations to authenticated;
  grant update (status) on public.integrations to authenticated;
  grant all on public.integrations to service_role;

  create or replace function public.guard_integration_status() returns trigger language plpgsql security definer set search_path = public, pg_temp as $f$
  begin
    if new.status is distinct from old.status and auth.uid() is not null then
      if old.status = 'revoked' then raise exception 'Una integración revocada se reconecta con una clave nueva.' using errcode = '42501'; end if;
      if new.status not in ('active', 'paused') then raise exception 'Estado no permitido.' using errcode = '42501'; end if;
    end if;
    return new;
  end $f$;
  drop trigger if exists trg_guard_integration_status on public.integrations;
  create trigger trg_guard_integration_status before update on public.integrations for each row execute function public.guard_integration_status();

  create or replace function public.integration_store_secret(p_provider text, p_type text, p_secret text)
  returns uuid language plpgsql security definer set search_path = public, vault, pg_temp as $f$
  declare v_id uuid; v_ref text; v_secret uuid;
  begin
    if coalesce(trim(p_provider), '') = '' or coalesce(trim(p_type), '') = '' or coalesce(p_secret, '') = '' then
      raise exception 'Faltan datos de la integración.' using errcode = '22023';
    end if;
    select id, secret_ref into v_id, v_ref from public.integrations where provider = p_provider for update;
    if v_id is not null and v_ref is not null then
      perform vault.update_secret(secret_id := v_ref::uuid, new_secret := p_secret);
      update public.integrations set validated_at = now(), last_error = null,
             status = case when status = 'revoked' then 'active' else status end where id = v_id;
      return v_id;
    end if;
    v_secret := vault.create_secret(p_secret, 'integration:' || p_provider, 'Clave de la integración ' || p_provider);
    if v_id is not null then
      update public.integrations set secret_ref = v_secret::text, validated_at = now(), last_error = null, status = 'active' where id = v_id;
      return v_id;
    end if;
    insert into public.integrations (integration_type, provider, secret_ref, status, validated_at)
    values (p_type, p_provider, v_secret::text, 'active', now()) returning id into v_id;
    return v_id;
  end $f$;
  revoke all on function public.integration_store_secret(text, text, text) from public, anon, authenticated;
  grant execute on function public.integration_store_secret(text, text, text) to service_role;

  -- ===== pruebas =====
  -- 1. La Edge Function (service_role) guarda una clave
  set local role service_role;
  v_id := public.integration_store_secret('hubspot', 'crm', 'clave-de-prueba-111');
  reset role;
  select secret_ref into v_ref from public.integrations where id = v_id;
  select decrypted_secret into v_plain from vault.decrypted_secrets where id = v_ref::uuid;
  r := r || format('1) alta: fila creada=%s, secret_ref con valor=%s, Vault descifra=%s (esperado true, true, true) | ',
        v_id is not null, v_ref is not null, v_plain = 'clave-de-prueba-111');

  -- 2. Sobrescribir: misma fila, mismo secreto, valor nuevo
  set local role service_role;
  perform public.integration_store_secret('hubspot', 'crm', 'clave-de-prueba-222');
  reset role;
  select count(*) into n from public.integrations where provider = 'hubspot';
  select secret_ref into v_ref2 from public.integrations where id = v_id;
  select decrypted_secret into v_plain from vault.decrypted_secrets where id = v_ref2::uuid;
  r := r || format('2) sobrescribir: filas=%s, mismo secret_ref=%s, valor nuevo=%s (esperado 1, true, true) | ',
        n, v_ref = v_ref2, v_plain = 'clave-de-prueba-222');

  -- 3. El Admin, con su sesión
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.integrations;
  r := r || format('3) admin lee el estado: %s fila (esperado 1) | ', n);
  begin
    perform secret_ref from public.integrations;
    r := r || '4) ADMIN LEE secret_ref: PERMITIDO (MAL) | ';
  exception when others then r := r || '4) admin lee secret_ref: bloqueado (esperado bloqueado) | '; end;
  begin
    update public.integrations set status = 'paused';
    get diagnostics n = row_count;
    r := r || format('5) admin pausa: %s fila (esperado 1) | ', n);
  exception when others then r := r || format('5) ADMIN NO PUEDE PAUSAR [%s] (MAL) | ', sqlerrm); end;
  begin
    update public.integrations set status = 'revoked';
    r := r || '6) ADMIN PONE revoked: PERMITIDO (MAL) | ';
  exception when others then r := r || '6) admin pone revoked: bloqueado (esperado bloqueado) | '; end;
  begin
    update public.integrations set secret_ref = 'otra-cosa';
    r := r || '7) ADMIN ESCRIBE secret_ref: PERMITIDO (MAL) | ';
  exception when others then r := r || '7) admin escribe secret_ref: bloqueado (esperado bloqueado) | '; end;
  begin
    insert into public.integrations (integration_type, provider) values ('crm', 'falso');
    r := r || '8) ADMIN INSERTA: PERMITIDO (MAL) | ';
  exception when others then r := r || '8) admin inserta: bloqueado (esperado bloqueado) | '; end;
  begin
    delete from public.integrations;
    r := r || '9) ADMIN BORRA: PERMITIDO (MAL) | ';
  exception when others then r := r || '9) admin borra: bloqueado (esperado bloqueado) | '; end;
  begin
    perform public.integration_store_secret('hubspot', 'crm', 'robada');
    r := r || '10) ADMIN EJECUTA integration_store_secret: PERMITIDO (MAL) | ';
  exception when others then r := r || '10) admin ejecuta integration_store_secret: bloqueado (esperado bloqueado) | '; end;
  begin
    perform 1 from vault.decrypted_secrets limit 1;
    r := r || '11) ADMIN LEE EL VAULT: PERMITIDO (MAL)';
  exception when others then r := r || '11) admin lee el Vault: bloqueado (esperado bloqueado)'; end;
  reset role;

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
