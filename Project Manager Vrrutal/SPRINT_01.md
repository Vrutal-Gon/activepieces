# Sprint 1 · semana del 2026-10-14

> Instancia concreta de la plantilla de [`PROJECT_MANAGER_VRUTAL.md`](PROJECT_MANAGER_VRUTAL.md) §11.
> La plantilla se queda allí para reutilizar; cada sprint es un fichero `SPRINT_NN.md`.
>
> **Pendiente de aprobación de alcance** (cadencia §6: revisión antes de construir).

---

## De dónde sale este alcance (no es intuición)

No había plan de primera semana escrito: se le citaba en
`Activepieces/flows/MKT-F2_linkedin/README.md` («semana 2») pero no existía. Este sprint se
deriva de reglas ya fijadas, no de criterio nuevo:

1. **Regla de empate** (§9, BRIEF §7), en su orden: *evidencia > ambición comercial* y
   *documentación > velocidad*. Las dos apuntan al mismo sitio: lo que hoy falla en silencio.
2. **Launch Readiness** (§14): todo lo marcado «antes del primer cliente».
3. **Deudas verificadas** el 2026-10-13 y 14 (`db/plantillas/cambios/README.md` «MUY
   IMPORTANTE» y [`../docs/BITACORA.md`](../docs/BITACORA.md) §11).

**P0 real de la empresa sigue siendo constituir la entidad legal** (§9, BRIEF §9). No es
técnico y no entra aquí: bloquea contratos, aviso legal y SEM, no el código.

---

## Sprint Goal

**Que dar de alta un cliente deje de ser un acto de fe.** Hoy nada comprueba que un cambio de
esquema se haya aplicado: el registro en Markdown es el único rastro y ya se desincronizó. El
objetivo es que el alta sea reproducible y que un cambio no aplicado **falle en voz alta**.

No es una mejora de producto: es el cimiento que hace posible el primer cliente externo.

---

## Por qué esto antes que cualquier otra cosa

El 2026-10-13, una auditoría objeto por objeto encontró **dos cambios sin aplicar que el propio
registro ya marcaba como pendientes**, y llevaban **cinco días** así:

- `2026-10-08_integrations_social.sql` — sin `integration_read_secret`, lo que rompía en
  ejecución `integration-get-key` (F3-HubSpot) y dejaba a Postiz sin las credenciales de
  LinkedIn del cliente.
- `2026-10-06_client_manager_role.sql` — la pantalla de Equipo ofrecía el rol Manager y
  asignarlo fallaba contra el check constraint de `profiles.role`.

La misma auditoría encontró en Vrutal1st que la **`002` se aplicó a medias** y que la **`028`
dejó sobrecargas duplicadas** de `catalog_create_system_option` / `catalog_update_system_option`.

**El patrón, no el caso:** nada falla al arrancar, solo al usarse. Con un cliente interno eso
cuesta un rato de depuración. Con un cliente que paga, es una promesa incumplida — el único
error que la regla de empate llama irreversible.

---

## Success Metrics (verificables antes de empezar)

1. `schema_change_log` existe en la base de cliente y tiene **una fila por cada cambio** de
   `db/plantillas/cambios/` ya aplicado en Vrutal-labs, con su hash.
2. Ejecutar el script de alta dos veces seguidas es **idempotente**: la segunda no cambia nada
   y no da error.
3. Introducir a mano un cambio sin aplicar hace que el script **falle y lo nombre**, en vez de
   seguir.
4. `plantilla + todos los cambios` reproduce la base viva: **mismo recuento de tablas (20)** y
   mismas funciones críticas que `rgauumxztblwurzebmsa`.
5. `has_table_privilege('authenticated','public.catalog_flow_ro','select')` sigue dando
   **`false`** al terminar.

---

## Scope · Planned

