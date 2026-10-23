# Bitácora de navegación · Las llaves del castillo

> **Para quién es esto.** Para quien hereda el sistema. Explica **cómo está hecho, por qué así
> y cómo se conecta entre sí**. No es un tutorial ni un manual de instalación: es el mapa que
> necesitas para no romper nada el primer día.
>
> **Cómo leerlo.** Las decisiones firmes se citan por su número (**D-01**…**D-20**) y viven en
> [`arquitectura/VRUTAL_OS_CONTEXTO_ARQUITECTURA.md`](arquitectura/VRUTAL_OS_CONTEXTO_ARQUITECTURA.md),
> sección 3. Aquí no se repiten: se usan. Si una decisión te sorprende, lee su fila allí antes
> de cambiarla — casi todas corrigen un error que ya se cometió.
>
> **Estado y fecha.** Cifras verificadas contra las dos bases vivas el **2026-10-14**. El
> documento de arquitectura tiene las secciones 5 y 6 congeladas a mediados de septiembre:
> donde haya discrepancia, **manda esta bitácora**.

---

## 1. Qué vende Vrutal (sin esto, nada del resto tiene sentido)

Vrutal alquila **especialistas**: agentes que hacen el trabajo de un puesto concreto (SDR,
administrativo, marketing) dentro de las herramientas del cliente. No vende software que el
cliente configura; vende trabajo hecho.

Tres consecuencias que explican toda la arquitectura:

1. **La definición del trabajo es la propiedad intelectual de Vrutal.** Las tareas, los prompts
   y los KPIs son el activo. El cliente ve **lo que el especialista produce**, nunca cómo está
   definido (ver §6).
2. **Cada cliente está aislado de verdad**, no por una columna `tenant_id`. De ahí **D-01**.
3. **El cliente no se auto-sirve.** No hay registro público: Vrutal crea los admins (**D-04**,
   **D-05**). El acceso se controla, no se ofrece como autoservicio.

---

## 2. La idea central: dos planos, nunca uno

```
                 ┌─────────────────────────────────────────────┐
                 │  PLANO DE CONTROL · "Vrutal 1st"            │
                 │  Supabase apmhvqlvwjcrwfaixgju              │
                 │  UNO para toda la empresa                   │
                 │                                             │
                 │  schema catalog    → la IP (tareas, roles,  │
                 │                      prompts)               │
                 │  schema public     → operación (clientes,   │
                 │                      contratos, staff)      │
                 │  schema deployment → instancias             │
                 │                                             │
                 │  Panel-Vrutal1st (React) ── lo usa el staff │
                 └──────┬───────────────────────────────▲───────┘
                        │                               │
          sync cada 15 min                      canal inverso
          (empuja el catálogo)                  (push_token)
          D-06 · D-19                           022 · 030 · D-20
                        │                               │
   ┌────────────────────▼───────────────────────────────┴─────────────┐
   │  PLANO DE DATOS · "VrutalOS" · UNO POR CLIENTE                   │
   │  Supabase propio (cliente 0 "Vrutal-labs": rgauumxztblwurzebmsa) │
   │                                                                  │
   │  VrutalOS/app (React) ── lo usa el cliente                       │
   │  Sus datos de negocio + espejo de solo lectura del catálogo      │
   │                                                                  │
   │     ▲ X-AP-Token (server-to-server)                              │
   │  ┌──┴──────────────────────────────────────────┐                 │
   │  │ INSTANCIA DOCKER DEL CLIENTE                │                 │
   │  │ Activepieces (motor) · Postiz (social)      │                 │
   │  │ Postgres · Redis · Qdrant · Temporal        │                 │
   │  └─────────────────────────────────────────────┘                 │
   └──────────────────────────────────────────────────────────────────┘
```

**Por qué dos planos y no uno multi-tenant** (**D-01**): aislamiento real. Es lo que hace que
una policy RLS con `qual=true` sea segura — dentro de un cliente, «ver a tu equipo» no es una
fuga. Y de paso esquiva la licencia comercial de Activepieces, porque cada cliente corre su
propia instancia (ver §7).

**Por qué los prompts no bajan nunca** (**D-02**): viven solo en el plano de control
(`catalog.job_role_prompt`, `public.tenant_specialist_prompt`) y se inyectan en tiempo de
ejecución desde el servidor. La tabla `specialist_prompts` del plano de datos **se eliminó**.
Sacar la IP de la base del cliente es más fuerte que cualquier permiso.

---

## 3. El plano de control: qué tabla es qué y cómo se relacionan

### 3.1 `catalog` — la propiedad intelectual

La cadena es **dominio → proceso → tarea**, y encima **el rol como vista etiquetada**:

```
domain (3) ──< process (17) ──< task (1.093)
                                   │
                                   └──< job_role_task (261) >── job_role (8)
                                          time_weight_pct
                                          criticality
                                          effect_classification
```

La clave del modelo es **D-13**: **la tarea es la unidad atómica y el rol es una vista sobre la
biblioteca compartida**. Una tarea que sirve a dos roles **se enlaza dos veces** en
`job_role_task`; no se duplica. Sin esa regla acabas con 250 documentos que se contradicen.

Dos cosas que parecen errores y no lo son:

