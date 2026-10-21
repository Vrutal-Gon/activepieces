# MKT-F5 · Ficha comparativa de competidores

`marketing_analyst` · TSK-000178 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F5**).

```
Recibe → Consulta → Consulta → Ordena → Ejecuta → Deja rastro
```

Patrón AGENT, riesgo bajo, solo lectura.

| Archivo | Qué es |
|---|---|
| `F5.template.json` | Variante **HTTP** (la de por defecto). Se importa en borrador: no se ejecuta solo |
| `F5-agente.template.json` | Variante **agente**: Claude busca y visita las páginas él mismo |

## Dos variantes, un solo trabajo

El paso que observa a la competencia no tiene una sola forma de hacerse, y por eso hay dos
plantillas en vez de un paso pendiente. En el catálogo son **dos opciones del mismo slot**
(`observa`, posición 4 de la composición `pipeline` v2 de TSK-000178), cada una con su condición:

| Variante | `applies_when` | Qué hace | Lo que cuesta y lo que no ve |
|---|---|---|---|
| **HTTP** (por defecto) | `{"competitor_watch": "http"}` | GET a la web del competidor; el HTML crudo alimenta el Ordena | No gasta modelo. Mira **una web por ejecución** (la de mayor prioridad) y **no ejecuta JavaScript**: una web hecha con React no se ve |
| **Agente** | `{"competitor_watch": "agent"}` | Una llamada a la API de Anthropic con `web_search_20260209` y `web_fetch_20260209` (8 usos máx.), que cita la fuente de cada dato | Gasta modelo y búsquedas, y el alcance varía entre ejecuciones. Si la respuesta vuelve con `stop_reason: pause_turn`, el Ordena falla en vez de entregar una ficha a medias |

La variante de agente necesita la clave del Vault (un paso más, `step_6`); la de HTTP no llama a
ningún modelo y por eso ese slot está marcado como opcional en el catálogo.

**Falta una tercera, prevista y sin construir**: extracción con selectores — el precio concreto de
una página concreta. Cuando exista será otra opción de este mismo slot, no otro flujo.

**Aviso antes de probar cualquiera de las dos**: las 5 filas que hay hoy en Negocio → Competencia
son categorías sacadas de LAB 03 (La inercia, Agencias, Consultoras, Software houses, Empresas de
automatización) y **ninguna tiene web**. Sin nombres propios no hay nada que visitar: el mapa de
competidores con nombres es trabajo pendiente de LAB 06, capítulo 9.

## Puesta en marcha

1. Lo que este flujo lee y entrega, todo en la base del cliente:

| Antes (pestaña) | Ahora | Campos |
|---|---|---|
| `Competidores` | entrada `competitor` | `competidor` · `url` |
| `Fichas` | colección `fichas` de work_item | `fecha` · `competitor` · `pricing` · `messaging` · `channels` · `source_url` · `observed_at` |
| `Rastro` | `run_log` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones en Activepieces: **ninguna**. Los pasos HTTP se autentican con `X-AP-Token` (el secreto `AP_INTEGRATION_TOKEN` del proyecto) y la clave de Claude se pide al Vault en ejecución.
3. **Flujos → Importar** → `F5.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Sin configurar (revisa día y hora) |
| `step_1` Consulta · competidores definidos del cliente | Nada que configurar: lee `Competidores` de la base del cliente. Solo el secreto `AP_INTEGRATION_TOKEN` en la cabecera `X-AP-Token`. |
| `step_2` Consulta · páginas públicas de cada competidor | **Sustituir el paso.** Leer las páginas públicas de cada URL de `{{step_1}}` (precios, mensajes, canales) y devolver una lista de objetos con los campos de CompetitorCard. Solo URLs de la hoja; sin seguir enlaces a otros dominios. Herramienta sin decidir (HTTP + extracción, o agente). |
| `step_3` Ordena · CompetitorCard | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_4` Ejecuta · escribir la ficha | Nada que configurar: entrega a la colección `fichas`, que el cliente ve en «Su trabajo». Las filas nacen como propuesta si la colección es aprobable. |
| `step_5` Deja rastro | Nada que configurar: deja la ejecución en `run_log`, con sus tokens. Solo el token en `X-AP-Token`. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Consulta · páginas públicas de cada competidor** — Leer las páginas públicas de cada URL de `{{step_1}}` (precios, mensajes, canales) y devolver una lista de objetos con los campos de CompetitorCard. Solo URLs de la hoja; sin seguir enlaces a otros dominios. Herramienta sin decidir (HTTP + extracción, o agente).

## Contratos

- **CompetitorCard** (nuevo, propuesto): `competitor`, `pricing`, `messaging`, `channels`, `source_url`, `observed_at`

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula): una fila de `work_item` puede acabar exportada a una hoja.
- La clave de Claude no vive en el flujo: se pide al Vault del cliente en cada ejecución.
- Los cuerpos JSON van en el campo **JSON Body** de cada paso HTTP: fuera de ahí se envían vacíos y sin avisar.
