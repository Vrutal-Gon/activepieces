# MKT-F9 · Tendencias de búsqueda y competidores

`search_marketing` · TSK-000163 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F9**).

```
Recibe → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón AGENT, riesgo bajo, solo lectura. **Bloqueado**: necesita Search Console, que hoy no está disponible (sin web verificada). El diseño es válido; la construcción espera esa fuente.

| Archivo | Qué es |
|---|---|
| `F9.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Oportunidades` | `fecha` · `topic` · `source` · `signal` · `priority` · `rationale` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F9.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Sin configurar (revisa día y hora) |
| `step_1` Consulta · posiciones y consultas propias del sitio | **Sustituir el paso.** Search Console del sitio propio (posiciones y consultas). BLOQUEADO: sin web verificada con tráfico. |
| `step_2` Consulta · tendencias de búsqueda y actividad de competidores | **Sustituir el paso.** Tendencias de búsqueda y actividad de competidores. Fuente sin decidir (Google Trends, F5). |
| `step_3` Decide · oportunidades priorizadas | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo |
| `step_4` Ordena · OpportunityList | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_5` Ejecuta · escribir las oportunidades | Misma conexión y hoja → pestaña `Oportunidades`. **Rows Data Format = `JSON`** y en el campo solo `{{step_4.rows}}` (la lista, no `rows_json`) |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Consulta · posiciones y consultas propias del sitio** — Search Console del sitio propio (posiciones y consultas). BLOQUEADO: sin web verificada con tráfico.
- **Consulta · tendencias de búsqueda y actividad de competidores** — Tendencias de búsqueda y actividad de competidores. Fuente sin decidir (Google Trends, F5).

## Contratos

- **OpportunityList** (nuevo, propuesto): `topic`, `source`, `signal`, `priority`, `rationale`

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
