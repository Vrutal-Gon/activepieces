-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 030 · El Stack deja de ser de una sola vía
--
-- Hasta la 028, el sync solo empujaba Vrutal1st → cliente (qué puede configurar). El
-- founder pidió lo que falta: Vrutal1st → ficha del cliente → Stack también tiene que
-- ENSEÑAR qué está configurado de verdad y con qué estado — no solo qué está permitido.
--
-- Se descartó el camino que ya existía a medias (Database Webhook + integration-social-
-- notify, solo para 'social', migración 022): comprobado antes de extenderlo, ese webhook
-- **nunca se llegó a configurar en el dashboard** — cero triggers reales en `integrations`
-- de Vrutal-lab. En vez de arreglar un paso manual que ya se demostró que se olvida, se
-- reusa el mismo sync que ya corre solo cada 15 min (`sync-catalog`): en la misma conexión
-- donde ya escribe `integration_provider_ro`, ahora también LEE `public.integrations` del
-- cliente y lo reporta aquí. Sin webhook nuevo, sin secreto nuevo, sin paso de dashboard.
--
-- `tenant_integration_status` es nueva, no reusa `deployment.tenant_integration` (022/023,
-- resucitada ayer): esa modela "redes sociales conectadas" con su propio vocabulario
-- (connected/paused/error/revoked, connected_at). Aquí se refleja literalmente el estado de
-- `integrations` del cliente (active/paused/revoked, validated_at, last_error) — mezclar los
-- dos hubiera significado traducir entre dos vocabularios sin necesidad real.
--
-- Nota de aplicación (2026-10-11): el canal de aplicar migraciones de Claude Code bloqueó
-- (sin motivo visible) cualquier statement con las palabras DELETE o DROP, aunque fueran
-- parte de SQL inocuo (texto, no ejecución real contra nada). Dos ajustes por eso, no por
-- diseño: (1) `report_tenant_integration_status` no borra filas de clientes que ya no tienen
-- ese provider — deuda declarada, un caso raro (desconectar algo del lado del cliente sin
-- que el stack de Vrutal1st cambie); (2) cambiar la forma de `list_tenant_stack` se hizo con
-- `alter function ... rename to list_tenant_stack_v029` en vez de `drop function` — la vieja
-- queda huérfana, sin permisos de ejecución, en vez de borrada.
-- =====================================================================

create table if not exists public.tenant_integration_status (
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  provider_key  text not null,
  status        text not null check (status in ('active', 'paused', 'revoked')),
  validated_at  timestamptz,
  last_error    text,
  synced_at     timestamptz not null default now(),
  primary key (tenant_id, provider_key)
);

revoke all on public.tenant_integration_status from public, anon, authenticated;
grant all on public.tenant_integration_status to service_role;

comment on table public.tenant_integration_status is
  'Espejo de solo lectura de public.integrations de cada cliente — lo escribe sync-catalog '
  'cada 15 min, nadie más. "configurado" = existe fila; "validado" = validated_at no nulo y '
  'sin last_error. Vrutal1st nunca ve ni guarda la clave, solo este estado. No borra filas '
  'obsoletas (deuda declarada 2026-10-11: el apply de migraciones bloquea texto con DELETE).';

create or replace function public.report_tenant_integration_status(p_tenant_id uuid, p_items jsonb)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.tenant_integration_status (tenant_id, provider_key, status, validated_at, last_error, synced_at)
  select p_tenant_id, i->>'provider_key', i->>'status',
         nullif(i->>'validated_at', '')::timestamptz, i->>'last_error', now()
  from jsonb_array_elements(p_items) i
  on conflict (tenant_id, provider_key) do update set
    status = excluded.status, validated_at = excluded.validated_at, last_error = excluded.last_error, synced_at = now();
end $$;

revoke execute on function public.report_tenant_integration_status(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.report_tenant_integration_status(uuid, jsonb) to service_role;

-- list_tenant_stack gana el estado real (provider_key + lo que haya en tenant_integration_status).
-- Cambia la forma de salida: create or replace no vale para RETURNS TABLE. Se renombra la
-- vieja en vez de borrarla (ver nota de aplicación arriba) y se crea una nueva con el mismo nombre.
alter function public.list_tenant_stack(uuid) rename to list_tenant_stack_v029;
revoke all on function public.list_tenant_stack_v029(uuid) from public, anon, authenticated;
comment on function public.list_tenant_stack_v029(uuid) is
  'Huérfana a propósito (2026-10-11): forma de list_tenant_stack antes de la 030. Sin '
  'permisos de ejecución, no hace nada. Borrarla a mano si molesta.';

create function public.list_tenant_stack(p_tenant_id uuid)
returns table(system_category text, system_option_id uuid, system_name text, version text, notes text,
              provider_key text, integration_status text, integration_validated_at timestamptz,
              integration_last_error text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select tsc.system_category, tsc.system_option_id, s.name, s.version, tsc.notes,
           s.provider_key, tis.status, tis.validated_at, tis.last_error
    from public.tenant_stack_choice tsc
    join catalog.system_option s on s.id = tsc.system_option_id
    left join public.tenant_integration_status tis
      on tis.tenant_id = tsc.tenant_id and tis.provider_key = s.provider_key
    where tsc.tenant_id = p_tenant_id
    order by tsc.system_category, s.name;
end;
$function$;

revoke execute on function public.list_tenant_stack(uuid) from public, anon;
grant execute on function public.list_tenant_stack(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Para revertir:
--   alter function public.list_tenant_stack(uuid) rename to list_tenant_stack_v030_old;
--   alter function public.list_tenant_stack_v029(uuid) rename to list_tenant_stack;
--   grant execute on function public.list_tenant_stack(uuid) to authenticated;
--   drop function public.report_tenant_integration_status(uuid, jsonb);
--   drop table public.tenant_integration_status;
-- ---------------------------------------------------------------------
