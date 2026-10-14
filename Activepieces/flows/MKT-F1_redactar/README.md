# MKT-F1 · Redactar una pieza desde su brief

`content_promotion` · TSK-000010 + TSK-000057 · diseño en [MARKETING_flujos_v0.1.drawio](../MARKETING_flujos_v0.1.drawio) (página **F1**).

```
Recibe → Ordena → Consulta → Decide → Decide → Ejecuta → Deja rastro
```

Riesgo medio, reversible, no publica. Si la voz falla, el borrador sigue marcado con sus incidencias; lo ves al aprobar en F2.

| Archivo | Qué es |
|---|---|
| `F1.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Briefs` | `fecha` · `brief_id` · `objective` · `audience` · `key_message` · `evidence` · `cta` · `target_keyword` · `channel` · `link_url` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` (Sheets), `Claude · Vrutal-labs` y, desde 2026-10-10, **`Google Docs`** (`xwuKZRmYFcoJAKff8DGgw`, scopes `documents`/`drive`/`drive.readonly`) — ya referenciada en la plantilla, no hay que crearla.
3. **Flujos → Importar** → `F1.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Ordena · a ContentBrief | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_2` Consulta · memoria de marca | **Resuelto 2026-10-10**: lee la pestaña `Marca` por Google Sheets (`get-many-rows`), mismo patrón ya probado en F13 `step_2`. Conexión ya puesta en la plantilla |
| `step_3` Decide · redactar borrador | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo |
| `step_4` Decide · control de voz | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo |
| `step_5` Ejecuta · crear documento | **Resuelto 2026-10-10**: piece Google Docs, acción `create_document` (confirmada en Activepieces 0.82: `title` y `body`, ambos de texto). `title` = `Borrador — {{step_1.rows[0].brief_id}}`; `body` = `{{step_4}}` (el JSON completo: cuerpo + `voice_check` + incidencias — sin Router que lo filtre, a propósito: el borrador sigue adelante marcado, igual que dice la cabecera de este README). Conexión Google Docs ya puesta en la plantilla |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes

Ninguno falla a propósito ya — los dos que lo hacían (`step_2`, `step_5`) quedaron resueltos el 2026-10-10, con sus conexiones ya creadas y referenciadas en la plantilla. Queda solo importar y probar (punto 3 de arriba).

## Contratos

- **ContentBrief** (existente + `link_url`, 2026-10-09 — ver `MKT-F13_brief/README.md`): `brief_id`, `objective`, `audience`, `key_message`, `evidence`, `cta`, `target_keyword`, `channel`, `link_url`. F1 no toca `link_url`: lo etiqueta con UTM más adelante F14.

## Diferencias con el diagrama (a revisar)

- El diagrama no dibuja un Ordena de ContentDraft tras el control de voz: el JSON de Claude va directo a «Crear documento». Conviene validarlo ahí.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
