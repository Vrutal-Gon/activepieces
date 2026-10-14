# MKT-F12 · Calendario editorial a 4 semanas

`content_promotion` · VRL-MKT-C01 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F12**).

```
Recibe → Consulta → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, reversible. Cadena: KeywordSet (F4) → calendario → ContentBrief (F13).

| Archivo | Qué es |
|---|---|
| `F12.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Hallazgos` | los escribe F11 |
| `Keywords` | las escribe F4 |
| `Calendario` | `fecha` · `week` · `publish_at` · `piece_title` · `channel` · `target_keyword` · `brief_id` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F12.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Sin configurar (revisa día y hora) |
| `step_1` Consulta · hallazgos | **Crea la pestaña `Hallazgos` en la hoja y elígela en el desplegable** (aún no existe). Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Hallazgos` |
| `step_2` Consulta · KeywordSet | Nada que hacer: pestaña `Keywords` ya puesta. Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Keywords` |
| `step_3` Consulta · calendario actual | **Crea la pestaña `Calendario` en la hoja y elígela en el desplegable** (aún no existe). Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Calendario` |
| `step_4` Decide · qué piezas y en qué fechas | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo |
| `step_5` Ordena · EditorialPlan | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_6` Ejecuta · actualizar el calendario | Misma conexión y hoja → pestaña `Calendario`. **Rows Data Format = `JSON`** y en el campo solo `{{step_5.rows}}` (la lista, no `rows_json`) |
| `step_7` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **EditorialPlan** (nuevo, propuesto): `week`, `publish_at`, `piece_title`, `channel`, `target_keyword`, `brief_id`

## Diferencias con el diagrama (a revisar)

- «Consulta» del diagrama es un solo bloque; aquí son tres lecturas de hoja.
- F12 y F2 comparten la pestaña `Calendario`: F2 busca por `brief_id`, que F12 deja vacío y F13 genera después. Decidir quién asigna el `brief_id` (propuesta: F12, con la forma `<semana>-<canal>-<n>`).
- **Nota de diseño (sin construir):** la columna `channel` ya existe, pero nadie valida contra qué canales están realmente conectados para ese cliente. Si se adopta Postiz, `GET /public/v1/integrations` podría dar la lista real de canales conectados — uso menor, no crítico, se deja para después de validar F2/F14.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