| # | Entregable | Dónde | Criterio de hecho |
|---|---|---|---|
| 1 | **Tabla de control `schema_change_log`** (fichero, hash, fecha, quién) + su cambio fechado | `db/plantillas/cambios/` | Creada y retro-rellenada con lo ya aplicado en Vrutal-labs |
| 2 | **Script de alta** que aplica plantilla + todos los cambios **en orden de fecha**, registra cada uno y **aborta en voz alta** si uno falla | `db/` o `scripts/` | Idempotente; probado dos veces; falla a propósito en una prueba |
| 3 | ~~**Regenerar `vrutal_client_project_template.sql`**~~ → **HECHO el 2026-10-15.** Regenerada leyendo la base viva por MCP, sin necesitar `pg_dump` ni credenciales | `db/plantillas/vrutal_client_project_template.sql` | 10 tablas → **23**. Aplicada entera en un Postgres desechable: `catalogo_cerrado=f`, 23 tablas, 0 permisos regalados |
| 4 | ~~**Auditoría de Vrutal1st**: cerrar la `002` a medias y las sobrecargas duplicadas de la `028`~~ → **HECHO el 2026-10-14, y no había SQL que arreglar.** Queda solo retirar la deuda de la documentación | `db/migrations/`, docs | Ver «Resultado de la auditoría» abajo |
| 5 | ~~**Retirar permisos por defecto** de Supabase en las tablas que faltan~~ → **CONSTRUIDO el 2026-10-15**, pendiente de aplicar. Encontrada además **la causa raíz** | `2026-10-15_quitar_permisos_regalados.sql` | Prueba en seco 5/5 y migración idempotente, verificadas en Postgres desechable |
| 6 | ~~**Probar en sombra el paso «Pide permiso» de F2**~~ → **HECHO el 2026-10-14.** Resuelto contra motor y servidor en vivo; apareció un fallo distinto y peor | `Activepieces/flows/MKT-F2_linkedin/` | Ver «Resultado del 6» abajo |

**Por qué el 6 entra en una semana de infraestructura:** es barato, y resuelve la única
incógnita que puede obligar a rediseñar el puente de aprobaciones. Cuanto antes se sepa, menos
cuesta. Si el flujo no se reanuda, hace falta otra fuente de URL de reanudación.

## Scope · Deferred (y por qué)

| Diferido | Por qué no ahora |
|---|---|
| Postiz: rellenar `PENDIENTE_URL_POSTIZ` e `PENDIENTE_INTEGRATION_ID_LINKEDIN`, conectar LinkedIn | Ya marcado «semana 2» en el README de F2. Depende del despliegue en VPS |
| Cerrar el dominio de correo con tabla + trigger sobre `auth.users` | «Antes del primer cliente», no antes del alta reproducible. Hoy la regla vive en `team-invite` |
| MFA del staff + exigir `aal2` en `has_platform_role()` | Importante y acotado; no bloquea el alta |
| Autonomía por tarea (techo por tarea + que el gate lea `task_autonomy_effective`) | Es diseño, no ejecución. Riesgo real pero necesita decisión de producto primero |
| Database Webhook de redes sociales | Hay vía que funciona (sync de 15 min, migración 030). P2 |
| Entregables: definir colecciones y el bloque «Escribir en la tabla» | Depende de que existan especialistas de marketing en la base — ya existen (5), pero va detrás del alta |
| Escalado de aprobaciones a Slack/WhatsApp/Teams por stack | Dirección confirmada para más adelante, no esta semana |
| Renombrar la carpeta `Project Manager Vrrutal` (errata) | Trivial; con `git mv` cuando convenga, no ocupa sprint |

---

## Dependencies

- **Acceso a los dos proyectos Supabase** (`apmhvqlvwjcrwfaixgju`, `rgauumxztblwurzebmsa`) — hay.
- **El 6 necesita la instancia del lab arriba** — está (15 contenedores, 1,93 GiB, con cotas).
- **El 3 necesita leer la base viva de Vrutal-labs**, que es el cliente 0 y la referencia.
- **Nada de esto depende de la entidad legal**, a propósito: avanza en paralelo al P0 comercial.

---

## Risks

| Riesgo | Mitigación |
|---|---|
| Retro-rellenar `schema_change_log` asume que el registro en Markdown es correcto — y ya se demostró que miente | No fiarse: **verificar objeto por objeto contra la base** antes de escribir cada fila. Es el trabajo, no un paso previo |
| Regenerar la plantilla puede arrastrar datos o particularidades de Vrutal-labs que no son de un cliente nuevo | Extraer solo esquema (sin filas); revisar a mano lo específico del cliente 0 |
| Un cambio fechado puede no ser idempotente y romper al reaplicarse | Cada uno lleva su `.test.sql` en seco; los que no lo tengan, se les hace |
| Tocar permisos (el 5) puede romper una pantalla en uso | Un cambio por tabla, con su prueba en seco, y verificar la pantalla afectada |
| El 6 puede salir mal y abrir rediseño | Es justo el objetivo: saberlo ahora. Si sale mal, pasa a diseño, no a construcción a ciegas |

---

## Resultado del 3 (2026-10-15) · plantilla regenerada

Regenerada leyendo la base viva de Vrutal-labs **por la conexión MCP**, así que no hizo falta
`pg_dump` ni la contraseña: **10 tablas → 23**. Lleva las 23 tablas en orden de dependencia,
22 funciones, 1 vista, 8 triggers, 54 políticas, los permisos de tabla partiendo de `revoke
all`, y la revocación de privilegios por defecto.

