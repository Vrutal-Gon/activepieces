-- =====================================================================
-- Vrutal 1st (apmhvqlvwjcrwfaixgju) · catálogo
-- MKT-F4 deja Google Sheets: el catálogo pasa a describir lo que de verdad corre.
-- Aplicada el 2026-10-19.
--
-- El flujo se ejecutó entero contra VrutalOS: 55 filas en `work_item` (colección `keywords`,
-- estado `proposed`) y una fila en `run_log` con 1.134/5.674 tokens. La composición del
-- catálogo, en cambio, seguía describiendo la versión de Google Sheets. Esto la pone al día y,
-- como el flujo cumple la puerta de activación, lo pasa todo a su estado activo.
--
-- PUERTA DE ACTIVACIÓN (regla del 2026-10-16, «manda Activepieces»): publicado + habilitado +
-- sin pasos stub + al menos una ejecución SUCCEEDED contra VrutalOS + task_code en el catálogo
-- + slots que cuadran con la versión publicada. F4 cumple las seis.
--
-- TRES DECISIONES QUE EXPLICAN LA FORMA DE ESTE FICHERO:
--
-- 1. La composición no se reescribe: nace su **v2**. La v1 se queda en draft como registro de
--    la época de Sheets. Para eso están las versiones, y así no se borra historia. (Además, el
--    permiso automático del MCP bloquea los DELETE contra la base, lo que empujó a la solución
--    correcta.)
-- 2. Las comprobaciones de `catalog_check_composition` van escritas aquí en SQL. Esa función
--    exige `is_platform_admin()` y este fichero se aplica sin sesión de panel. Son las mismas
--    reglas: sin slots, opciones del mismo slot con distinta posición o tipo, bloques no
--    validados, y contratos consumidos que ningún slot anterior produce.
-- 3. `component_version.consumes` lleva **claves de contrato**, no prosa. La respuesta de la API
--    de Anthropic no es un contrato del catálogo, así que el bloque Code la declara vacía y el
--    detalle queda en su changelog. Con texto libre, la comprobación lo leería como un contrato
--    que nadie produce y la composición no se podría publicar nunca.
--
-- Reversible: ver bloque al final.
-- =====================================================================

-- 1 · Contratos que el flujo produce de verdad.
update catalog.contract set status = 'validated' where key = 'KeywordSet' and version = 1 and status = 'draft';
update catalog.contract set status = 'validated' where key = 'RunRecord'  and version = 1 and status = 'draft';

-- 2 · Los cinco bloques nuevos. Todos son el mismo piece HTTP: lo que cambia es qué hacen y
--     contra qué hablan, que es justo lo que el catálogo tiene que saber.
insert into catalog.component (name, comp_type, kind, variant, owner, maturity) values
  ('Lee de la tabla · VrutalOS',      'activepieces_piece', 'context', '{"source": "vrutalos"}'::jsonb,          'Vrutal Labs', 'tested'),
  ('Consulta · clave del Vault',      'activepieces_piece', 'context', '{"source": "vault"}'::jsonb,             'Vrutal Labs', 'tested'),
  ('Decide · por API (Claude)',       'activepieces_piece', 'decide',  '{"llm": "claude", "via": "api"}'::jsonb, 'Vrutal Labs', 'tested'),
  ('Escribe en la tabla · work_item', 'activepieces_piece', 'act',     '{"sink": "vrutalos"}'::jsonb,            'Vrutal Labs', 'tested'),
  ('Deja rastro · run_log',           'activepieces_piece', 'audit',   '{"sink": "vrutalos"}'::jsonb,            'Vrutal Labs', 'tested')
on conflict do nothing;

insert into catalog.component_version (component_id, version, status, artifact_ref, output_contract_key, output_contract_version, consumes, changelog)
select c.id, 1, 'validated', 'piece:@activepieces/piece-http@0.11.19', v.contrato, v.contrato_v, v.consume, v.changelog
  from (values
    ('Lee de la tabla · VrutalOS',      null::text,  null::int, '{}'::text[],           'v1: lee un bloque del scope de negocio del cliente por flow-input-read (lista de orígenes cerrada). Sustituye a «Lee de la hoja».'),
    ('Consulta · clave del Vault',      null,        null,      '{}'::text[],           'v1: pide a integration-get-key la clave de un proveedor de la lista blanca. La clave nunca se escribe en el flujo.'),
    ('Decide · por API (Claude)',       null,        null,      '{}'::text[],           'v1: llama a la API de Anthropic por HTTP. Sustituye a la pieza piece-claude, que devuelve solo content[0].text y se queda vacía con los modelos actuales.'),
    ('Escribe en la tabla · work_item', null,        null,      '{KeywordSet}'::text[], 'v1: entrega filas por work-items-write; nacen proposed o delivered según la colección. Sustituye a «Escribir en la hoja».'),
    ('Deja rastro · run_log',           'RunRecord', 1,         '{}'::text[],           'v1: deja la ejecución en run_log con resultado, detalle y tokens. Sustituye a la pestaña Rastro.')
  ) as v(nombre, contrato, contrato_v, consume, changelog)
  join catalog.component c on c.name = v.nombre
 where not exists (select 1 from catalog.component_version x where x.component_id = c.id and x.version = 1);