- **`job_role` se versiona por `(key, version)`.** Un mismo nombre de rol en dos departamentos
  son **filas independientes** (un fork), nunca una etiqueta multi-dominio.
- **`component` y `task_component` están vacías a propósito.** Se llenan cuando se construye
  software de verdad. Vacío ≠ roto.

`job_role_prompt` es la joya: prompt maestro versionado, **solo superadmin**.

**Modo pre-live (migración 040, 2026-10-19).** Lo publicado en el catálogo es inmutable: no se
edita, no vuelve a draft y no se borra. Esa regla es correcta con clientes dentro y un estorbo
mientras el catálogo busca su forma —cada flujo que se migra deja atrás bloques y composiciones
que ya no describen nada, y un catálogo que acumula mentiras no sirve para lo único que sirve:
saber qué hay montado. Así que hay un interruptor de un solo registro, `catalog.release_gate`, y
una función `catalog.is_prelive()` que consultan los cuatro guardianes: en pre-live se puede
borrar y rehacer, también desde el panel. No se quita ninguna regla: se declara una excepción con
fecha de caducidad.

**La puerta no se puede olvidar:** `is_prelive()` devuelve `false` en cuanto exista un tenant que
no sea interno, por mucho que el interruptor siga encendido, y `catalog_set_prelive(true, …)` se
niega a encenderlo si ya hay uno. El primer cliente real lo apaga solo. Para limpiar hay dos
funciones, ambas solo superadmin y solo en pre-live: `catalog_purge_task(task_code)` (borra sus
composiciones y slots y devuelve la tarea a draft, sin tocar bloques que puedan estar
compartidos) y `catalog_purge_orphan_blocks(dry_run)` (barre versiones y bloques que ya no usa
nadie; **en seco por defecto**).

### 3.2 `public` — la operación de Vrutal

```
tenants (1) ──< tenant_specialist (5) ──< tenant_specialist_flow (67)
   │                   │                     autonomy_level por flujo
   │                   └──< tenant_specialist_prompt   (versión efectiva X.Y.Z)
   │
   ├──< tenant_credential ──→ Vault   (puntero, no el secreto)
   ├──< tenant_instance ──< tenant_onboarding_step        (migración 019)
   ├──< tenant_integration / tenant_integration_status    (022, 030)
   └──< support_ticket ──< support_ticket_message         (023, D-20)

profiles (staff) ──< user_roles >── roles (scope) ──< role_permissions >── permissions (21)
```

Lo esencial:

- **`tenants` es el cliente, `tenant_specialist` es su contrato** y `tenant_specialist_flow` es
  qué tareas tiene encendidas y con cuánta autonomía. Pausar un contrato apaga sus flujos en
  cascada (trigger `cascade_tenant_specialist_status`): no hay que apagarlos a mano.
- **`tenant_credential` no guarda secretos**, guarda un puntero a Vault (**D-10**). Las
  credenciales viajan del plano de datos al de control, **nunca al revés**: el centro necesita
  saber conectarse a cada cliente; el cliente no necesita credenciales del centro.
- **Los tickets de soporte NO viven en la base del cliente** (**D-20**). Un ticket es una
  conversación con Vrutal sobre el servicio, no un dato de negocio del cliente: no le aplica el
  aislamiento por instancia. Se descartó el nombre `client_ticket`.

### 3.3 Los permisos del staff: RBAC y nada más

**D-16** corrige un fallo real: convivían **dos** fuentes de verdad para decidir quién manda
(los flags `profiles.is_platform_admin` / `is_superadmin` y RBAC) y se contradecían. **Los flags
se eliminaron.** Hoy:

```
user_roles ──> roles ──> role_permissions ──> permissions
                 │
                 └── scope: 'platform' | 'client'
```

- `has_platform_role(text[])` es la base: rol `platform` global + perfil `active` + no borrado.
- `is_superadmin()` e `is_platform_admin()` sobreviven **como envoltorios** sobre RBAC, para no
  reescribir todas las policies de golpe.
- `has_permission(perm, tenant)` es el que debe usarse en lo nuevo. **Ninguna** tiene `EXECUTE`
  para `anon`.

**`roles.scope` existe por un susto** (**D-17**): los roles de cliente (`client_admin`,
`client_user`) estaban **concediendo permisos en el plano de control** sin que nadie lo
pretendiera. Hoy son **plantilla informativa**: no se asignan a usuarios de Vrutal1st ni otorgan
nada aquí. Los permisos reales del cliente viven en su propia base.

**Dos guardias en `user_roles` que te van a salvar:**

- `trg_user_roles_guard` — rechaza roles `client`, roles con `tenant_id`, y cualquier cambio
  hecho con sesión de usuario que no sea superadmin.
- `trg_user_roles_last_superadmin` — rechaza toda operación que deje el sistema **sin
  superadmin**.

> **Bootstrap:** con `auth.uid()` NULL (SQL Editor o `service_role`) las guardias permiten
> asignar el primer superadmin. Es deliberado, no un agujero: es la única forma de arrancar un
> entorno nuevo.

**Deuda conocida y acotada:** la migración de policies a `has_permission()` va **tabla a tabla**,
conforme el panel toca cada pantalla. Mientras tanto, `platform_admin` escribe `tenants` por
policy sin tener `tenants.write` en RBAC, y `platform_ops` tiene el permiso pero la policy no se
lo deja usar.

