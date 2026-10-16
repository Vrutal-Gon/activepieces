-- =====================================================================
-- ⛔ MIGRACIÓN REVERTIDA POR LA 036 (2026-10-16). NO APLICAR.
--
-- Fue un error: creó una tarea con `task_code = 'VRL-MKT-C03'`, violando la convención
-- documentada en `docs/arquitectura/VRUTAL_OS_Modelo_Datos_Roles_Tareas.md:156` — el
-- `task_code` es opaco (`TSK-NNNNNN`) y los códigos semánticos están prohibidos porque
-- obligan a renumerar cuando se reorganiza la taxonomía.
--
-- Y era innecesaria: `TSK-001300` ya existía desde la 020, con `source_code = 'VRL-MKT-C03'`
-- y la misma ficha. El diagnóstico de abajo («cero tareas VRL-% de 1.093») es FALSO: se buscó
-- en `task_code` cuando el código Vrutal vive en `source_code`, igual que los de O*NET y APQC.
-- Lo único que faltaba era habilitarla en `tenant_specialist_flow`.
--
-- Se conserva el fichero a propósito: el rastro del error es parte del registro.
-- Lo que sigue queda solo como documentación de lo que se hizo mal.
-- =====================================================================

-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · Migración 033 · Crear la tarea VRL-MKT-C03 (la de MKT-F2)
--
-- Hueco encontrado el 2026-10-15 al ir a construir el paso «Pide permiso» de MKT-F2:
-- `VRL-MKT-C03` **no existía en `catalog.task`**. Tampoco `VRL-MKT-A01`, `VRL-MKT-A02`,
-- `VRL-MKT-C01` ni `VRL-MKT-C02`: cero tareas `VRL-%` de 1.093. Las cinco tareas propias de
-- Vrutal (las que no vienen de O*NET/ESCO/APQC) se diseñaron en los diagramas y nunca se
-- crearon en el catálogo.
--
-- Por qué bloqueaba de verdad y no era cosmético: en la base del cliente,
-- `approval_requests` tiene clave foránea `(specialist_id, task_key)` →
-- `catalog_flow_ro(specialist_id, task_key)`. Con un `task_key` que no está sincronizado,
-- `approval-create` **falla por integridad referencial**. El paso habría reventado en la
-- primera ejecución, no al construirlo.
--
-- Esta migración crea SOLO `VRL-MKT-C03`, la que necesita F2. Las otras cuatro se crearán
-- cuando se construya su flujo: no se adelantan.
--
-- Valores y de dónde salen:
--   · `source = 'internal'` — es tarea propia de Vrutal, no importada.
--   · `source_code = 'C6'` — su código en el diseño («C6 VRL-MKT-C03»).
--   · `process_id = 'mkt_distribucion'` — dominio Marketing, proceso Distribución.
--   · `primary_pattern = 'API'` — el flujo publica llamando a la API de Postiz.
--   · `risk = 'medium_high'`, `reversible = false`, `customer_facing = true`,
--     `effect_classification = 'irreversible'` — el README de F2 la llama «la primera acción
--     irreversible del sistema»: una publicación en LinkedIn no se deshace.
--   · `criticality = 'core'` — publicar es central para `content_promotion`.
--   · `requires_approval = true` y autonomía `execute_with_approval` en el tenant.
--   · `time_weight_pct` se deja NULL: se mide en auditoría real, no se estima.
--
-- `status = 'draft'` A PROPÓSITO: el founder no ha revisado la ficha. Mismo patrón que F4.
-- El sync NO filtra por `catalog.task.status` (comprobado en `get_tenant_sync_payload`), así
-- que una tarea en draft sí llega a `catalog_flow_ro` y F2 puede funcionar. Promoverla a
-- `validated` es decisión del founder, no de esta migración.
-- =====================================================================

insert into catalog.task (
  task_code, source, source_code, statement, process_id, language,
  primary_pattern, risk, reversible, requires_approval,
  touches_budget, customer_facing, status
)
values (
  'VRL-MKT-C03', 'internal', 'C6',
  'Programar la publicación de un post en LinkedIn en la fecha aprobada.',
  'mkt_distribucion', 'es',
  'API', 'medium_high', false, true,
  false, true, 'draft'
)
on conflict (task_code, version) do nothing;

insert into catalog.job_role_task (job_role_id, task_id, criticality, effect_classification)
select jr.id, t.id, 'core', 'irreversible'
from catalog.job_role jr,
     catalog.task t
where jr.key = 'content_promotion'
  and jr.version = (select max(version) from catalog.job_role where key = 'content_promotion')
  and t.task_code = 'VRL-MKT-C03'
on conflict (job_role_id, task_id) do nothing;

insert into public.tenant_specialist_flow (tenant_specialist_id, task_id, autonomy_level, status)
select ts.id, t.id, 'execute_with_approval', 'enabled'
from public.tenant_specialist ts
join catalog.task t on t.task_code = 'VRL-MKT-C03'
where ts.job_role_key = 'content_promotion'
  and ts.status = 'contracted'
on conflict (tenant_specialist_id, task_id) do nothing;

-- ---------------------------------------------------------------------
-- Para revertir (en este orden, por las claves foráneas):
--   delete from public.tenant_specialist_flow
--    where task_id = (select id from catalog.task where task_code = 'VRL-MKT-C03');
--   delete from catalog.job_role_task
--    where task_id = (select id from catalog.task where task_code = 'VRL-MKT-C03');
--   delete from catalog.task where task_code = 'VRL-MKT-C03';
--   (y antes de borrarla, comprobar que ninguna `approval_requests` de ningún cliente la
--    referencia ya: el sync la habrá copiado a `catalog_flow_ro`)
-- ---------------------------------------------------------------------
