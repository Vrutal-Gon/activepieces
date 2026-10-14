#!/usr/bin/env bash
# =====================================================================
# Aplica a UN proyecto Supabase de CLIENTE la plantilla y los cambios de
# db/plantillas/cambios/, en orden de fecha, dejando rastro en la tabla
# public.schema_change_log de esa misma base.
#
# Paga la deuda «MUY IMPORTANTE» de db/plantillas/cambios/README.md: aplicar a mano
# desde el SQL Editor no deja rastro, así que nada comprobaba que un cambio se hubiera
# aplicado de verdad. El 2026-10-13 aparecieron dos cambios sin aplicar que el registro
# en Markdown ya marcaba como pendientes, y llevaban cinco días así — nadie lo vio porque
# nada falla al arrancar: solo falla al usarse.
#
# ABORTA EN VOZ ALTA y nombrando el fichero si:
#   · un cambio falla al aplicarse
#   · un fichero ya aplicado ha cambiado por debajo (hash distinto)
# Nunca se salta un cambio «porque no parece relevante».
#
# USO
#   export DATABASE_URL='postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres'
#   scripts/aplicar-cambios-cliente.sh                 # comprueba, NO escribe (por defecto)
#   scripts/aplicar-cambios-cliente.sh --apply         # aplica lo que falte
#   scripts/aplicar-cambios-cliente.sh --apply --with-template   # cliente NUEVO
#   scripts/aplicar-cambios-cliente.sh --apply --retro # marca como aplicado sin ejecutar
#
# La URL se pasa SOLO por variable de entorno, nunca como argumento: un argumento queda
# en el historial del shell y lleva la contraseña dentro.
#
# No hace falta psql en el host: se usa el de una imagen Docker fijada.
# =====================================================================
set -euo pipefail

PGIMAGE="postgres:17-alpine"
MODE="check"
WITH_TEMPLATE=0
RETRO=0

for arg in "$@"; do
  case "$arg" in
    --apply)         MODE="apply" ;;
    --check)         MODE="check" ;;
    --with-template) WITH_TEMPLATE=1 ;;
    --retro)         RETRO=1 ;;
    -h|--help)       sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "ERROR: opción desconocida: $arg" >&2; exit 2 ;;
  esac
done

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: falta DATABASE_URL en el entorno." >&2
  echo "       export DATABASE_URL='postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres'" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CAMBIOS_DIR="$REPO_ROOT/db/plantillas/cambios"
TEMPLATE="$REPO_ROOT/db/plantillas/vrutal_client_project_template.sql"

# Docker en Windows necesita la ruta en forma nativa (C:/...), no /c/...
if command -v cygpath >/dev/null 2>&1; then
  MOUNT_SRC="$(cygpath -m "$REPO_ROOT")"
else
  MOUNT_SRC="$REPO_ROOT"
fi

# psql dentro del contenedor. La URL viaja por VARIABLE DE ENTORNO y la expande el shell
# DEL CONTENEDOR (por eso el `sh -c`), no el de aquí: así no aparece en la línea de
# comandos, ni en `docker inspect`, ni en la lista de procesos del host.
psql_sql() {   # psql_sql <sql>  → stdout, sin cabeceras
  MSYS_NO_PATHCONV=1 docker run --rm \
    -e PGCONNSTRING="$DATABASE_URL" \
    "$PGIMAGE" \
    sh -c 'psql "$PGCONNSTRING" -v ON_ERROR_STOP=1 -t -A -c "$0"' "$1" 2>&1
}
psql_file() {  # psql_file <ruta_en_repo> <sql_extra>  → todo en UNA transacción
  MSYS_NO_PATHCONV=1 docker run --rm \
    -e PGCONNSTRING="$DATABASE_URL" \
    -v "${MOUNT_SRC}:/repo:ro" \
    "$PGIMAGE" \
    sh -c 'psql "$PGCONNSTRING" -v ON_ERROR_STOP=1 --single-transaction -f "$0" -c "$1"' \
    "$1" "$2" 2>&1
}

# Hash del fichero NORMALIZADO a LF. El repositorio se trabaja en Windows y git convierte
# los finales de línea al sacarlo; hashear los bytes crudos daría un hash distinto en cada
# máquina y el script acusaría de modificado un fichero intacto.
hash_of() {
  tr -d '\r' < "$1" | sha256sum | cut -d' ' -f1
}

