# VRUTAL OS · Documento de Contexto Técnico

> **Para qué sirve este documento.** Es el contexto que se sube a Claude (u otro asistente, o un programador) al empezar a trabajar sobre el core técnico de Vrutal, para que NO reconstruya la arquitectura de memoria y NO contradiga decisiones ya tomadas. No es estrategia (eso vive en los LABs). Es el mapa técnico y el registro de decisiones firmes.
>
> **Estado:** v2 · 15 septiembre 2026. Documento vivo — se actualiza cada vez que se toma o cambia una decisión de arquitectura.
>
> **Regla de oro para quien lea esto:** si algo aquí contradice lo que crees recordar, gana este documento. Si algo aquí contradice el estado real de la base de datos, gana la base de datos y hay que actualizar este documento.
>
> **Aviso aprendido en v2:** la v1 quedó desfasada en días (decía que el sync no existía cuando llevaba 291 ejecuciones). Antes de construir encima de este documento, contrasta las secciones 5 y 6 con la base.

---

## 0. Cómo leer esto antes de tocar nada

1. Lee la sección 1 (los dos planos) — es el concepto que más se malinterpreta.
2. Lee la sección 3 (decisiones firmes) — son cerradas, no se reabren sin decisión explícita del responsable.
3. Antes de proponer una herramienta nueva para una tarea, comprueba en la sección 4 si esa tarea ya tiene dueño asignado.
4. Antes de escribir SQL, consulta el estado real de la base — este documento lista las tablas pero la base es la verdad.

---

## 1. La arquitectura en una frase

Vrutal tiene **dos planos** que nunca se confunden:

- **Control-plane (Vrutal1st):** UNA sola base. El centro de operaciones de Vrutal. Aquí vive la propiedad intelectual (catálogo de roles y tareas, prompts maestros), qué ha contratado cada cliente, las credenciales de acceso a cada cliente, y el RBAC del equipo interno de Vrutal. Nunca se replica.

- **Data-plane (VrutalOS):** UNA base POR CLIENTE. Lo que ve y usa el cliente. Aquí viven sus conversaciones, sus aprobaciones, su registro de ejecuciones, sus usuarios. Habrá tantas como clientes (objetivo: decenas o cientos).

Y un tercer componente que **no es una base de datos**:

- **Motor de ejecución (Activepieces):** UNO POR CLIENTE, en el contenedor docker que creamos para el cliente y controlamos. Es lo que hace el trabajo real de los agentes: leer un email, extraer datos de un PDF, escribir en el CRM del cliente. **Activepieces NO se usa para nada más.** (Ver decisión D-07.)

- **Nota Importante** Cuando se hace referencia a su VPS, en realidad hablamos de Contenedor, dependiendo de la necesidad el contenedor puede estar en un VPS compartido o en un VPS exclusivo. 

### Diagrama mental

```
                    ┌─────────────────────────┐
                    │       VRUTAL1ST          │   ← uno solo, el centro
                    │   (control-plane)        │
                    │  catálogo · prompts IP   │
                    │  contratos · credenciales│
                    └───────────┬─────────────┘
                                │ sync de catálogo (pg_cron → Edge Function sync-catalog)
              ┌─────────────────┼─────────────────┐
              ▼                                     ▼
   ┌──────────────────────┐            ┌──────────────────────┐
   │ CLIENTE A (su Docker)  │          │   CLIENTE B (su Docker)  │   ← uno por cliente
   │  ┌────────────────┐  │            │  ┌────────────────┐  │
   │  │ VrutalOS base A │  │            │  │ VrutalOS base B │  │
   │  └────────────────┘  │            │  └────────────────┘  │
   │  ┌────────────────┐  │            │  ┌────────────────┐  │
   │  │ Activepieces A  │──┼─→ CRM/ERP  │  │ Activepieces B  │──┼─→ CRM/ERP
   │  └────────────────┘  │   de A     │  └────────────────┘  │   de B
   └──────────────────────┘            └──────────────────────┘
```

**Dos tipos de flecha, no confundir:**
- Vrutal1st → cada VrutalOS = **sync del catálogo** (copiar "qué flujos tiene contratados este cliente"). Interno, cada 15 min. Lo hace Supabase, NO Activepieces.
- Activepieces → sistemas del cliente = **trabajo real de los agentes**. Lo hace Activepieces, uno por cliente.

---

