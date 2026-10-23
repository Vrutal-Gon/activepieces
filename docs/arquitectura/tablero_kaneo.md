# Tablero del cliente (Kaneo) · cómo se enciende y en qué se apoya

Qué resuelve, las decisiones y las trampas están en `docs/BITACORA.md` §9 bis. Esto es lo
operativo: **qué API de Kaneo se usa** y **los pasos exactos para encenderlo en un cliente**.

Diagrama: `tablero_kaneo.drawio` (en esta misma carpeta).

## Estado en Vrutal-labs (cliente 0), al 2026-10-23

| Hecho | Pendiente |
|---|---|
| Perfil `tareas` levantado; Kaneo sano en `127.0.0.1:18004` | **Poner `KANEO_API_URL` de verdad**: hoy tiene la plantilla literal `https://<slug>-tareas.<dominio>`, así que el sync falla con «Invalid URL». El valor definitivo (`https://lab-tareas.vrutal-labs.com`) solo será alcanzable en el VPS |
| Cuenta `tablero@vrutal-labs.com` («Equipo Vrutal»), workspace `Vrutal-labs` (`otRWEq3J01ezbC9I9tKVeVDkhB9uVJZK`) | Programar el cron, cuando Kaneo sea alcanzable (ver el aviso) |
| Tres proyectos: **MKT** `ar4epdaixuj2dau26pw8vf4m`, **SEO** `e0jkvv79temt046n3jpg71cu`, **ANL** `uvlxdpthn1u9cfi8r4b8p1j0`, con las columnas renombradas al español | |
| API key `VrutalOS` creada y probada: lectura y escritura, 200 en los cinco endpoints | |
| Migración aplicada y **verificada objeto por objeto**; `pg_cron` y `pg_net` instaladas | |
| Los tres proyectos y sus 12 columnas, sembrados en el espejo | |
| `board-sync` (v4, `verify_jwt` false) y `board-write` (v3, `verify_jwt` true) desplegadas y probadas: gate correcto con el token del Vault, 401 sin él, 405 en GET, 401 sin sesión | |
| Registro cerrado otra vez (`sign-up` responde 403 `REGISTRATION_NOT_ALLOWED`) | |

> **Las Edge Functions no alcanzan un Kaneo de `localhost`.** Corren en la nube de Supabase, así
> que contra la máquina de desarrollo `board-sync` fallará por red — el mismo caso ya conocido de
> `integration-social-connect` con el Postiz local. Se valida al pasar al VPS, y **hasta entonces
> no se programa el cron**: solo llenaría `cron.job_run_details` de fallos.

> **Acentos desde Git Bash.** `curl -d {name:Promoción}` corrompe los caracteres (llegan
> como `U+FFFD`) y así nacieron los nombres de los tres proyectos, que hubo que rehacer. Para
> cualquier alta por API desde esta máquina, **el cuerpo va en un fichero UTF-8**:
> `curl --data-binary @cuerpo.json`, o directamente `fetch` desde node.

## La herramienta

