# MKT-F13 · ContentBrief de cada pieza

`content_promotion` · TSK-000197 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F13**).

```
Recibe → Consulta → Consulta → Decide → Ordena → Ejecuta → Deja rastro
```

Patrón LLM, riesgo bajo, reversible. **La prueba cita su fuente o queda vacía**: el rol nunca inventa cifras ni casos (el prompt lo pide y el paso Ordena lo hace cumplir).

| Archivo | Qué es |
|---|---|
| `F13.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Perfil` | `campo` · `valor` (ya existe) |
| `Marca` | `campo` · `valor` (voz, diccionario) |
| `Briefs` | `fecha` · `brief_id` · `objective` · `audience` · `key_message` · `evidence` · `cta` · `target_keyword` · `channel` · `link_url` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F13.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Consulta · ICP | Nada que hacer: pestaña `Perfil` ya puesta. Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Perfil` |
| `step_2` Consulta · voz de marca | Nada que hacer: pestaña `Marca` ya puesta. Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Marca` |
| `step_3` Decide · objetivo, mensaje, prueba, CTA y enlace | Conexión `Claude · Vrutal-labs`. Revisa el prompt (está en el paso) y el modelo. **Fija `link_url`**: la URL de destino de la pieza (landing, entrada de blog...) — es la base que F14 etiqueta con UTM (ver `MKT-F14_adaptacion/README.md`) |
| `step_4` Ordena · ContentBrief | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_5` Ejecuta · guardar el brief | Misma conexión y hoja → pestaña `Briefs`. **Rows Data Format = `JSON`** y en el campo solo `{{step_4.rows}}` (la lista, no `rows_json`) |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Contratos

- **ContentBrief** (existente + `link_url`, 2026-10-09): `brief_id`, `objective`, `audience`, `key_message`, `evidence`, `cta`, `target_keyword`, `channel`, `link_url`. `link_url` formaliza el campo `target_page` que F10 proponía sin fijarlo en el contrato (ver `MKT-F10_keyword_pagina/README.md`) — mismo campo, nombre definitivo.

## Diferencias con el diagrama (a revisar)

- «Consulta» del diagrama es un solo bloque; aquí son dos lecturas de hoja (ICP y voz). La keyword objetivo viene en el cuerpo del webhook.

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
