-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · El Rastro de los flujos pasa a run_log
--
-- La pestaña «Rastro» de Google Sheets (contrato RunRecord: fecha · flujo · tarea · resultado · detalle)
-- pasa a public.run_log, que ya existe y es lo que alimenta la pantalla Consumo. En vez de crear una
-- tabla nueva se le añaden las cuatro columnas que le faltan, y así una ejecución deja UN solo rastro.
--
-- Qué se añade:
--   flow_key   El flujo que corrió ('MKT-F4'). La tarea ya va en task_key.
--   outcome    'ok' | 'error' | 'rejected'   (el `resultado` del contrato)
--   detail     Texto corto de qué pasó. NUNCA el contenido de entradas o salidas: solo referencias.
--   run_ref    El id de ejecución de Activepieces. Es la misma referencia que work_item.run_ref,
--              así una fila entregada y su rastro se pueden cruzar.
--
-- Y se relaja algo que impedía usarla como rastro: provider y model_name eran NOT NULL. Un paso de
-- rastro no siempre pasa por un LLM (un flujo de reglas no tiene proveedor ni modelo), así que ahora
-- admiten NULL. usage_summary() no se rompe: suma con coalesce y agrupa por especialista.
--
-- OJO, Y ESTÁ BIEN ASÍ: run_log tiene una clave foránea (specialist_id, task_key) ->
-- catalog_flow_ro(specialist_id, task_key). Si el flujo que intenta dejar rastro no está contratado
-- para ese especialista, el insert FALLA. Es deliberado: no se registra trabajo que nadie contrató.
--
-- NO se añade coste: la pieza piece-claude@0.5.0 devuelve el texto y el modelo, pero no los tokens
-- (comprobado en el log de una ejecución real de F13). tokens_in, tokens_out y cost_usd se quedan
-- NULL hasta que el paso de Claude pase a HTTP contra la API de Anthropic, que sí devuelve `usage`.
-- Consumo mostrará ejecuciones y modelo, sin coste.
--
-- CONTRATO CON LOS FLUJOS (bloque «Deja rastro», sustituye a la pestaña «Rastro»):
--   El flujo llama a la Edge Function `run-log-write` con
--     { job_role_key, task_key, flow_key, outcome, detail, provider?, model_name?, run_ref? }
--   La función resuelve job_role_key -> specialists.id e inserta una fila.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

alter table public.run_log add column if not exists flow_key text;
alter table public.run_log add column if not exists outcome  text;
alter table public.run_log add column if not exists detail   text;
alter table public.run_log add column if not exists run_ref  text;

alter table public.run_log alter column provider   drop not null;
alter table public.run_log alter column model_name drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'run_log_outcome_check') then
    alter table public.run_log add constraint run_log_outcome_check
      check (outcome is null or outcome in ('ok', 'error', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'run_log_detail_len_check') then
    alter table public.run_log add constraint run_log_detail_len_check
      check (detail is null or length(detail) <= 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'run_log_flow_key_check') then
    alter table public.run_log add constraint run_log_flow_key_check
      check (flow_key is null or flow_key ~ '^[A-Z0-9][A-Za-z0-9._-]{1,39}$');
  end if;
end $$;

-- La pantalla Consumo lee por especialista y rango de fechas.
create index if not exists run_log_specialist_created_idx on public.run_log (specialist_id, created_at desc);

-- Permisos: no cambian. run_log ya tiene `grant select` para authenticated con política solo-admin
-- (run_log_select_admin) y la escribe service_role desde la Edge Function. Se deja escrito para que
-- no parezca un olvido.

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop index if exists run_log_specialist_created_idx;
--   alter table public.run_log drop constraint if exists run_log_flow_key_check;
--   alter table public.run_log drop constraint if exists run_log_detail_len_check;
--   alter table public.run_log drop constraint if exists run_log_outcome_check;
--   -- volver a NOT NULL solo si no hay filas con provider/model_name nulos:
--   alter table public.run_log alter column model_name set not null;
--   alter table public.run_log alter column provider   set not null;
--   alter table public.run_log drop column if exists run_ref;
--   alter table public.run_log drop column if exists detail;
--   alter table public.run_log drop column if exists outcome;
--   alter table public.run_log drop column if exists flow_key;
-- ---------------------------------------------------------------------
