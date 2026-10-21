# MKT-F9 · Tendencias de búsqueda y competidores

`search_marketing` · TSK-000163 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F9**).

```
Recibe → Consulta → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón AGENT, riesgo bajo, solo lectura. **Bloqueado**: necesita Search Console, que hoy no está disponible (sin web verificada). El diseño es válido; la construcción espera esa fuente.

| Archivo | Qué es |
|---|---|
| `F9.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. Lo que este flujo lee y entrega, todo en la base del cliente:

| Antes (pestaña) | Ahora | Campos |
|---|---|---|
| `Oportunidades` | colección `oportunidades` de work_item | `fecha` · `topic` · `source` · `signal` · `priority` · `rationale` |
| `Rastro` | `run_log` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones en Activepieces: **ninguna**. Los pasos HTTP se autentican con `X-AP-Token` (el secreto `AP_INTEGRATION_TOKEN` del proyecto) y la clave de Claude se pide al Vault en ejecución.
3. **Flujos → Importar** → `F9.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Sin configurar (revisa día y hora) |
| `step_1` Consulta · posiciones y consultas propias del sitio | **Sustituir el paso.** Search Console del sitio propio (posiciones y consultas). BLOQUEADO: sin web verificada con tráfico. |
| `step_2` Consulta · tendencias de búsqueda y actividad de competidores | **Sustituir el paso.** Tendencias de búsqueda y actividad de competidores. Fuente sin decidir (Google Trends, F5). |
| `step_3` Consulta · clave de Anthropic (Vault) | Nada que configurar: pide la clave de Anthropic al Vault del cliente. Solo el token en `X-AP-Token`. |
| `step_4` Decide · oportunidades priorizadas | Nada que configurar: la clave se resuelve del paso anterior. Revisa el prompt y el modelo |
| `step_5` Ordena · OpportunityList | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_6` Ejecuta · escribir las oportunidades | Nada que configurar: entrega a la colección `oportunidades`, que el cliente ve en «Su trabajo». Las filas nacen como propuesta si la colección es aprobable. |
| `step_7` Deja rastro | Nada que configurar: deja la ejecución en `run_log`, con sus tokens. Solo el token en `X-AP-Token`. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Consulta · posiciones y consultas propias del sitio** — Search Console del sitio propio (posiciones y consultas). BLOQUEADO: sin web verificada con tráfico.
- **Consulta · tendencias de búsqueda y actividad de competidores** — Tendencias de búsqueda y actividad de competidores. Fuente sin decidir (Google Trends, F5).

## Contratos

- **OpportunityList** (nuevo, propuesto): `topic`, `source`, `signal`, `priority`, `rationale`

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula): una fila de `work_item` puede acabar exportada a una hoja.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución.
- Los cuerpos JSON van en el campo **JSON Body** de cada paso HTTP: fuera de ahí se envían vacíos y sin avisar.
