#!/bin/sh
# Agente de la instancia: aplica las credenciales de redes sociales que el cliente guarda
# en su VrutalOS.
#
# Hace una sola cosa: vigilar una huella y, si cambia, reiniciar Postiz — que al arrancar
# vuelve a pedir las credenciales (ver boot.sh). Hace falta porque Postiz las lee del entorno
# del proceso, y el entorno de un proceso no se puede cambiar en caliente.
#
# Lo que este agente NO hace, a propósito:
#   · No ve ninguna credencial. Solo pide `?format=fingerprint`, que devuelve proveedores y
#     fechas, nunca secretos. Quien las recibe es Postiz, directamente.
#   · No habla con el socket de Docker. Va contra docker_socket_proxy, limitado a operaciones
#     de contenedor (ni imágenes, ni volúmenes, ni exec).
#
# La primera vuelta tras recrear el contenedor no reinicia nada: si no hay huella aplicada
# todavía, se guarda la actual y se da por aplicada — Postiz acaba de arrancar y ya las ha
# leído. Así levantar la instancia no provoca un reinicio inmediato e inútil.
set -e

STATE_FILE=/state/applied-fingerprint
INTERVAL="${AGENT_INTERVAL:-30}"

if [ -z "$SOCIAL_APP_ENV_URL" ] || [ -z "$SOCIAL_APP_TOKEN" ] || [ -z "$POSTIZ_CONTAINER" ]; then
  echo "[agente] falta SOCIAL_APP_ENV_URL, SOCIAL_APP_TOKEN o POSTIZ_CONTAINER: nada que vigilar"
  # No se sale con error: una instancia sin redes sociales configuradas es válida, y un
  # contenedor en bucle de reinicio solo ensuciaria los logs.
  while true; do sleep 3600; done
fi

echo "[agente] vigilando credenciales de redes sociales cada ${INTERVAL}s (contenedor: ${POSTIZ_CONTAINER})"

while true; do
  # Se mira el CÓDIGO DE SALIDA de curl, no si la respuesta viene vacía: una huella vacía es
  # legítima (el cliente no ha guardado ninguna app todavía) y hay que distinguirla de que
  # VrutalOS no conteste. Si se confundieran, la PRIMERA vez que el cliente guardase sus
  # credenciales el agente lo tomaría por su primer arranque y no reiniciaría Postiz: las
  # claves quedarían guardadas y sin efecto, sin ningún error a la vista.
  if CURRENT=$(curl -fsS --max-time 15 \
    -H "X-AP-Token: ${SOCIAL_APP_TOKEN}" \
    "${SOCIAL_APP_ENV_URL}?format=fingerprint" 2>/dev/null); then

    APPLIED=""
    [ -f "$STATE_FILE" ] && APPLIED=$(cat "$STATE_FILE" 2>/dev/null || true)

    # Las escrituras no son fatales a propósito (hay `set -e`): si no se puede guardar la
    # huella, se avisa y se reintenta en la vuelta siguiente. Un agente en bucle de reinicio
    # es un fallo peor que un reinicio de Postiz de más.
    if [ ! -f "$STATE_FILE" ]; then
      printf '%s' "$CURRENT" > "$STATE_FILE" 2>/dev/null \
        && echo "[agente] primera huella registrada, sin reiniciar (Postiz acaba de arrancar)" \
        || echo "[agente] aviso: no se ha podido escribir ${STATE_FILE}"
    elif [ "$CURRENT" != "$APPLIED" ]; then
      echo "[agente] credenciales nuevas: reiniciando ${POSTIZ_CONTAINER}"
      if curl -fsS --max-time 60 -X POST \
        "http://docker_socket_proxy:2375/containers/${POSTIZ_CONTAINER}/restart?t=30" \
        -o /dev/null 2>/dev/null; then
        printf '%s' "$CURRENT" > "$STATE_FILE" 2>/dev/null || echo "[agente] aviso: no se ha podido escribir ${STATE_FILE}"
        echo "[agente] reinicio solicitado y huella guardada"
      else
        # No se guarda la huella: se reintenta en la vuelta siguiente.
        echo "[agente] no se ha podido reiniciar ${POSTIZ_CONTAINER}, se reintenta en ${INTERVAL}s"
      fi
    fi
  fi

  sleep "$INTERVAL"
done