die() { echo ""; echo "══════ ABORTADO ══════"; echo "$*" >&2; exit 1; }

echo "Modo:      $MODE$([ "$RETRO" = 1 ] && echo ' (retro: marca sin ejecutar)')"
echo "Cambios:   $CAMBIOS_DIR"
echo ""

# --- 0. Conexión -----------------------------------------------------
db=$(psql_sql 'select current_database();' | tr -d '\r' | tail -1)
case "$db" in
  postgres|*) [ -n "$db" ] || die "No se ha podido conectar a la base. Revisa DATABASE_URL." ;;
esac
echo "Conectado a: $db"

# Red de seguridad: que no sea Vrutal 1st por error. Allí estas tablas no existen y los
# cambios de esta carpeta no van nunca.
if [ "$(psql_sql "select count(*) from information_schema.tables where table_schema='catalog';" | tr -d '\r' | tail -1)" != "0" ]; then
  die "Esta base tiene el esquema 'catalog': parece Vrutal 1st, NO un proyecto de cliente.
       Los cambios de db/plantillas/cambios/ solo van al VrutalOS de un cliente."
fi

# --- 1. Plantilla (solo cliente nuevo) -------------------------------
if [ "$WITH_TEMPLATE" = 1 ]; then
  [ -f "$TEMPLATE" ] || die "No existe la plantilla: $TEMPLATE"
  echo ""
  echo "── Plantilla ──"
  echo "AVISO: la plantilla está DESFASADA (10 tablas frente a las 20 reales). Ver el"
  echo "       «Pendiente» de db/plantillas/cambios/README.md antes de fiarte de ella."
  if [ "$MODE" = "apply" ]; then
    out=$(psql_file "/repo/db/plantillas/vrutal_client_project_template.sql" "select 1;") \
      || die "La PLANTILLA ha fallado. Nada se ha aplicado (transacción revertida).

$out"
    echo "  plantilla aplicada"
  else
    echo "  (check) se aplicaría"
  fi
fi

# --- 2. Tabla de control (arranque) ----------------------------------
# El bucle de abajo necesita consultar la tabla para saber qué falta, pero el cambio que la
# CREA es el último por fecha (2026-10-14). Si se dejara al bucle, en modo --retro los doce
# cambios anteriores intentarían anotarse en una tabla inexistente y fallarían todos.
# Por eso se crea aquí, antes del bucle: es infraestructura del propio script, no un cambio
# funcional del cliente. El fichero es `create table if not exists`, así que repetirlo no
# hace nada.
LOG_CHANGE="2026-10-14_schema_change_log.sql"
tiene_log=$(psql_sql "select count(*) from information_schema.tables where table_schema='public' and table_name='schema_change_log';" | tr -d '\r' | tail -1)

if [ "$tiene_log" = "0" ]; then
  echo ""
  if [ "$MODE" = "apply" ]; then
    echo "── Arranque ──"
    h="$(hash_of "$CAMBIOS_DIR/$LOG_CHANGE")"
    out=$(psql_file "/repo/db/plantillas/cambios/$LOG_CHANGE" \
      "insert into public.schema_change_log (filename, sha256, applied_by) values ('$LOG_CHANGE', '$h', 'aplicar-cambios-cliente.sh (arranque)') on conflict (filename) do nothing;") \
      || die "No se ha podido crear la tabla de control ($LOG_CHANGE).

$out"
    echo "  APLICADO      $LOG_CHANGE  (tabla de control)"
    tiene_log=1
  else
    echo "schema_change_log no existe aún: se tratará todo como no aplicado."
  fi
fi

# --- 3. Cambios, en orden de fecha -----------------------------------
# Orden lexicográfico = orden de fecha, porque el nombre es AAAA-MM-DD_… (regla 4).
# OJO: dos cambios del MISMO día se ordenan alfabéticamente, no por dependencia. Hoy
# funciona (is_active_solo_admin crea is_active_user antes de que team_members_rpc lo use),
# pero si algún día dos cambios del mismo día dependen entre sí al revés, hay que renombrar
# uno con la fecha del siguiente día, no confiar en el alfabeto.
echo ""
echo "── Cambios ──"
pendientes=0; aplicados=0; saltados=0

