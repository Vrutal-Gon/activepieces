# MKT-F7 · Diagnóstico por canal frente a su objetivo

`marketing_analyst` · TSK-000189 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F7**).

```
Recibe → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, solo lectura. Depende de F3 (la foto semanal), que hoy solo tiene HubSpot como fuente. Encadenar: al terminar F3, llamar a este webhook.

| Archivo | Qué es |
|---|---|
| `F7.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Métricas` | las escribe F3 |
| `Objetivos` | `canal` · `metrica` · `objetivo` |
| `Diagnóstico` | `fecha` · `period_start` · `channel` · `metric` · `value` · `target` · `status` · `note` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F7.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · foto semanal de métricas | Nada que hacer: pestaña `Métricas` ya puesta. Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Métricas` |
| `step_2` Consulta · objetivos por canal | Nada que hacer: pestaña `Objetivos` ya puesta. Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Objetivos` |
| `step_3` Decide · resultado frente al objetivo, por canal | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo |
| `step_4` Ordena · ChannelDiagnosis | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_5` Ejecuta · escribir el diagnóstico | Misma conexión y hoja → pestaña `Diagnóstico`. **Rows Data Format = `JSON`** y en el campo solo `{{step_4.rows}}` (la lista, no `rows_json`) |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **ChannelDiagnosis** (nuevo, propuesto): `period_start`, `channel`, `metric`, `value`, `target`, `status`, `note`

## Diferencias con el diagrama (a revisar)

- Se añade un paso «Ordena» (el diagrama no lo dibuja) para validar el JSON de Claude antes de escribir filas.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
