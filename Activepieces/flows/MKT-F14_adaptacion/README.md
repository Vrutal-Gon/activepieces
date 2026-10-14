# MKT-F14 · Adaptar una pieza aprobada a cada canal

`content_promotion` · VRL-MKT-C02 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F14**).

```
Recibe → Consulta → Decide → Ordena → Pide permiso → Ejecuta → Deja rastro
```

Patrón LLM, riesgo medio, reversible. **De cara al público: cada adaptación pasa por «Pide permiso».**

| Archivo | Qué es |
|---|---|
| `F14.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Formatos` | `canal` · `longitud_max` · `reglas` |
| `Borradores` | `fecha` · `brief_id` · `channel` · `body` · `version` · `voice_check` · `voice_issues` · `status` · `publish_at` · `tags_ia` · `link_url` · `utm_source` · `utm_medium` · `utm_campaign` · `utm_term` · `utm_content` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F14.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · reglas de formato y longitud por canal | **Crea la pestaña `Formatos` en la hoja y elígela en el desplegable** (aún no existe). Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Formatos` |
| `step_2` Decide · adaptar la pieza a cada canal | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo. **Además de adaptar el texto, asigna `tags_ia` y construye el enlace con UTM** (ver «Etiquetado interno» y «UTM automáticos» más abajo) |
| `step_3` Ordena · ContentDraft por canal | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_4` Pide permiso · aprobar cada adaptación | **Sustituir el paso.** Enviar cada adaptación (`{{step_3.rows}}`) al founder y esperar una respuesta por adaptación; solo las aprobadas siguen. Fail-closed: sin respuesta, no se guarda nada como aprobado. |
| `step_5` Ejecuta · guardar las versiones aprobadas | Misma conexión y hoja → pestaña `Borradores`. **Rows Data Format = `JSON`** y en el campo solo `{{step_3.rows}}` (la lista, no `rows_json`) |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Pide permiso · aprobar cada adaptación** — Enviar cada adaptación (`{{step_3.rows}}`) al founder y esperar una respuesta por adaptación; solo las aprobadas siguen. Fail-closed: sin respuesta, no se guarda nada como aprobado.

## Contratos

- **ContentDraft** (existente + campos de UTM, 2026-10-09): `brief_id`, `channel`, `body`, `version`, `voice_check`, `voice_issues`, `status`, `publish_at`, `tags_ia`, `link_url`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`

## Etiquetado interno (`tags_ia`, decidido 2026-10-07)

Cada adaptación lleva etiquetas internas con el formato `#categoria:valor` (p. ej. `#tema:rotacion-personal #formato:hilo`), espacio-separadas en una sola celda. **Las pone la IA sola, en `step_2`, nadie se las pide al cliente.** Sirven para que F3 (métricas) y los propios `Decide` de F12/F14 aprendan qué temas o formatos rinden mejor — un bucle de la IA hacia sí misma, no un reporte para el cliente.

**No es dato de cliente**: igual que el catálogo de tareas (`VrutalOS/diseno/README.md`, «el catálogo no se enseña»), `tags_ia` no debe aparecer en ninguna pantalla de VrutalOS ni en ninguna vista que lea `authenticated`. Cuando `Borradores`/`Publicaciones` pasen de hoja de Google a tabla de VrutalOS (`work_item`), esta columna necesita quedar fuera de la vista con la que RLS alimenta al cliente — mismo patrón que `secret_ref` en `integrations`.

## UTM automáticos (decidido 2026-10-09)

Distinto de `tags_ia`, aunque se calculan en el mismo paso: los UTM **van dentro del enlace publicado de verdad** — cualquiera que haga clic los ve en la URL. No deben derivarse de `tags_ia` (eso mezclaría lo interno con lo público); se calculan de campos ya estructurados del propio `ContentBrief`, en modo automático, nadie los escribe a mano:

| UTM | Se calcula de |
|---|---|
| `utm_source` | `channel` (identificador real del canal, p. ej. `linkedin`, `x` — los mismos de Postiz) |
| `utm_medium` | fijo por tipo de canal (`social` para las redes; pendiente de revisar para canales no-sociales, p. ej. `listmonk`/email) |
| `utm_campaign` | `brief_id` |
| `utm_term` | `target_keyword` (de `ContentBrief`) |
| `utm_content` | `version` de `ContentDraft` (variante por canal; **no** `tags_ia`, para no mezclar lo interno con lo público) |

`step_2` toma `link_url` de `ContentBrief` (ver `MKT-F13_brief/README.md`), construye la URL final con los 5 parámetros (urlencoded, sin duplicar querystring si `link_url` ya trae uno) y la incrusta en `body` antes de guardar en `Borradores`. Los 5 valores se guardan también por separado en `ContentDraft` (no solo concatenados en la URL) para que F3 pueda agregar por cualquiera de ellos — ver `MKT-F3_metricas/README.md`.

## Diferencias con el diagrama (a revisar)

- Con el paso de permiso pendiente, «Guardar las versiones aprobadas» hoy escribiría todas las filas de `{{step_3.rows}}`: al configurar el permiso hay que pasar al paso de escritura solo las aprobadas.

## Conexión con F2/Postiz (sin construir, nota de diseño)

F14 **no publica**: deja en `Borradores` el `ContentDraft` aprobado por canal. Hoy solo MKT-F2 publica, y solo LinkedIn. La idea es que F2 se generalice para leer también `Borradores` (por `brief_id` + `channel`, no solo `Calendario`) y llame a Postiz con el `integration id` del canal de cada fila — así cualquier canal que F14 adapte tiene dónde publicarse, no solo LinkedIn. Ver `MKT-F2_linkedin/README.md`.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