---

## 4. El plano de datos: la base de cada cliente

Un proyecto Supabase por cliente. Lo que hay dentro:

| Tabla | Para qué | Nota de permisos |
|---|---|---|
| `profiles` | Los usuarios del cliente | Rol en `app_metadata`, **nunca** `user_metadata` (**D-04**) |
| `specialists` | Los agentes desplegados (metadatos, **no** el prompt) | Hoy todo autenticado los lee; `user_specialist_access` **no** se aplica en servidor, el front filtra (solo UX) |
| `conversations` / `messages` | El chat | |
| `approval_requests` | Flujos esperando autorización | `resume_url` **sin GRANT** para `authenticated` (ver §8) |
| `approval_delegation` | Delegación por vacaciones (**D-14**) | Con RLS pero **sin GRANT** todavía |
| `catalog_flow_ro` / `_report_ro` / `_kpi_ro` | **Espejo de solo lectura** del catálogo | **El cliente no los lee nunca** (ver §6) |
| `integrations` | Claves de las APIs del cliente | El Admin ve el estado, **no** `secret_ref` |
| `work_collection` / `work_item` | Entregables del especialista | Sustituyen a las pestañas de Google Sheets |
| `run_log`, `audit_log` | Ejecución y auditoría | |
| `report_output`, `user_kpi_selection`, `user_report_subscription`, `knowledge_update_request` | Personalización y salidas (**D-12**) | Con RLS pero **sin GRANT**: se conceden al construir su pantalla |

Los roles del cliente son tres, en `profiles.role`: **Usuario**, **Manager** y **Admin**
(`is_admin()`, `is_manager()`, `is_admin_or_manager()`). El Manager se añadió el 2026-10-06 para
quien lee y edita el perfil de empresa que alimenta a los flujos, sin tocar equipo,
integraciones ni facturación.

> **Trampa documentada:** `vrutal_client_project_template.sql` **está desfasada** — 10 tablas
> frente a las 20 reales, y su `handle_new_user` hace admin al primer usuario cuando la base
> real toma el rol de `app_metadata`. Hoy **plantilla + cambios no reproducen la base viva**.
> Regenerarla antes del próximo cliente.

---

## 5. El puente: cómo viaja el catálogo del centro al cliente

El sync es **la pieza que conecta los dos planos**, y es trabajo del centro, no del motor de
ejecución de ningún cliente (**D-06**, **D-07**).

```
pg_cron "sync-catalog-to-clients"  (cada 15 min, en Vrutal1st)
   │  lee sync_cron_token de Vault en CADA ejecución
   │  net.http_post  ──cabecera x-sync-token──┐
   ▼                                          ▼
list_sync_targets()              Edge Function "sync-catalog"
get_tenant_sync_payload(tenant)       │ valida el token con sync_acquire_lease()
   (solo service_role)                │ lease de 300 s: impide ejecuciones solapadas
                                      │ invoca todos los tenants en PARALELO (Promise.all)
                                      ▼
                        base del cliente: upsert EN BLOQUE por tabla
                        (1 query con unnest: flows / reports / kpis
                         + 1 disable en bloque)  ← rol vrutal_sync
```

**Por qué el token propio y no la anon key** (**D-19**): la anon key **es pública**, y
`verify_jwt` solo comprueba que el JWT sea válido, no quién llama. Con la anon key cualquiera
podía disparar el sync, que corre con `service_role`, **contra todas las bases de cliente**. Es
la lección más caras del proyecto: *anon key = identificación del proyecto, nunca autorización*.

**Por qué los upserts en bloque:** antes `pushToTenant()` hacía un `await sql` por fila en un
bucle secuencial. Con 62 flujos eran 62+ viajes de ida y vuelta contra un timeout de 25 s en el
cron, y el sync se caía con `Gateway Timeout`. Se reescribió a 1 query por tabla (18 sep) y la
Edge Function pasó a invocar todos los tenants en paralelo. Sin tope de concurrencia explícito:
no hace falta con los clientes de hoy, y se pondrá cuando sea un problema real, no antes.

**El rol `vrutal_sync`** tiene en la base del cliente exactamente lo que necesita:
`select` en los espejos, `insert, update` en `specialists` — y **sin `DELETE` a propósito**:
retirar un especialista es `status='retired'`; borrarlo dejaría huérfanas sus aprobaciones y
entregables.

### El canal inverso

El cliente también empuja hacia el centro, autenticándose con el **`push_token` de su instancia**
(`tenant_instance.push_token`, lo rota `staff_rotate_tenant_push_token`):

- **Tickets de soporte** (**D-20**): `support-ticket-send` / `-list` del cliente llaman a
  `ticket-intake` / `ticket-query` de Vrutal1st.
- **Estado de redes sociales** (022, 030): el cliente reporta qué redes tiene conectadas, nunca
  el secreto. La vía que **de verdad funciona hoy** es el sync de 15 min leyendo `integrations`;
  el Database Webhook previsto **sigue sin configurar** (comprobado el 2026-10-11: cero triggers).

---

## 6. La regla que más fácil es romper sin darse cuenta

