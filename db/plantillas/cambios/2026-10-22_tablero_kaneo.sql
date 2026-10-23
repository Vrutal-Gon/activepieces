-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · TABLERO (espejo de Kaneo)
--
-- QUÉ RESUELVE. Hoy el cliente ve RESULTADOS: entregables (`work_item`) y decisiones pendientes
-- (`approval_requests`). Lo que NO puede ver es en qué se está trabajando: eso vive en la cabeza
-- del equipo de Vrutal y en `run_log`, que es solo de Admin. Falta el apartado intermedio: un
-- tablero con las tareas, su columna y su conversación.
--
-- DE DÓNDE SALE. El equipo de Vrutal gestiona ese trabajo en **Kaneo** (MIT, una instancia por
-- cliente en su propio Docker, perfil «tareas» de `infra/instance/docker-compose.yml`). Kaneo es
-- herramienta de Vrutal: el cliente NUNCA entra en su interfaz, igual que con Postiz. Lo que ve
-- es este espejo, pintado por VrutalOS con el diseño de Vrutal.
--
-- POR QUÉ UN ESPEJO Y NO UNA CONSULTA EN VIVO. El navegador habla solo con su Supabase, con RLS.
-- Si la pantalla preguntara a Kaneo en cada carga, cada carga dependería de que Kaneo esté arriba
-- y habría que llevar una clave por el camino. La Edge Function `board-sync` (cron, cada 5 min)
-- copia; la pantalla lee su propia base. Es la misma forma que el sync de catálogo (D-06).
--
-- QUIÉN ESCRIBE. El equipo de Vrutal, en Kaneo. Y el cliente, desde VrutalOS: crear una tarjeta
-- y comentar, por la Edge Function `board-write`, que escribe en Kaneo y refleja esa fila al
-- momento (no se espera al cron). **Mover una tarjeta de columna no es del cliente**: el estado
-- del trabajo lo fija Vrutal. Por eso `authenticated` NO tiene insert/update/delete aquí —
-- mismo criterio que `decide_approval` y `work_items_add`.
--
-- LA ETIQUETA `interno` ES EL FRENO. Kaneo contiene también trabajo interno de Vrutal. Lo que se
-- refleja son solo los proyectos dados de alta en `board_project` y, dentro de ellos, las
-- tarjetas que NO llevan la etiqueta `interno`. El filtro lo aplica `board-sync`; si la etiqueta
-- aparece después, borra la fila del espejo.
--
-- LOS IDENTIFICADORES SON `text`, NO `uuid`: Kaneo genera ids de texto (`text("id")` en su
-- esquema, comprobado en el código de la versión 2.46.2). Usar uuid aquí rompería el upsert.
--
-- NO HAY CLAVE FORÁNEA de `board_card.status` a `board_column`: Kaneo admite «estados virtuales»
-- (su respuesta de tablero devuelve `plannedTasks` con un status que no es ninguna columna), y una
-- FK haría fallar el sync justo cuando el tablero cambia. La pantalla agrupa por `status` y pinta
-- al final lo que no reconoce.
--
-- CONTRATO CON LAS EDGE FUNCTIONS:
--   board-sync   (gate X-Sync-Token, service_role) → upsert de las cuatro tablas, por proyecto.
--   board-write  (sesión del cliente)              → comprueba `board_authorize(<especialista>)`,
--                                                    escribe en Kaneo y refleja la fila.
--
-- Ningún DROP: el permiso automático de la base los bloquea. Solo `create table if not exists`,
-- políticas condicionales y `create or replace function`.
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. Los proyectos de Kaneo que este cliente puede ver, y de qué especialista son.
--    Un proyecto que no esté aquí NO EXISTE para el cliente, aunque Kaneo lo tenga.
--    El alta la hace Vrutal (service_role) al contratar un especialista.
create table if not exists public.board_project (
  id            text primary key,                 -- el id de Kaneo, tal cual
  specialist_id uuid not null references public.specialists(id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 200),
  -- Prefijo del identificador corto que ve la gente: <slug>-<number>, p. ej. MKT-12.
  slug          text not null check (length(btrim(slug)) between 1 and 40),
  position      int  not null default 0,
  synced_at     timestamptz not null default now()
);