## 2. Identidad de los proyectos (datos reales)

| Proyecto | Rol | Supabase ref | Región |
|---|---|---|---|
| **Vrutal1st** (también llamado "Vrutal 1st") | Control-plane | `apmhvqlvwjcrwfaixgju` | eu-central-1 |
| **VrutalOS** | Data-plane (plantilla / primer cliente) | `rgauumxztblwurzebmsa` | eu-central-1 |

- Hoy `VrutalOS` (`rgauumxztblwurzebmsa`) hace doble papel: es la plantilla del data-plane Y la instancia del primer cliente (Vrutal Labs, dogfooding).
- Ambos corren Postgres 17 en Supabase gestionado.
- El tenant "Vrutal-lab" es `is_internal=true` y su `supabase_project_ref` apunta a `rgauumxztblwurzebmsa`.

> **Aviso de nomenclatura:** en el diccionario de marca hay DOS cosas llamadas "VRUTAL OS": el producto (esta arquitectura) y el sistema documental interno de 16 LABs. Este documento trata del PRODUCTO. Ver LAB 00, Cap. 2.

---

## 3. Decisiones firmes (cerradas — no reabrir sin decisión explícita)

| # | Decisión | Fecha | Motivo |
|---|---|---|---|
| **D-01** | **Un proyecto Supabase por cliente**, no multi-tenant en una sola base. | sesión inicial | Aislamiento real entre clientes. Es lo que hace que las policies RLS con `qual=true` sean seguras (dentro de un tenant, "ver a tu equipo" no es fuga). |
| **D-02** | **Los prompts (maestro y customizado) NUNCA existen físicamente en la base del cliente.** Viven en Vrutal1st (`catalog.job_role_prompt`, `public.tenant_specialist_prompt`) y se inyectan en tiempo de ejecución server-side. | sesión prompts | Es la IP de Vrutal. Sacarlos de la base del cliente es más fuerte que cualquier RLS. La tabla `specialist_prompts` del data-plane fue ELIMINADA. |
| **D-03** | **Que el agente no revele su propio prompt** es una mitigación por instrucción, NO una garantía. No se promete "inextraíble". | sesión prompts | Honestidad técnica. Un modelo reduce el riesgo, no lo elimina. |
| **D-04** | **El admin del cliente lo crea Vrutal**, no la propia empresa. El rol se fija vía `app_metadata` (solo escribible por `service_role`), nunca `user_metadata`. | sesión auth | Seguridad: `user_metadata` lo puede escribir el usuario desde el navegador; `app_metadata` no. Impide auto-nombrarse admin. |
| **D-05** | **Signup público CERRADO.** Nadie se registra desde una web abierta. Usuarios normales entran por invitación (el admin del cliente pone email+nombre, el usuario pone su contraseña). Solo Vrutal crea/cambia admins. | sesión auth | Modelo de negocio: el acceso se controla, no se auto-sirve. **Aplica también a Vrutal1st** (staff entra solo por invitación). |
| **D-06** | **Sync del catálogo (Vrutal1st→VrutalOS) con Supabase `pg_cron` + Edge Function.** NO con Activepieces. | sesión arquitectura | El sync es trabajo del centro, no debe depender del motor de ejecución de ningún cliente. |
| **D-07** | **Activepieces sirve EXCLUSIVAMENTE para ejecutar los agentes/roles** (leer email, extraer PDF, escribir en CRM). Uno por cliente, en su contenedor. Nada de sync ni tareas internas de Vrutal. | sesión arquitectura | Separación de responsabilidades. |
| **D-08** | **Infraestructura: VPS compartido por defecto**, dedicado solo cuando la métrica de LAB 08 (concurrencia pico sostenida) lo pida. NO dedicado desde el cliente 1. | sesión infra | Coste. Lo fija una métrica, no el número de cliente. |
| **D-09** | **Base de datos del cliente: Supabase gestionado por defecto.** Self-hosted queda como opción PREMIUM futura. | sesión infra | Gestionado da Auth, RLS, backups, Vault y Storage "gratis"; self-host obliga a construir y mantener todo eso ×N clientes. |
| **D-10** | **Las credenciales de cada VrutalOS se guardan en Vault de Vrutal1st** (`tenant_credential` + `vault.create_secret`). Viajan del data-plane al control-plane, nunca al revés. | sesión sync | El control-plane necesita saber cómo conectarse a cada cliente; el cliente no necesita credenciales del control-plane. |
| **D-11** | **Los secretos NUNCA se manejan desde el navegador** ni desde un panel HTML. | sesión sync | Un panel corre en el cliente. Ver D-17 para cómo se aplica al panel. |
| **D-12** | **KPIs y reportes son personalizables POR USUARIO**, aunque dos usuarios compartan el mismo agente. El KPI se liga a un reporte concreto (`report_key`), no solo al agente. | sesión modelo datos | Requisito de producto explícito. |
| **D-13** | **La tarea es la unidad atómica; el rol es una vista etiquetada sobre la biblioteca de tareas compartida.** Una tarea que se repite entre roles se ENLAZA (`job_role_task`), no se duplica. | doc Modelo de Datos | Evita 250 documentos que se contradicen. |
| **D-14** | **Delegación por vacaciones acotada por agente O por flujo concreto** (mutuamente excluyente), nunca "todo". Revocable por el admin del cliente. | sesión pantallas | Se delega lo necesario para que el agente siga trabajando. |
| **D-15** | **"Multi-agente en una sesión" NO entra en el lanzamiento.** Está en Explorando (LAB 15), bloqueado por Sinapsis/LAB 05. | sesión pantallas | Decisión consciente de alcance. |
| **D-16** | **Autorización del staff de Vrutal: SOLO RBAC** (`user_roles` → `roles` → `role_permissions`). Los flags `profiles.is_platform_admin` / `is_superadmin` se ELIMINARON. `is_superadmin()` / `is_platform_admin()` se mantienen como envoltorios sobre RBAC. Las policies migran a `has_permission()` tabla a tabla conforme el panel toque cada pantalla. | 15 sep 2026 | Había dos fuentes de verdad para decidir quién manda, y se contradecían. |
| **D-17** | **Roles con ámbito (`roles.scope`)**: `platform` = roles de Vrutal, otorgan permisos en Vrutal1st y son globales (`tenant_id` NULL). `client` = plantilla INFORMATIVA de los roles del cliente (`client_admin`, `client_user`); no se asignan a usuarios de Vrutal1st ni otorgan nada aquí. Los permisos reales del cliente viven en su data-plane. | 15 sep 2026 | Los roles de cliente estaban concediendo permisos en el control-plane sin que nadie lo pretendiera. |
| **D-18** | **El panel escribe y rota credenciales, nunca las lee.** `get_tenant_credential` está revocada para `authenticated`. Solo procesos server-side (`service_role`) leen secretos. | 15 sep 2026 | Aplicación estricta de D-11. |
| **D-19** | **El sync se autentica con un token propio, no con la anon key.** pg_cron lee `sync_cron_token` de Vault y lo envía en `x-sync-token`; la Edge Function lo valida vía `sync_acquire_lease`, que además impide ejecuciones solapadas (lease de 300 s). | 15 sep 2026 | La anon key es pública: con ella cualquiera podía disparar el sync con `service_role` contra todas las bases de cliente. |
| **D-20** | **Los tickets de soporte NUNCA viven en la base del cliente** (se descartó el nombre reservado `client_ticket`). Viven en Vrutal1st (`public.support_ticket` / `support_ticket_message`, migración 023), igual que `tenant_integration`. La instancia del cliente los crea/lee llamando a Vrutal1st (Edge Functions `ticket-intake`/`ticket-query`), autenticada con `tenant_instance.push_token` — el mismo canal de D-11/022, ahora bidireccional. | 8 oct 2026 | Un ticket es una conversación con Vrutal sobre el servicio, no un dato de negocio del cliente: no aplica el aislamiento por instancia que sí aplica a CRM/estrategia/contenido. |