**El catálogo de Vrutal es de Vrutal** (2026-10-06). `catalog_flow_ro`, `catalog_report_ro` y
`catalog_kpi_ro` están en la base del cliente, pero **ningún usuario del cliente puede leerlos**,
ni por pantalla ni por API: con una sola sesión se volcaría el listado entero de la IP.

- `authenticated` **no tiene GRANT** sobre ellos y la app no los consulta.
- Siguen ahí solo por las claves foráneas de `approval_requests` y `run_log`.
- Los leen el sync y `service_role`.
- **Comprobación:** `has_table_privilege('authenticated','public.catalog_flow_ro','select')`
  debe dar **`false`** en cada proyecto de cliente.

Lo que el cliente ve de un especialista es **lo que produce** (entregables, aprobaciones), con
las etiquetas que escribe el propio flujo. Nunca cómo está definido su trabajo.

---

## 7. Los motores dentro de la instancia del cliente

Un cliente = una instancia Docker (`infra/instance/`). Qué corre y por qué:

| Servicio | Para qué | Por qué está |
|---|---|---|
| **Activepieces** 0.82.0 | **El motor**: ejecuta el trabajo de los agentes | **Solo esto** (**D-07**). Nada de sync ni tareas internas |
| `ap_postgres`, `ap_redis` | Su estado | |
| **Postiz** | Publicar en redes sociales | Perfil `social`. El cliente **nunca ve su interfaz** |
| **Temporal** + Elasticsearch + Postgres | Programar publicaciones de Postiz | **No es nuestro**: lo arrastra Postiz (`depends_on` + `TEMPORAL_ADDRESS`). Quitarlo rompe la programación |
| `postiz_agent` | Reinicia Postiz cuando cambian las credenciales | **Nunca ve una credencial**: solo compara una huella |
| **Kaneo** 2.46.2 | **El tablero**: donde el equipo de Vrutal gestiona el trabajo de este cliente | Perfil `tareas`. El cliente **nunca ve su interfaz** (igual que Postiz): la ve espejada en VrutalOS → Tablero |
| `kaneo_postgres` | Su estado | |
| `qdrant`, `memory_postgres` | Vectores y memoria | |
| `docker_socket_proxy` | Acceso acotado al socket de Docker | |
| **Traefik** (`infra/edge/`) | Entrada única, uno por VPS | |

**Licencia de Activepieces:** la arquitectura de una instancia por cliente (**D-01**)
**esquiva la necesidad de licencia comercial**. No es un detalle legal menor: es una de las
razones por las que el diseño es así.

**VPS compartido por defecto** (**D-08**), dedicado solo cuando la métrica de concurrencia pico
sostenida de LAB08 lo pida — lo decide una métrica, no el número de cliente. Y **Supabase
gestionado por defecto** (**D-09**): da Auth, RLS, backups, Vault y Storage «gratis»;
self-hosted queda como premium futuro porque obliga a construir y mantener todo eso ×N clientes.

**Memoria (2026-10-14).** Los servicios llevan `mem_limit` en `docker-compose.yml`. Se puso
tras colgarse el demonio de Docker Desktop dos veces el mismo día: sin cota, un contenedor
desbocado **se lleva el demonio por delante** en lugar de morir él solo. Medido ese día: núcleo
~1,1 GB, perfil `social` ~2,6 GB, total ~3,7 GB. El perfil `tareas` (2026-10-22) añade ~0,75 GB
(Kaneo 512 m + su Postgres 256 m).

---

## 8. Las llaves: cuál, para qué y por qué

Esta es la sección que de verdad te entregan. **No hay ninguna clave RSA ni par
público/privado en el proyecto**: todo son claves de Supabase y secretos compartidos.

### 8.1 Las dos claves de Supabase (la distinción que más importa)

| Clave | Qué es | Dónde puede estar | Por qué |
|---|---|---|---|
| **`anon` / publishable** | **Pública.** Identifica el proyecto | En el navegador, sin problema | Es identificación, **nunca autorización** (**D-19**) |
| **`service_role`** | **La llave maestra: se salta RLS entero** | **Solo** en Edge Functions y procesos de servidor. **Jamás** en un panel ni en el navegador | **D-11**: un panel corre en la máquina del cliente. Si la clave está ahí, está comprometida |

**El panel escribe y rota credenciales, pero no las lee** (**D-18**). `get_tenant_credential`
está **revocada para `authenticated`**. Solo procesos server-side leen secretos. Es la
aplicación estricta de D-11, y la razón por la que casi todo lo sensible pasa por una Edge
Function en vez de por el front.

### 8.2 Secretos compartidos: uno por consumidor, a propósito