| | |
|---|---|
| Proyecto | [usekaneo/kaneo](https://github.com/usekaneo/kaneo), licencia **MIT** |
| Versión fijada | `ghcr.io/usekaneo/kaneo:2.46.2@sha256:f44be9aa22546f95c59076bee86678bffcaf5e5d4b960c58a107ad1a05cd1f90` (digest resuelto contra ghcr.io el 2026-10-22) |
| Qué es por dentro | TypeScript: React + Hono + Postgres (Drizzle), autenticación con Better Auth |
| Puerto interno | `5173`, que sirve **la interfaz y la API**. La API cuelga de `/api`; salud en `/api/health` |
| Autenticación de la API | Cabecera **`x-api-key`** (también admite `Authorization: Bearer <key>`). La clave va atada a un usuario y a sus permisos de workspace |

## Los endpoints que se usan (y solo esos)

Comprobados leyendo su código en la versión 2.46.2, no la documentación.

| Quién | Método y ruta | Qué devuelve / espera |
|---|---|---|
| `board-sync` | `GET /api/column/{projectId}` | `[{ id, projectId, name, slug, position, icon, color, isFinal }]`. El **`slug`** es lo que las tarjetas guardan como `status` |
| `board-sync` | `GET /api/task/tasks/{projectId}?page=&limit=100&relatedPage=` | `{ data: { columns: [{ slug, name, tasks: [...] }], plannedTasks, archivedTasks }, pagination }`. Tarea: `id, number, title, description, status, priority, assigneeName, startDate, dueDate, position, createdAt, labels[{name}]` |
| `board-sync` | `GET /api/comment/{taskId}` | `[{ id, taskId, content, createdAt, user: { name, image } }]` |
| `board-write` | `POST /api/task/{projectId}` | Cuerpo: `{ title, description, status, priority }` — `status` es el **slug de la columna**. Devuelve la tarea creada |
| `board-write` | `POST /api/comment/{taskId}` | Cuerpo: `{ content, externalUserName, externalSource }` — `externalSource` es una lista cerrada (`planka, trello, jira, plane, linear, kaneo`). Devuelve la actividad creada |

Tres cosas que condicionan el diseño del espejo:

1. **Los ids son `text`**, no `uuid` (`text("id")` en su esquema). El espejo usa `text`.
2. **No hay `updated_since`**: la respuesta de tablero no trae `updatedAt`, así que cada pasada
   es una foto completa por proyecto. Paginación: 50 por defecto, **100 como máximo**, y las
   etiquetas paginan aparte (`relatedPage` / `relatedTotalPages`), por eso el sync recorre las
   dos paginaciones.
3. **La lectura de comentarios ignora `externalUserName`** y devuelve el nombre del usuario de
   la API key. Por eso el espejo guarda los comentarios con `ignoreDuplicates`: el primero que
   escribe gana, y un comentario del cliente conserva su nombre.

## Encenderlo en un cliente, en orden

Los pasos 1 y 2 son del Supabase del cliente; el 3 y el 4, de su instancia Docker; el 5 cierra.

### 1. Extensiones y migración

1. En el dashboard del proyecto del cliente → **Database → Extensions**, activar **`pg_cron`** y
   **`pg_net`**. (Comprobado en Vrutal-labs el 2026-10-22: **no estaban**.)
2. Aplicar el cambio, no por SQL Editor:

   ```bash
   scripts/aplicar-cambios-cliente.sh --apply
   ```

   Antes, si se quiere la red de seguridad, pegar entero
   `db/plantillas/cambios/2026-10-22_tablero_kaneo.test.sql` en el SQL Editor: acaba en un error
   a propósito y no deja nada aplicado.

### 2. Secretos

En el Vault del proyecto del cliente (SQL Editor), para el cron:

```sql
select vault.create_secret('<token largo y aleatorio>', 'board_sync_token');
select vault.create_secret('https://<ref>.supabase.co/functions/v1/board-sync', 'board_sync_url');
```

Y como secretos de las Edge Functions (`Project Settings → Edge Functions → Secrets`):

| Secreto | Valor |
|---|---|
| `BOARD_SYNC_TOKEN` | **el mismo** valor que `board_sync_token` del Vault. Las funciones le hacen `trim()`, porque pegarlo en el panel se lleva saltos y espacios con una facilidad asombrosa: el 2026-10-23 costó una tarde de 401 con el token correcto |
| `KANEO_API_URL` | El origen de ESTA instancia, **sin** `/api` ni barra final: `https://lab-tareas.vrutal-labs.com`, no la plantilla con `<slug>` — eso también pasó |
| `KANEO_API_KEY` | la API key del usuario de servicio de Kaneo (paso 4) |

`APP_ORIGINS` ya existe para las demás funciones; `board-write` usa el mismo.

### 3. La instancia

En `infra/instance/clients/<slug>.env`:

```
KANEO_ADMIN_PORT=18004
KANEO_AUTH_SECRET=<openssl rand -hex 32>
KANEO_POSTGRES_PASSWORD=<openssl rand -hex 24>
KANEO_DISABLE_REGISTRATION=true
KANEO_DISABLE_WORKSPACE_CREATION=true
```

Para el alta, **y solo para ella**, poner las dos últimas a `false`, levantar, dar de alta, y
volver a ponerlas a `true` reiniciando el contenedor:

```bash
docker compose -p <slug> --env-file clients/<slug>.env --profile tareas up -d
```

### 4. Alta manual en Kaneo (una vez por cliente)

Por túnel SSH a `127.0.0.1:18004` — la interfaz de Kaneo **no sale a internet**:

1. Crear la cuenta del staff (la primera cuenta completa la instalación).
2. Crear el workspace del cliente.
3. Crear **un proyecto por especialista contratado**. El `slug` del proyecto es el prefijo que
   verá el cliente en cada tarjeta (`MKT-12`): ponerlo corto y reconocible.
4. Crear una API key de un usuario de servicio llamado `VrutalOS`, con permiso de lectura y de
   `task:create` / `task:update` en ese workspace. Ese valor es `KANEO_API_KEY`.
5. Volver a poner `KANEO_DISABLE_REGISTRATION=true` y `KANEO_DISABLE_WORKSPACE_CREATION=true`.

Y dar de alta cada proyecto en el espejo, que es lo que lo hace visible para el cliente:

```sql
insert into public.board_project (id, specialist_id, name, slug, position)
values ('<id del proyecto en Kaneo>',
        (select id from public.specialists where job_role_key = 'content_promotion'),
        'Contenido y Promoción', 'MKT', 0);
```

Un proyecto de Kaneo **sin fila aquí no existe para el cliente**. Y dentro de los que sí están,
una tarjeta con la etiqueta **`interno`** no llega al espejo.

### 5. Las funciones

```bash
supabase functions deploy board-sync  --project-ref <ref> --no-verify-jwt
supabase functions deploy board-write --project-ref <ref>
```

`board-sync` va **sin** verificación de JWT a propósito (su gate es `X-Sync-Token`). Al
desplegarla por MCP hay que pasar `verify_jwt: false` explícitamente, o la herramienta manda
`true` por defecto y la función deja de responder — pasó con `flow-input-read` v3.

## Comprobar que funciona

```bash
# 1. La API responde y la interfaz NO sale a internet
curl -s -H "x-api-key: $KANEO_API_KEY" "https://<slug>-tareas.<dominio>/api/project?workspaceId=<id>" | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" "https://<slug>-tareas.<dominio>/"      # esperado: 404

# 2. El gate del sync
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://<ref>.supabase.co/functions/v1/board-sync"   # 401
curl -s -X POST -H "X-Sync-Token: $BOARD_SYNC_TOKEN" "https://<ref>.supabase.co/functions/v1/board-sync"
```

En SQL, después de la primera pasada:

```sql
select count(*) from public.board_card;
select jobname, schedule from cron.job where jobname = 'board-sync';
select status, start_time from cron.job_run_details order by start_time desc limit 3;
-- el espejo no puede quedar abierto:
select has_table_privilege('authenticated','public.board_card','select')   as lee,     -- true
       has_table_privilege('authenticated','public.board_card','insert')   as escribe, -- false
       has_table_privilege('authenticated','public.board_card','truncate') as trunca;  -- false
```

Y la prueba que de verdad importa: **etiquetar una tarjeta como `interno` en Kaneo, sincronizar,
y comprobar que desaparece del espejo**; quitarle la etiqueta, sincronizar, y que vuelva.
