-- =====================================================================
-- Vrutal 1st (apmhvqlvwjcrwfaixgju) · catálogo
-- MKT-F5: dos variantes del paso que observa a la competencia. Aplicada el 2026-10-20.
--
-- POR QUÉ ESTA MIGRACIÓN EXISTE. El paso «Consulta · páginas públicas de cada competidor» no
-- tenía herramienta decidida y llevaba meses como paso pendiente. La respuesta no es elegir una:
-- es que el mismo trabajo se puede hacer de tres maneras distintas según lo que el cliente tenga
-- y esté dispuesto a gastar, y eso es exactamente lo que el modelo de composición sirve para
-- guardar. Primera vez que se usa `applies_when`: hasta hoy los 66 slots lo tenían vacío y la
-- promesa de «una composición, varias opciones por stack» estaba sin estrenar (hallazgo H-14 de
-- la auditoría del 2026-10-16).
--
-- LAS DOS OPCIONES del slot `observa` — misma posición, mismo tipo, distinta condición:
--   {"competitor_watch": "http"}   (POR DEFECTO) GET a la web del competidor; el HTML crudo
--                                  alimenta el Ordena. Barato y predecible. Límite declarado:
--                                  una web por ejecución (no hay bucle) y no ejecuta JavaScript.
--   {"competitor_watch": "agent"}  Claude con las herramientas de servidor web_search_20260209 y
--                                  web_fetch_20260209: busca y visita él lo que necesite y cita
--                                  la fuente de cada dato. Más caro y de alcance variable.
--
-- El slot de la clave del Vault es `optional` y solo aplica a la variante de agente: la de HTTP
-- no llama a ningún modelo, así que no necesita clave.
--
-- LA TERCERA, prevista y sin construir: extracción con selectores (scraping de un precio concreto
-- en una página concreta). Cuando exista, es otra opción de este mismo slot, no otro flujo.
--
-- NACE EN DRAFT A PROPÓSITO: F5 no ha corrido nunca, así que no pasa la puerta de activación
-- («manda Activepieces»). Esto es la constancia de las dos versiones del flujo, no su
-- publicación. El slot `normalize` sigue apuntando a un bloque sin artefacto, que es lo otro que
-- falta para poder validarla.
--
-- Plantillas correspondientes en el repo: `MKT-F5_competidores/F5.template.json` (HTTP) y
-- `F5-agente.template.json`.
-- =====================================================================

insert into catalog.component (name, comp_type, kind, variant, owner, maturity) values
  ('Consulta · web del competidor (HTTP)',        'activepieces_piece', 'context', '{"mode": "http"}'::jsonb,  'Vrutal Labs', 'prototype'),
  ('Consulta · competidores (agente web)',        'activepieces_piece', 'context', '{"mode": "agent"}'::jsonb, 'Vrutal Labs', 'prototype')
on conflict do nothing;

insert into catalog.component_version (component_id, version, status, artifact_ref, consumes, changelog)
select c.id, 1, 'validated', 'piece:@activepieces/piece-http@0.11.19', '{}'::text[], v.changelog
  from (values
    ('Consulta · web del competidor (HTTP)',
     'v1: GET a la web del competidor de mayor prioridad y el HTML crudo al Ordena. Límite declarado: una web por ejecución (sin bucle) y sin JavaScript. Manda User-Agent propio.'),
    ('Consulta · competidores (agente web)',
     'v1: una llamada a la API de Anthropic con las herramientas de servidor web_search_20260209 y web_fetch_20260209 (max_uses 8, citations on). Claude elige qué visitar y cita la fuente de cada dato. Si la respuesta vuelve con stop_reason pause_turn, el Ordena falla en vez de entregar una ficha a medias.')
  ) as v(nombre, changelog)
  join catalog.component c on c.name = v.nombre
 where not exists (select 1 from catalog.component_version x where x.component_id = c.id and x.version = 1);

insert into catalog.task_composition (task_id, task_version, key, version, name, pattern, status, changelog)
select t.id, t.version, 'pipeline', 2, 'Ficha comparativa de competidores', 'AGENT', 'draft',
       'v2 (2026-10-20): fuera Google Sheets (lee los competidores de mkt_competitor, entrega la ficha como work_item y deja rastro en run_log) y el paso de observación pasa a tener DOS opciones por stack: HTTP (por defecto) o agente con búsqueda web. La v1 se queda en draft como registro de la época de Sheets.'
  from catalog.task t
 where t.task_code = 'TSK-000178'
   and not exists (select 1 from catalog.task_composition x where x.task_id = t.id and x.key = 'pipeline' and x.version = 2);

insert into catalog.task_composition_slot (composition_id, position, slot_key, kind, component_version_id, optional, applies_when, is_default)
select tc.id, s.position, s.slot_key, s.kind, cv.id, s.optional, s.applies_when::jsonb, s.is_default
  from catalog.task_composition tc
  join catalog.task t on t.id = tc.task_id and t.task_code = 'TSK-000178'
  join (values
    (1, 'intake',    'intake',    'Programación',                          1, false, '{}',                           false),
    (2, 'context',   'context',   'Lee de la tabla · VrutalOS',            1, false, '{}',                           false),
    (3, 'context_2', 'context',   'Consulta · clave del Vault',            1, true,  '{"competitor_watch": "agent"}', false),
    (4, 'observa',   'context',   'Consulta · web del competidor (HTTP)',  1, false, '{"competitor_watch": "http"}',  true),
    (4, 'observa',   'context',   'Consulta · competidores (agente web)',  1, false, '{"competitor_watch": "agent"}', false),
    (5, 'normalize', 'normalize', 'Ordena · a CompetitorCard',             1, false, '{}',                           false),
    (6, 'act',       'act',       'Escribe en la tabla · work_item',       1, false, '{}',                           false),
    (7, 'audit',     'audit',     'Deja rastro · run_log',                 1, false, '{}',                           false)
  ) as s(position, slot_key, kind, bloque, v, optional, applies_when, is_default) on true
  join catalog.component c on c.name = s.bloque
  join catalog.component_version cv on cv.component_id = c.id and cv.version = s.v
 where tc.key = 'pipeline' and tc.version = 2
   and not exists (select 1 from catalog.task_composition_slot x
                    where x.composition_id = tc.id and x.position = s.position and x.component_version_id = cv.id);

-- ---------------------------------------------------------------------
-- Para revertir (la composición v2 está en draft, así que se puede borrar tal cual):
--   delete from catalog.task_composition_slot where composition_id in (
--     select tc.id from catalog.task_composition tc join catalog.task t on t.id = tc.task_id
--      where t.task_code = 'TSK-000178' and tc.key = 'pipeline' and tc.version = 2);
--   delete from catalog.task_composition where key = 'pipeline' and version = 2
--     and task_id = (select id from catalog.task where task_code = 'TSK-000178');
--   select public.catalog_purge_orphan_blocks(false);  -- barre las dos versiones nuevas (pre-live)
-- ---------------------------------------------------------------------