| Secreto | Quién lo usa | Para qué | Por qué separado |
|---|---|---|---|
| `sync_cron_token` | pg_cron → `sync-catalog` | Autenticar el sync (cabecera `x-sync-token`) | Vive en **Vault**, se lee en cada ejecución; se rota con `vault.update_secret` |
| `tenant_instance.push_token` (`VRUTAL1ST_PUSH_TOKEN`) | Cliente → Vrutal1st | Canal inverso: tickets y estado social | Es **por instancia**, así se puede rotar un cliente sin tocar a los demás |
| `AP_INTEGRATION_TOKEN` (`X-AP-Token`) | Flujos de Activepieces → VrutalOS | `approval-create`, `approval-result`, `integration-get-key` | El consumidor es **el mismo** (los flujos de esta instancia), por eso se reutiliza entre esas tres |
| `SOCIAL_APP_TOKEN` | Contenedor de Postiz y su agente → `social-app-env` | Servir credenciales de apps OAuth al arrancar | **Otro consumidor** → secreto propio. No se reutiliza el de arriba |
| `WEBHOOK_SHARED_SECRET` | Database Webhook → `integration-social-notify` | Avisar de cambios de estado | |
| `board_sync_token` + `BOARD_SYNC_TOKEN` | pg_cron → `board-sync` | Autenticar el espejo del tablero (cabecera `x-sync-token`) | **Otro consumidor** que `sync_cron_token`, y además vive en otra base: aquel está en Vrutal1st, este en la del cliente |
| `KANEO_API_KEY` | `board-sync` y `board-write` → Kaneo | Leer y escribir el tablero de esta instancia | **Es de Vrutal, no del cliente**: no pasa por Integraciones ni por el Vault del cliente. Misma pregunta que resolvió la clave de Postiz (migración `025`): ¿de quién es la herramienta? |
| `APP_ORIGINS` / `PANEL_ORIGINS` | Todas las funciones con sesión | Lista blanca de CORS | Sin él, la función **rechaza todo** («Origen no permitido») |
| `ALLOWED_EMAIL_DOMAINS` | `team-invite` | Limitar a dominios que fija Vrutal | **Deuda:** solo vive en la función; un usuario dentro podría cambiarse el correo desde Auth |
| `AP_RESUME_URL_PREFIX` | `approval-create` | Validar que el enlace apunta a la instancia esperada | **Anti-SSRF**: sin él, un flujo manipulado haría que Vrutal llame a cualquier URL |

La regla detrás de la tabla: **un secreto por consumidor**. Cuando dos cosas distintas comparten
un secreto, rotarlo obliga a tocar las dos y nadie lo rota.

### 8.3 Los dos Vault

- **Vault de Vrutal1st** — credenciales de cada VrutalOS (**D-10**). Entrada:
  `set_tenant_credential()` (exige permiso `secrets.manage`); salida: `get_tenant_credential()`,
  solo `service_role`.
- **Vault de cada cliente** — claves de **sus** sistemas (HubSpot, Anthropic, apps OAuth de
  redes). Entrada: `integration_store_secret()`; salida: `integration_read_secret()`, **único
  camino** y solo `service_role`. La columna `integrations.secret_ref` **no tiene GRANT** para
  `authenticated`.

**Un caso que explica el diseño entero:** la API key de Postiz. Al principio se guardaba en el
Vault del cliente, como si fuera suya. Se corrigió el 2026-10-10 (migración **025**): Postiz es
**infraestructura que Vrutal provisiona**, no un sistema del cliente. Hoy la pone el staff con
`staff_set_tenant_postiz_key` en Vrutal1st, y el cliente la pide con su `push_token`. Se quitó
`postiz` de `integration-save-key`. La pregunta que lo resuelve siempre: **¿de quién es esta
cosa, del centro o del cliente?**

**Y el truco más bonito del sistema:** las credenciales de la app de LinkedIn del cliente van
del Vault al proceso de Postiz **sin escribirse en ningún disco**. `social-app-env` las sirve en
formato `env` al arrancar el contenedor (`infra/instance/postiz/boot.sh`), porque Postiz lee
`LINKEDIN_CLIENT_ID` de `process.env` y no admite credenciales por organización. Y `postiz_agent`
pide el mismo endpoint en formato `fingerprint`: reinicia Postiz cuando cambian **sin ver nunca
una credencial**.

---

## 9. Aprobaciones: cómo un flujo pide permiso y espera

Decidido el **2026-10-13**: la aprobación se da en la pantalla **Aprobaciones de VrutalOS**,
nunca por enlaces de correo. **El cliente no ve jamás un enlace.**

```
flujo de Activepieces
   │ se pausa con @activepieces/piece-approval (la pieza SOLO aporta la pausa)
   │ POST approval-create  (X-AP-Token, valida prefijo del resume_url ← anti-SSRF)
   ▼
approval_requests  (resume_url guardado, SIN GRANT para authenticated)
   │
   │  el cliente decide en su pantalla
   ▼
approval-decide   1) decide_approval()  ← registra PRIMERO (decided_by/at en servidor)
                  2) GET resume_url     ← reanuda DESPUÉS
   │
   ▼
el flujo despierta y pregunta:  POST approval-result → { approved, item_decisions }
```

**Por qué cada decisión de diseño:**

- **`resume_url` sin GRANT para `authenticated`**: quien pudiera leerlo **reanudaría un flujo
  sin decidir nada**, saltándose la aprobación. Por eso el enlace se queda en el servidor y es
  la función quien lo llama.
- **Registrar antes de reanudar**: si fuera al revés, un fallo al registrar dejaría el flujo
  andando **sin rastro de quién lo autorizó**.
- **El flujo pregunta en vez de recibir**: el enlace de reanudación es un **GET sin cuerpo**, así
  que al despertar el flujo no sabe nada. Por eso existe `approval-result`. **No leas `approved`
  de la pieza**: `approval-decide` llama al enlace tal cual, sin `?action=`, y la pieza daría
  `false` siempre.
