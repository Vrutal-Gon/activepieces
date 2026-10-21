# MKT-F14 · Adaptar una pieza aprobada a cada canal

`content_promotion` · VRL-MKT-C02 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F14**).

```
Recibe → Consulta → Consulta → Decide → Ordena → Pide permiso → Ejecuta → Deja rastro
```

Patrón LLM, riesgo medio, reversible. **De cara al público: cada adaptación pasa por «Pide permiso».**

| Archivo | Qué es |
|---|---|
| `F14.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. Lo que este flujo lee y entrega, todo en la base del cliente:

| Antes (pestaña) | Ahora | Campos |
|---|---|---|
| `Formatos` | — | `canal` · `longitud_max` · `reglas` |
| `Borradores` | colección `borradores` de work_item | `fecha` · `brief_id` · `channel` · `body` · `version` · `voice_check` · `voice_issues` · `status` · `publish_at` |
| `Rastro` | `run_log` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones en Activepieces: **ninguna**. Los pasos HTTP se autentican con `X-AP-Token` (el secreto `AP_INTEGRATION_TOKEN` del proyecto) y la clave de Claude se pide al Vault en ejecución.
3. **Flujos → Importar** → `F14.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · reglas de formato y longitud por canal | **Sustituir el paso.** Decide dónde vive «Formatos» en VrutalOS (tabla de entrada que mantiene el cliente, o colección de work_item que escribe otro flujo) y añádelo al mapa LEE del generador. |
| `step_2` Consulta · clave de Anthropic (Vault) | Nada que configurar: pide la clave de Anthropic al Vault del cliente. Solo el token en `X-AP-Token`. |
| `step_3` Decide · adaptar la pieza a cada canal | Nada que configurar: la clave se resuelve del paso anterior. Revisa el prompt y el modelo |
| `step_4` Ordena · ContentDraft por canal | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_5` Pide permiso · aprobar cada adaptación | **Sustituir el paso.** Enviar cada adaptación (`{{step_3.rows}}`) al founder y esperar una respuesta por adaptación; solo las aprobadas siguen. Fail-closed: sin respuesta, no se guarda nada como aprobado. |
| `step_6` Ejecuta · guardar las versiones aprobadas | Nada que configurar: entrega a la colección `borradores`, que el cliente ve en «Su trabajo». Las filas nacen como propuesta si la colección es aprobable. |
| `step_7` Deja rastro | Nada que configurar: deja la ejecución en `run_log`, con sus tokens. Solo el token en `X-AP-Token`. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Pide permiso · aprobar cada adaptación** — Enviar cada adaptación (`{{step_3.rows}}`) al founder y esperar una respuesta por adaptación; solo las aprobadas siguen. Fail-closed: sin respuesta, no se guarda nada como aprobado.

## Contratos

- **ContentDraft** (existente): `brief_id`, `channel`, `body`, `version`, `voice_check`, `voice_issues`, `status`, `publish_at`

## Diferencias con el diagrama (a revisar)

- Con el paso de permiso pendiente, «Guardar las versiones aprobadas» hoy escribiría todas las filas de `{{step_3.rows}}`: al configurar el permiso hay que pasar al paso de escritura solo las aprobadas.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula): una fila de `work_item` puede acabar exportada a una hoja.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución.
- Los cuerpos JSON van en el campo **JSON Body** de cada paso HTTP: fuera de ahí se envían vacíos y sin avisar.
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