create index if not exists board_project_specialist_idx
  on public.board_project (specialist_id, position);

-- 2. Las columnas del tablero. Las define Kaneo, no VrutalOS: aquí solo se copian.
--    La clave es (proyecto, slug) porque el `status` de una tarjeta es ese slug.
create table if not exists public.board_column (
  project_id text not null references public.board_project(id) on delete cascade,
  slug       text not null,
  name       text not null check (length(btrim(name)) between 1 and 120),
  position   int  not null default 0,
  -- Columna de cierre en Kaneo: lo que cae ahí está terminado.
  is_final   boolean not null default false,
  synced_at  timestamptz not null default now(),
  primary key (project_id, slug)
);

create index if not exists board_column_orden_idx
  on public.board_column (project_id, position);

-- 3. La tarjeta. `specialist_id` va desnormalizado a propósito: así la política de seguridad no
--    tiene que hacer join con `board_project` en cada fila.
create table if not exists public.board_card (
  id               text primary key,              -- el id de Kaneo
  project_id       text not null references public.board_project(id) on delete cascade,
  specialist_id    uuid not null references public.specialists(id) on delete cascade,
  number           int,                           -- se muestra como <slug del proyecto>-<number>
  title            text not null check (length(btrim(title)) between 1 and 300),
  -- Kaneo admite descripciones muy largas y las omite de la respuesta del tablero cuando pasan de
  -- 64 kB. El espejo guarda lo que quepa en 20 000 caracteres; `board-sync` recorta.
  description      text check (description is null or length(description) <= 20000),
  status           text not null,                 -- slug de la columna, o un estado virtual
  priority         text check (priority is null or priority in
                     ('no-priority', 'low', 'medium', 'high', 'urgent')),
  -- Un NOMBRE, nunca un correo: el cliente no recibe el directorio del equipo de Vrutal.
  assignee_name    text check (assignee_name is null or length(assignee_name) <= 120),
  labels           text[] not null default '{}',
  start_date       date,
  due_date         date,
  position         int,
  -- Quién la creó: el equipo de Vrutal en Kaneo, o el propio cliente desde VrutalOS.
  origin           text not null default 'vrutal' check (origin in ('vrutal', 'cliente')),
  created_by       uuid references public.profiles(id),
  kaneo_created_at timestamptz,
  synced_at        timestamptz not null default now()
);

-- Lo que lee la pantalla: un especialista, por columna y por orden dentro de ella.
create index if not exists board_card_tablero_idx
  on public.board_card (specialist_id, status, position);
create index if not exists board_card_project_idx
  on public.board_card (project_id);

-- 4. La conversación de una tarjeta.
create table if not exists public.board_comment (
  id                text primary key,             -- el id de Kaneo
  card_id           text not null references public.board_card(id) on delete cascade,
  specialist_id     uuid not null references public.specialists(id) on delete cascade,
  author_name       text not null check (length(btrim(author_name)) between 1 and 120),
  -- Si lo escribió alguien del cliente desde VrutalOS, aquí queda quién.
  author_profile_id uuid references public.profiles(id),
  body              text not null check (length(body) between 1 and 10000),
  kaneo_created_at  timestamptz,
  synced_at         timestamptz not null default now()
);

create index if not exists board_comment_card_idx
  on public.board_comment (card_id, kaneo_created_at);

-- 5. Seguridad por fila. Ve el tablero de un especialista quien tiene acceso a ese especialista
--    (y el Admin), igual que los entregables: `can_access_specialist` existe desde el cambio
--    2026-10-06_work_items. `active_only` es obligatoria en cada tabla nueva (regla 5 del README).
alter table public.board_project enable row level security;
alter table public.board_column  enable row level security;
alter table public.board_card    enable row level security;
alter table public.board_comment enable row level security;