---

## 4. Quién resuelve qué (mapa de herramientas)

| Necesidad | Herramienta asignada | Notas |
|---|---|---|
| Base de datos, Auth, RLS, backups, Storage, Vault | **Supabase gestionado** | Por cliente (data-plane) y para el control-plane. |
| Ejecutar el trabajo de los agentes | **Activepieces** (self-host, MIT, uno por cliente) | Solo esto. Ver D-07. |
| Sync de catalogo entre bases | **pg_cron `sync-catalog-to-clients` + Edge Function `sync-catalog`** | Ver D-06 y D-19. |
| Autorización del staff | **RBAC en Vrutal1st** | Ver D-16 y D-17. |
| Guardar secretos | **Supabase Vault** (`tenant_credential`) + **Bitwarden** para lo que maneja el humano | Nunca texto plano, nunca navegador. |
| Facturación | **Holded** (API externa) | `tenants.holded_contact_id` enlaza. No hay tabla de facturas propia. |
| Frontend (paneles Vrutal-lab y VrutalOS) | Pendiente de construir. | Ver sección 7. |

### Licencia de Activepieces (importante)
- La edición Community (MIT) es gratis y de ejecuciones ilimitadas en self-host. **Es la que usamos.**
- Las features `ee/` (multi-tenant, SSO, roles, white-label) requieren licencia comercial de pago, incluso self-hosted.
- **La arquitectura de "una instancia por cliente" (D-01) ESQUIVA la necesidad de licencia comercial.**
- Cada instancia Community pide crear un admin la primera vez. Solución: mismo correo de Vrutal en todas, **contraseña distinta y fuerte por instancia** (en Bitwarden).