**Probada entera** en un Postgres desechable con `auth` y `vault` simulados:
`catalogo_cerrado = f`, **23 tablas**, **0 permisos regalados**. Las diferencias con la base
viva son las dos exclusiones deliberadas (`client_ticket` y `staff_contract_specialist`) más
el trigger de `auth.users`, que la consulta sobre `public` no contaba.

### Dos bugs encontrados al regenerarla

**1 · `handle_new_user` no conocía el rol Manager** — arreglado y aplicado. El rol se añadió
el 2026-10-06 y ese cambio actualizó el check constraint, `is_manager()`,
`is_admin_or_manager()`, la pantalla de Equipo y `team-invite`… pero **no el trigger que crea
el perfil**. Invitar a alguien como Manager lo creaba como **Usuario normal, en silencio**.
Nadie lo sufrió porque Vrutal-labs solo tiene una cuenta. Mismo patrón que el 13 de octubre:
nada falla al arrancar, solo al usarse.

**2 · `staff_contract_specialist()` está en la base del CLIENTE** y no debería. Usa
`catalog.job_role`, `public.tenant_specialist`, `has_permission()` y `staff_can_access_tenant()`,
que no existen ahí: es la **migración 024 de Vrutal1st aplicada por error** en el proyecto del
cliente, donde está muerta. Excluida de la plantilla para que no se propague. Retirarla de
Vrutal-labs queda pendiente (es un `drop function`).

---

## Resultado del 5 y del 3 anterior (2026-10-15)

**El 5 tenía una causa raíz que la nota original no recogía.** Medido en Vrutal-labs: **18 de
las 23 tablas** de `public` daban a `anon`/`authenticated` los permisos `TRUNCATE`,
`REFERENCES` y `TRIGGER` (y `MAINTAIN`, que es de PG17 — el servidor va por 17.6). Entre esas
18 están las tres `catalog_*_ro`: bien cerradas para leer (`select` de `authenticated` da
`false`), pero **con truncate**. No es fuga de la IP; es peor en otro sentido, porque un
`truncate` de `catalog_flow_ro` se lleva por delante las claves foráneas de
`approval_requests` y `run_log`.

Y revocar sobre las tablas de hoy **no habría bastado**: los permisos vuelven solos en cada
tabla nueva, porque vienen de los **privilegios por defecto del esquema**. En
`pg_default_acl` hay dos entradas para tablas — la de `postgres` (`anon`/`authenticated` =
`Dxtm`) y la de `supabase_admin` (`arwdDxtm`). Alguien ya limpió en su día la de `postgres`
quitando `arwd` pero dejó `Dxtm`, así que cada tabla creada desde el SQL Editor nacía otra vez
abierta. El cambio arregla las dos cosas. La entrada de `supabase_admin` no se puede tocar
desde aquí y se explica por qué en la cabecera.

**El 3 queda bloqueado en credenciales, con el trabajo hecho alrededor.**
`scripts/regenerar-plantilla-cliente.sh` extrae el esquema con `pg_dump` en Docker, pero
necesita el `DATABASE_URL` del cliente —que no se ha leído a propósito—. Lo que sí resuelve:
**comprueba el orden** y aborta si la base de origen todavía tiene `client_ticket` o permisos
regalados, porque una plantilla se escribe desde una base limpia y no al revés. Deja el volcado
aparte (en `.gitignore`) en vez de sobreescribir la plantilla, que es un documento curado.
Recuento real: **23 tablas, no las 20 documentadas ni las 10 de la plantilla.**

### Alcance añadido, señalado (DoD: nada se cuela)

Al inventariar las tablas apareció algo que **no estaba en el plan**: la tabla
**`client_ticket` sigue creada** en Vrutal-labs, con RLS y dos políticas, **vacía**. Es un
resto anterior a **D-20** (2026-10-08), que decidió que los tickets no viven en la base del
cliente sino centralizados en Vrutal1st. El README de esta carpeta ya lo daba por superado.

Va en **su propio cambio** (`2026-10-15_retirar_client_ticket.sql`), no mezclado con el 5, y
con **guarda**: si en algún proyecto tuviera filas, **falla en vez de borrar**. Importa
retirarla antes de regenerar la plantilla, o nacería en cada cliente nuevo. Probado en los dos
sentidos.

---

## Resultado del 6 (2026-10-14)

**Mi sospecha del waitpoint era infundada; el fallo real es otro y es peor.**

**La pausa es de ámbito de ejecución, no de waitpoint.** En el motor
(`/usr/src/app/dist/packages/engine/main.js`):

