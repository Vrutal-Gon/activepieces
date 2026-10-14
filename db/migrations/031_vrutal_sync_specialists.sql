-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · El sync también crea los especialistas en la base del cliente
--
-- Hueco encontrado el 2026-10-13: los tres especialistas de Marketing llevaban contratados
-- en `tenant_specialist` desde el 2026-10-09 y NUNCA habían bajado a la base del cliente.
-- `get_tenant_sync_payload` solo llevaba flows/reports/kpis/stack, y `sync-catalog` resuelve
-- el especialista de cada flujo con `select id from specialists where job_role_key in (...)`
-- — los BUSCA, no los crea. Resultado: los flujos de un especialista que no existe en el
-- cliente se descartaban EN SILENCIO al sincronizar, así que `catalog_flow_ro` estaba vacío
-- para Marketing y la ficha del cliente no mostraba el departamento aunque los flujos ya
-- corrieran en Activepieces. Las filas de `sdr` y `data_entry_clerk` se habían puesto a mano
-- al aprovisionar, y por eso el problema no se había visto antes.
--
-- También bloqueaba el paso «Pide permiso» de los flujos: `approval_requests.specialist_id`
-- es NOT NULL, así que sin esas filas no se puede crear ninguna aprobación.
--
-- Qué cambia: `get_tenant_sync_payload` gana la clave 'specialists'. El upsert en la base del
-- cliente lo hace `sync-catalog` (Edge Function), igual que el resto del payload.
--
-- Mapeo de estado, porque los dos lados no usan los mismos valores:
--   tenant_specialist (aquí)   →  specialists (cliente)
--   contracted                 →  active
--   paused                     →  paused
--   cancelled                  →  retired
--
-- Lo que NO se sincroniza, a propósito:
--   · `autonomy_level`: aquí la autonomía es POR FLUJO (`tenant_specialist_flow`), no por
--     especialista. El cliente tiene una columna por especialista con otro significado; se
--     deja su valor por defecto y el sync no la toca.
--   · `phase`: es el ciclo de vida del especialista en casa del cliente (01_AUDIT…05_LIVE),
--     no una decisión del plano de control.
-- =====================================================================

-- `sync-catalog` vuelca el objeto `counts` entero en el registro del sync
-- (`Object.assign(logRow, { ...counts })`), así que cada contador nuevo necesita su columna
-- o el INSERT en `sync_run_log` falla. Ya pasó con `stack_upserted` el 2026-10-11.
alter table public.sync_run_log
  add column if not exists specialists_upserted int;

create or replace function public.get_tenant_sync_payload(p_tenant_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public', 'catalog', 'pg_temp'
as $function$
  select jsonb_build_object(
    'specialists', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job_role_key', ts.job_role_key,
        'job_role_version', ts.job_role_version,
        'display_name', jr.name,
        'risk_level', jr.risk_level,
        'status', case ts.status
                    when 'contracted' then 'active'
                    when 'paused'     then 'paused'
                    when 'cancelled'  then 'retired'
                  end
      ))
      from public.tenant_specialist ts
      join catalog.job_role jr
        on jr.key = ts.job_role_key
       and jr.version = ts.job_role_version
      where ts.tenant_id = p_tenant_id
    ), '[]'::jsonb),
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
-- Para revertir: volver a crear la función sin la clave 'specialists' (ver la 028, que es
-- la versión anterior de esta misma función). Las filas ya creadas en la base del cliente
-- no se van solas: eso es deliberado, quitarlas dejaría huérfanas sus aprobaciones.
-- ---------------------------------------------------------------------
