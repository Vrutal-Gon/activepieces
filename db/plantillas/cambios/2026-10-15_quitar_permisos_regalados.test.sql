-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-15_quitar_permisos_regalados.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Aplica la migración, la prueba y TERMINA CON UN ERROR A PROPÓSITO,
-- así que Postgres revierte todo: no queda nada aplicado.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Qué se prueba, en este orden:
--   1. Cuántas tablas tenían los permisos regalados ANTES (en Vrutal-labs, 18 de 23).
--   2. Que después NO queda ninguna.
--   3. Que los permisos de DATOS no se han tocado: `profiles` conserva los suyos. Este es
--      el riesgo real del cambio — pasarse de frenada y dejar la app sin permisos.
--   4. Que una tabla NUEVA ya nace limpia (la causa raíz: los privilegios por defecto).
--   5. Que `service_role` sigue pudiendo hacer truncate, que sí es suyo.
--
-- No requiere ningún cambio previo ni ningún id.
-- =====================================================================
do $do$
declare
  r text := '';
  n_antes int;
  n_despues int;
  n_datos_antes int;
  n_datos_despues int;
  n_nueva int;
begin
  -- ---------------------------------------------------------------
  -- 1. Estado de partida
  -- ---------------------------------------------------------------
  select count(distinct table_name) into n_antes
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated')
    and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN');

  select count(*) into n_datos_antes
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'profiles'
    and grantee = 'authenticated'
    and privilege_type in ('SELECT','INSERT','UPDATE','DELETE');

  r := r || format('1) tablas con permisos regalados antes: %s | ', n_antes);

  -- ---------------------------------------------------------------
  -- Aplicar el cambio (copia exacta de la migración)
  -- ---------------------------------------------------------------
  revoke truncate, references, trigger, maintain
    on all tables in schema public
    from anon, authenticated;

  alter default privileges in schema public
    revoke truncate, references, trigger, maintain
    on tables from anon, authenticated;

  -- ---------------------------------------------------------------
  -- 2. Ya no queda ninguna
  -- ---------------------------------------------------------------
  select count(distinct table_name) into n_despues
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated')
    and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN');
  r := r || format('2) despues: %s (esperado 0) | ', n_despues);

  -- ---------------------------------------------------------------
  -- 3. Los permisos de DATOS intactos (que no nos hayamos pasado)
  -- ---------------------------------------------------------------
  select count(*) into n_datos_despues
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'profiles'
    and grantee = 'authenticated'
    and privilege_type in ('SELECT','INSERT','UPDATE','DELETE');
  r := r || format('3) permisos de datos de profiles: %s antes / %s despues (tienen que ser iguales) | ',
                   n_datos_antes, n_datos_despues);

  -- ---------------------------------------------------------------
  -- 4. Una tabla NUEVA nace limpia (la causa raíz)
  -- ---------------------------------------------------------------
  create table public.zz_prueba_defecto (id int);
  select count(*) into n_nueva
  from information_schema.role_table_grants
  where table_schema = 'public' and table_name = 'zz_prueba_defecto'
    and grantee in ('anon','authenticated');
  r := r || format('4) permisos de anon/authenticated en una tabla nueva: %s (esperado 0) | ', n_nueva);

  -- ---------------------------------------------------------------
  -- 5. `service_role` conserva truncate
  -- ---------------------------------------------------------------
  r := r || format('5) truncate de service_role en profiles: %s (esperado true)',
                   has_table_privilege('service_role', 'public.profiles', 'truncate'));

  raise exception 'RESULTADO DRY-RUN (todo revertido, incluida la tabla de prueba): %', r;
end $do$;
