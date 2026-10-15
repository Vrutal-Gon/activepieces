-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Quitar los permisos que Supabase regala
--
-- Supabase crea cada proyecto concediendo a `anon` y `authenticated` permisos de tabla que
-- nadie pidió. PostgREST no los expone, así que no se notan — pero existen, y con una
-- conexión Postgres directa sirven. El README de esta carpeta ya lo anotaba como pendiente
-- («solo se ha hecho en `integrations`; repasar el resto antes del primer cliente»).
--
-- Medido en Vrutal-labs el 2026-10-15: **18 de las 23 tablas** de `public` seguían dando a
-- `anon` y `authenticated` los permisos TRUNCATE, REFERENCES y TRIGGER.
--
-- Lo más serio: entre esas 18 están `catalog_flow_ro`, `catalog_kpi_ro` y
-- `catalog_report_ro`. Están bien cerradas para leer —`select` de `authenticated` da `false`,
-- comprobado— pero tenían **TRUNCATE**. No es una fuga de la IP de Vrutal: es algo peor en
-- otro sentido, porque `truncate` sobre `catalog_flow_ro` se llevaría por delante las claves
-- foráneas de `approval_requests` y `run_log`. Un permiso destructivo sobre la tabla que
-- define el trabajo de los especialistas, concedido por descuido del proveedor.
--
-- LA CAUSA RAÍZ, que la nota del README no recogía: no basta con revocar en las tablas de
-- hoy. Los permisos vuelven solos en cada tabla nueva, porque vienen de los PRIVILEGIOS POR
-- DEFECTO del esquema. En Vrutal-labs hay dos entradas en `pg_default_acl` para tablas:
--   · concedidos por `postgres`:        anon y authenticated = Dxtm
--   · concedidos por `supabase_admin`:  anon y authenticated = arwdDxtm
-- (D=truncate, x=references, t=trigger, m=maintain, a=insert, r=select, w=update, d=delete)
-- Alguien ya limpió en su día la entrada de `postgres` quitando `arwd`, pero dejó `Dxtm`.
-- Por eso cada tabla creada desde el SQL Editor —que crea como `postgres`— nace otra vez con
-- truncate, references y trigger para el cliente. Esta migración arregla las dos cosas: las
-- tablas de hoy y el defecto que las repone.
--
-- `maintain` se incluye porque es PostgreSQL 17 (17.6 en Vrutal-labs) y aparece en el mismo
-- ACL: permite VACUUM, ANALYZE, REINDEX y CLUSTER sobre la tabla. Tampoco es del cliente.
--
-- Por qué `revoke ... on all tables` y no una lista de 18: una lista se queda vieja en
-- cuanto se añade una tabla. Revocar sobre todas es idempotente y no toca los permisos de
-- datos (select/insert/update/delete), que cada tabla tiene concedidos a propósito en su
-- propia migración.
--
-- Lo que esta migración NO puede arreglar desde aquí: la entrada por defecto de
-- `supabase_admin`. `alter default privileges` solo actúa sobre las entradas del rol que
-- ejecuta (o de un rol del que sea miembro), y aquí se ejecuta como `postgres`. En la
-- práctica no estorba: las tablas del proyecto se crean como `postgres`, no como
-- `supabase_admin`. Si alguna vez una tabla aparece con `arwd` para `anon`, es por esa
-- entrada y hay que mirarla.
--
-- PENDIENTE APARTE, no se toca aquí para no mezclar: las SECUENCIAS también vienen
-- regaladas (`anon`/`authenticated` = `rwU`, y `w` sobre una secuencia permite `setval`).
-- Merece su propio cambio y su propia comprobación.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. Las tablas de hoy.
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated;

-- 2. El defecto que las reponía. Sin esto, la próxima tabla nace otra vez abierta.
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
--   (volvería a dejar que una sesión de cliente con conexión directa haga TRUNCATE de
--    cualquier tabla, incluidas las tres `catalog_*_ro` de las que dependen por clave
--    foránea `approval_requests` y `run_log`. No hay razón para revertirlo.)
-- ---------------------------------------------------------------------