---

## 5. Modelo de datos (estado real a 15 sep 2026)

> **Cifras desfasadas (2026-10-14).** Los conteos son de 15 sep. Verificado en vivo el 14 oct:
> `catalog.task` 1.093 · `job_role` **8** (no 2) · `job_role_task` **261** (no 62) · `domain` 3 ·
> `process` 17 · `tenant_specialist` 5 · `tenant_specialist_flow` 67. Las tablas de octubre
> (019-031) y las relaciones entre ellas estan en [`../BITACORA.md`](../BITACORA.md) §3 y §4.

### 5.1 Vrutal1st (control-plane) — schema `catalog` (la IP)

| Tabla | Qué contiene | RLS |
|---|---|---|
| `domain` | Dominios. Capa 1 taxonomía. (2 filas) | Sí (desde v2) |
| `process` | Procesos dentro de un dominio. (11 filas) | Sí (desde v2) |
| `occupation` | Ocupaciones de referencia O*NET. (21 filas) | Sí |
| `task` | **La biblioteca de tareas.** `task_code` opaco (TSK-XXXXXX). (1.084 filas) | Sí |
| `job_role` | Roles/especialistas. Versionado por `(key, version)`. (2 filas) | Sí |
| `job_role_task` | Enlace rol↔tarea con `time_weight_pct`, `criticality`, `effect_classification`. (62 filas) | Sí |
| `job_role_prompt` | **Prompt maestro versionado.** Solo superadmin. (vacía) | Sí |
| `component` / `task_component` | **VACÍAS a propósito** — se llenan cuando algo se construye de verdad. | Sí (desde v2) |
| `report_definition` / `kpi_definition` | Catálogo de reportes y KPIs por rol. (vacías) | Sí |

### 5.2 Vrutal1st (control-plane) — schema `public` (operación de Vrutal)

| Tabla | Qué contiene |
|---|---|
| `tenants` | Los clientes. `supabase_project_ref`, `holded_contact_id`, `account_manager_profile_id`, `is_internal`, `data_plane_status`. |
| `tenant_specialist` | Qué agente ha contratado cada cliente. |
| `tenant_specialist_prompt` | Versión efectiva del prompt por cliente. Versionado X.Y.Z. Solo staff. |
| `tenant_specialist_flow` | Qué flujos (tareas) están encendidos por cliente, con su `autonomy_level`. |
| `tenant_report_enablement` / `tenant_kpi_enablement` | Qué reportes/KPIs están encendidos por cliente. |
| `tenant_credential` | Puntero a la credencial del VrutalOS de cada cliente (el secreto real está en Vault). |
| `profiles` | Staff de Vrutal. **Sin flags de admin desde v2.** El usuario solo puede editar su `full_name`. |
| `roles` | Con columna **`scope`** (`platform` / `client`). Ver D-17. Roles `platform`: `platform_superadmin`, `platform_admin`, `platform_ops`. Roles `client` (informativos): `client_admin`, `client_user`. |
| `permissions` / `role_permissions` | 21 permisos. Solo un superadmin puede editarlos. |
| `user_roles` | Asignaciones. Solo roles `platform`, siempre globales. Única por `(profile, role, tenant)` con `NULLS NOT DISTINCT`. |
| `tenant_members` / `external_references` | Membresía y referencias externas. |
| `sync_run_log` | Una fila por tenant y ejecución del sync (estado, contadores, error). |
| `sync_lease` | Una fila. Lease de ejecución única del sync. Sin acceso para `anon`/`authenticated`. |
| `tenant_instance` / `tenant_onboarding_step` | Instancia Docker de cada cliente y checklist de alta (migración 019). Sin secretos: viven en la instancia. |
| `support_ticket` / `support_ticket_message` | Tickets de soporte del Admin del cliente (migración 023, D-20). **No** viven en la base del cliente. |

