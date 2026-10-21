# MKT-F13 · ContentBrief de cada pieza

`content_promotion` · TSK-000197 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F13**).

```
Recibe → Consulta ICP y Marca (VrutalOS) → Clave → Decide (Claude por API) → Ordena → Entrega (work_item) → Deja rastro (run_log)
```

Patrón LLM, riesgo bajo, reversible. **La prueba cita su fuente o queda vacía**: el rol nunca inventa cifras ni casos (el prompt lo pide y el paso Ordena lo hace cumplir).

| Archivo | Qué es |
|---|---|
| `F13.template.json` | Plantilla importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |
| `blocks/ordena-contentbrief.step.ts` | Bloque «Ordena · a ContentBrief» (paso Code). Mismo texto que el paso del flujo, listo para publicar como artefacto con `tools/publish-blocks.sh` |

## Puesta en marcha

> **2026-10-19 · F13 deja Google Sheets**, con el mismo patrón que estrenó MKT-F4. El ICP y la voz
> de marca se leen de la base del cliente, los briefs se entregan como trabajo del especialista
> —el cliente los aprueba en su pantalla— y el rastro va a `run_log` con tokens. Claude se llama
> **por HTTP contra su API**, no con la pieza: `piece-claude@0.5.0` devuelve solo `content[0].text`
> y con los modelos actuales se queda vacía (ver la tabla de trampas de
> [GUIA_construir_flujos.md](../../GUIA_construir_flujos.md)).

### 1. Lo que ya está en la base del cliente

| Qué | Dónde | Estado |
|---|---|---|
| ICP | `mkt_input_value` con `input_key = 'icp'` | cargado |
| Voz de marca | `mkt_input_value` con `input_key = 'brand_voice'` | 16 valores, de LAB 03/04 |
| Pestaña de entrega | `work_collection` `briefs` de `content_promotion`, aprobable, 10 columnas | creada |
| Las tres funciones | `flow-input-read`, `work-items-write`, `run-log-write` | desplegadas |

El ICP y la marca se editan en VrutalOS → **Negocio**, no en una hoja. Si falta alguno de los dos,
el flujo falla en el «Ordena» y no escribe nada.

### 2. Conexiones en Activepieces

**Ninguna.** El webhook se autentica con su cabecera `X-Vrutal-Token` y los pasos HTTP con
`X-AP-Token`; la clave de Claude se pide al Vault en ejecución. Ni la conexión
`Google · Vrutal-labs` ni la de `Claude · Vrutal-labs` se usan ya en este flujo.

### 3. Importar y poner los dos secretos

La plantilla del repo ya está migrada: **Flujos → Importar** → `F13.template.json`. Después, en el
flujo importado, dos cosas y solo dos:

1. **El token del webhook.** El valor de `X-Vrutal-Token` en la plantilla es un marcador. Pon el
   secreto real —el que ya usa el flujo publicado, o uno nuevo— y actualízalo en quien llame al
   webhook:

   ```bash
   openssl rand -hex 24 | tr -d '\n' | clip
   ```

2. **El token de las funciones.** `X-AP-Token` en los cinco pasos HTTP (1, 2, 3, 5 y 6): el secreto
   `AP_INTEGRATION_TOKEN` del proyecto de Supabase del cliente. El paso contra Anthropic (`step_7`)
   **no lo lleva**: su cabecera es `x-api-key` y se resuelve de `{{step_3.body.key}}`.

Si algún cuerpo JSON hay que volver a pegarlo, va **en el campo «JSON Body»** y sin comillas
invertidas: la pieza lee el cuerpo de `body.data`, así que fuera de ese campo se envía vacío y sin
avisar.

### 4. Probar y publicar

1. **Probar flujo** con un cuerpo de calendario de verdad. F12 (el flujo que llena el calendario)
   todavía no está construido, así que el cuerpo se manda a mano. Este sirve: son los seis campos
   del contrato `EditorialPlan` y la keyword es una de las que F4 entregó de verdad el 2026-10-21.

   ```json
   {
     "week": "2026-W44",
     "publish_at": "2026-10-28",
     "piece_title": "Cuánto cuesta de verdad que se vaya una persona",
     "channel": "linkedin",
     "target_keyword": "cuánto cuesta la rotación de empleados",
     "brief_id": "kw-cuanto-cuesta-la-rotacion-de-empleados"
   }
   ```

   Qué debe verse: `step_1` con `count: 16` (ICP) y `step_2` con `count: 16` (marca); `step_7` con
   `content` y `usage`; `step_5` devolviendo `{"collection": "briefs", "written": N}`; `step_6` con
   `{"ok": true}`. Si `step_5` responde **400 nombrando una columna**, el «Ordena» está emitiendo
   una columna que la colección no declara: es el fallo que ya costó una ronda en F4 con `estado`.
2. **En VrutalOS**: el Especialista de Contenido tiene la pestaña **Briefs** con N filas en estado
   **propuesta**, y se pueden aprobar o rechazar. En **Consumo**, la ejecución con sus tokens.
3. **Publicar**, y borrar el flujo viejo si quedó duplicado al importar.
4. Comprobación de que de verdad se fue de Sheets: en la versión publicada no queda ningún paso con
   `piece-google-sheets`.

## Contratos

- **ContentBrief** (existente + `link_url`, 2026-10-09): `brief_id`, `objective`, `audience`, `key_message`, `evidence`, `cta`, `target_keyword`, `channel`, `link_url`. `link_url` formaliza el campo `target_page` que F10 proponía sin fijarlo en el contrato (ver `MKT-F10_keyword_pagina/README.md`) — mismo campo, nombre definitivo.
- **F13 no entrega `link_url`, y es correcto.** Un brief de F13 nace de una entrada del calendario, que no dice en qué página va: la página la asigna **F10**, que escribe en la misma colección `briefs` con ese campo relleno. Por eso F13 entrega 9 de las 10 columnas declaradas y la columna «Enlace» sale vacía en sus filas. Lo que no se puede hacer es pedírselo a Claude: inventaría una URL. Si algún día F13 debe traerlo, vendrá en el cuerpo del webhook y se copiará de ahí, nunca del modelo.

## Diferencias con el diagrama (a revisar)

- «Consulta» del diagrama es un solo bloque; aquí son dos lecturas (ICP y voz de marca) más la de la clave. La keyword objetivo viene en el cuerpo del webhook.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula). Sigue valiendo: una fila de `work_item` se puede exportar a una hoja más adelante.
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución y solo la devuelve `integration-get-key`, que tiene lista blanca de proveedores.