-- 3 · El bloque Code, versión 3: el código que corre hoy. Publicado en el repo privado como
--     commit a42806c (sha256 del blob normalizado a LF). La v2 queda intacta: lo publicado no
--     se toca, se versiona.
insert into catalog.component_version (component_id, version, status, artifact_ref, artifact_sha256, output_contract_key, output_contract_version, consumes, changelog)
select c.id, 3, 'validated',
       'git:Vrutal-Gon/VrutalOS:activepieces/flows/MKT-F4/ordena-keywordset.step.ts@a42806c49d4a5123de6e4c8b7be4c9a5de90a8f6',
       '0975e0554c168292072146a4eb3b2a190eb1b00b0c64a894f713a73b618d31ca',
       'KeywordSet', 1, '{}'::text[],
       'v3: recibe la respuesta entera de la API de Anthropic (no un texto) y coge todos sus bloques de texto, no el primero; deja de emitir `estado`, que ahora es work_item.status, y devuelve tokens_in/tokens_out para run_log.'
  from catalog.component c
 where c.name = 'Ordena · a KeywordSet'
   and not exists (select 1 from catalog.component_version x where x.component_id = c.id and x.version = 3);

-- 4 · La composición v2, con los siete pasos que de verdad corren.
insert into catalog.task_composition (task_id, task_version, key, version, name, pattern, status, changelog)
select t.id, t.version, 'pipeline', 2, 'Keywords por dolor de ICP', 'LLM', 'draft',
       'v2 (2026-10-19): el flujo deja Google Sheets. Lee el ICP de mkt_input_value por flow-input-read, llama a la API de Anthropic por HTTP (la pieza piece-claude devolvía vacío), entrega las keywords como work_item proposed y deja rastro en run_log con tokens. Probada de punta a punta: 55 filas y 1.134/5.674 tokens. La v1 se queda en draft como registro de la época de Google Sheets.'
  from catalog.task t
 where t.task_code = 'TSK-000161'
   and not exists (select 1 from catalog.task_composition x where x.task_id = t.id and x.key = 'pipeline' and x.version = 2);

insert into catalog.task_composition_slot (composition_id, position, slot_key, kind, component_version_id, optional, applies_when, is_default)
select tc.id, s.position, s.slot_key, s.kind, cv.id, false, '{}'::jsonb, false
  from catalog.task_composition tc
  join catalog.task t on t.id = tc.task_id and t.task_code = 'TSK-000161'
  join (values
    (1, 'intake',    'intake',    'Programación',                    1),
    (2, 'context',   'context',   'Lee de la tabla · VrutalOS',      1),
    (3, 'context_2', 'context',   'Consulta · clave del Vault',      1),
    (4, 'decide',    'decide',    'Decide · por API (Claude)',       1),
    (5, 'normalize', 'normalize', 'Ordena · a KeywordSet',           3),
    (6, 'act',       'act',       'Escribe en la tabla · work_item', 1),
    (7, 'audit',     'audit',     'Deja rastro · run_log',           1)
  ) as s(position, slot_key, kind, bloque, v) on true
  join catalog.component c on c.name = s.bloque
  join catalog.component_version cv on cv.component_id = c.id and cv.version = s.v
 where tc.key = 'pipeline' and tc.version = 2
   and not exists (select 1 from catalog.task_composition_slot x where x.composition_id = tc.id and x.position = s.position);

-- 5 · Comprobar y publicar. Si algo no cuadra, esta migración falla aquí y no valida nada.
do $$
declare v_id uuid; n int; msg text;
begin
  select tc.id into v_id
    from catalog.task_composition tc join catalog.task t on t.id = tc.task_id
   where t.task_code = 'TSK-000161' and tc.key = 'pipeline' and tc.version = 2;

  if not exists (select 1 from catalog.task_composition_slot s where s.composition_id = v_id) then
    raise exception 'La composición no tiene slots.';
  end if;

  if exists (
    select 1 from catalog.task_composition_slot s where s.composition_id = v_id
     group by s.slot_key having count(distinct s.position) > 1 or count(distinct s.kind) > 1
  ) then
    raise exception 'Hay opciones del mismo slot con distinta posición o tipo.';
  end if;

  select count(*) into n
    from catalog.task_composition_slot s
    join catalog.component_version cv on cv.id = s.component_version_id
   where s.composition_id = v_id and cv.status <> 'validated';
  if n > 0 then
    raise exception '% slot(s) apuntan a una versión de bloque que no está validated.', n;
  end if;

  select string_agg(distinct x.consumido, ', ') into msg
    from (
      select unnest(cv.consumes) as consumido, s.position
        from catalog.task_composition_slot s
        join catalog.component_version cv on cv.id = s.component_version_id
       where s.composition_id = v_id
    ) x
   where not exists (
     select 1 from catalog.task_composition_slot s2
       join catalog.component_version cv2 on cv2.id = s2.component_version_id
      where s2.composition_id = v_id and s2.position < x.position
        and cv2.output_contract_key = x.consumido
   );
  if msg is not null then
    raise exception 'Se consume sin que ningún slot anterior lo produzca: %', msg;
  end if;

  update catalog.task_composition set status = 'validated' where id = v_id and status = 'draft';
end $$;

-- 6 · La tarea y el rol. A partir de aquí el enunciado de la tarea queda bloqueado.
update catalog.task set status = 'validated' where task_code = 'TSK-000161' and status = 'draft';
update catalog.job_role set status = 'active', updated_at = now() where key = 'search_marketing' and status = 'draft';

-- ---------------------------------------------------------------------
-- Para revertir:
--   update catalog.job_role set status = 'draft' where key = 'search_marketing';
--   update catalog.task set status = 'draft' where task_code = 'TSK-000161';
--   -- La composición v2 y las versiones publicadas solo las devuelve a draft un superadmin
--   -- (trigger guard_published_immutable): hay que pasar por catalog_set_*_status con esa
--   -- sesión. La v1 sigue en draft, así que el camino de vuelta existe sin tocar nada.
-- ---------------------------------------------------------------------