```js
function createWaitForWaitpointHook({hookParams}){
  return _waitpointId => {            // argumento IGNORADO (prefijo _)
    hookParams.hookResponse = {...hookParams.hookResponse, type:"paused"}
  }
}
```

`waitForWaitpoint` **descarta su argumento** y solo marca la ejecución como `paused`. Así que
encadenar `create_approval_links` (URL) y `wait_for_approval` (pausa) **sí funciona**: cualquier
URL de reanudación válida de esa ejecución la despierta.

**Pero `create_approval_links` devuelve una URL muerta.** Hace `` `${resumeUrl}/confirm` `` y esa
ruta no existe en 0.82. Probado contra el servidor del lab:

| URL | HTTP | Lectura |
|---|---|---|
| `…/v1/flow-runs/{run}/requests/{nonce}` | **400** | la ruta existe, falla la validación de mi uuid falso |
| `…/requests/{nonce}/sync` | **400** | la ruta existe |
| `…/requests/{nonce}/confirm` | **404** | **la ruta no existe** |
| `…/requests/{nonce}/inventado` | **404** | idéntico a `/confirm` — es 404 de ruta, no de entidad |

**Qué hacer al construir el paso:** quitar el sufijo `/confirm` del `approvalLink` antes de
mandarlo a `approval-create`; la URL válida es la base. Si se guarda tal cual, el flujo **no se
reanuda nunca** y falla en silencio — la aprobación queda decidida en el panel y parece que
funcionó. Y recordar que el `?action=approve` no hace falta: la decisión se pide a
`approval-result`.

**Valor de haberlo hecho primero:** era el entregable más barato y ha cambiado el diseño del
paso antes de escribirlo, no después.

---

## Resultado de la auditoría (2026-10-14)

Hecha objeto por objeto contra las dos bases vivas, distinguiendo el tipo (`pg_proc` para
funciones, `pg_class` + `relkind` para tablas y vistas), que es la trampa que ya dio un falso
positivo con `work_collection_overview`.

**Base de cliente (`rgauumxztblwurzebmsa`): limpia.** Los 18 objetos que declaran los cambios de
`db/plantillas/cambios/` existen, **uno cada uno**, sin duplicados ni ausencias — las 15
funciones, la vista y las dos tablas. Los dos cambios que se aplicaron tarde el 13 de octubre
están. El riesgo que anotaba este plan («el registro miente») **no se materializó esta vez**, así
que retro-rellenar `schema_change_log` parte de una base fiable.

**Vrutal1st (`apmhvqlvwjcrwfaixgju`): las dos deudas estaban ya resueltas o adjudicadas.**

- **Sobrecargas duplicadas de la `028`:** no existen. `catalog_create_system_option` y
  `catalog_update_system_option` tienen **una firma cada una**, ambas con `p_provider_key`.
- **La `002` «a medias»:** es real —**13 de sus 21 tablas no existen**— pero **no es un error
  pendiente, es una decisión ya tomada y escrita**. La migración `029` (2026-10-11) la
  adjudicó: crea solo `deployment.tenant_integration`, lo único que la `022` necesita de verdad,
  y declara expresamente que **no resucita el resto** (motor de reglas `rule_matches`, vista
  `v_tenant_profile`, `tenant_attribute`) porque nada lo llama. Incluso omite a conciencia la
  columna `n8n_credential_ref`: n8n se descartó por Activepieces antes de que esa tabla llegara
  a usarse.
- **Verificado:** ninguna de las 13 tablas ausentes se referencia desde código de aplicación.
  Solo aparecen en la `001` (hermana de la `002`) y en la propia `029`. Ni Panel-Vrutal1st ni
  VrutalOS las tocan.

**Lo que esto cambia.** Las 8 tablas `deployment.*` ausentes (`specialist`, `conversation`,
`message`, `approval_request`, `run_log`…) son **duplicados de lo que vive en la base de cada
cliente**, donde ya existen. Crearlas en el plano de control **contradiría D-01 y D-02**: la
`002` se escribió antes de que «un Supabase por cliente» fuera firme, y esa decisión la dejó
obsoleta. No hay nada que arreglar en SQL; hay una deuda que **retirar de la documentación**,
porque seguía figurando como pendiente en el registro de cambios y en la bitácora.

---

## Definition of Done (de §11, sin recortar)

- Criterio de éxito verificable definido **antes** de empezar — arriba.
- Documentación actualizada: **lo no documentado no ha existido**. Cada cambio con su `.sql` y
  su fila en el registro.
- Cambio trazable 1:1 a lo pedido: si el diff toca algo no pedido, se separa o se señala.
- Verificado **contra la base viva**, no contra el registro.
- Prueba en seco donde haya riesgo, terminando en error a propósito para no dejar nada aplicado.