**Funciones de autorización:**
- `has_platform_role(text[])` — base de todo: rol `platform` global, perfil `active` y no borrado.
- `is_superadmin()` → `platform_superadmin`. `is_platform_admin()` → `platform_superadmin` o `platform_admin`.
- `has_permission(perm, tenant)` — solo cuenta roles `platform` y perfiles activos.
- Todas sin `EXECUTE` para `anon`.

**Guardias (triggers en `user_roles`):**
- `trg_user_roles_guard` — rechaza roles `client`, roles con `tenant_id`, y cualquier cambio hecho con sesión de usuario que no sea superadmin. Con `auth.uid()` NULL (SQL Editor / `service_role`) permite el bootstrap.
- `trg_user_roles_last_superadmin` — rechaza cualquier operación que deje el sistema sin superadmin.

**Funciones de negocio:**
- `set_tenant_credential(tenant, purpose, secret)` — guarda credencial en Vault (exige `secrets.manage`). **Es la única vía del panel para credenciales.**
- `get_tenant_credential(tenant, purpose)` — **revocada para `authenticated`** (D-18). Solo `service_role`.
- `provision_tenant(name, industry, size, job_role_keys[], status)` — crea el tenant en el control-plane, sus contratos y sus flujos (autonomía `suggest` por defecto). **No provisiona el data-plane.**
- `list_sync_targets()` / `get_tenant_sync_payload(tenant)` — solo `service_role`, los usa el sync.
- `sync_acquire_lease(token, ttl)` / `sync_release_lease()` — solo `service_role`. Ver D-19.
- `cascade_tenant_specialist_status()` — trigger: al pausar/cancelar un contrato, apaga sus flujos/reportes/KPIs.

**Sync (D-06, D-19):**
- Cron `sync-catalog-to-clients`, cada 15 min, `net.http_post` a la Edge Function `sync-catalog` con cabecera `x-sync-token` leída de Vault en cada ejecución.
- Secretos en Vault: `sync_cron_token` (rotar con `vault.update_secret`), `vrutal_sync_scoped_cred_vrutal_lab`.
- Verificado el 15 sep 2026: sin token → 401; token falso → 401; token válido → 200 y 62 flujos sincronizados; lease liberado al terminar.

> **Nota sobre bootstrap:** para asignar el primer superadmin de un entorno nuevo se usa el SQL Editor (sin `auth.uid()`), que las guardias permiten a propósito. Con sesión de usuario, solo un superadmin asigna roles.

### 5.3 VrutalOS (data-plane, por cliente) — schema `public`

| Tabla | Qué contiene |
|---|---|
| `profiles` | Usuarios del cliente. Primer usuario = `client_admin` (bootstrap); resto según `app_metadata` (D-04). |
| `specialists` | Los agentes desplegados en este cliente (metadatos, NO el prompt). |
| `conversations` / `conversation_participants` / `messages` | El chat. |
| `run_log` | Registro de ejecuciones. |
| `approval_requests` | Flujos esperando autorización. Con `assigned_to`, `requested_by`. |
| `approval_delegation` | Delegación por vacaciones (agente O flujo, D-14). |
| `catalog_flow_ro` / `catalog_report_ro` / `catalog_kpi_ro` | **Espejo de solo lectura** del catálogo, poblado por el sync. Sin prompt. |
| `user_specialist_access` | Qué usuario tiene qué agente habilitado. |
| `user_report_subscription` / `user_kpi_selection` | Personalización por usuario (D-12). |
| `report_output` | Reportes generados (xlsx/docx/pdf en Storage, o web con URL). |
| `knowledge_update_request` | Solicitudes de actualizar contexto/RAG. Por defecto pasan por aprobación. |
| `integrations` | Conexiones a APIs del cliente (CRM, ERP…). Secretos vía `secret_ref`. |
| `audit_log` | Auditoría. |

Bucket de Storage: `client-files` (privado). Convención de ruta propuesta: `reports/{specialist_id}/{report_key}/{filename}`.

