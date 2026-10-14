-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Integraciones con Vault
--
-- Las claves de los sistemas del cliente (CRM, IA…) las pega su Admin en la app y
-- se guardan CIFRADAS en el Vault del Supabase del cliente (decisión: bóveda = Vault).
--   · Una Edge Function (integration-save-key) prueba la clave contra el proveedor y,
--     solo si funciona, la guarda con integration_store_secret().
--   · integrations.secret_ref apunta al secreto del Vault. Nunca hay clave en claro en tablas.
--   · La clave no se vuelve a mostrar: solo se sobrescribe.
--   · Vrutal1st recibe solo el estado de la conexión, nunca la clave.
--
-- Qué cambia aquí:
--   1. integrations gana validated_at y last_error, y un proveedor = una integración.
--   2. Permisos por columna: el Admin LEE el estado pero NO secret_ref (ni siquiera la
--      referencia), y solo puede pausar/reanudar (status). Alta y cambios de clave: solo
--      la Edge Function (service_role).
--   3. Un trigger impide que un usuario ponga 'revoked' o revive una integración revocada.
--   4. integration_store_secret(): único camino a vault.create_secret/update_secret.
--      Solo service_role puede ejecutarla.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. Estado de la conexión (lo que enseña la pantalla) y un proveedor = una integración.
alter table public.integrations
  add column if not exists validated_at timestamptz,
  add column if not exists last_error text;

create unique index if not exists integrations_provider_key on public.integrations (provider);

-- 2. Permisos por columna.
revoke all on public.integrations from anon, authenticated;
grant select (id, integration_type, provider, config, status, validated_at, last_error, created_at)
  on public.integrations to authenticated;
grant update (status) on public.integrations to authenticated;
grant all on public.integrations to service_role;

-- 3. Un usuario solo alterna activa <-> pausada. 'revoked' lo pone el sistema al quitar la clave.
create or replace function public.guard_integration_status()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  if new.status is distinct from old.status and auth.uid() is not null then
    if old.status = 'revoked' then
      raise exception 'Una integración revocada se reconecta con una clave nueva.' using errcode = '42501';
    end if;
    if new.status not in ('active', 'paused') then
      raise exception 'Estado no permitido.' using errcode = '42501';
    end if;
  end if;
  return new;
end $f$;

drop trigger if exists trg_guard_integration_status on public.integrations;
create trigger trg_guard_integration_status
  before update on public.integrations
  for each row execute function public.guard_integration_status();

-- 4. Guardar la clave en el Vault. Crea el secreto la primera vez y lo sobrescribe después.
create or replace function public.integration_store_secret(
  p_provider text, p_type text, p_secret text)
returns uuid
language plpgsql security definer set search_path = public, vault, pg_temp as $f$
declare
  v_id uuid;
  v_ref text;
  v_secret uuid;
begin
  if coalesce(trim(p_provider), '') = '' or coalesce(trim(p_type), '') = '' or coalesce(p_secret, '') = '' then
    raise exception 'Faltan datos de la integración.' using errcode = '22023';
  end if;

  select id, secret_ref into v_id, v_ref from public.integrations where provider = p_provider for update;

  if v_id is not null and v_ref is not null then
    perform vault.update_secret(secret_id := v_ref::uuid, new_secret := p_secret);
    update public.integrations
       set validated_at = now(), last_error = null,
           status = case when status = 'revoked' then 'active' else status end
     where id = v_id;
    return v_id;
  end if;

  v_secret := vault.create_secret(p_secret, 'integration:' || p_provider, 'Clave de la integración ' || p_provider);
  if v_id is not null then
    update public.integrations
       set secret_ref = v_secret::text, validated_at = now(), last_error = null, status = 'active'
     where id = v_id;
    return v_id;
  end if;

  insert into public.integrations (integration_type, provider, secret_ref, status, validated_at)
  values (p_type, p_provider, v_secret::text, 'active', now())
  returning id into v_id;
  return v_id;
end $f$;

revoke all on function public.integration_store_secret(text, text, text) from public, anon, authenticated;
grant execute on function public.integration_store_secret(text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Para revertir (los secretos ya guardados en el Vault NO se borran solos):
--   drop function public.integration_store_secret(text, text, text);
--   drop trigger trg_guard_integration_status on public.integrations;
--   drop function public.guard_integration_status();
--   drop index public.integrations_provider_key;
--   grant select, update on public.integrations to authenticated;
--   alter table public.integrations drop column validated_at, drop column last_error;
-- ---------------------------------------------------------------------