while IFS= read -r ruta; do
  f="$(basename "$ruta")"
  h="$(hash_of "$ruta")"

  if [ "$tiene_log" = "1" ]; then
    fila=$(psql_sql "select sha256 from public.schema_change_log where filename = '$f';" | tr -d '\r' | tail -1)
  else
    fila=""
  fi

  if [ -n "$fila" ]; then
    if [ "$fila" = "$h" ]; then
      echo "  ya aplicado   $f"
      saltados=$((saltados+1))
    else
      die "El fichero $f YA está aplicado pero ha CAMBIADO desde entonces.
       hash anotado: $fila
       hash de hoy:  $h
       Un cambio ya aplicado no se edita: se escribe uno nuevo con fecha de hoy.
       Si de verdad quieres re-aplicarlo, borra su fila a mano y vuelve a ejecutar."
    fi
    continue
  fi

  pendientes=$((pendientes+1))

  if [ "$MODE" != "apply" ]; then
    echo "  PENDIENTE     $f"
    continue
  fi

  if [ "$RETRO" = 1 ]; then
    out=$(psql_sql "insert into public.schema_change_log (filename, sha256, applied_by, source, notes)
                    values ('$f', '$h', 'aplicar-cambios-cliente.sh --retro', 'retro',
                            'Marcado sin ejecutar: ya estaba aplicado a mano por el SQL Editor. El hash es el del fichero de hoy, no el de lo que se ejecuto.');") \
      || die "No se ha podido anotar $f.

$out"
    echo "  ANOTADO       $f  (retro, no ejecutado)"
  else
    # El cambio y su fila de registro van en la MISMA transacción: si el cambio falla no
    # queda fila, y si la fila falla el cambio se revierte. Nunca quedan descuadrados.
    out=$(psql_file "/repo/db/plantillas/cambios/$f" \
      "insert into public.schema_change_log (filename, sha256, applied_by) values ('$f', '$h', 'aplicar-cambios-cliente.sh');") \
      || die "El cambio $f ha FALLADO. Nada de ese cambio se ha aplicado
       (transacción revertida) y no se ha anotado. Los anteriores sí están aplicados.
       Arregla la causa y vuelve a ejecutar: los ya aplicados se saltan solos.

$out"
    echo "  APLICADO      $f"
  fi
  aplicados=$((aplicados+1))
  tiene_log=1
done < <(find "$CAMBIOS_DIR" -maxdepth 1 -name '*.sql' ! -name '*.test.sql' | sort)

# --- 4. Resumen ------------------------------------------------------
echo ""
echo "── Resumen ──"
echo "  ya aplicados antes: $saltados"
if [ "$MODE" = "apply" ]; then
  echo "  aplicados ahora:    $aplicados"
  echo ""
  echo "Comprobación de que el catálogo de Vrutal sigue cerrado al cliente:"
  existe_ro=$(psql_sql "select count(*) from information_schema.tables where table_schema='public' and table_name='catalog_flow_ro';" | tr -d '\r' | tail -1)
  if [ "$existe_ro" = "0" ]; then
    # Pasa en una base de prueba o en un cliente a medio aprovisionar. No es una fuga, pero
    # tampoco es normal: la tabla viene en la plantilla y la puebla el sync.
    echo "  catalog_flow_ro no existe en esta base: no hay nada que cerrar."
    echo "  OJO: en un cliente de verdad debería existir (plantilla + sync). Revísalo."
  else
    cerrado=$(psql_sql "select has_table_privilege('authenticated','public.catalog_flow_ro','select');" | tr -d '\r' | tail -1)
    echo "  authenticated puede leer catalog_flow_ro: $cerrado  (tiene que ser 'f')"
    [ "$cerrado" = "f" ] || die "catalog_flow_ro ha quedado LEGIBLE para el cliente. Eso expone la IP de Vrutal."
  fi
  echo ""
  echo "Anota en db/plantillas/cambios/README.md en qué proyecto y cuándo (regla 1)."
else
  echo "  pendientes:         $pendientes"
  [ "$pendientes" = "0" ] && echo "" && echo "Esta base está al día." \
    || { echo ""; echo "Para aplicarlos: $(basename "$0") --apply"; }
fi
