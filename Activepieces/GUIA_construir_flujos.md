# Guía para construir flujos en Activepieces (Vrutal)

Lo aprendido construyendo y probando F1 a F14 de Marketing (2026-10-02 a 2026-10-05). Instancia: Activepieces 0.82.0, entorno `lab` (Vrutal-labs). Léela antes de tocar un flujo. Cada regla viene de algo que falló.

## 0. Reglas de oro

1. **«Verde» no es «bien hecho».** Un flujo puede terminar en `SUCCEEDED` y haber escrito datos de ejemplo o filas vacías. Una prueba solo cuenta si compruebas **qué se escribió** (§7).
2. **Un flujo entregado debe importarse y funcionar sin configurar a mano.** Si algo exige que la persona rellene campos dinámicos en la interfaz, el flujo está incompleto (§3).
3. **Todo falla cerrado.** Un paso sin configurar lanza un error; nunca deja pasar datos ni actúa.
4. **Ningún secreto en el repositorio.** Ni en plantillas, ni en README, ni en el chat (§4).
5. **No se escribe en la base de datos de Activepieces** para arreglar un flujo. Se corrige la plantilla y se reimporta, o se exporta el flujo, se corrige el JSON y se importa (§8).

## 1. Método

1. Se diseñan **10 flujos en draw.io**, solo proceso, sin herramientas. Se aprueban.
2. Se genera el **esqueleto importable** (`tools/gen_mkt_templates.py`): un paso por bloque del diagrama, en el mismo orden. Lo que dependa de una herramienta o cuenta sin decidir es un paso Code «pendiente» que falla a propósito.
3. Se **importa, se publica y se prueba de uno en uno**. Orden: primero los que menos dependen de fuentes externas.
4. Se **registra en el catálogo** de Vrutal 1st (§9), en draft.

Cambiar el diagrama implica regenerar. El generador es la fuente; las plantillas son salida.

## 2. Plantillas JSON de importación

Estructura que el servidor acepta (la de `MKT-F4_keywords/F4-keywords.template.json`):

| Campo | Valor | Qué pasa si falta o está mal |
|---|---|---|
| `status` | `PUBLISHED` o `ARCHIVED`. **Nunca `DRAFT`** | Importación rechazada. Es el estado de la *plantilla*; el flujo se importa en borrador igualmente |
| `flows[0].trigger.lastUpdatedDate` | ISO 8601, p. ej. `2026-10-03T00:00:00.000Z` | **El flujo se crea vacío** y el log dice `body/ Invalid input` |
| `flows[0].schemaVersion` | `"20"` | |
| `pieces` | lista de `@activepieces/piece-…` | |
| Cada paso | `name` (`step_N`), `type`, `valid`, `skip`, `displayName`, `settings`, `nextAction` | |

Pasos Code: `type: "CODE"`, `settings.sourceCode = {code, packageJson: "{}"}` y `settings.input`.

### Pieces y versiones probadas en 0.82

| Piece | Versión | Acción / disparador | Notas |
|---|---|---|---|
| `piece-schedule` | 0.1.22 | `every_week` (`day_of_the_week` 0=domingo, `hour_of_the_day`, `timezone`), `every_month` (`day_of_the_month`) | Zona `Europe/Madrid` |
| `piece-webhook` | 0.1.42 | `catch_webhook` con `authType: "header"` y `authFields {headerName, headerValue}` | §4 |
| `piece-google-sheets` | 0.16.4 | `get-many-rows`, `google-sheets-insert-multiple-rows`, `insert_row` | §3 |
| `piece-claude` | 0.5.0 | `ask_claude` | **No enviar `temperature`** con `claude-sonnet-5-5`: la API responde `400 temperature is deprecated for this model`. Omite la clave |
| `piece-approval` | 0.1.28 | `wait_for_approval` | **Legacy** en 0.82; hay acciones nuevas en la pestaña Approvals sin verificar. «Pide permiso» sigue siendo un paso pendiente |

Los pasos Code corren en un sandbox (`AP_EXECUTION_MODE: SANDBOX_CODE_ONLY`). El motor necesita `AP_INTERNAL_URL=http://activepieces:80`; si una ejecución acaba en `INTERNAL_ERROR` con `ENOTFOUND`, revisa eso (README de F4).

