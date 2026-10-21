# MKT-F7 · Diagnóstico por canal frente a su objetivo

`marketing_analyst` · TSK-000189 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F7**).

```
Recibe → Consulta → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, solo lectura. Depende de F3 (la foto semanal), que hoy solo tiene HubSpot como fuente. Encadenar: al terminar F3, llamar a este webhook.

| Archivo | Qué es |
|---|---|
| `F7.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. Lo que este flujo lee y entrega, todo en la base del cliente:

| Antes (pestaña) | Ahora | Campos |
|---|---|---|
| `Métricas` | colección `metricas` de work_item | las escribe F3 |
| `Objetivos` | entrada `channel_target` | `canal` · `metrica` · `objetivo` |
| `Diagnóstico` | colección `diagnostico` de work_item | `fecha` · `period_start` · `channel` · `metric` · `value` · `target` · `status` · `note` |
| `Rastro` | `run_log` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones en Activepieces: **ninguna**. Los pasos HTTP se autentican con `X-AP-Token` (el secreto `AP_INTEGRATION_TOKEN` del proyecto) y la clave de Claude se pide al Vault en ejecución.
3. **Flujos → Importar** → `F7.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · foto semanal de métricas | Nada que configurar: lee `Métricas` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_2` Consulta · objetivos por canal | Nada que configurar: lee `Objetivos` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_3` Consulta · clave de Anthropic (Vault) | Nada que configurar: pide la clave de Anthropic al Vault del cliente. Solo el token en `X-AP-Token`. |
| `step_4` Decide · resultado frente al objetivo, por canal | Nada que configurar: la clave se resuelve del paso anterior. Revisa el prompt y el modelo |
| `step_5` Ordena · ChannelDiagnosis | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_6` Ejecuta · escribir el diagnóstico | Nada que configurar: entrega a la colección `diagnostico`, que el cliente ve en «Su trabajo». Las filas nacen como propuesta si la colección es aprobable. |
| `step_7` Deja rastro | Nada que configurar: deja la ejecución en `run_log`, con sus tokens. Solo el token en `X-AP-Token`. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **ChannelDiagnosis** (nuevo, propuesto): `period_start`, `channel`, `metric`, `value`, `target`, `status`, `note`

## Diferencias con el diagrama (a revisar)

- Se añade un paso «Ordena» (el diagrama no lo dibuja) para validar el JSON de Claude antes de escribir filas.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula): una fila de `work_item` puede acabar exportada a una hoja.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución.
- Los cuerpos JSON van en el campo **JSON Body** de cada paso HTTP: fuera de ahí se envían vacíos y sin avisar.
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
