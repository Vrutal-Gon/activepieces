#!/usr/bin/env bash
# Publica en el repo privado VrutalOS los artefactos de los bloques de TSK-001222 (carpeta blocks/)
# y muestra, para cada archivo NUEVO o CAMBIADO, la referencia y el hash que hay que rellenar
# en la versión del bloque en el panel de Vrutal 1st.
# Lo ejecuta una persona en Git Bash:   bash /c/Vrutal/Activepieces/tools/publish-blocks.sh
# No cambia tu configuración de git. Antes de hacer commit y push te pide confirmación.
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:Vrutal-Gon/VrutalOS.git}"
DEST="${DEST:-/c/VrutalOS}"
GIT_REPO_ID="${GIT_REPO_ID:-Vrutal-Gon/VrutalOS}"
SRC_DIR="${SRC_DIR:-/c/Vrutal/Activepieces/flows/TSK-001222_detectar-clasificar-email/blocks}"
REL_DIR="${REL_DIR:-activepieces/flows/TSK-001222}"

[ -d "$SRC_DIR" ] || { echo "No existe la carpeta $SRC_DIR"; exit 1; }
FILES=$(cd "$SRC_DIR" && find . -type f ! -name '.*' | sed 's#^\./##' | sort)
[ -n "$FILES" ] || { echo "No hay archivos en $SRC_DIR"; exit 1; }

# Un artefacto no debe llevar secretos: parar si algo lo parece.
for f in $FILES; do
  if grep -qiE 'password|passwd|secret|token|api[_-]?key|authorization|bearer' "$SRC_DIR/$f"; then
    echo "$f contiene palabras sensibles (password/secret/token/api key...). Revísalo antes de subirlo."; exit 1
  fi
done

if [ ! -d "$DEST/.git" ]; then git clone "$REPO_URL" "$DEST"; fi
cd "$DEST"
git pull --ff-only

mkdir -p "$REL_DIR"
for f in $FILES; do mkdir -p "$(dirname "$REL_DIR/$f")"; cp "$SRC_DIR/$f" "$REL_DIR/$f"; done

cat > activepieces/.gitattributes <<'EOF'
* text eol=lf
EOF

cat > activepieces/README.md <<'EOF'
# activepieces/

Artefactos de Vrutal para Activepieces. La fuente de verdad de cada bloque es este repositorio;
el catálogo de Vrutal 1st guarda solo una referencia inmutable.

```
activepieces/
  flows/<TSK-XXXXXX>/<bloque>.flow.json   plantilla de flujo exportada (p. ej. un intake con su trigger)
  flows/<TSK-XXXXXX>/<bloque>.step.ts     paso Code, con cabecera "vrutal-block" (contrato, variante, inputs)
  pieces/                                 pieces propios (más adelante)
```

## Referencia desde Vrutal 1st (`component_version.artifact_ref`)

    git:<propietario>/<repo>:<ruta>@<SHA de commit completo, 40 hex>

Ejemplo: `git:Vrutal-Gon/VrutalOS:activepieces/flows/TSK-001222/inbound-imap-trigger.flow.json@<sha>`

- El SHA es de commit, nunca una rama ni un tag (son mutables y romperían la inmutabilidad de lo validado).
- Hash del contenido (`artifact_sha256`): `git show <sha>:<ruta> | sha256sum`.

## Reglas

- Una plantilla exportada lleva solo la referencia `{{connections['<externalId>']}}`, nunca la credencial.
- Antes de subir un export, comprueba que no incluye datos de ejemplo con correos, nombres o importes reales.
- Un artefacto publicado no se edita: se hace un commit nuevo y una versión nueva del bloque.
EOF

git add activepieces
if git diff --cached --quiet; then echo "No hay cambios que publicar: el repositorio ya está al día."; exit 0; fi
echo; echo "== Cambios que se van a subir =="; git status --short
echo
if [ "${ASSUME_YES:-0}" != "1" ]; then
  read -r -p "¿Hacer commit y push a $REPO_URL (rama main)? [s/N] " ans
  [ "$ans" = "s" ] || [ "$ans" = "S" ] || { echo "Cancelado. No se ha subido nada (los cambios quedan preparados en $DEST)."; exit 0; }
fi

git commit -q -m "TSK-001222: publica bloques"
git push -q origin HEAD:main

SHA=$(git rev-parse HEAD)
CHANGED=$(git diff --name-only HEAD~1 HEAD -- "$REL_DIR")
echo
echo "=================  Rellena en el panel de Vrutal 1st  ================="
for rel in $CHANGED; do
  echo "Archivo   : $rel"
  echo "Artefacto : git:${GIT_REPO_ID}:${rel}@${SHA}"
  echo "sha256    : $(git show "$SHA:$rel" | sha256sum | cut -d' ' -f1)"
  echo "-----------------------------------------------------------------------"
done