> El data-plane no se ha auditado en v2. Esta tabla viene de v1: verificar contra la base antes de usarla.

---

## 6. Estado del proyecto (honesto)

> **Desfasada (2026-10-14).** Esta seccion describe el estado a 15 sep. Lo que se hizo entre
> el 19 sep y el 14 oct (los dos frontales, las tablas de octubre, aprobaciones, Postiz) esta en
> [`../BITACORA.md`](../BITACORA.md). **Donde haya discrepancia, manda la bitacora.**

**Lo que está hecho y probado:**
- Esquema completo de ambas bases, con RLS y migraciones versionadas.
- Catálogo con 1.084 tareas, 2 `job_role` y 62 enlaces rol↔tarea.
- Auth del data-plane validado de punta a punta: signup → trigger → perfil con rol correcto.
- Credencial del primer cliente guardada en Vault.
- **Sync construido y en producción**: cron cada 15 min + Edge Function. Histórico hasta el 15 sep: 258 ejecuciones correctas y 33 con error (`Gateway Timeout` en `get_tenant_sync_payload`, último el 14 sep). Autenticado con token y lease desde el 15 sep.
- **18 sep: causa del timeout identificada y corregida.** No era `get_tenant_sync_payload` (esa función es una sola query, rápida) sino `pushToTenant()` dentro de la Edge Function `sync-catalog`: hacía un `await sql` por fila (insert/upsert) en un bucle secuencial contra la base del cliente — con 62 flows, 62+ round-trips antes de terminar, contra un timeout de 25 s en el cron (`net.http_post`). Se reescribió a upserts en bloque (1 query con `unnest` por tabla — flows/reports/kpis — más 1 disable en bloque por tabla) en vez de fila a fila. Desplegado como versión 4 y verificado: `status_code 200`, `timed_out false`, 62 flows sincronizados sin error, confirmado también en las dos ejecuciones normales del cron posteriores.
- **`provision_tenant`** crea tenant, contratos y flujos en el control-plane.
- **RBAC único en Vrutal1st** con guardias contra escalada y contra quedarse sin superadmin, verificado simulando sesiones.
- Activepieces Community corriendo en local (Docker).

**Lo que NO está hecho (no confundir diseño con funcionamiento):**
- El frontend (paneles Vrutal-lab y VrutalOS) NO existe.
- Ningún flujo de agente real corriendo en Activepieces todavía.
- Provisioning del data-plane (crear el proyecto VrutalOS del cliente, su VPS y su Activepieces): manual.
- Manual de instalación paso a paso: pendiente.

**Metodología (de LAB 15):** todo pasa por Audit → Report → Design → Test → Deploy → Evolve. No se documenta un proceso como "listo" hasta que se ha ejecutado de verdad.

---

## 7. Puntos abiertos (pendientes de decisión o construcción)

**Seguridad (prioritario):**
- **Signup público de Auth en Vrutal1st**: confirmar que está desactivado (Dashboard → Authentication → Sign In / Providers → "Allow new users to sign up" en OFF). No es verificable por SQL.
- **MFA (TOTP) para el staff**: activarlo y, cuando todo el staff esté enrolado, exigir `aal2` dentro de `has_platform_role()`.
- **Suspender usuarios**: los admins ya no pueden cambiar `profiles.status` vía API (el grant de columna solo permite `full_name`). Hace falta una RPC `set_profile_status` con `has_permission('users.write')` cuando el panel lo necesite.
- **Migración de policies a `has_permission()`** (D-16): tabla a tabla con cada pantalla del panel. Incoherencia conocida hasta entonces: `platform_admin` escribe `tenants` por policy sin tener `tenants.write` en RBAC; `platform_ops` tiene el permiso pero la policy no se lo deja usar.
- **Rotación de `sync_cron_token`**: sin procedimiento definido.

**Sync:**
- **"No escala" resuelto (18 sep), en ambos ejes**: `pushToTenant()` hace 1 upsert en bloque + 1 disable en bloque por tabla (flows/reports/kpis) en vez de fila a fila, y la Edge Function ahora invoca a todos los tenants en paralelo (`Promise.all`, un `catch` y un log por tenant) en vez de un `for` secuencial. Versión 5 desplegada y verificada: `status_code 200`, sin timeout, mismos conteos que antes del cambio. Sin límite de concurrencia explícito — no hace falta con el número de clientes de hoy; si la lista de tenants crece mucho, añadir un tope antes de que sea un problema real, no antes.
- `report_key`/`kpi_key`: referencia blanda hasta que haya reportes/KPIs en el catálogo.

