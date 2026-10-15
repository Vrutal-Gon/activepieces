-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · Migración 032 · Quitar los permisos que Supabase regala
--
-- Pareja de `db/plantillas/cambios/2026-10-15_quitar_permisos_regalados.sql`, que hizo lo
-- mismo en el plano de datos. Aquí quedó sin hacer, y aquí importa más.
--
-- Medido el 2026-10-15: **23 tablas de `public`** daban a `anon` y `authenticated` los
-- permisos TRUNCATE, REFERENCES y TRIGGER. Los esquemas `catalog` y `deployment` están
-- limpios, así que la IP (tareas, roles, prompts) no estaba afectada.
--
-- Por qué en el plano de control es peor que en el de datos: en `public` viven `user_roles`,
-- `roles`, `permissions` y `role_permissions`, que son el RBAC del staff. Y **TRUNCATE no
-- dispara triggers de fila**: `trg_user_roles_last_superadmin`, que existe precisamente para
-- que ninguna operación deje el sistema sin superadmin, **no se ejecutaría** ante un
-- `truncate user_roles`. La guarda protege DELETE y UPDATE, no TRUNCATE.
--
-- Hasta qué punto era alcanzable: `anon` y `authenticated` llegan por PostgREST, que no
-- expone TRUNCATE. Así que esto es defensa en profundidad, no una puerta abierta. Se cierra
-- porque el permiso no tiene ninguna razón para estar ahí y la consecuencia si alguna vez se
-- alcanzara es perder el control de acceso del staff.
--
-- LA CAUSA RAÍZ, igual que en el cliente: no basta con revocar en las tablas de hoy. Los
-- permisos vuelven solos en cada tabla nueva, porque vienen de los privilegios por defecto
-- del esquema. En `pg_default_acl` de este proyecto, la entrada de `postgres` para tablas de
-- `public` es `authenticated=Dxtm` (D=truncate, x=references, t=trigger, m=maintain). Cada
-- tabla creada desde el SQL Editor nace otra vez con ellos.
--
-- `maintain` se incluye porque es PostgreSQL 17 y aparece en el mismo ACL.
--
-- `catalog` y `deployment` no necesitan la revocación de defecto: no tienen ninguna entrada
-- en `pg_default_acl`, así que una tabla nueva allí nace solo con los permisos de su dueño.
--
-- Las SECUENCIAS no se tocan: comprobado el 2026-10-15, su ACL real es `authenticated=U`
-- (solo USAGE, sin SELECT ni UPDATE), así que no hay riesgo de `setval`. El `rwU` que
-- aparece en los privilegios por defecto es de la entrada de `supabase_admin`, que no es la
-- vía por la que se crean las secuencias de este proyecto.
-- =====================================================================

-- 1. Las tablas de hoy.
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated;

-- 2. El defecto que las reponía.
alter default privileges in schema public
  revoke truncate, references, trigger, maintain
  on tables from anon, authenticated;

-- ---------------------------------------------------------------------
-- Para revertir:
--   grant truncate, references, trigger, maintain
--     on all tables in schema public to anon, authenticated;
--   alter default privileges in schema public
--     grant truncate, references, trigger, maintain
--     on tables to anon, authenticated;
--   (volvería a dejar al alcance de una sesión con conexión directa un TRUNCATE de
--    `user_roles`, que se salta la guarda del último superadmin. No hay razón para
--    revertirlo.)
-- ---------------------------------------------------------------------
