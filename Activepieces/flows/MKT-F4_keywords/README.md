# MKT-F4 · Keywords por dolor del ICP

`search_marketing` · TSK-000161 · diseño en [MARKETING_flujos_v0.1.md](../MARKETING_flujos_v0.1.md) (F4).

```
Recibe (día 1, 08:00) → Consulta perfil (VrutalOS) → Consulta estrategia SEM (VrutalOS) → Decide (Claude) → Ordena KeywordSet → Entrega (work_item) → Deja rastro (run_log)
```

| Archivo | Qué es |
|---|---|
| `F4-keywords.template.json` | Plantilla para importar en Activepieces |
| `blocks/ordena-keywordset.step.ts` | Bloque «Ordena · a KeywordSet» (paso Code). **Cambiado el 2026-10-19**: ya no emite `estado`. Probado (2026-10-02): quita duplicados por idioma, neutraliza fórmulas, descarta filas sin idioma es/en y las que rompen la regla de marca (bots, IA como compra), y rechaza respuestas sin JSON |

## Puesta en marcha

> **2026-10-19 · F4 deja Google Sheets.** El perfil lo lee de la base del cliente y las keywords
> las entrega como trabajo del especialista, que el cliente aprueba en su pantalla. Tres pasos
> cambian de pieza (Sheets → HTTP contra tres Edge Functions de VrutalOS) y el bloque «Ordena»
> deja de emitir la columna `estado`: ese dato es ahora el estado del `work_item`
> (`proposed` → `approved` | `rejected`).

### 1. Lo que tiene que estar en la base del cliente (ya está, 2026-10-19)

| Qué | Dónde | Estado |
|---|---|---|
| Perfil e ICP | `mkt_input_value` con `input_key = 'icp'` | 17 valores cargados |
| Estrategia SEM | `mkt_sem_strategy` (cambio `2026-10-20_mkt_sem_strategy.sql`) | tabla creada el 2026-10-21, **0 filas**: Vrutal-labs no tiene SEM hasta tener entidad legal y cuenta bancaria |
| Pestaña de entrega | `work_collection` `keywords` de `search_marketing`, aprobable, 8 columnas | creada |
| Rastro | `run_log` con `flow_key`, `outcome`, `detail`, `run_ref` | creado |
| Las tres funciones | `flow-input-read`, `work-items-write`, `run-log-write` | desplegadas, gate `X-AP-Token` probado |

El ICP se edita desde VrutalOS → **Negocio → Perfil e ICP**, no en una hoja. Si ese bloque se
queda vacío, el flujo no escribe nada: el paso «Ordena» falla a propósito.

> **2026-10-21 · la estrategia SEM entra en el prompt.** `step_7` lee `mkt_sem_strategy`
> (VrutalOS → **Negocio → Estrategia**, tabla de abajo): objetivo de lista cerrada, vigencia,
> presupuesto, mercado, destino y, si el objetivo es «empuje de producto», qué producto. Con eso
> el especialista inclina el `intent` del conjunto (leads/CAC → commercial y transactional; marca
> → informational; CTR/ROI → keywords largas) y añade las del producto que se empuja.
>
> **Entrada OPCIONAL, y es la excepción a la regla de entradas vacías.** Un cliente sin SEM
> devuelve `count: 0` y eso **no** es un error: el prompt lo dice y el flujo sigue con el ICP, que
> es la entrada obligatoria. No pongas un paso que pare el flujo por `count == 0` en `step_7`.
> Lo que sí para el flujo es que la tabla no exista (cliente sin el cambio `2026-10-20` aplicado):
> ahí la función responde 500 y debe fallar en voz alta.
>
> **Ejecutado de verdad el 2026-10-21** (importado y con el token puesto; su disparador es de programación, así que la ejecución `TESTING` escribió de verdad): ejecución `ok` en
> `run_log`, 63 keywords entregadas y 1 descartada, 1.601/5.642 tokens — el `tokens_in` sube de
> 1.134 a 1.601 frente al 2026-10-19 por las reglas de SEM del *system*, aunque la lista venga
> vacía. Lo que esa prueba **no** ejerce: `mkt_sem_strategy` tiene 0 filas, así que la rama con
> estrategia (y con ella el `select` anidado `mkt_focus_product(name)` de la función, y el efecto
> real del objetivo sobre el `intent`) sigue sin probarse. Se prueba el día que se cree la primera
> estrategia en **Negocio → Estrategia**, que es también el día que Vrutal-labs tenga cuenta
> publicitaria.

