-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · Migración 036 · Revierte la 033 y habilita TSK-001300
--
-- La 033 fue un error. Creó una tarea con `task_code = 'VRL-MKT-C03'`, violando la convención
-- documentada en `docs/arquitectura/VRUTAL_OS_Modelo_Datos_Roles_Tareas.md:156`:
--
--   «Nota sobre task_code. Opaco y secuencial a propósito. Un código semántico tipo
--    SALES-DISC-004 obliga a renumerar cuando reorganizas la taxonomía, y la taxonomía se
--    reorganizará. La legibilidad la da slug; la identidad la da el código.»
--
-- El coste ya se había materializado antes de detectarlo: la migración 035 existe porque un
-- `task_code` semántico cae al final del orden de la lista (que ordena por proceso y luego
-- por código), y hubo que añadir el filtro de Estado para compensarlo.
--
-- Y LA TAREA ERA INNECESARIA. `TSK-001300` ya existía desde la migración 020, con
-- `source_code = 'VRL-MKT-C03'`, enlazada a `content_promotion`, y con exactamente la misma
-- ficha que la 033 "decidió": `mkt_distribucion`, `API`, `medium_high`, `core`,
-- `irreversible`. El diagnóstico de la 033 («cero tareas VRL-% de 1.093») era un artefacto de
-- buscar en `task_code` cuando la convención guarda ese código en `source_code` — que es el
-- mismo hueco donde viven `13-1161.00.5441` de O*NET o `3.4.3.2` de APQC.
--
-- Lo único que de verdad faltaba era habilitarla en `tenant_specialist_flow`: ninguna de las
-- tres tareas internas de `content_promotion` (TSK-001298/299/300) lo estaba.
--
-- `VRL-` nunca fue una decisión de nomenclatura. Nació el 2026-10-01 en
-- `docs/producto/MARKETING_roles_propuesta_v0.1.md` como marcador «NEW VRL-MKT-A01» = «tarea
-- nueva, aún sin código», y se consolidó al perder el «NEW» en los diagramas de flujos. La
-- 020 lo trató bien; la 033 lo ascendió a identidad.
--
-- Comprobado antes de borrar: las dos filas de `approval_requests` del cliente usan
-- `TSK-000010`, ninguna referencia a `VRL-MKT-C03`.
--
-- El sync pondrá la fila `VRL-MKT-C03` de `catalog_flow_ro` del cliente en `disabled`
-- (borrado suave, comportamiento esperado del sync) y creará la de `TSK-001300`.
-- =====================================================================

-- 1 · Retirar el duplicado, en orden de clave foránea.
delete from public.tenant_specialist_flow
 where task_id = (select id from catalog.task where task_code = 'VRL-MKT-C03');

delete from catalog.job_role_task
 where task_id = (select id from catalog.task where task_code = 'VRL-MKT-C03');

delete from catalog.task where task_code = 'VRL-MKT-C03';

-- 2 · Habilitar la que ya existía. Es lo que debió hacerse desde el principio.
insert into public.tenant_specialist_flow (tenant_specialist_id, task_id, autonomy_level, status)
select ts.id, t.id, 'execute_with_approval', 'enabled'
from public.tenant_specialist ts
join catalog.task t on t.task_code = 'TSK-001300'
where ts.job_role_key = 'content_promotion'
  and ts.status = 'contracted'
on conflict (tenant_specialist_id, task_id) do nothing;

-- ---------------------------------------------------------------------
-- Comprobación. Tiene que dar: vrl_en_task_code = 0, tsk001300_habilitada = 1.
-- ---------------------------------------------------------------------
select (select count(*) from catalog.task where task_code like 'VRL-%') as vrl_en_task_code,
       (select count(*) from public.tenant_specialist_flow tsf
          join catalog.task t on t.id = tsf.task_id
         where t.task_code = 'TSK-001300' and tsf.status = 'enabled') as tsk001300_habilitada;

-- ---------------------------------------------------------------------
-- No se revierte. Volver a crear un task_code semántico repetiría el error.
-- Si alguna vez hace falta una variante de TSK-001300, el camino es una VERSIÓN nueva
-- (misma `task_code`, `version` + 1), que es lo que describe el modelo de datos en sus
-- líneas 478-480 — y que todavía no tiene RPC: no existe `catalog_new_task_version`.
-- ---------------------------------------------------------------------
