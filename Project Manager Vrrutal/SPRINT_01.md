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
| 3 | **Regenerar `vrutal_client_project_template.sql`** desde la base viva | `db/plantillas/` | 20 tablas, no 10; `handle_new_user` toma el rol de `app_metadata` |
| 4 | **Auditoría de Vrutal1st**: cerrar la `002` a medias y las sobrecargas duplicadas de la `028` | `db/migrations/` | Verificado contra `pg_proc`/`pg_class`, distinguiendo tipo de objeto |
| 5 | **Retirar permisos por defecto** de Supabase (`TRUNCATE`, `REFERENCES`, `TRIGGER` para `anon` y `authenticated`) en las tablas que faltan | cambio fechado | Hoy solo hecho en `integrations`; repasar el resto |
| 6 | **Probar en sombra el paso «Pide permiso» de F2** | `Activepieces/flows/MKT-F2_linkedin/` | Confirmado si el flujo **se reanuda de verdad** tras decidir en el panel |

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

## Definition of Done (de §11, sin recortar)

- Criterio de éxito verificable definido **antes** de empezar — arriba.
- Documentación actualizada: **lo no documentado no ha existido**. Cada cambio con su `.sql` y
  su fila en el registro.
- Cambio trazable 1:1 a lo pedido: si el diff toca algo no pedido, se separa o se señala.
- Verificado **contra la base viva**, no contra el registro.
- Prueba en seco donde haya riesgo, terminando en error a propósito para no dejar nada aplicado.