**Panel Vrutal-lab:**
- **Stack propuesto, pendiente de confirmar**: SPA (Vite + React + TypeScript) con `supabase-js` y sesión de usuario; toda operación privilegiada vía RPC con comprobación de permisos; **sin `service_role` en el panel**.
- **Alcance v0 propuesto**: tenants (con `provision_tenant`), contratos, flujos y `autonomy_level`, alta/rotación de credenciales, drift de prompts, estado del sync.

**Resto:**
- **Provisioning del data-plane**: sin automatizar.
- **Componentes** (`catalog.component`): vacío hasta que se construya software real.
- **`time_weight_pct`**: sin poblar; se mide en auditoría real, no se estima.
- **Roles nuevos** (Ventas, Compras, Finanzas, RRHH): catálogo de tareas importado, sin ficha `job_role` completa.
- **Webhooks entrantes a Activepieces**: para producción, dominio propio o túnel.
- **Discrepancia en doc Data Entry Clerk**: el resumen decía 8 tareas con intervención humana pero solo 2 estaban marcadas; revisar. **No confundir con el bug de 18 sep de abajo** — este sigue sin resolver, requiere el documento fuente original para saber cuáles 6 tareas más debían llevar `effect_classification = 'irreversible'`.
- **18 sep: 4 tareas de SDR estaban mal enlazadas a Data Entry Clerk — corregido.** `TSK-001284/1285/1288/1289` (captura de lead, agenda, alta de contacto/oportunidad en HubSpot) formaban parte del flujo de 7 pasos del SDR pero estaban en `catalog.job_role_task` bajo `data_entry_clerk`, y lo mismo en `tenant_specialist_flow` (la tabla que de verdad sincroniza al cliente). Movidas a `sdr` en ambas tablas (migraciones `fix_sdr_tasks_mislinked_to_data_entry_clerk` y `fix_sdr_tenant_specialist_flow_mislinked_to_data_entry_clerk`), sync re-disparado y verificado: las 4 quedan `enabled` bajo `sdr` en `catalog_flow_ro` del cliente, las filas viejas bajo `data_entry_clerk` quedan `disabled` (soft-delete, comportamiento esperado del sync). **Nota de producto:** una tarea no es exclusiva de un rol — varios roles pueden compartir la misma tarea vía `job_role_task` (D-13). Cada una de estas tareas es, en la práctica, un mini-flujo de Activepieces pendiente de programar.

---

## 8. Errores ya cometidos (para no repetir)

1. **Se propuso Activepieces para el sync de catálogo.** Corregido en D-06/D-07. **Lección:** antes de asignar una herramienta a una tarea, preguntar "¿de quién es esta tarea, del centro o del cliente?".
2. **Se marcaron policies `qual=true` como fallo de seguridad en la primera auditoría.** Con D-01, no lo son. **Lección:** una alarma de seguridad depende del modelo de aislamiento; confirmar el modelo antes de alarmar.
3. **Dos proyectos Supabase divergieron** al principio (Lovable creaba proyectos nuevos). **Lección:** una sola fuente de verdad; herramientas no-code que provisionan infra por su cuenta fragmentan el sistema.
4. **Este documento se quedó atrás de la base en días** (v1 decía que el sync no existía). **Lección:** actualizar el documento en la misma sesión en que se construye algo, no después.
5. **Se usó la anon key como autenticación del sync.** La anon key es pública; `verify_jwt` solo comprueba que el JWT sea válido, no quién llama. Corregido en D-19. **Lección:** anon key = identificación del proyecto, nunca autorización.
6. **Convivieron dos sistemas de autorización** (flags en `profiles` y RBAC) y los permisos de `user_roles` estaban vacíos: nadie podía usar las funciones de credenciales. Corregido en D-16. **Lección:** un solo mecanismo para decidir quién manda.
7. **`platform_admin` podía editar `role_permissions`** y concederse `secrets.manage`, y **un usuario suspendido podía reactivarse** editando su propio `status`. Corregido en v2. **Lección:** revisar quién puede editar la propia tabla de permisos y qué columnas puede tocar cada usuario sobre sí mismo.
