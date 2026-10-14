-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 025 · API key de Postiz, gestionada por staff, no por el cliente
--
-- Corrige un diseño de sesión anterior (2026-10-08): la API key de la instancia de Postiz
-- de cada cliente se guardaba en `integrations` del propio Supabase del cliente, por
-- `integration-save-key` — el mismo camino que usa el Admin del cliente para pegar SUS
-- propias claves (HubSpot, Anthropic). Postiz no es una clave del cliente: es infraestructura
-- que Vrutal provisiona y gestiona, así que no debía vivir ahí ni enseñarse en Integraciones.
--
-- Nota sobre el documento de arquitectura: `tenant_credential`/`set_tenant_credential` (D-10,
-- D-18) **no existen en ninguna migración** — se comprobó antes de escribir esta, no se asumió.
-- En vez de resucitar una tabla sin construir y de ajuste semántico dudoso (D-10 describe
-- credenciales para que Vrutal1st alcance el proyecto del cliente, no al revés), se reusa
-- lo que ya está construido y probado esta misma sesión: `tenant_instance` + Vault +
-- `tenant_instance.push_token` (022/023) como canal autenticado instancia↔Vrutal1st.
--
-- Sigue siendo una instancia de Postiz por cliente (sin cambiar el aislamiento, LAB08):
-- solo cambia DÓNDE vive la clave — en el Vault de Vrutal1st, no en el del cliente.
-- =====================================================================

alter table public.tenant_instance add column if not exists postiz_key_ref text;

comment on column public.tenant_instance.postiz_key_ref is
  'Referencia al Vault de Vrutal1st con la API key de la instancia de Postiz de este cliente. '
  'La pone el staff (staff_set_tenant_postiz_key); el cliente nunca la ve ni la gestiona.';

-- Staff: alta o sobrescritura de la clave (mismo patrón que integration_store_secret, en Vrutal1st).
create or replace function public.staff_set_tenant_postiz_key(p_tenant_id uuid, p_key text)
returns void
language plpgsql security definer set search_path = public, vault, pg_temp as $f$
declare v_ref text;
begin
  if not staff_can_access_tenant(p_tenant_id) or not has_permission('tenants.write', p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_key), '') = '' then
    raise exception 'Falta la clave' using errcode = '22023';
  end if;

  select postiz_key_ref into v_ref from public.tenant_instance where tenant_id = p_tenant_id;

  if v_ref is not null then
    perform vault.update_secret(secret_id := v_ref::uuid, new_secret := p_key);
  else
    insert into public.tenant_instance (tenant_id, postiz_key_ref, updated_at, updated_by)
    values (p_tenant_id, vault.create_secret(p_key, 'postiz:' || p_tenant_id, 'API key de Postiz')::text, now(), auth.uid())
    on conflict (tenant_id) do update set
      postiz_key_ref = excluded.postiz_key_ref, updated_at = now(), updated_by = auth.uid();
  end if;
end $f$;

-- Server-to-server: la instancia del cliente pide su propia clave de Postiz, con su push_token.
-- Mismo criterio que social_integration_report: un solo error para "token malo" y "tenant sin clave".
create or replace function public.social_get_postiz_key(p_tenant_id uuid, p_token text)
returns text
language plpgsql security definer set search_path = public, vault, pg_temp as $f$
declare v_ref text; v_key text;
begin
  if not public._tenant_token_ok(p_tenant_id, p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select postiz_key_ref into v_ref from public.tenant_instance where tenant_id = p_tenant_id;
  if v_ref is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where id = v_ref::uuid;
  return v_key;
end $f$;

-- Extiende el read de 019: añade si ya hay clave de Postiz, nunca la clave ni su referencia
-- (mismo criterio que integrations.secret_ref: el Admin/staff ve estado, nunca el secreto).
-- Postgres no deja cambiar el tipo de retorno con "create or replace": hay que borrar primero.
drop function if exists public.staff_get_tenant_instance(uuid);
create function public.staff_get_tenant_instance(p_tenant_id uuid)
returns table(host text, public_url text, template_version text, ap_version text, app_version text,
              notes text, updated_at timestamptz, updated_by_name text, postiz_key_set boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select i.host, i.public_url, i.template_version, i.ap_version, i.app_version, i.notes, i.updated_at,
         coalesce(p.full_name, u.email::text), i.postiz_key_ref is not null
  from public.tenant_instance i
  left join public.profiles p on p.id = i.updated_by
  left join auth.users u on u.id = i.updated_by
  where i.tenant_id = p_tenant_id;
end $$;

revoke execute on function public.staff_set_tenant_postiz_key(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_set_tenant_postiz_key(uuid, text) to authenticated;
revoke execute on function public.social_get_postiz_key(uuid, text) from public, anon, authenticated;
grant execute on function public.social_get_postiz_key(uuid, text) to service_role;
-- El drop+create de staff_get_tenant_instance borra su grant anterior: se repone aquí.
revoke execute on function public.staff_get_tenant_instance(uuid) from public, anon;
grant execute on function public.staff_get_tenant_instance(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.social_get_postiz_key(uuid, text);
--   drop function public.staff_set_tenant_postiz_key(uuid, text);
--   alter table public.tenant_instance drop column postiz_key_ref;
--   (el secreto ya guardado en el Vault no se borra solo)
--   staff_get_tenant_instance vuelve a su forma de 019 solo si se re-ejecuta 019 entera
--   (el drop de esta migración no se revierte con un create or replace simple)
-- ---------------------------------------------------------------------
