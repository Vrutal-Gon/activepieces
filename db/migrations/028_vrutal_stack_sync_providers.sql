-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 028 · El Stack de un cliente decide qué puede pegar en VrutalOS
--
-- Corrige el diseño real: hasta ahora, habilitar un sistema en el Stack de un cliente
-- (`tenant_stack_choice`, migración 026) no tenía ningún efecto fuera de Vrutal1st — era
-- solo una ficha informativa. El founder señaló el caso concreto: Anthropic aparece en
-- VrutalOS → Integraciones (lista fija en `providers.ts`) da igual lo que diga el Stack del
-- cliente en Vrutal1st, y arreglarlo "a mano" (una migración por cliente) no es la solución
-- — tiene que viajar por el sync que ya existe de verdad (`sync-catalog-to-clients` cada 15
-- min, Edge Function `sync-catalog` en este proyecto, D-06/D-19), el mismo que ya empuja
-- flows/reports/kpis a cada base de cliente. No estaba documentado en ninguna migración
-- trackeada (comprobado antes de tocarlo, vía MCP): `get_tenant_sync_payload` y la propia
-- Edge Function solo llevaban `flows`/`reports`/`kpis`, nada de `stack`.
--
-- No todas las categorías del Stack tienen sentido aquí (CRM/ERP son solo informativos,
-- para elegir la variante de componente de una tarea — no hay ningún sitio en VrutalOS
-- donde pegar una clave de SAP). Por eso `system_option` gana `provider_key`: solo se
-- sincroniza — y solo aparece como opción en VrutalOS → Integraciones — el sistema que
-- además de estar en el Stack del cliente tiene un `provider_key` que coincide con un
-- proveedor real ya construido ahí (`hubspot`, `anthropic` hoy). "Deepseek"/"Open AI" que
-- el founder ya añadió al Stack de Vrutal-lab se quedan sin sincronizar hasta que exista un
-- proveedor de verdad para ellos en VrutalOS — no se inventa la integración aquí.
-- =====================================================================

alter table catalog.system_option add column if not exists provider_key text;

update catalog.system_option set provider_key = 'hubspot'
where provider_key is null and system_category = 'crm' and name = 'HubSpot CRM';

insert into catalog.system_option (system_category, name, version, connection_notes, docs_url, provider_key)
select 'llm', 'Anthropic', null,
       'Clave de API, la pega el Admin del cliente en VrutalOS → Integraciones (vive en su Vault, nunca en Vrutal1st).',
       'https://docs.anthropic.com/', 'anthropic'
where not exists (
  select 1 from catalog.system_option where system_category = 'llm' and name = 'Anthropic'
);

update catalog.system_option set provider_key = 'anthropic'
where provider_key is null and system_category = 'llm' and name = 'Anthropic';

create or replace function public.catalog_create_system_option(
  p_system_category text, p_name text, p_version text default null, p_connection_notes text default null,
  p_docs_url text default null, p_provider_key text default null
)
returns uuid
language plpgsql security definer set search_path = public, catalog, pg_temp as $function$
declare
  v_id uuid;
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  insert into catalog.system_option (system_category, name, version, connection_notes, docs_url, provider_key)
  values (p_system_category, p_name, p_version, p_connection_notes, p_docs_url, p_provider_key)
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.catalog_update_system_option(
  p_id uuid, p_system_category text, p_name text, p_version text default null, p_connection_notes text default null,
  p_docs_url text default null, p_provider_key text default null
)
returns void
language plpgsql security definer set search_path = public, catalog, pg_temp as $function$
begin
  if not is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  update catalog.system_option set
    system_category = p_system_category,
    name = p_name,
    version = p_version,
    connection_notes = p_connection_notes,
    docs_url = p_docs_url,
    provider_key = p_provider_key
  where id = p_id;
end;
$function$;

-- Gana una columna de salida: create or replace no vale para RETURNS TABLE, hace falta
-- drop (y volver a conceder el grant, que el drop se lleva).
drop function public.catalog_list_system_options(text);

create function public.catalog_list_system_options(p_category text default null)
returns table(id uuid, system_category text, name text, version text, connection_notes text, docs_url text, provider_key text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $function$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
    select s.id, s.system_category, s.name, s.version, s.connection_notes, s.docs_url, s.provider_key
    from catalog.system_option s
    where p_category is null or s.system_category = p_category
    order by s.system_category, s.name;
end;
$function$;

revoke execute on function public.catalog_list_system_options(text) from public, anon;
grant execute on function public.catalog_list_system_options(text) to authenticated;

-- Sync: añade 'stack' al payload que ya recibe cada cliente cada 15 min. Solo las filas con
-- provider_key — el resto del Stack (CRM, ERP…) no tiene nada que sincronizar hacia VrutalOS.
create or replace function public.get_tenant_sync_payload(p_tenant_id uuid)
returns jsonb
language sql security definer set search_path = public, catalog, pg_temp as $function$
  select jsonb_build_object(
    'flows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job_role_key', ts.job_role_key,
        'task_code', t.task_code,
        'task_version', t.version,
        'statement', t.statement,
        'autonomy_level', tsf.autonomy_level,
        'status', tsf.status
      ))
      from public.tenant_specialist_flow tsf
      join public.tenant_specialist ts on ts.id = tsf.tenant_specialist_id
      join catalog.task t on t.id = tsf.task_id
      where ts.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job_role_key', tre.job_role_key,
        'report_key', tre.report_key,
        'name', rd.name,
        'description', rd.description,
        'status', tre.status
      ))
      from public.tenant_report_enablement tre
      join public.tenant_specialist ts on ts.id = tre.tenant_specialist_id
      join catalog.report_definition rd on rd.job_role_key = tre.job_role_key and rd.key = tre.report_key
      where ts.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'kpis', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job_role_key', tke.job_role_key,
        'report_key', kd.report_key,
        'kpi_key', tke.kpi_key,
        'name', kd.name,
        'explanation', kd.explanation,
        'status', tke.status
      ))
      from public.tenant_kpi_enablement tke
      join public.tenant_specialist ts on ts.id = tke.tenant_specialist_id
      join catalog.kpi_definition kd on kd.job_role_key = tke.job_role_key and kd.key = tke.kpi_key
      where ts.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'stack', coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider_key', so.provider_key,
        'system_category', tsc.system_category,
        'system_name', so.name
      ))
      from public.tenant_stack_choice tsc
      join catalog.system_option so on so.id = tsc.system_option_id
      where tsc.tenant_id = p_tenant_id and so.provider_key is not null
    ), '[]'::jsonb)
  );
$function$;

-- ---------------------------------------------------------------------
-- Para revertir:
--   create or replace function public.get_tenant_sync_payload(uuid) ... (quitar la clave 'stack', ver 019/022 para la forma anterior)
--   drop function public.catalog_list_system_options(text);
--   create function public.catalog_list_system_options(text) ... (ver forma de antes de la 028, sin provider_key)
--   grant execute on function public.catalog_list_system_options(text) to authenticated;
--   create or replace function public.catalog_create_system_option(...) sin p_provider_key
--   create or replace function public.catalog_update_system_option(...) sin p_provider_key
--   alter table catalog.system_option drop column provider_key;
-- ---------------------------------------------------------------------
