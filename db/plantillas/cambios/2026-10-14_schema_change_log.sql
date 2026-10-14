-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Tabla de control de cambios de esquema
--
-- Paga la deuda marcada como «MUY IMPORTANTE» en el README de esta carpeta. Aplicar un
-- cambio desde el SQL Editor no deja rastro en el historial de migraciones de Supabase, así
-- que hasta hoy el único registro era un fichero Markdown escrito a mano — y se
-- desincronizó: el 2026-10-13 una auditoría objeto por objeto encontró DOS cambios sin
-- aplicar que ese mismo fichero ya marcaba como pendientes, y llevaban cinco días así.
-- Nadie lo vio porque nada falla al arrancar: solo falla al usarse.
--
-- Esta tabla es el rastro que faltaba, en la propia base: una fila por cambio aplicado, con
-- el hash del fichero. Con ella, `scripts/aplicar-cambios-cliente.sh` puede decidir qué
-- falta, saltarse lo ya hecho y ABORTAR EN VOZ ALTA si un cambio no se aplica o si un
-- fichero ya aplicado ha cambiado por debajo.
--
-- Por qué `filename` es la clave y no un número de versión: los cambios de esta carpeta se
-- nombran `AAAA-MM-DD_descripcion.sql` (regla 4) y se aplican en orden de fecha, no en una
-- secuencia global. El nombre del fichero es el identificador natural y ya es único.
--
-- Por qué el hash se calcula sobre el fichero NORMALIZADO a LF: el repositorio se trabaja en
-- Windows y git convierte los finales de línea al sacar los ficheros (avisa con «LF will be
-- replaced by CRLF»). Hashear los bytes crudos daría un hash distinto en cada máquina y el
-- script acusaría de modificado un fichero intacto. El script quita los `\r` antes de
-- hashear; esta tabla solo guarda el resultado.
--
-- Por qué NO lleva la política `active_only` que exige la regla 5: esa regla existe para que
-- un usuario desactivado del cliente no pueda colarse en una tabla nueva. Aquí se consigue
-- de forma más fuerte — `authenticated` y `anon` no tienen NINGÚN permiso de tabla, así que
-- una política para `authenticated` sería código muerto. El historial de cambios de esquema
-- es operación de Vrutal, no dato de negocio del cliente: mismo criterio que
-- `catalog_flow_ro` (decidido 2026-10-06). Se deja escrito para que no parezca un olvido.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

create table if not exists public.schema_change_log (
  filename    text        primary key,
  sha256      text        not null,
  applied_at  timestamptz not null default now(),
  applied_by  text        not null,
  source      text        not null default 'script'
              check (source in ('script', 'retro', 'manual')),
  notes       text
);

comment on table public.schema_change_log is
  'Rastro de los cambios de db/plantillas/cambios/ aplicados en ESTA base. Lo escribe '
  'scripts/aplicar-cambios-cliente.sh. Operacion de Vrutal: el cliente no lo lee.';

comment on column public.schema_change_log.sha256 is
  'SHA-256 del fichero normalizado a LF (sin \r). Si cambia, el fichero se edito despues '
  'de aplicarse y el script aborta.';

comment on column public.schema_change_log.source is
  'script = lo aplico el script. retro = fila escrita a posteriori para un cambio que se '
  'aplico a mano por el SQL Editor; su hash es el del fichero de HOY, no el de lo que de '
  'verdad se ejecuto. manual = aplicado a mano y anotado a mano.';

alter table public.schema_change_log enable row level security;

-- Nadie del cliente lo toca: ni lectura. Solo los procesos de servidor de Vrutal.
revoke all on public.schema_change_log from anon, authenticated;
grant all on public.schema_change_log to service_role;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop table if exists public.schema_change_log;
--   (se perderia el rastro de que cambios estan aplicados en esta base, y
--    aplicar-cambios-cliente.sh volveria a no tener forma de saberlo: cada ejecucion
--    intentaria aplicar todo otra vez)
-- ---------------------------------------------------------------------
