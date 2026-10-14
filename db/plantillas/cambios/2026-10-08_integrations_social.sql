-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Redes sociales (Postiz) en Integraciones
--
-- Las 36 redes que soporta Postiz no se conectan pegando una clave (ver nota de diseño
-- en el plan): "Conectar" pide a Postiz la URL de autorización real del proveedor y
-- redirige ahí — el cliente nunca ve la interfaz de Postiz. Lo único que sí se guarda
-- como clave de verdad, en el Vault, es la API key de la propia instancia de Postiz
-- (integration_type = 'platform', provider = 'postiz'), capturada con el mismo
-- integration-save-key que ya existe (añadir 'postiz' a su PROVIDERS).
--
-- Qué cambia aquí:
--   1. integration_read_secret(): único camino para LEER un secreto del Vault.
--      Solo service_role puede ejecutarla — la usa integration-social-connect para
--      leer la API key de Postiz y hablarle a su API en nombre del cliente.
--      (integration_store_secret ya existía para escribir; faltaba leer.)
--
-- Pendiente, fuera de SQL (no se configura aquí):
--   - Database Webhook sobre public.integrations, AFTER INSERT OR UPDATE OF status
--     WHEN (integration_type = 'social'), hacia la Edge Function integration-social-notify
--     (avisa a Vrutal1st del estado — nunca de secret_ref ni config).
--   - Secretos de las Edge Functions de esta instancia: POSTIZ_BASE_URL,
--     TENANT_ID, VRUTAL1ST_PUSH_URL, VRUTAL1ST_PUSH_TOKEN (el que entrega
--     staff_rotate_tenant_push_token en Vrutal1st).
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

create or replace function public.integration_read_secret(p_provider text)
returns text
language plpgsql security definer set search_path = public, vault, pg_temp as $f$
declare v_ref text; v_secret text;
begin
  select secret_ref into v_ref from public.integrations where provider = p_provider;
  if v_ref is null then
    return null;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_ref::uuid;
  return v_secret;
end $f$;

revoke all on function public.integration_read_secret(text) from public, anon, authenticated;
grant execute on function public.integration_read_secret(text) to service_role;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.integration_read_secret(text);
-- ---------------------------------------------------------------------