- **La pestaña «Approvals» de Activepieces 0.82 no sirve aquí**: es una lista fija de 6 canales
  de mensajería (Slack, Discord, Teams, Outlook, Gmail, Telegram). Ninguno es el panel. La pieza
  legacy es la correcta porque es **la única que da el enlace sin pausar**.

**Deuda declarada:** si la decisión se registra pero la reanudación falla (Activepieces caído,
pausa caducada) se devuelve 502 y el flujo se queda parado. La decisión **no se deshace** —es el
rastro de auditoría y es correcta—, pero no hay reintento: `decide_approval` solo actúa sobre
aprobaciones `pending`, así que volver a pulsar no reanuda. Hace falta relanzar a mano. Se acepta
a propósito: el caso es raro y la alternativa (dejarla pendiente tras haberla decidido) mentiría.

**Verificado el 2026-10-14 contra el motor y el servidor en vivo** — dos conclusiones, y la
segunda es la que importa:

1. **La pausa es de ámbito de ejecución, no de waitpoint.** En el motor,
   `createWaitForWaitpointHook` devuelve `_waitpointId => {...type:"paused"}`: **descarta su
   argumento** y solo marca la ejecución como pausada. Así que un flujo sí puede pedir la URL
   con `create_approval_links` y pausarse después con `wait_for_approval`.
2. **Pero `create_approval_links` devuelve una URL muerta.** Hace `` `${resumeUrl}/confirm` `` y
   esa ruta **no existe** en 0.82. Probado: la base y `/sync` dan **400** (ruta existe, entrada
   inválida), mientras `/confirm` da **404**, igual que un sufijo inventado.

**Qué hacer:** quitar el sufijo `/confirm` antes de guardar el enlace en `approval-create`; la
URL válida es la base. Si se guarda tal cual, el flujo **no se reanuda nunca** y falla en
silencio: la aprobación queda decidida en el panel y parece que funcionó.

**Dirección a futuro (2026-10-14):** primero VrutalOS. Después, para «poner en pendientes»,
combinar soluciones: tras X horas **laborables** esperando, escalar a Slack, WhatsApp o Teams
**según el stack del cliente** — y de ahí saldrán **versiones de flujo por stack**. Ahí la
pestaña Approvals pasa de inútil a útil: esos seis canales son justo los que harían falta, con
WhatsApp como el que falta.

---

## 9 bis. Tablero: cómo el cliente ve en qué se está trabajando (2026-10-22)

Hasta aquí el cliente veía **resultados**: entregables (`work_item`) y decisiones pendientes
(`approval_requests`). Lo que se estaba haciendo **ahora** no lo veía nadie fuera de Vrutal.
Eso lo cubre el Tablero.

La herramienta es **Kaneo** (MIT, `usekaneo/kaneo`): React + Hono + Postgres, API REST con
OpenAPI, API key por cabecera `x-api-key`, modelo workspace → proyecto → tarea con columnas,
etiquetas y comentarios. Corre **una instancia por cliente**, en su propio Docker (perfil
`tareas`), como Activepieces y Postiz.

```
Kaneo (instancia del cliente)        ← aquí trabaja el equipo de Vrutal
   │  pg_cron «board-sync» cada 5 min, token del Vault, cabecera x-sync-token
   ▼
Edge Function board-sync  ──GET x-api-key──►  /api/{column,task,comment}
   │  upsert; filtra la etiqueta «interno»; borra lo que Kaneo ya no devuelve
   ▼
board_project · board_column · board_card · board_comment   (espejo, RLS, SOLO select)
   ▼
VrutalOS → Tablero        ── pedir tarea / comentar ──►  board-write ──► Kaneo ──► espejo
```

**Las tres decisiones que lo explican:**

1. **Espejo, no consulta en vivo.** El navegador habla solo con su Supabase, con RLS. Si la
   pantalla preguntara a Kaneo en cada carga, cada carga dependería de que Kaneo esté arriba y
   habría que llevar una clave por el camino. Misma forma que el sync de catálogo (**D-06**).
2. **El cliente no ve la interfaz de Kaneo.** Lo que sale a internet es solo
   `/api/{project,column,task,comment}` por Traefik — ni la interfaz ni `/api/auth`. Es la
   lección de Postiz, dicha otra vez.
3. **Escribir va por función, no por tabla.** `authenticated` solo tiene SELECT sobre las
   cuatro tablas. Pedir una tarea y comentar pasan por `board-write`, que autoriza con
   `board_authorize()` evaluada con la sesión de quien llama, escribe primero en **Kaneo** (la
   fuente) y después refleja la fila. Al revés, un fallo de Kaneo dejaría al cliente viendo una
   tarjeta que el equipo no tiene.

**Mover una tarjeta de columna no es del cliente**: el estado del trabajo lo fija Vrutal. El
cliente propone y comenta.

**Y se ven todos los agentes juntos** (2026-10-23, a petición del founder): el agente es un
**filtro** de la pantalla, no una pantalla distinta. Se mira el tablero para saber en qué anda
el equipo entero, no para auditar a uno. Cada tarjeta lleva la franja de color y el nombre de su
agente para que no se confundan, con el tono derivado del `job_role_key` — si saliera de la
posición en la lista, contratar un especialista le cambiaría el color a todos los demás.

