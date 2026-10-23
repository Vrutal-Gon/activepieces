# VrutalOS · app del cliente

Front que usa el cliente dentro de su instancia (LAB08 Anexo B). Un despliegue por cliente, cada uno con su Supabase.

| Carpeta | Qué hay |
|---|---|
| `diseno/` | Mockup navegable aprobado de los dos layouts (usuario y admin). Fuente de verdad del diseño. |
| `app/` | React 19 + Vite + TypeScript + Supabase. Mismo stack y tokens de marca que `Panel-Vrutal1st`. |

## Arrancar

```
cd VrutalOS/app
cp .env.example .env.local   # URL, clave pública y nombre de la empresa
npm install
npm run dev
```

Nada de la empresa va en el código: nombre y proyecto Supabase salen de `.env.local`.

## Estado

- **Fase 0 · diseño** — aprobado en principio (layouts usuario y admin).
- **Fase 1 · shell** — hecho: login y recuperación de contraseña, perfil y rol (`profiles`), shell con los dos layouts, rutas de admin protegidas en UX. Todas las pantallas son «próximamente».
- **Fase 2 · pantallas** — en curso, una a una. Hecho: Especialistas (lista y ficha con «Su trabajo»: entregables por pestañas con aprobar/rechazar; necesita `2026-10-06_work_items.sql`), Equipo, Accesos, Integraciones, Consumo y Aprobaciones (todo el SQL necesario está aplicado en Vrutal-labs; ver `db/plantillas/cambios/README.md`). Resto, «próximamente». Equipo incluye «Invitar persona» (necesita la función `team-invite` desplegada). **Tablero** (2026-10-23): el cliente ve en qué se está trabajando, puede pedir una tarea y comentar; lee el espejo de Kaneo (`board_*`, cambio `2026-10-22_tablero_kaneo.sql`, funciones `board-sync`/`board-write`) — pendiente de encender, ver `docs/arquitectura/tablero_kaneo.md`.
- **Pendiente:** 2FA, búsqueda y notificaciones.

## Decisiones en vigor