### 2. Conexiones en Activepieces (`http://127.0.0.1:18001`)

Solo hace falta una: **Claude** (`Claude · Vrutal-labs`). La conexión de Google Sheets ya no se
usa en este flujo. Los pasos HTTP no llevan conexión: se autentican con la cabecera
`X-AP-Token`, cuyo valor es el secreto `AP_INTEGRATION_TOKEN` del proyecto de Supabase del
cliente — el mismo que ya usan F2 y F3.

### 3. Los pasos del flujo

> **2026-10-19 · Claude sale de la pieza.** `piece-claude@0.5.0` devuelve solo `content[0].text`,
> el primer bloque de la respuesta. Con los modelos actuales ese bloque no siempre es texto, así
> que el paso acaba `SUCCEEDED` y entrega **cadena vacía**: pasó con `claude-opus-5` (58 s) y con
> `claude-sonnet-5-5` a 8000 y a 3000 tokens (38 s y 18 s). Ahora se llama a la API por HTTP, se
> leen **todos** los bloques de texto y, de paso, llega `usage`: tokens reales para `run_log`.

| Paso | Qué es | Dónde va |
|---|---|---|
| `trigger` | Programación, día 1 a las 08:00 (Madrid) | — |
| `step_1` | HTTP · perfil e ICP (`source: "icp"`) | `…/functions/v1/flow-input-read` |
| `step_7` | HTTP · estrategia SEM (`source: "sem_strategy"`), opcional | `…/functions/v1/flow-input-read` |
| `step_2` | HTTP · la clave de Anthropic, del Vault del cliente | `…/functions/v1/integration-get-key` |
| `step_6` | HTTP · la llamada a Claude | `https://api.anthropic.com/v1/messages` |
| `step_3` | Code · Ordena a KeywordSet | — |
| `step_4` | HTTP · entrega | `…/functions/v1/work-items-write` |
| `step_5` | HTTP · rastro | `…/functions/v1/run-log-write` |

Las cabeceras de los pasos contra VrutalOS son `Content-Type: application/json` y
`X-AP-Token: <AP_INTEGRATION_TOKEN>` — son **cinco** pasos con ese token: `step_1`, `step_7`,
`step_2`, `step_4` y `step_5`. El paso contra Anthropic lleva `Content-Type`,
`anthropic-version: 2023-06-01` y `x-api-key: {{step_2.body.key}}` — la clave nunca se escribe
en el flujo: se resuelve en ejecución desde el Vault.

**La plantilla del repo ya está así.** Reconstruir el flujo paso a paso en la interfaz es largo y
propenso a erratas (ya nos costó dos rondas: comillas invertidas pegadas y el marcador del token
sin sustituir). Lo rápido ahora es **importar `F4-keywords.template.json`, poner el token en las
cinco cabeceras `X-AP-Token`, publicar y borrar el flujo viejo** — el duplicado solo existe entre
esos dos pasos.

### 4. Probar y publicar

1. **Probar flujo.** Qué debe verse:
   - `step_1` devuelve `count: 17` y la lista de campos del ICP.
   - `step_7` devuelve `count: 0` mientras Vrutal-labs no haga SEM. **Cero es correcto aquí**: el
     flujo sigue. Si devuelve 500, al proyecto le falta el cambio `2026-10-20_mkt_sem_strategy.sql`.
   - `step_4` devuelve `{"collection": "keywords", "written": N}` con N = `{{step_3.count}}`.
   - `step_5` devuelve `{"ok": true}`.