**Trampas encontradas al construirlo, las tres en el código de Kaneo 2.46.2:**

- Sus identificadores son **`text`, no `uuid`** (`text("id")` en su esquema). El espejo con
  `uuid` habría roto el upsert en la primera pasada.
- Su respuesta de tablero **no trae `updatedAt`**, así que no hay «dame lo que cambió desde»:
  cada pasada es una foto completa por proyecto. A esta escala sobra.
- Su ruta de **lectura** de comentarios (`comment/controllers/get-comments.ts`) ignora
  `externalUserName` y devuelve el nombre del usuario de la API key. Por eso los comentarios
  entran en el espejo con `ignoreDuplicates`: si no, el comentario de una persona del cliente
  pasaría a figurar como «VrutalOS» en la siguiente pasada. **Comprobado en vivo el 2026-10-23**:
  se escribe `externalUserName: "Gonzalo"`, y la relectura devuelve `"Equipo Vrutal"`.
- **Y otra del panel, tampoco de Kaneo:** un secreto pegado en Edge Functions se lleva un salto
  de línea o un espacio, y la comparación exacta falla **en silencio**. El 2026-10-23 los tres
  secretos del tablero llegaron así: `BOARD_SYNC_TOKEN` devolvía 401 con el token correcto, y
  `KANEO_API_URL` llegaba con un espacio detrás. Las dos funciones hacen `trim()` de los tres
  desde entonces. **Y el que se pega tiene que ser el valor, no la plantilla**: `KANEO_API_URL`
  estaba puesto literalmente como `https://<slug>-tareas.<dominio>`.
- **Y una del entorno, no de Kaneo:** mandar un JSON con acentos desde Git Bash con `curl -d`
  los corrompe (llegan como `U+FFFD`). Los nombres de los proyectos nacieron rotos y hubo que
  rehacerlos enviando el cuerpo desde un fichero UTF-8. Para cualquier alta por API desde esta
  máquina: el cuerpo, en fichero.

**Lo que falta para que funcione** (ver `db/plantillas/cambios/README.md`): aplicar la
migración, activar `pg_cron` y `pg_net` en el proyecto del cliente (comprobado el 2026-10-22:
**no están**), desplegar las dos funciones con su `verify_jwt`, y el alta manual en Kaneo
(cuenta del staff, workspace, un proyecto por especialista, API key) con su fila en
`board_project`. Diagrama: `docs/arquitectura/tablero_kaneo.drawio`.

---

## 10. Cronología (la navegación)

| Fecha | Hito | Por qué importa |
|---|---|---|
| 2026-08-01 | `v0.1.0 Foundation` | Primer commit |
| ~sep | Esquema de las dos bases, RLS, Vault, `provision_tenant` | Los cimientos |
| 15 sep | **D-16/D-17**: RBAC único, `roles.scope`; **D-18/D-19**: sync con token y lease | Se cierran los dos agujeros de autorización |
| 18 sep | Sync: upserts en bloque + tenants en paralelo. 4 tareas de SDR mal enlazadas, corregidas | El sync pasa de «no escala» a escalar |
| 21–29 sep | Panel-Vrutal1st: catálogo, clientes, bloques, login + 2FA, dashboard | Nace el panel de staff |
| **1 oct** | **Reorganización del repo**: 157 movimientos, «nada se borró» (`MOVIMIENTOS.md`) | De carpetas sueltas a estructura |
| 5–6 oct | Base de cliente: cuentas, Vault de integraciones, entregables, rol Manager, RPCs de Equipo y Consumo | El cliente empieza a existir de verdad |
| 8 oct | **D-20**: tickets centralizados en Vrutal1st | «¿De quién es este dato?» |
| 10 oct | Migración **024** (contratar especialista) y **025** (la clave de Postiz es del centro) | Dos huecos encontrados al montar Marketing |
| 11 oct | **029**: el schema `deployment` nunca se había creado | Prerrequisito oculto de la 022 |
| 13 oct | **Aprobaciones en VrutalOS**; **031** + grant: el sync crea especialistas; auditoría objeto por objeto | Aparecen **dos cambios sin aplicar** que el registro ya marcaba |
| **14 oct** | `mem_limit` en los 16 servicios; git ordenado (7 commits); corregida la guía de aprobación de F2; esta bitácora | Se paga la deuda de infraestructura y de historial |
| **22–23 oct** | **Tablero**: Kaneo en la instancia del cliente, espejo `board_*` con su cron, `board-sync`/`board-write`, pantalla y diseño | El cliente deja de ver solo resultados y ve **en qué se está trabajando** |

---

## 11. Lo que NO está hecho (no confundir diseño con funcionamiento)

- **Alta de cliente a mano.** Aplicar cambios desde el SQL Editor **no deja rastro**: este
  repositorio es el único registro y se desincroniza. Ya costó caro el 13 de octubre (dos
  cambios llevaban **cinco días** sin aplicar, en silencio, porque nada falla al arrancar: solo
  al usarse). Hace falta un script que aplique plantilla + todos los cambios en orden y **falle
  en voz alta**, más una tabla de control (`schema_change_log`) en la base del cliente.
  **En `db/migrations/` ya no queda deuda** (auditado el 2026-10-14): las sobrecargas duplicadas
  de la `028` no existen —una firma cada una— y la `002` «a medias» **no es un error pendiente**:
  la `029` la adjudicó por escrito el 2026-10-11, creando solo `deployment.tenant_integration` y
  dejando el resto sin resucitar porque nada lo llama. Sus 8 tablas `deployment.*` ausentes son
  duplicados de lo que vive en la base de cada cliente: crearlas **contradiría D-01 y D-02**.
  La `002` se escribió antes de que «un Supabase por cliente» fuera firme.