## 3. Campos dinámicos de Google Sheets (lo que más tiempo costó)

Activepieces **vacía o repone los valores de ejemplo** en `google-sheets-insert-multiple-rows` e `insert_row` si ocurre cualquiera de estas dos cosas:

- la plantilla no lleva el **esquema del campo** (`propertySettings`), o
- alguien **elige la pestaña a mano** en el desplegable (cambiar `sheetId` reinicia `values`).

Para que se importe completo, cada paso de hoja lleva:

- `auth`: `{{connections['<externalId>']}}` (el id está en la tabla `app_connection`, columna `externalId`, o en un export).
- `spreadsheetId` y **`sheetId` (gid numérico de la pestaña)** ya puestos. El gid se lee de un flujo donde esa pestaña ya esté elegida (campo `sheetId` del paso) o de la URL de la hoja (`#gid=…`). Una pestaña que aún no existe no tiene gid: se crea, se elige **una vez**, y se exporta o se lee el gid para la plantilla.
- `propertySettings` con el esquema:
  - escritura múltiple: `values` (`type: MANUAL`, `schema.values.type: JSON`), `input_type` e `check_for_duplicate_column`;
  - `insert_row`: `values` con `schema` de `A..E` (`SHORT_TEXT`).
- `values` correctos: `{"values": "{{step_N.rows}}"}` (la lista, **no** `rows_json`); `insert_row` con `A..E` literales.

Los nombres y los gid vigentes están en `TAB_GID` dentro de `gen_mkt_templates.py`. **Los nombres de pestaña son exactos, con tildes** (`Métricas`, `Diagnóstico`) y las cabeceras de la fila 1 son los nombres de campo del contrato, en minúsculas y sin espacios. Una errata (`Rasto`) o una cabecera con espacio no da error: escribe en el sitio equivocado.

## 4. Webhooks y secretos

- Todo disparador por evento usa **Catch Webhook con cabecera** (`X-Vrutal-Token`). Nunca `none`.
- El secreto es aleatorio, de 32+ caracteres, **sin salto de línea**. Generarlo y copiarlo al portapapeles de una vez:
  ```
  openssl rand -hex 24 | tr -d '\n' | clip
  ```
  Pegado desde la terminal con salto de línea, el valor guardado queda con un carácter de más y **todas las llamadas se rechazan en silencio** (síntoma: `curl` devuelve 200 y no se crea ninguna ejecución).
- **Plantillas del repo: valor marcador** `PENDIENTE_GENERAR_SECRETO`. Las copias con secreto real se generan **fuera del repo**: `python Activepieces/tools/gen_mkt_templates.py --ready <carpeta>` (una por flujo, secreto distinto). Cada ejecución del comando genera secretos nuevos: no reimportes un flujo ya publicado desde una copia regenerada.
- **El registro de cada ejecución guarda las cabeceras en claro**, incluido el secreto. Quien vea las ejecuciones puede leerlo. La interfaz de Activepieces es solo para staff. Si el secreto llega a verse (chat, captura, export), se rota.
- Un export del flujo (JSON) lleva el secreto dentro: no se sube a Git ni se comparte.
- Al llamar a un webhook **publicado**, un token malo o ausente devuelve igualmente HTTP 200 y **no crea ejecución**. El 200 no prueba nada: se mira si hay ejecución nueva (§7).
- La URL `/test` solo registra datos si el editor tiene pulsado **Test trigger**; si no, responde 200 y no hace nada. Las pruebas automáticas solo valen contra la URL real, con el flujo **publicado**.

## 5. Patrones de los bloques

- **Ordena** (paso Code, `kind: normalize`): valida el contrato campo a campo, limita filas (`MAX_ROWS`), neutraliza fórmulas (una celda no empieza por `= + - @`) y **falla si no queda ninguna fila válida**. Lleva cabecera `/* vrutal-block {…} */` con bloque, tipo, contrato que produce y entradas. La prueba (`evidence`) solo se conserva si cita fuente (URL o `Fuente:`).
- **Decide con Claude:** el prompt solo recibe campos estructurados del cliente (ICP, voz, diccionario); nunca texto libre del cliente. Termina pidiendo «Responde SOLO con JSON» con la forma exacta de `{"items":[…]}`.
- **Lectura y escritura de hoja:** pasos aislados (`Lee de la hoja`, `Escribir en la hoja`, `Deja rastro`). Cada pestaña es una tabla futura de VrutalOS: cabeceras = campos del contrato más `fecha`.
- **Paso pendiente:** Code que lanza `PENDIENTE DE CONFIGURAR · …` (falla cerrado). No lo uses como sustituto de un paso que ya se puede construir: un flujo que nunca termina no deja rastro y no se puede validar (F8 lo sufrió).

