-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Qué proveedores puede conectar este cliente
--
-- Espejo de solo lectura de lo que Vrutal1st decidió para este cliente en su Stack
-- (`tenant_stack_choice` + `catalog.system_option.provider_key`, migración 028 de Vrutal1st).
-- Lo escribe el sync (`sync-catalog`, cada 15 min, D-06/D-19) — nunca el Admin ni el panel
-- de este cliente directamente. `providers.ts` (la lista de cómo pedir/validar cada clave)
-- sigue siendo código de aquí; esta tabla solo dice CUÁLES de esos proveedores están
-- habilitados para este cliente en concreto, así que IntegrationsPage.tsx filtra por ella
-- en vez de enseñar siempre la lista completa fija.
--
-- Migración 030 de Vrutal1st: el sync también LEE `public.integrations` de esta base (ya
-- existe, no se crea aquí) para reportar a Vrutal1st qué está configurado/validado de
-- verdad — por eso `vrutal_sync` necesita SELECT ahí también (ver el grant más abajo).
-- =====================================================================

create table if not exists public.integration_provider_ro (
  provider_key text primary key,
  system_category text not null,
  system_name text not null,
  synced_at timestamptz not null default now()
);

revoke all on public.integration_provider_ro from anon, authenticated;
grant select on public.integration_provider_ro to authenticated;
grant all on public.integration_provider_ro to service_role;
alter table public.integration_provider_ro enable row level security;
-- Sin política, RLS bloquea todo aunque el GRANT esté bien — detectado en vivo el 2026-10-11:
-- la tabla se creó, el sync escribía bien, pero el navegador veía cero filas. Misma forma que
-- ya usa catalog_flow_ro ("read_all_authenticated"): el filtro real es el GRANT, no la RLS.
create policy "read_all_authenticated" on public.integration_provider_ro for select to public using (true);
-- El sync escribe con una conexión Postgres directa como `vrutal_sync` (no `service_role` —
-- ese es el rol de la API, este el de la conexión cruda), el mismo rol que ya usan
-- catalog_flow_ro/catalog_report_ro/catalog_kpi_ro. Sin esto: "permission denied" en el sync,
-- detectado en vivo el 2026-10-11 al disparar sync-catalog a mano la primera vez.
grant select, insert, update, delete on public.integration_provider_ro to vrutal_sync;

-- Lectura de integrations para reportar estado a Vrutal1st (migración 030) — mismo motivo
-- que el grant de arriba, detectado en vivo el 2026-10-11 en el mismo disparo manual.
grant select on public.integrations to vrutal_sync;

-- ---------------------------------------------------------------------
-- Para revertir:
--   revoke select on public.integrations from vrutal_sync;
--   drop table public.integration_provider_ro;
-- ---------------------------------------------------------------------
