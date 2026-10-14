# MKT-F5 · Ficha comparativa de competidores

`marketing_analyst` · TSK-000178 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F5**).

```
Recibe → Consulta → Consulta → Ordena → Ejecuta → Deja rastro
```

Patrón AGENT, riesgo bajo, solo lectura.

| Archivo | Qué es |
|---|---|
| `F5.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Competidores` | `competidor` · `url` |
| `Fichas` | `fecha` · `competitor` · `pricing` · `messaging` · `channels` · `source_url` · `observed_at` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F5.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Sin configurar (revisa día y hora) |
| `step_1` Consulta · competidores definidos del cliente | **Crea la pestaña `Competidores` en la hoja y elígela en el desplegable** (aún no existe). Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Competidores` |
| `step_2` Consulta · páginas públicas de cada competidor | **Sustituir el paso.** Leer las páginas públicas de cada URL de `{{step_1}}` (precios, mensajes, canales) y devolver una lista de objetos con los campos de CompetitorCard. Solo URLs de la hoja; sin seguir enlaces a otros dominios. Herramienta sin decidir (HTTP + extracción, o agente). |
| `step_3` Ordena · CompetitorCard | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_4` Ejecuta · escribir la ficha | Misma conexión y hoja → pestaña `Fichas`. **Rows Data Format = `JSON`** y en el campo solo `{{step_3.rows}}` (la lista, no `rows_json`) |
| `step_5` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Consulta · páginas públicas de cada competidor** — Leer las páginas públicas de cada URL de `{{step_1}}` (precios, mensajes, canales) y devolver una lista de objetos con los campos de CompetitorCard. Solo URLs de la hoja; sin seguir enlaces a otros dominios. Herramienta sin decidir (HTTP + extracción, o agente).

## Contratos

- **CompetitorCard** (nuevo, propuesto): `competitor`, `pricing`, `messaging`, `channels`, `source_url`, `observed_at`

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
