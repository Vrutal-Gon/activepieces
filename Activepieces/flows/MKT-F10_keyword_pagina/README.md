# MKT-F10 · Asignar keywords a páginas

`search_marketing` · TSK-000128 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F10**).

```
Recibe → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, reversible. Alimenta F13.

| Archivo | Qué es |
|---|---|
| `F10.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Páginas` | `url` · `titulo` · `tema` |
| `Briefs` | `fecha` · `brief_id` · `objective` · `audience` · `key_message` · `evidence` · `cta` · `target_keyword` · `channel` · `link_url` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F10.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · páginas existentes del sitio | **Crea la pestaña `Páginas` en la hoja y elígela en el desplegable** (aún no existe). Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Páginas` |
| `step_2` Decide · keyword → página existente o nueva | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo |
| `step_3` Ordena · ContentBrief | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_4` Ejecuta · escribir los briefs | Misma conexión y hoja → pestaña `Briefs`. **Rows Data Format = `JSON`** y en el campo solo `{{step_3.rows}}` (la lista, no `rows_json`) |
| `step_5` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **ContentBrief** (existente + `link_url`): `brief_id`, `objective`, `audience`, `key_message`, `evidence`, `cta`, `target_keyword`, `channel`, `link_url`. **Resuelto 2026-10-09**: el campo que aquí se proponía como `target_page` quedó fijado en el contrato con el nombre `link_url` (ver `MKT-F13_brief/README.md`) — mismo campo, ya no es una propuesta.

## Diferencias con el diagrama (a revisar)

- El KeywordSet llega en el cuerpo del webhook; el diagrama no dice cómo. Alternativa: leer la pestaña `Keywords` con `estado = propuesta` (F4 las escribe ahí). A decidir.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
