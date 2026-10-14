# MKT-F11 · Auditoría técnica del sitio

`search_marketing` · TSK-000119 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F11**).

```
Recibe → Consulta → Consulta → Ordena → Decide → Ejecuta → Deja rastro
```

Patrón SCRIPT, riesgo bajo, solo lectura. **Bloqueado** en parte: indexación y enlaces necesitan Search Console (sin web verificada).

| Archivo | Qué es |
|---|---|
| `F11.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Hallazgos` | `fecha` · `url` · `issue_type` · `detail` · `severity` · `source` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F11.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Sin configurar (revisa día y hora) |
| `step_1` Consulta · indexación y enlaces rotos | **Sustituir el paso.** Indexación y enlaces rotos del sitio. BLOQUEADO: Search Console no disponible (sin web verificada). |
| `step_2` Consulta · velocidad y experiencia de página | **Sustituir el paso.** Velocidad y experiencia de página (p. ej. PageSpeed Insights API, sin cuenta de cliente). Devolver una lista de hallazgos por URL. |
| `step_3` Ordena · SiteFinding | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_4` Decide · prioridad de cada hallazgo | **Sustituir el paso.** Asignar `severity` (high|medium|low) a cada fila de `{{step_3.rows}}` con reglas deterministas (patrón SCRIPT, sin LLM). Umbrales sin definir. |
| `step_5` Ejecuta · abrir incidencias priorizadas | **Sustituir el paso.** Abrir incidencias priorizadas en la herramienta de tareas (sin decidir) y/o escribir en la pestaña `Hallazgos`. |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Consulta · indexación y enlaces rotos** — Indexación y enlaces rotos del sitio. BLOQUEADO: Search Console no disponible (sin web verificada).
- **Consulta · velocidad y experiencia de página** — Velocidad y experiencia de página (p. ej. PageSpeed Insights API, sin cuenta de cliente). Devolver una lista de hallazgos por URL.
- **Decide · prioridad de cada hallazgo** — Asignar `severity` (high|medium|low) a cada fila de `{{step_3.rows}}` con reglas deterministas (patrón SCRIPT, sin LLM). Umbrales sin definir.
- **Ejecuta · abrir incidencias priorizadas** — Abrir incidencias priorizadas en la herramienta de tareas (sin decidir) y/o escribir en la pestaña `Hallazgos`.

## Contratos

- **SiteFinding** (nuevo, propuesto): `url`, `issue_type`, `detail`, `severity`, `source`

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