Deuda conocida: si las pestañas de entrada están vacías, el flujo llama a Claude igualmente y falla después en «Ordena». Añadir una comprobación previa que pare el flujo cuando no haya datos ahorra esa llamada.

## 6. Dependencias de datos entre flujos

| Flujo | Necesita antes | Estado |
|---|---|---|
| F7 | `Métricas` (la escribe F3) y `Objetivos` | `Objetivos` no existe: aún no se opera, no hay objetivos que fijar |
| F8 | `Métricas` y `Diagnóstico` (la escribe F7) | Espera a F7 |
| F9, F11 | Search Console (web verificada) | Bloqueados |
| F10 | Páginas reales de una web | Sin web |
| F2 | Cuenta de LinkedIn conectada y `Calendario` | Pendiente |

Un flujo con entradas vacías **debe fallar** y no escribir nada. No se rellena una pestaña con datos inventados para que el flujo «funcione».

## 7. Cómo probar y qué comprobar

1. **Publicar** el flujo (sin eso la URL real no responde).
2. Llamar a la URL real: `http://127.0.0.1:18001/api/v1/webhooks/<flowId>` con `X-Vrutal-Token`.
3. Pruebas mínimas: token bueno (crea ejecución), token malo y sin cabecera (**no** crean ejecución), cuerpo vacío si el flujo lo lee (falla sin escribir).
4. **Leer el resultado de cada paso**, no solo el estado:

```
# Última ejecución de un flujo
docker exec lab-ap_postgres-1 psql -U activepieces -d activepieces -t -A -F'|' -c \
 "select status, environment, created, \"logsFileId\" from flow_run where \"flowId\"='<flowId>' order by created desc limit 3;"

# Volcar el log (viene comprimido con ZSTD; Node 24 lo descomprime)
docker exec lab-ap_postgres-1 psql -U activepieces -d activepieces -t -A -c \
 "select encode(data,'base64') from file where id='<logsFileId>';" | base64 -d > run.bin
node -e "const z=require('zlib'),fs=require('fs');const j=JSON.parse(z.zstdDecompressSync(fs.readFileSync('run.bin')).toString());
for(const [k,v] of Object.entries(j.executionState.steps)) console.log(k, v.status, JSON.stringify(v.output??v.errorMessage).slice(0,300))"
```

5. Qué debe verse: filas **reales** enviadas al paso de escritura (no `column1/value1`), `updatedRows` ≥ 1 en la pestaña correcta, y los campos de «Deja rastro» con valor.
6. Antes de publicar de verdad: una ejecución completa buena, las pruebas negativas, cero pasos pendientes en el recorrido, y secreto propio del flujo.

## 8. Qué falló y por qué