2. **En VrutalOS**: el especialista SEO/SEM tiene la pestaña **Keywords** con N filas en estado
   **propuesta**, y se pueden aprobar o rechazar. En **Consumo** aparece la ejecución.
3. **Publicar.** Desde entonces corre el día 1 de cada mes a las 08:00 (Madrid).
   **PENDIENTE a 2026-10-21**: comprobado contra la base de Activepieces, el flujo está `DISABLED`
   y **sin versión publicada** (`publishedVersionId` nulo). Ha ejecutado bien —sus 63 keywords
   están entregadas— pero esa fue una ejecución de prueba lanzada a mano. Tal como está **no se
   disparará el día 1**. Publicarlo es lo único que falta.
4. Comprobación de que de verdad se fue de Sheets: la ejecución no toca ninguna pestaña, y en la
   versión publicada no queda ningún paso con `piece-google-sheets`.

## Si la ejecución acaba en `INTERNAL_ERROR`

Mira el log del contenedor: `ENOTFOUND lab-flows.localhost` significa que el motor intenta subir la ejecución por la dirección pública (`AP_FRONTEND_URL`), que dentro del contenedor no resuelve y que por LAB08 solo expone `/api/v1/webhooks`. Arreglo, sin abrir ninguna ruta en Traefik: `AP_INTERNAL_URL=http://activepieces:80` en el servicio `activepieces`. Desde 2026-10-02 ya viene en la plantilla `infra/instance/docker-compose.yml`, así que lo llevan todas las instancias. Si lo ves en una instancia antigua, recrea el servicio (desde `infra/instance`):

```
docker compose -p <slug> --env-file clients/<slug>.env up -d activepieces
```

## Deuda declarada (2026-10-02)

F4 v1 es un **brainstorm de Claude** sobre un perfil escrito a mano, sin datos reales de búsqueda. Sirve para estrenar el motor y el LLM, no como investigación de keywords. Tres deudas, decididas por el founder, cada una con su condición de pago:

| Deuda | Hoy | Debe ser | Se paga |
|---|---|---|---|
| ~~**Perfil**~~ **PAGADA el 2026-10-19** | Tabla `mkt_input_value` en la base del cliente, con lista cerrada de campos (`mkt_input_field`) y editable por el Admin o el Admin de Marketing desde VrutalOS → Negocio | — | Hecho |
| **Prompt** | Dentro del paso `step_2` del flujo | Guardado en Vrutal 1st e inyectado en ejecución desde el servidor (D-02). Hoy `catalog.job_role_prompt` y `tenant_specialist_prompt` tienen 0 filas y son **por rol**, no por tarea: falta decidir dónde viven los prompts de tarea | Antes del primer cliente externo |
| **Datos de búsqueda** | Ninguno: las keywords salen de la imaginación del modelo | Keyword Planner (volumen y dificultad; necesita cuenta de Google Ads y token de desarrollador) y/o Search Console (consultas reales de la web; hoy es de la tarea S1, TSK-000163, y necesita una web verificada con tráfico) | Cuando haya cuenta de Ads o web con tráfico |

**No presentar F4 a un cliente como investigación de keywords** mientras la tercera deuda siga abierta.

## Qué no hace todavía (a propósito)

- **Volumen y dificultad**: quedan vacíos hasta tener cuenta de Google Ads (Keyword Planner). Ese día se añade un bloque Consulta entre Decide y Ordena.
- ~~**Rastro en la hoja**~~ **Hecho el 2026-10-19**: el rastro va a `run_log` en la base del cliente, con `flow_key`, `outcome`, `detail` y `run_ref`. Sin tokens ni coste: la pieza de Claude devuelve el modelo pero no el `usage`; eso llega cuando el paso de Claude pase a HTTP contra la API de Anthropic.
- **Sin pausa de aprobación**: el flujo no se detiene a pedir permiso, y no le hace falta. Desde el 2026-10-19 las keywords se entregan como **propuestas** (`work_item` en estado `proposed`) y el cliente las aprueba o rechaza en su pantalla, después y sin bloquear la ejecución.
