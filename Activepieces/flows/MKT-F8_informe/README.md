# MKT-F8 · Informe semanal de marketing

`marketing_analyst` · TSK-000081 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F8**).

```
Recibe → Consulta → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, reversible, solo informe interno. Encadenar tras F7.

| Archivo | Qué es |
|---|---|
| `F8.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. Lo que este flujo lee y entrega, todo en la base del cliente:

| Antes (pestaña) | Ahora | Campos |
|---|---|---|
| `Métricas` | colección `metricas` de work_item | las escribe F3 |
| `Diagnóstico` | colección `diagnostico` de work_item | las escribe F7 |
| `Informes` | colección `informes` de work_item | `fecha` · `period_start` · `rank` · `channel` · `conclusion` · `action` |
| `Rastro` | `run_log` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones en Activepieces: **ninguna**. Los pasos HTTP se autentican con `X-AP-Token` (el secreto `AP_INTEGRATION_TOKEN` del proyecto) y la clave de Claude se pide al Vault en ejecución.
3. **Flujos → Importar** → `F8.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · foto semanal | Nada que configurar: lee `Métricas` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_2` Consulta · diagnóstico por canal | Nada que configurar: lee `Diagnóstico` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_3` Consulta · clave de Anthropic (Vault) | Nada que configurar: pide la clave de Anthropic al Vault del cliente. Solo el token en `X-AP-Token`. |
| `step_4` Decide · tres conclusiones accionables | Nada que configurar: la clave se resuelve del paso anterior. Revisa el prompt y el modelo |
| `step_5` Ordena · WeeklyReport | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_6` Ejecuta · entregar el informe (hoja Informes) | Nada que configurar: entrega a la colección `informes`, que el cliente ve en «Su trabajo». Las filas nacen como propuesta si la colección es aprobable. |
| `step_7` Deja rastro | Nada que configurar: deja la ejecución en `run_log`, con sus tokens. Solo el token en `X-AP-Token`. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **WeeklyReport** (nuevo, propuesto): `period_start`, `rank`, `channel`, `conclusion`, `action`

## Diferencias con el diagrama (a revisar)

- «Consulta» del diagrama es un solo bloque; aquí son dos lecturas de hoja (foto y diagnóstico).
- La entrega al destinatario interno se resuelve, de momento, escribiendo el informe en la pestaña `Informes` (cada hoja es una tabla). Email o Slack, cuando se decida.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula): una fila de `work_item` puede acabar exportada a una hoja.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución.
- Los cuerpos JSON van en el campo **JSON Body** de cada paso HTTP: fuera de ahí se envían vacíos y sin avisar.
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
