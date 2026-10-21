-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-16_run_log_rastro.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Incluye la migración tal cual, la prueba, y TERMINA CON UN ERROR A PROPÓSITO:
-- Postgres revierte todo (columnas, restricciones y las filas de prueba). No queda nada.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- No hay que sustituir nada: la prueba busca ella misma un especialista y una tarea contratada.
-- (Este archivo se generó pegando la migración dentro del bloque de prueba; el bloque `do $$` de la
--  migración se escribe aquí como `if` de plpgsql, porque un DO no puede anidarse dentro de otro.)
-- =====================================================================
do $do$
declare
  r text := '';
  v_c bigint;
  v_t text;
  spec uuid;
  tkey text;
begin
  -- ===== migración (equivalente literal de 2026-10-16_run_log_rastro.sql) =====
  alter table public.run_log add column if not exists flow_key text;
  alter table public.run_log add column if not exists outcome  text;
  alter table public.run_log add column if not exists detail   text;
  alter table public.run_log add column if not exists run_ref  text;

  alter table public.run_log alter column provider   drop not null;
  alter table public.run_log alter column model_name drop not null;

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

  create index if not exists run_log_specialist_created_idx on public.run_log (specialist_id, created_at desc);
  -- ===== fin de la migración · empieza la prueba =====

  -- 0. Un especialista con una tarea contratada de verdad (la FK del espejo lo exige)
  select f.specialist_id, f.task_key into spec, tkey
    from public.catalog_flow_ro f
    join public.specialists s on s.id = f.specialist_id
   where s.job_role_key = 'search_marketing' and f.status = 'enabled'
   limit 1;
  if spec is null then
    raise exception 'DRY-RUN no ejecutado: no hay ninguna tarea contratada para search_marketing en catalog_flow_ro';
  end if;
  r := r || format('0) especialista y tarea de prueba: %s | ', tkey);

  -- 1. Las cuatro columnas nuevas existen
  select count(*) into v_c from information_schema.columns
   where table_schema = 'public' and table_name = 'run_log'
     and column_name in ('flow_key', 'outcome', 'detail', 'run_ref');
  r := r || format('1) columnas nuevas: %s (esperado 4) | ', v_c);

  -- 2. Un rastro de verdad entra, sin proveedor ni modelo (un flujo de reglas no pasa por un LLM)
  insert into public.run_log (specialist_id, task_key, flow_key, outcome, detail, run_ref)
    values (spec, tkey, 'MKT-F4', 'ok', '12 filas escritas en keywords', 'prueba-dry-run');
  r := r || '2a) rastro sin LLM insertado | ';
  insert into public.run_log (specialist_id, task_key, flow_key, outcome, detail, provider, model_name, run_ref)
    values (spec, tkey, 'MKT-F4', 'ok', 'con modelo', 'anthropic', 'claude-sonnet-5-5', 'prueba-dry-run');
  r := r || '2b) rastro con modelo insertado | ';

  -- 3. Lo que no debe entrar
  begin
    insert into public.run_log (specialist_id, task_key, flow_key, outcome)
      values (spec, tkey, 'MKT-F4', 'casi');
    r := r || '3a) outcome inventado: ENTRO (esperado bloqueado) | ';
  exception when others then r := r || '3a) outcome inventado bloqueado | '; end;
  begin
    insert into public.run_log (specialist_id, task_key, flow_key, outcome, detail)
      values (spec, tkey, 'MKT-F4', 'ok', repeat('x', 301));
    r := r || '3b) detalle de 301 caracteres: ENTRO (esperado bloqueado) | ';
  exception when others then r := r || '3b) detalle demasiado largo bloqueado | '; end;
  begin
    insert into public.run_log (specialist_id, task_key, flow_key, outcome)
      values (spec, tkey, 'mkt f4 ', 'ok');
    r := r || '3c) flow_key con espacios: ENTRO (esperado bloqueado) | ';
  exception when others then r := r || '3c) flow_key mal formado bloqueado | '; end;

  -- 4. La FK del espejo: no se registra trabajo que nadie contrató
  begin
    insert into public.run_log (specialist_id, task_key, flow_key, outcome)
      values (spec, 'TSK-999999', 'MKT-F4', 'ok');
    r := r || '4) tarea no contratada: ENTRO (esperado bloqueado) | ';
  exception when others then r := r || '4) tarea no contratada bloqueada | '; end;

  -- 5. Lo que verá la pantalla Consumo
  select format('%s ejecuciones, coste %s', count(*), coalesce(sum(cost_usd), 0))
    into v_t from public.run_log where run_ref = 'prueba-dry-run';
  r := r || format('5) %s (esperado 2 ejecuciones, coste 0) | ', v_t);

  -- 6. Permisos sin cambios
  select format('authenticated select=%s insert=%s · anon select=%s',
    has_table_privilege('authenticated', 'public.run_log', 'select'),
    has_table_privilege('authenticated', 'public.run_log', 'insert'),
    has_table_privilege('anon', 'public.run_log', 'select')) into v_t;
  r := r || format('6) %s (esperado true, false, false)', v_t);

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
