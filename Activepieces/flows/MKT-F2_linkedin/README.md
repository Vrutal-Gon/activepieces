# MKT-F2 · Programar el post de LinkedIn

`content_promotion` · VRL-MKT-C03 · diseño en [MARKETING_flujos_v0.1.drawio](../MARKETING_flujos_v0.1.drawio) (página **F2**).

```
Recibe → Consulta → Ordena → Pide permiso → Ejecuta → Deja rastro
```

**Primera acción irreversible del sistema.** «Ejecuta» llama a la API de [Postiz](https://github.com/gitroomhq/postiz-app) (self-hosted, por cliente) para crear el post ya programado — Postiz guarda la fecha y publica él mismo, el flujo no espera. Si no apruebas, termina sin publicar. Probar primero en sombra (construir el post, no publicar).

**Por qué Postiz y no el piece nativo de LinkedIn:** así este paso vale para cualquier red que Postiz soporte (LinkedIn, X, Facebook, Instagram…), sin un piece nuevo por canal. Mixpost (la alternativa evaluada primero) quedó descartada: su edición gratuita (Lite, MIT) no tiene LinkedIn ni API — eso es de pago (Pro, $299/dominio). Postiz es self-hosted y gratis con el producto completo. A cambio, no separa clientes de forma robusta, así que cada cliente lleva su propia instancia de Postiz (mismo patrón que Activepieces hoy: interfaz solo para el staff, por túnel SSH — el cliente nunca ve Postiz, ve el calendario dentro de VrutalOS). Pendiente de spike antes de construir: probar en la práctica la conexión OAuth con una página real de LinkedIn y medir el footprint del stack de Postiz (incluye Temporal, más pesado que Activepieces solo).

| Archivo | Qué es |
|---|---|
| `F2.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo. **Construido 2026-10-10**: `step_4`/`step_5` ya son pasos HTTP reales (genéricos, sin pieza nativa de Postiz) — ver «Puesta en marcha». `step_3` («Pide permiso») sigue pendiente, no es parte de este cambio |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Calendario` | `fecha` · `week` · `publish_at` · `piece_title` · `channel` · `target_keyword` · `brief_id` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`. `step_4`/`step_5` son pasos HTTP genéricos — **no hace falta ninguna conexión de Postiz en Activepieces**. **Corregido 2026-10-10**: la API key de Postiz ya NO vive en el Vault del cliente (no es una clave que el cliente pegue, como HubSpot) — la pone el staff en Panel-Vrutal1st → ficha del cliente → Infraestructura (migración `025_vrutal_postiz_key.sql`), y `step_4` la pide por servidor a servidor con el token de la instancia.
3. **Flujos → Importar** → `F2.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · fecha en el calendario | **Crea la pestaña `Calendario` en la hoja y elígela en el desplegable** (aún no existe). Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Calendario` |
| `step_2` Ordena · post LinkedIn | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_3` Pide permiso · founder: texto + fecha | **Sigue pendiente**, no se tocó en este cambio. Enviar al founder texto + fecha y esperar su respuesta; si no aprueba, el flujo termina aquí. El piece «Approval» es legacy en 0.82: usar las acciones de la pestaña Approvals si existen (confirmado que existen: `@activepieces/piece-approval`, acciones `wait_for_approval`/`create_approval_links` — su propia descripción recomienda la pestaña Approvals en vez del piece). Fail-closed: sin respuesta, no sigue. |
| `step_4` Consulta · clave de Postiz (Vault) | **Construido 2026-10-10**, pieza HTTP genérica, sin conexión que elegir. Cabecera `X-AP-Token`: pega el secreto real (mismo que usa F3) en vez del marcador `PENDIENTE_GENERAR_SECRETO_AP_INTEGRATION_TOKEN` |
| `step_5` Ejecuta · Postiz: crear post programado | **Construido 2026-10-10**, pieza HTTP genérica. Dos marcadores por rellenar cuando Postiz esté desplegado (semana 2): `PENDIENTE_URL_POSTIZ` en la URL (la base real, p. ej. `https://lab-social.localhost:8088` en local) y `PENDIENTE_INTEGRATION_ID_LINKEDIN` en `posts[0].integration.id` (el id que da Postiz al conectar la página de LinkedIn por OAuth). **No activar** hasta rellenar los dos y probar en sombra. |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar. `step_5` no se puede probar de verdad hasta que Postiz esté desplegado y la cuenta de LinkedIn conectada (semana 2 del plan) — antes de eso, fallará al no tener los dos marcadores rellenos, que es justo el comportamiento fail-closed esperado.

## Pasos pendientes (fallan a propósito)

- **Pide permiso · founder: texto + fecha** — Enviar al founder texto + fecha y esperar su respuesta; si no aprueba, el flujo termina aquí. El piece «Approval» es legacy en 0.82: usar las acciones de la pestaña Approvals (confirmadas que existen en esta instancia). Fail-closed: sin respuesta, no sigue. Pendiente de construir — ninguna de las tareas de esta sesión lo resolvió.

## Contratos

- **LinkedInPost** (propuesto): `brief_id`, `body`, `publish_at` — lo que `Ordena` prepara antes de llamar a Postiz.
- **Payload real de Postiz** (`POST /public/v1/posts`), verificado contra `libraries/nestjs-libraries/src/dtos/posts/create.post.dto.ts` del propio Postiz el 2026-10-10 — **distinto del que se había supuesto antes** (`integrations` plural y `posts[].content` directo no existen en el DTO real):
  ```json
  {
    "type": "schedule",
    "shortLink": false,
    "date": "<publish_at>",
    "tags": [],
    "posts": [{
      "integration": { "id": "<integration id de LinkedIn en Postiz>" },
      "value": [{ "content": "<body>" }],
      "settings": { "__type": "linkedin-page" }
    }]
  }
  ```
  `integration` va **dentro** de cada post (uno por canal, no una lista aparte), `value` es un array de bloques de contenido (no un `content` plano), y `settings.__type` es obligatorio salvo `type: "draft"` — para LinkedIn (`LinkedinDto`) no tiene campos obligatorios propios, así que basta el discriminador. Pendiente de confirmar en la prueba real: el formato exacto de `publish_at` en `Calendario` debe ser una fecha ISO 8601 válida (`@IsDateString()` en el DTO) — no se ha verificado qué formato escribe F12 ahí.
- `tags_ia` (de `ContentDraft`, ver `MKT-F14_adaptacion/README.md`) **viaja con la pieza pero no va en el payload de Postiz** — Postiz no sabe nada de esto, es interno de Vrutal. Al generalizar F2 para leer de `Borradores` (nota de F14), este flujo debe copiar `tags_ia` al registro que queda en `Publicaciones`/`Rastro`, para que F3 pueda cruzarlo luego por publicación.
- **UTM (decidido 2026-10-09, ver `MKT-F14_adaptacion/README.md`)**: sin cambio de lógica en este flujo. El enlace que viaja dentro de `body` ya llega etiquetado desde `Borradores` — F14 lo construye y lo incrusta antes de que F2 lo publique. F2 solo copia `utm_source`/`utm_medium`/`utm_campaign`/`utm_term`/`utm_content` al registro de `Publicaciones`/`Rastro`, igual que ya hace con `tags_ia`.

## Diferencias con el diagrama (a revisar)

- La fecha (`publish_at`) se busca en `Calendario` por `brief_id`; la pestaña la escribe F12. Si el calendario no tiene ese `brief_id`, el post se descarta (fail-closed).

## Pendiente de catálogo (sin aplicar)

- `deployment.tenant_integration.category` (migración `002_vrutal_catalog_deployment.sql`) no incluye hoy `'social'`. Para registrar "este cliente tiene Postiz conectado a LinkedIn" haría falta una migración que añada `'social'` al check constraint y una fila `system = 'postiz'`. El token real lo guarda Postiz en su propia base — aquí solo iría una referencia, igual que `n8n_credential_ref`.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
