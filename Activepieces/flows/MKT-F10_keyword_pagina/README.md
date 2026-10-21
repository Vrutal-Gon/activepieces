# MKT-F10 · Asignar keywords a páginas

`search_marketing` · TSK-000128 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F10**).

```
Recibe → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, reversible. Alimenta F13.

| Archivo | Qué es |
|---|---|
| `F10.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. Lo que este flujo lee y entrega, todo en la base del cliente:

| Antes (pestaña) | Ahora | Campos |
|---|---|---|
| `Páginas` | — | `url` · `titulo` · `tema` |
| `Briefs` | colección `briefs` de work_item | `fecha` · `brief_id` · `objective` · `audience` · `key_message` · `evidence` · `cta` · `target_keyword` · `channel` · `target_page` |
| `Rastro` | `run_log` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones en Activepieces: **ninguna**. Los pasos HTTP se autentican con `X-AP-Token` (el secreto `AP_INTEGRATION_TOKEN` del proyecto) y la clave de Claude se pide al Vault en ejecución.
3. **Flujos → Importar** → `F10.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · páginas existentes del sitio | **Sustituir el paso.** Decide dónde vive «Páginas» en VrutalOS (tabla de entrada que mantiene el cliente, o colección de work_item que escribe otro flujo) y añádelo al mapa LEE del generador. |
| `step_2` Consulta · clave de Anthropic (Vault) | Nada que configurar: pide la clave de Anthropic al Vault del cliente. Solo el token en `X-AP-Token`. |
| `step_3` Decide · keyword → página existente o nueva | Nada que configurar: la clave se resuelve del paso anterior. Revisa el prompt y el modelo |
| `step_4` Ordena · ContentBrief | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_5` Ejecuta · escribir los briefs | Nada que configurar: entrega a la colección `briefs`, que el cliente ve en «Su trabajo». Las filas nacen como propuesta si la colección es aprobable. |
| `step_6` Deja rastro | Nada que configurar: deja la ejecución en `run_log`, con sus tokens. Solo el token en `X-AP-Token`. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **ContentBrief** (existente + campo propuesto target_page): `brief_id`, `objective`, `audience`, `key_message`, `evidence`, `cta`, `target_keyword`, `channel`, `target_page`

## Diferencias con el diagrama (a revisar)

- El KeywordSet llega en el cuerpo del webhook; el diagrama no dice cómo. Alternativa: leer la pestaña `Keywords` con `estado = propuesta` (F4 las escribe ahí). A decidir.
- Se propone el campo `target_page` en ContentBrief (hoy no existe): sería ContentBrief@2.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula): una fila de `work_item` puede acabar exportada a una hoja.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución.
- Los cuerpos JSON van en el campo **JSON Body** de cada paso HTTP: fuera de ahí se envían vacíos y sin avisar.
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
