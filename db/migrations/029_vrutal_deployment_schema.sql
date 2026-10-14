-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 029 · Prerrequisito real de la 022: el esquema `deployment` nunca se creó
--
-- Al intentar aplicar `022_vrutal_social_integrations.sql` (2026-10-11), Supabase devolvió
-- "schema deployment does not exist". Comprobado en vivo antes de asumir nada más: la
-- migración `002_vrutal_catalog_deployment.sql` (que crea el esquema `deployment` entero —
-- `tenant_integration`, `tenant_attribute`, la vista `v_tenant_profile`, el motor de reglas
-- `rule_matches`) **nunca se aplicó**, aunque el esquema `catalog` de esa misma 002 sí existe
-- (se aplicó parcialmente, en algún momento, sin dejar rastro de cuál parte). Ningún otro
-- código vivo depende hoy de `deployment.*` — solo lo necesitan 022/023, recién escritas.
--
-- Esta migración NO resucita la 002 completa (motor de reglas, vista de perfil, `tenant_
-- attribute`): nada lo llama, y traer de vuelta un subsistema entero sin que nadie lo haya
-- pedido no es parte de este arreglo. Solo crea lo mínimo que 022 necesita de verdad:
-- `deployment.tenant_integration`, con la misma forma exacta de la 002 (columna por columna,
-- `unique (tenant_id, system)` — lo que usa el `on conflict` de `social_integration_report`),
-- salvo `n8n_credential_ref`: n8n se descartó por Activepieces antes de que esta tabla
-- llegara a usarse nunca (ver Activepieces/flows/README.md) — no se repone una columna muerta.
-- =====================================================================

create schema if not exists deployment;

comment on schema deployment is
  'RAMAS. Instancias por tenant. Toda tabla lleva tenant_id y RLS.';

create table if not exists deployment.tenant_integration (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  system            text not null,          -- 'hubspot','linkedin-page','postiz', etc.
  category          text not null check (category in
                      ('crm','erp','ecommerce','ads','email','helpdesk','analytics','other')),
  status            text not null default 'connected'
                    check (status in ('connected','error','revoked')),
  connected_at      timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (tenant_id, system)
);

revoke all on deployment.tenant_integration from public, anon, authenticated;
grant all on deployment.tenant_integration to service_role;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop table deployment.tenant_integration;
--   drop schema deployment;
-- ---------------------------------------------------------------------