- **Activar, desactivar y reactivar cuentas**: solo el Admin (sobre otra persona) y Vrutal. Nadie toca su propio estado, ni el Admin. Se aplica en el servidor (`db/plantillas/cambios/2026-10-05_is_active_solo_admin.sql`). **Cada proyecto de cliente nuevo debe recibirlo.**
- **Invitar personas**: lo hace el Admin desde Equipo, con la Edge Function `supabase/functions/team-invite` (comprueba en servidor que quien llama es Admin activo; solo ella usa la clave de servicio). **Solo se invita a correos de los dominios que fija Vrutal** (secret `ALLOWED_EMAIL_DOMAINS`, por instancia; el cliente no puede cambiarlo). Sin lista, no se invita a nadie. Para crear una cuenta con otro dominio, Vrutal lo hace desde su Control Panel. Cada proyecto de cliente necesita: la función desplegada, los secrets `APP_ORIGINS` (orígenes de la app) y `ALLOWED_EMAIL_DOMAINS` (dominios, separados por coma), y `<origen>/bienvenida` en Auth → URL Configuration → Redirect URLs. **Límites conocidos:** el registro público de Auth debe estar desactivado, y un usuario ya dentro podría cambiarse el correo a otro dominio desde Auth (pendiente de cerrar). El rol se fija en `app_metadata` (fuente de verdad) y en `profiles`.
- **Claves de integraciones**: se guardan **cifradas en el Vault del Supabase del cliente** (decisión 2026-10-06, Anexo B abierto → cerrado). La Edge Function `integration-save-key` prueba la clave contra el proveedor y solo entonces la guarda; el Admin ve el estado («Validada · fecha» o el error del proveedor) pero **nunca la clave ni su referencia** (`secret_ref` sin permiso de lectura). No se puede ver ni copiar: solo sobrescribir. Cada alta queda en `audit_log` sin la clave. Sistemas soportados hoy: HubSpot y Anthropic; las conexiones OAuth (Google…) no son una clave pegada y no entran aquí.
- **Aprobaciones: el especialista debe explicarse en claro (contrato pendiente con los flujos).** El `payload` de `approval_requests` es JSON libre y un cliente no debe leer JSON. La pantalla ya lo traduce (etiquetas en español, valores legibles, «Ver datos técnicos» desplegable), pero la solución de fondo es que el bloque de tipo `gate` («Pide permiso») de Activepieces mande el payload ya redactado: `{ "resumen": "frase que explica qué quiere hacer y por qué", "campos": [ { "etiqueta": "Empresa", "valor": "Acme S.L." } ], ...resto técnico }`. La app usa `resumen` y `campos` si vienen y, si no, humaniza el resto. Por definir al construir los flujos: idioma del cliente (hoy español) y «pedir más información» (abrir una conversación con el especialista desde la aprobación, cuando exista Conversaciones).
- **El catálogo de Vrutal no se enseña (decidido 2026-10-06).** Las tareas, sus descripciones y los KPIs del catálogo son propiedad de Vrutal-labs: el cliente no los lee, ni en pantalla ni por API (`catalog_*_ro` sin permiso para `authenticated`; ver `db/plantillas/cambios/README.md`). Un especialista se muestra por **lo que produce**, no por cómo está definido. Consecuencia: «Ver tareas» desaparece, y la autonomía por tarea queda **en espera** (`db/plantillas/cambios/en-espera/`) hasta rediseñarla sobre tareas que ya han producido algo.
- **Trabajo del especialista = entregables (decidido 2026-10-06).** Lo que hoy los flujos escriben en las pestañas de Google Sheets (p. ej. `Keywords`: propuestas con `estado = propuesta`) pasa a tablas de la base del cliente, y la app lo enseña por pestañas dentro de cada especialista; el gestor con acceso a ese especialista aprueba o rechaza las propuestas (por fila o en bloque). Diseño en `diseno/` (pantalla del especialista). Modelo: tablas genéricas `work_collection` (pestañas y columnas, las define Vrutal) y `work_item` (filas), decidido 2026-10-06. **Aprueba quien tenga acceso a ese especialista (pantalla Accesos) y el Admin, aplicado en el servidor.** El bloque «Escribir en la hoja» de los flujos pasa a «Escribir en la tabla» (`work_items_add`); ver `db/plantillas/cambios/README.md`.
- **Soporte (tickets)**: construido (2026-10-08). El dato **no** vive en la base del cliente — un ticket es una conversación con Vrutal sobre el servicio, no un dato de negocio del cliente, así que vive centralizado en Vrutal1st (`db/migrations/023_vrutal_support_tickets.sql`), igual que `deployment.tenant_integration`. `SupportPage.tsx` llama a `support-ticket-send`/`support-ticket-list`, que reenvían a Vrutal1st con el token por instancia (`VRUTAL1ST_PUSH_TOKEN`, el mismo de `022`). Solo lo ve el Admin, igual que antes — ahora lo aplican esas Edge Functions con `is_admin()`, no una política RLS sobre una tabla de esta base (ya no existe aquí ninguna tabla de tickets).
- **Aprobaciones**: se mantiene la política actual. Se revisa cuando haya usuarios que aprueben.
- **Equipo**: el botón Desactivar/Reactivar solo se muestra al Admin y nunca sobre su propia fila. Si una actualización afecta a 0 filas, la pantalla avisa en vez de dar el cambio por hecho (el servidor bloquea en silencio).
- **Especialistas**: `user_specialist_access` filtra en el front, pero el servidor deja leer todos. Es solo UX.
- **Pendiente de decidir (2026-10-06): administradores.** D-05 (`docs/arquitectura/VRUTAL_OS_CONTEXTO_ARQUITECTURA.md`) dice «solo Vrutal crea y cambia admins». Hoy VrutalOS lo permite al Admin del cliente: invitar con rol Administrador (`team-invite`), cambiar el rol desde Equipo y, en el servidor, la política `profiles_update_self_or_admin`. Si se mantiene D-05: invitar solo usuarios, quitar el selector de rol de Equipo y reservar el cambio de rol a Vrutal con un trigger (requiere que el Control Panel pueda hacerlo). Se deja como está hasta decidir.
- **Pendiente (Vrutal1st):** la pestaña Usuarios, «Admin cliente» y «Usuarios activos» de la ficha de cliente están pendientes: faltan la Edge Function `client-users` y el permiso que entrega la conexión del cliente (mismo camino que `sync-catalog`).
- Resto de decisiones de acceso y cambios de BBDD: `db/plantillas/cambios/README.md`.
