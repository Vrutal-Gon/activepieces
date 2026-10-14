#!/bin/sh
# Arranque de Postiz en una instancia de Vrutal.
#
# Por qué existe: Postiz lee las credenciales de la app de cada red social de VARIABLES DE
# ENTORNO, en cada llamada (comprobado en su código el 2026-10-13: linkedin.provider.ts y
# linkedin.page.provider.ts usan process.env.LINKEDIN_CLIENT_ID al generar la URL, al canjear
# el código y al refrescar el token). No admite credenciales por organización, y `customFields`
# —que sí existe— solo lo declaran los proveedores de API key, no LinkedIn.
#
# Consecuencia: la app de LinkedIn del cliente tiene que estar en el entorno del proceso. Pero
# el cliente no puede, ni debe, editar un .env en nuestra máquina ni mandarnos sus credenciales
# por correo: las pega él en VrutalOS → Integraciones. Así que este script se las pide a su
# propio VrutalOS al arrancar y las exporta antes de ceder el control a Postiz.
#
# Ventaja de hacerlo así y no con un .env en disco: la credencial va del Vault al proceso y
# nunca se escribe en ningún fichero de la máquina.
#
# Para aplicar un cambio de credenciales basta REINICIAR este contenedor (vuelve a pasar por
# aquí). De eso se encarga postiz_agent, que solo mira una huella y nunca ve una credencial.
#
# Si VrutalOS no contesta, o no hay credenciales guardadas todavía, Postiz arranca igual: sin
# ellas las demás funciones (calendario, canales ya conectados, publicar) siguen operando; lo
# único que falla es autorizar una red nueva, que es justo lo que el cliente aún no ha podido
# configurar. Nunca se impide el arranque por esto.
set -e

if [ -n "$SOCIAL_APP_ENV_URL" ] && [ -n "$SOCIAL_APP_TOKEN" ]; then
  # Node en vez de curl: la imagen de Postiz no trae curl ni wget (comprobado), pero sí
  # Node 22 con fetch global.
  RAW=$(node -e '
const url = process.env.SOCIAL_APP_ENV_URL + "?format=env";
fetch(url, { headers: { "X-AP-Token": process.env.SOCIAL_APP_TOKEN } })
  .then((r) => (r.ok ? r.text() : ""))
  .then((t) => process.stdout.write(t))
  .catch(() => {});
' 2>/dev/null || true)

  # Defensa en profundidad: solo pasan líneas con la forma exacta CLAVE='valor'. Aunque la
  # respuesta viniera manipulada, no puede ejecutar nada en este `eval`.
  LINES=$(printf '%s\n' "$RAW" | grep -E "^[A-Z][A-Z0-9_]*='[^']*'$" || true)

  if [ -n "$LINES" ]; then
    set -a
    eval "$LINES"
    set +a
    echo "[vrutal] credenciales de redes sociales cargadas ($(printf '%s\n' "$LINES" | wc -l | tr -d ' ') variables)"
  else
    echo "[vrutal] sin credenciales de redes sociales todavia: el cliente aun no las ha puesto en VrutalOS"
  fi
else
  echo "[vrutal] SOCIAL_APP_ENV_URL/SOCIAL_APP_TOKEN sin definir: se arranca sin credenciales de redes"
fi

# Lo mismo que el Cmd original de la imagen.
exec sh -c "nginx && pnpm run pm2"
