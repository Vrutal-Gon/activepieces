#!/usr/bin/env bash
# =====================================================================
# Extrae el ESQUEMA de una base de cliente viva para regenerar
# db/plantillas/vrutal_client_project_template.sql.
#
# Por qué hace falta: la plantilla está DESFASADA. Tiene 10 tablas frente a las 23 reales
# (contadas en Vrutal-labs el 2026-10-15) y su `handle_new_user` hace admin al primer
# usuario, cuando la base real toma el rol de `app_metadata` (D-04, solo escribible por
# `service_role`). Hoy «plantilla + cambios» NO reproduce la base viva, así que un cliente
# nuevo no nace igual que Vrutal-labs.
#
# ORDEN IMPORTANTE. Ejecuta esto DESPUÉS de aplicar en la base de origen:
#   · 2026-10-15_retirar_client_ticket.sql     → si no, la plantilla se lleva un resto que
#                                                 contradice D-20 y nacería en cada cliente
#   · 2026-10-15_quitar_permisos_regalados.sql → si no, la plantilla hereda TRUNCATE y
#                                                 compañía para anon/authenticated
# Comprueba las dos y avisa si faltan.
#
# NO sobreescribe la plantilla: deja el volcado crudo aparte, porque la plantilla es un
# documento curado (cabecera, avisos, orden legible) y un volcado de pg_dump no lo es.
# Fundirlos es trabajo a mano, y se hace mirando el diff.
#
# USO
#   export DATABASE_URL='postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres'
#   scripts/regenerar-plantilla-cliente.sh
#
# La URL se pasa SOLO por variable de entorno, nunca como argumento: un argumento queda en
# el historial del shell y lleva la contraseña dentro.
#
# No hace falta pg_dump en el host: se usa el de una imagen Docker fijada. La versión de
# pg_dump tiene que ser >= la del servidor (Supabase va por PostgreSQL 17.6), de ahí la 17.
# =====================================================================
set -euo pipefail

PGIMAGE="postgres:17-alpine"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: falta DATABASE_URL en el entorno." >&2
  echo "       export DATABASE_URL='postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres'" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SALIDA="$REPO_ROOT/db/plantillas/_volcado_base_viva.sql"
PLANTILLA="$REPO_ROOT/db/plantillas/vrutal_client_project_template.sql"

if command -v cygpath >/dev/null 2>&1; then
  MOUNT_SRC="$(cygpath -m "$REPO_ROOT/db/plantillas")"
else
  MOUNT_SRC="$REPO_ROOT/db/plantillas"
fi

psql_sql() {
  MSYS_NO_PATHCONV=1 docker run --rm -e PGCONNSTRING="$DATABASE_URL" "$PGIMAGE" \
    sh -c 'psql "$PGCONNSTRING" -v ON_ERROR_STOP=1 -t -A -c "$0"' "$1" 2>&1
}

q() { psql_sql "$1" | tr -d '\r' | tail -1; }

# --- Red de seguridad: que no sea Vrutal 1st ------------------------
if [ "$(q "select count(*) from information_schema.tables where table_schema='catalog';")" != "0" ]; then
  echo "ABORTADO: esta base tiene el esquema 'catalog': parece Vrutal 1st, no un cliente." >&2
  exit 1
fi

echo "Origen: $(q 'select current_database();') · PostgreSQL $(q "select current_setting('server_version');")"
echo "Tablas en public: $(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r';")"
echo ""

# --- Comprobar que la base está lista para ser plantilla ------------
avisos=0

if [ "$(q "select count(*) from information_schema.tables where table_schema='public' and table_name='client_ticket';")" != "0" ]; then
  echo "AVISO: client_ticket todavía existe. Aplica 2026-10-15_retirar_client_ticket.sql antes," >&2
  echo "       o la plantilla se llevará un resto que contradice D-20." >&2
  avisos=$((avisos+1))
fi

regalados=$(q "select count(distinct table_name) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN');")
if [ "$regalados" != "0" ]; then
  echo "AVISO: $regalados tablas aún dan TRUNCATE/REFERENCES/TRIGGER a anon/authenticated." >&2
  echo "       Aplica 2026-10-15_quitar_permisos_regalados.sql antes, o la plantilla los hereda." >&2
  avisos=$((avisos+1))
fi

if [ "$avisos" -gt 0 ]; then
  echo "" >&2
  echo "ABORTADO: $avisos aviso(s). Arréglalos y vuelve a ejecutar." >&2
  echo "          (Es a propósito: una plantilla se escribe desde una base limpia, no al revés.)" >&2
  exit 1
fi

# --- Volcado --------------------------------------------------------
# --schema-only: sin datos, es una plantilla.
# --schema=public: `auth`, `storage` y compañía los gestiona Supabase; no son nuestros.
# --no-owner: la plantilla no debe fijar propietarios; cada proyecto tiene los suyos.
# SIN --no-acl a propósito: los GRANT y las políticas RLS son lo más importante que hay que
#   reproducir. Una plantilla sin permisos es una base abierta.
echo "Volcando esquema…"
MSYS_NO_PATHCONV=1 docker run --rm \
  -e PGCONNSTRING="$DATABASE_URL" \
  -v "${MOUNT_SRC}:/salida" \
  "$PGIMAGE" \
  sh -c 'pg_dump "$PGCONNSTRING" --schema-only --schema=public --no-owner -f /salida/_volcado_base_viva.sql'

[ -s "$SALIDA" ] || { echo "ERROR: el volcado ha salido vacío." >&2; exit 1; }

echo ""
echo "Volcado en: db/plantillas/_volcado_base_viva.sql"
echo "  tablas:    $(grep -c '^CREATE TABLE' "$SALIDA" || true)"
echo "  funciones: $(grep -c '^CREATE FUNCTION' "$SALIDA" || true)"
echo "  políticas: $(grep -c '^CREATE POLICY' "$SALIDA" || true)"
echo "  grants:    $(grep -c '^GRANT' "$SALIDA" || true)"
echo ""
echo "Plantilla actual: $(grep -c '^create table\|^CREATE TABLE' "$PLANTILLA" || true) tablas"
echo ""
echo "SIGUIENTE PASO, A MANO: comparar y fundir en la plantilla."
echo "  diff <(grep -oE '^CREATE TABLE [^ ]+' '$SALIDA' | sort) \\"
echo "       <(grep -ioE '^create table (if not exists )?[^ (]+' '$PLANTILLA' | sort)"
echo ""
echo "La plantilla es un documento curado: conserva su cabecera, sus avisos y su orden."
echo "No la sustituyas por el volcado tal cual."
echo "El volcado es temporal: no se versiona (está en .gitignore)."