do $$
declare t text;
begin
  -- Las tres que llevan `specialist_id` comprueban directamente.
  foreach t in array array['board_project', 'board_card', 'board_comment'] loop
    if not exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = t and policyname = t || '_select') then
      execute format('create policy %I on public.%I for select to authenticated using (public.can_access_specialist(specialist_id))',
                     t || '_select', t);
    end if;
  end loop;

  -- `board_column` no tiene especialista: cuelga de su proyecto.
  if not exists (select 1 from pg_policies
                  where schemaname = 'public' and tablename = 'board_column' and policyname = 'board_column_select') then
    create policy board_column_select on public.board_column for select to authenticated
      using (exists (select 1 from public.board_project p
                      where p.id = board_column.project_id
                        and public.can_access_specialist(p.specialist_id)));
  end if;

  foreach t in array array['board_project', 'board_column', 'board_card', 'board_comment'] loop
    if not exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = t and policyname = 'active_only') then
      execute format('create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active_user())', t);
    end if;
  end loop;
end $$;

-- 6. Permisos de tabla. Sin GRANT la política ni se evalúa; y una tabla nueva nace con
--    TRUNCATE/REFERENCES/TRIGGER/MAINTAIN regalados a anon y authenticated: se retiran.
--    SOLO SELECT para `authenticated`: el cliente escribe por `board-write`, nunca directo.
revoke all on public.board_project from anon, authenticated;
revoke all on public.board_column  from anon, authenticated;
revoke all on public.board_card    from anon, authenticated;
revoke all on public.board_comment from anon, authenticated;

grant select on public.board_project to authenticated;
grant select on public.board_column  to authenticated;
grant select on public.board_card    to authenticated;
grant select on public.board_comment to authenticated;

grant all on public.board_project to service_role;
grant all on public.board_column  to service_role;
grant all on public.board_card    to service_role;
grant all on public.board_comment to service_role;

-- 7. El criterio de acceso, para que `board-write` no lo reimplemente.
--    `security invoker`: se evalúa con la sesión de quien llama, que es justo lo que se comprueba.
create or replace function public.board_authorize(p_specialist uuid)
returns boolean
language sql stable security invoker set search_path = public, pg_temp as $f$
  select public.can_access_specialist(p_specialist)
$f$;

revoke all on function public.board_authorize(uuid) from public, anon;
grant execute on function public.board_authorize(uuid) to authenticated, service_role;

-- 8. El cron del espejo. Replica la receta de D-06/D-19: el token se lee del Vault EN CADA
--    EJECUCIÓN (nunca la anon key, que es pública). No se aplica a ciegas: si falta pg_cron,
--    pg_net o uno de los dos secretos, avisa y no programa nada — se repite este bloque cuando
--    estén. Idempotente: desprograma antes de volver a programar.
do $$
declare
  v_url text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'TABLERO: falta la extension pg_cron (se activa en el dashboard del proyecto). El espejo no queda programado.';
    return;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise notice 'TABLERO: falta la extension pg_net. El espejo no queda programado.';
    return;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'board_sync_token') then
    raise notice 'TABLERO: falta el secreto board_sync_token en el Vault. El espejo no queda programado.';
    return;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'board_sync_url') then
    raise notice 'TABLERO: falta el secreto board_sync_url en el Vault (la URL de board-sync). El espejo no queda programado.';
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'board_sync_url';

  if exists (select 1 from cron.job where jobname = 'board-sync') then
    perform cron.unschedule('board-sync');
  end if;

  perform cron.schedule('board-sync', '*/5 * * * *', format($cmd$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Sync-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'board_sync_token')),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000);
  $cmd$, v_url));

  raise notice 'TABLERO: espejo programado cada 5 minutos contra %', v_url;
end $$;

-- ---------------------------------------------------------------------
-- Para revertir (en orden inverso):
--   select cron.unschedule('board-sync');
--   drop function public.board_authorize(uuid);
--   drop table public.board_comment;   -- se lleva sus indices y politicas
--   drop table public.board_card;
--   drop table public.board_column;
--   drop table public.board_project;
-- ---------------------------------------------------------------------