- **Plantilla de cliente desfasada** (10 tablas de 20).
- **Tablero a medias** (2026-10-23). Encendido: perfil `tareas` levantado, Kaneo con su
  workspace, tres proyectos (MKT, SEO, ANL) con las columnas en español y la API key `VrutalOS`;
  migración aplicada y verificada objeto por objeto; `pg_cron` y `pg_net` instaladas; los tres
  proyectos y sus columnas sembrados en el espejo. **Queda**: poner los tres secretos de Edge
  Function (`BOARD_SYNC_TOKEN`, `KANEO_API_URL`, `KANEO_API_KEY` — el almacén de secretos no se
  toca desde aquí), desplegar `board-sync` (`verify_jwt=false`) y `board-write` (`true`), y
  programar el cron. **El cron no se programa todavía a propósito**: las Edge Functions corren en
  la nube de Supabase y **no alcanzan el Kaneo de la máquina de desarrollo**, igual que
  `integration-social-connect` no alcanza al Postiz local. Se valida al pasar al VPS; mientras
  tanto, programarlo solo llenaría `cron.job_run_details` de fallos de red.
- **Provisioning del plano de datos**: manual (crear el Supabase del cliente, su VPS, su
  Activepieces).
- **Autonomía por tarea**: hoy el techo es por especialista. Falta un techo **por tarea**, para
  que una tarea sensible (mover dinero, borrar datos) exija aprobación aunque el especialista sea
  autónomo. Y el bloque «Pide permiso» debe leer `task_autonomy_effective.effective_level`, o el
  ajuste de la app no tiene efecto real.
- **Dominio de correo** cerrado solo en una Edge Function (debería ser tabla + trigger sobre
  `auth.users`).
- **Database Webhook de redes sociales** sin configurar; funciona por el sync de 15 min.
- **Permisos por defecto de Supabase** (`TRUNCATE`, `REFERENCES`, `TRIGGER` para `anon` y
  `authenticated`) retirados **solo** en `integrations`. Repasar el resto antes del primer
  cliente.
- **`specialists`**: cualquier autenticado los lee; el filtrado por acceso es solo del front.
- **MFA del staff**: activar y, cuando todo el staff esté enrolado, exigir `aal2` en
  `has_platform_role()`.
- **Rotación de `sync_cron_token`**: sin procedimiento escrito.
- **Entregables**: `work_collection` / `work_item` existen y están **vacías**; falta definir las
  colecciones y el bloque «Escribir en la tabla» que sustituya a Google Sheets.

---

## 12. Reglas de oro

1. **Antes de asignar una herramienta a una tarea, pregunta de quién es la tarea: del centro o
   del cliente.** Casi todos los errores del proyecto vienen de no preguntarlo (Activepieces
   para el sync, la clave de Postiz en el Vault del cliente, los tickets en la base del cliente).
2. **La anon key identifica; nunca autoriza.**
3. **`service_role` jamás sale del servidor.**
4. **Un secreto por consumidor.**
5. **Una tabla nueva lleva su GRANT y su policy en la misma migración.** No se heredan.
6. **Comprueba contra la base viva antes de decir que algo está aplicado.** No hay tabla de
   control: el registro de este repositorio es todo lo que hay, y miente cuando alguien olvida
   anotar.
7. **Una sola copia de cada documento.** Versión nueva = misma ruta. Lo superado va a
   `_eliminar/`.
8. **Los secretos nunca entran en git.** `.env`, `infra/instance/clients/`. Sí se versionan los
   `*.env.example`.
9. **No se documenta un proceso como «listo» hasta haberlo ejecutado de verdad** (metodología de
   LAB15: Audit → Report → Design → Test → Deploy → Evolve).
10. **Mientras el catálogo esté en pre-live, todo se puede borrar: úsalo.** Un bloque o una
    composición que ya no describe lo que corre no se deja «por si acaso», se borra. Y
    **apagar el pre-live es parte del alta del primer cliente**, no un detalle posterior.

---

## 13. Dónde está cada cosa

Mapa de carpetas: [`../README.md`](../README.md). Qué se movió el 1 de octubre y de dónde:
[`../MOVIMIENTOS.md`](../MOVIMIENTOS.md).

Fuentes de verdad que **no** están en este repositorio:

- Supabase **Vrutal 1st** `apmhvqlvwjcrwfaixgju` — plano de control.
- Supabase **VrutalOS** `rgauumxztblwurzebmsa` — Vrutal-labs, el cliente 0.
- `C:\VrutalOS` — clon del repo privado donde se publican los artefactos de los bloques.
- Registro de cambios de la base de cliente:
  [`../db/plantillas/cambios/README.md`](../db/plantillas/cambios/README.md) — **léelo antes de
  tocar un proyecto de cliente**.