| Síntoma | Causa | Arreglo |
|---|---|---|
| Importar da error y el flujo queda vacío | Falta `trigger.lastUpdatedDate` (log: `body/ Invalid input`) | Añadirlo a la plantilla |
| La plantilla no se acepta | `status: "DRAFT"` | `PUBLISHED` |
| `400 temperature is deprecated for this model` | `temperature` con `claude-sonnet-5-5` | Quitar la clave |
| Flujo `SUCCEEDED` pero la hoja tiene `value1/value2` o filas vacías | Esquema de campos ausente o pestaña elegida a mano (§3) | Plantilla con `propertySettings` y `sheetId` |
| Secreto correcto, `curl` da 200, no hay ejecución | Salto de línea en el valor guardado | Regenerar con `tr -d '\n'` (§4) |
| `^[[200~curl: command not found` en Git Bash | «Pegado entre corchetes» | `bind 'set enable-bracketed-paste off'` o Shift+Insert |
| Escribe en una pestaña con errata | Nombre de pestaña distinto | Renombrar (el flujo apunta por gid, no se rompe) |
| `Ninguna fila valida` | Entrada vacía o JSON de Claude sin los campos obligatorios | Correcto si no hay datos; si los hay, revisar prompt |
| El paso de Claude acaba `SUCCEEDED` pero devuelve **vacío**, y el «Ordena» siguiente falla con `La respuesta de Claude no contiene JSON` | La pieza devuelve solo **`content[0].text`**, el primer bloque de la respuesta (comprobado en `piece-claude@0.5.0`). Con un modelo que razona —`claude-opus-5`, 58 s de latencia en F4 el 2026-10-19— el primer bloque es de pensamiento, no de texto, y la pieza entrega cadena vacía | Usar un modelo sin razonamiento por defecto (`claude-sonnet-5-5`). Si hace falta Opus, sacar a Claude de la pieza y llamarlo por HTTP contra la API, que además da los tokens para `run_log` |
| Paso HTTP que llama a una Edge Function y recibe `400 Falta <campo>`, como si el cuerpo fuera vacío | **Lo es.** Con `body_type: "json"`, la pieza HTTP lee el cuerpo de **`input.body.data`**, no de `input.body` (comprobado en el bundle de `piece-http@0.11.19`: `d.body = i.data`). Un `body` plano en la plantilla se envía vacío y **sin error de importación** | En la plantilla: `"body": { "data": { …el JSON… } }` más `propertySettings.body` con el esquema `{"data":{"type":"JSON","required":true,"displayName":"JSON Body"}}`. En la interfaz: pegarlo en el campo **JSON Body**, no en otro sitio |

**Arreglar un flujo ya importado cuyos campos no se dejan editar:** exportarlo desde Activepieces, corregir `values`/`sheetId` en el JSON (con los esquemas de §3), importarlo de nuevo y borrar el anterior. Funcionó con F13.

## 9. Registro en el catálogo (Vrutal 1st)

Proyecto Supabase `apmhvqlvwjcrwfaixgju`, esquema `catalog`. Estado a 2026-10-05: composiciones `pipeline v1` en draft de F1, F3, F4, F5, F7, F8, F9, F10, F11 y F13.

- Las funciones `catalog_*` exigen sesión de administrador (`is_platform_admin()`); desde una herramienta sin sesión se insertan filas directamente, con los triggers y restricciones activos. Se hace en **un solo bloque `DO $$ … $$`**: es atómico.
- `slot_key` único por posición: el segundo bloque del mismo tipo es `context_2`, `decide_2`, `normalize_2`.
- Un bloque `validated` o `deprecated` es inmutable. Para cambiarlo se crea una **versión nueva**, no se edita. Publicar exige `artifact_ref` (`git:<repo>:<ruta>@<SHA 40 hex>`), y los artefactos de los bloques aún no están en VrutalOS.
- Una composición solo se registra si su tarea existe en `catalog.task`. Faltan `VRL-MKT-A01`, `VRL-MKT-C01`, `VRL-MKT-C02` y `VRL-MKT-C03`: F2, F6, F12 y F14 esperan a que se den de alta.
- Contratos nuevos, en draft y sin aprobar: ContentBrief@1 y @2, CompetitorCard, ChannelDiagnosis, WeeklyReport, OpportunityList, SiteFinding, ReportWindow, MetricsSnapshot.

## 10. Lista antes de dar un flujo por entregado

- [ ] Plantilla con `lastUpdatedDate`, `status: PUBLISHED`, sin `temperature`.
- [ ] Hoja, conexiones, `sheetId` y esquemas de campo puestos: se importa sin tocar nada.
- [ ] Webhook con cabecera y secreto propio (sin salto de línea), fuera del repo.
- [ ] Pestañas creadas con cabeceras exactas y tildes.
- [ ] Todo paso pendiente falla cerrado y está listado en el README del flujo.
- [ ] Probado contra la URL real: bueno, malo, sin cabecera, vacío.
- [ ] Verificado **lo que se escribió** en la hoja y en `Rastro`.
- [ ] Registrado en el catálogo (si su tarea existe) y anotado en `flows/README.md`.
