-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-14_schema_change_log.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Aplica la migración, la prueba y TERMINA CON UN ERROR A PROPÓSITO,
-- así que Postgres revierte todo: no queda nada aplicado.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Qué se prueba: que la tabla queda CERRADA al cliente. Ese es el riesgo real de este
-- cambio — no que la tabla se cree (es trivial), sino que se cree abierta por descuido y
-- el cliente pueda leer el historial de cambios de esquema de Vrutal.
--
-- No requiere ningún cambio previo ni ningún id: no toca `profiles`.
-- =====================================================================
do $do$
declare
  r text := '';
  n int;
begin
  -- ---------------------------------------------------------------
  -- Aplicar el cambio (copia exacta de 2026-10-14_schema_change_log.sql)
  -- ---------------------------------------------------------------
  create table if not exists public.schema_change_log (
    filename    text        primary key,
    sha256      text        not null,
    applied_at  timestamptz not null default now(),
    applied_by  text        not null,
    source      text        not null default 'script'
                check (source in ('script', 'retro', 'manual')),
    notes       text
  );

  alter table public.schema_change_log enable row level security;
  revoke all on public.schema_change_log from anon, authenticated;
  grant all on public.schema_change_log to service_role;

  -- ---------------------------------------------------------------
  -- 1. RLS activada
  -- ---------------------------------------------------------------
  select count(*) into n
  from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relname = 'schema_change_log' and c.relrowsecurity;
  r := r || format('1) RLS activada: %s (esperado 1) | ', n);

  -- ---------------------------------------------------------------
  -- 2. Ni `authenticated` ni `anon` tienen NINGÚN permiso de tabla.
  --    Esto es lo que de verdad importa.
  -- ---------------------------------------------------------------
  select count(*) into n
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'schema_change_log'
    and grantee in ('authenticated', 'anon');
  r := r || format('2) permisos de anon/authenticated: %s (esperado 0) | ', n);

  r := r || format('2b) select de authenticated: %s (esperado false) | ',
                   has_table_privilege('authenticated', 'public.schema_change_log', 'select'));

  -- ---------------------------------------------------------------
  -- 3. `service_role` sí escribe
  -- ---------------------------------------------------------------
  r := r || format('3) insert de service_role: %s (esperado true) | ',
                   has_table_privilege('service_role', 'public.schema_change_log', 'insert'));

  -- ---------------------------------------------------------------
  -- 4. El check de `source` rechaza un valor inventado
  -- ---------------------------------------------------------------
  begin
    insert into public.schema_change_log (filename, sha256, applied_by, source)
    values ('prueba.sql', 'abc', 'dry-run', 'inventado');
    r := r || '4) source inventado: ACEPTADO (MAL) | ';
  exception when check_violation then
    r := r || '4) source inventado: rechazado (esperado rechazado) | ';
  end;

  -- ---------------------------------------------------------------
  -- 5. La clave primaria impide anotar dos veces el mismo fichero
  -- ---------------------------------------------------------------
  insert into public.schema_change_log (filename, sha256, applied_by)
  values ('prueba.sql', 'abc', 'dry-run');
  begin
    insert into public.schema_change_log (filename, sha256, applied_by)
    values ('prueba.sql', 'otro-hash', 'dry-run');
    r := r || '5) fichero duplicado: ACEPTADO (MAL)';
  exception when unique_violation then
    r := r || '5) fichero duplicado: rechazado (esperado rechazado)';
  end;

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
