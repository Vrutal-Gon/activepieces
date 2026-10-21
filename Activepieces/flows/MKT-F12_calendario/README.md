# MKT-F12 · Calendario editorial a 4 semanas

`content_promotion` · VRL-MKT-C01 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F12**).

```
Recibe → Consulta → Consulta → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, reversible. Cadena: KeywordSet (F4) → calendario → ContentBrief (F13).

| Archivo | Qué es |
|---|---|
| `F12.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. Lo que este flujo lee y entrega, todo en la base del cliente:

| Antes (pestaña) | Ahora | Campos |
|---|---|---|
| `Hallazgos` | colección `hallazgos` de work_item | los escribe F11 |
| `Keywords` | colección `keywords` de work_item | las escribe F4 |
| `Calendario` | colección `calendario` de work_item | `fecha` · `week` · `publish_at` · `piece_title` · `channel` · `target_keyword` · `brief_id` |
| `Rastro` | `run_log` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones en Activepieces: **ninguna**. Los pasos HTTP se autentican con `X-AP-Token` (el secreto `AP_INTEGRATION_TOKEN` del proyecto) y la clave de Claude se pide al Vault en ejecución.
3. **Flujos → Importar** → `F12.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Sin configurar (revisa día y hora) |
| `step_1` Consulta · hallazgos | Nada que configurar: lee `Hallazgos` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_2` Consulta · KeywordSet | Nada que configurar: lee `Keywords` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_3` Consulta · calendario actual | Nada que configurar: lee `Calendario` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_4` Consulta · clave de Anthropic (Vault) | Nada que configurar: pide la clave de Anthropic al Vault del cliente. Solo el token en `X-AP-Token`. |
| `step_5` Decide · qué piezas y en qué fechas | Nada que configurar: la clave se resuelve del paso anterior. Revisa el prompt y el modelo |
| `step_6` Ordena · EditorialPlan | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_7` Ejecuta · actualizar el calendario | Nada que configurar: entrega a la colección `calendario`, que el cliente ve en «Su trabajo». Las filas nacen como propuesta si la colección es aprobable. |
| `step_8` Deja rastro | Nada que configurar: deja la ejecución en `run_log`, con sus tokens. Solo el token en `X-AP-Token`. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **EditorialPlan** (nuevo, propuesto): `week`, `publish_at`, `piece_title`, `channel`, `target_keyword`, `brief_id`

## Diferencias con el diagrama (a revisar)

- «Consulta» del diagrama es un solo bloque; aquí son tres lecturas de hoja.
- F12 y F2 comparten la pestaña `Calendario`: F2 busca por `brief_id`, que F12 deja vacío y F13 genera después. Decidir quién asigna el `brief_id` (propuesta: F12, con la forma `<semana>-<canal>-<n>`).

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula): una fila de `work_item` puede acabar exportada a una hoja.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución.
- Los cuerpos JSON van en el campo **JSON Body** de cada paso HTTP: fuera de ahí se envían vacíos y sin avisar.
