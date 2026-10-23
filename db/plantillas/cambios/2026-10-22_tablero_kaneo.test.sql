-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-22_tablero_kaneo.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Incluye la migración tal cual, la prueba, y TERMINA CON UN ERROR A PROPÓSITO:
-- Postgres revierte todo (tablas, políticas, permisos y filas de prueba). No queda nada.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- No hay que sustituir nada: la prueba busca ella misma un especialista de esta base.
-- (El bloque `do $$` de la migración se escribe aquí como `if` de plpgsql, porque un DO no
--  puede anidarse dentro de otro. El bloque 8, el cron, se deja fuera: depende de dos secretos
--  del Vault y de pg_cron, y lo único que haría en seco es avisar y salir.)
--
-- QUÉ COMPRUEBA, que es el riesgo real de este cambio:
--   · Que el espejo NO quede abierto: `authenticated` solo con SELECT, `anon` sin nada, y
--     sin TRUNCATE (un truncate de `board_card` se llevaría por delante el tablero del cliente).
--   · Que la cascada funcione: retirar un proyecto se lleva sus columnas, tarjetas y comentarios,
--     sin dejar filas huérfanas que la pantalla seguiría pintando.
--   · Que los `check` muerdan: una prioridad inventada o un `origin` fuera de la lista no entran.
-- =====================================================================
do $do$
declare
  r text := '';
  v_c bigint;
  spec uuid;
  t text;
begin
  -- ===== migración (equivalente literal de 2026-10-22_tablero_kaneo.sql, pasos 1-7) =====
  create table if not exists public.board_project (
    id            text primary key,
    specialist_id uuid not null references public.specialists(id) on delete cascade,
    name          text not null check (length(btrim(name)) between 1 and 200),
    slug          text not null check (length(btrim(slug)) between 1 and 40),
    position      int  not null default 0,
    synced_at     timestamptz not null default now()
  );
  create index if not exists board_project_specialist_idx
    on public.board_project (specialist_id, position);

  create table if not exists public.board_column (
    project_id text not null references public.board_project(id) on delete cascade,
    slug       text not null,
    name       text not null check (length(btrim(name)) between 1 and 120),
    position   int  not null default 0,
    is_final   boolean not null default false,
    synced_at  timestamptz not null default now(),
    primary key (project_id, slug)
  );
  create index if not exists board_column_orden_idx
    on public.board_column (project_id, position);

  create table if not exists public.board_card (
    id               text primary key,
    project_id       text not null references public.board_project(id) on delete cascade,
    specialist_id    uuid not null references public.specialists(id) on delete cascade,
    number           int,
    title            text not null check (length(btrim(title)) between 1 and 300),
    description      text check (description is null or length(description) <= 20000),
    status           text not null,
    priority         text check (priority is null or priority in
                       ('no-priority', 'low', 'medium', 'high', 'urgent')),
    assignee_name    text check (assignee_name is null or length(assignee_name) <= 120),
    labels           text[] not null default '{}',
    start_date       date,
    due_date         date,
    position         int,
    origin           text not null default 'vrutal' check (origin in ('vrutal', 'cliente')),
    created_by       uuid references public.profiles(id),
    kaneo_created_at timestamptz,
    synced_at        timestamptz not null default now()
  );
  create index if not exists board_card_tablero_idx
    on public.board_card (specialist_id, status, position);
  create index if not exists board_card_project_idx
    on public.board_card (project_id);

  create table if not exists public.board_comment (
    id                text primary key,
    card_id           text not null references public.board_card(id) on delete cascade,
    specialist_id     uuid not null references public.specialists(id) on delete cascade,
    author_name       text not null check (length(btrim(author_name)) between 1 and 120),
    author_profile_id uuid references public.profiles(id),
    body              text not null check (length(body) between 1 and 10000),
    kaneo_created_at  timestamptz,
    synced_at         timestamptz not null default now()
  );
  create index if not exists board_comment_card_idx
    on public.board_comment (card_id, kaneo_created_at);

  alter table public.board_project enable row level security;
  alter table public.board_column  enable row level security;
  alter table public.board_card    enable row level security;
  alter table public.board_comment enable row level security;

  foreach t in array array['board_project', 'board_card', 'board_comment'] loop
    if not exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = t and policyname = t || '_select') then
      execute format('create policy %I on public.%I for select to authenticated using (public.can_access_specialist(specialist_id))',
                     t || '_select', t);
    end if;
  end loop;

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

  create or replace function public.board_authorize(p_specialist uuid)
  returns boolean
  language sql stable security invoker set search_path = public, pg_temp as $f$
    select public.can_access_specialist(p_specialist)
  $f$;

  revoke all on function public.board_authorize(uuid) from public, anon;
  grant execute on function public.board_authorize(uuid) to authenticated, service_role;
  -- ===== fin de la migración · empieza la prueba =====

  -- 0. Un especialista de verdad de esta base (las FK lo exigen)
  select id into spec from public.specialists where status = 'active' order by job_role_key limit 1;
  if spec is null then
    raise exception 'DRY-RUN no ejecutado: esta base no tiene ningun especialista activo';
  end if;
  r := r || format('0) especialista de prueba: %s | ', spec);

  -- 1. Las cuatro tablas existen (tabla, no vista: buscarlas en pg_proc da falsos positivos)
  select count(*) into v_c from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and c.relname in ('board_project', 'board_column', 'board_card', 'board_comment');
  r := r || format('1) tablas: %s (esperado 4) | ', v_c);

  -- 2. RLS activo en las cuatro
  select count(*) into v_c from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relrowsecurity
     and c.relname in ('board_project', 'board_column', 'board_card', 'board_comment');
  r := r || format('2) con RLS: %s (esperado 4) | ', v_c);

  -- 3. Ocho politicas: cuatro de lectura y cuatro `active_only`
  select count(*) into v_c from pg_policies
   where schemaname = 'public'
     and tablename in ('board_project', 'board_column', 'board_card', 'board_comment');
  r := r || format('3) politicas: %s (esperado 8) | ', v_c);

  -- 4. EL RIESGO: que el espejo quede abierto.
  select count(*) into v_c from (values
      ('board_project'), ('board_column'), ('board_card'), ('board_comment')) v(t)
   where has_table_privilege('authenticated', 'public.' || v.t, 'select');
  r := r || format('4a) authenticated SELECT: %s (esperado 4) | ', v_c);

  select count(*) into v_c from (values
      ('board_project'), ('board_column'), ('board_card'), ('board_comment')) v(t)
   where has_table_privilege('authenticated', 'public.' || v.t, 'insert')
      or has_table_privilege('authenticated', 'public.' || v.t, 'update')
      or has_table_privilege('authenticated', 'public.' || v.t, 'delete')
      or has_table_privilege('authenticated', 'public.' || v.t, 'truncate');
  r := r || format('4b) authenticated escribe o trunca: %s (esperado 0) | ', v_c);

  select count(*) into v_c from (values
      ('board_project'), ('board_column'), ('board_card'), ('board_comment')) v(t)
   where has_table_privilege('anon', 'public.' || v.t, 'select')
      or has_table_privilege('anon', 'public.' || v.t, 'insert')
      or has_table_privilege('anon', 'public.' || v.t, 'truncate');
  r := r || format('4c) anon con algo: %s (esperado 0) | ', v_c);

  -- 5. Un tablero de verdad entra
  insert into public.board_project (id, specialist_id, name, slug, position)
    values ('prj-dry-run', spec, 'Marketing (prueba)', 'MKT', 0);
  insert into public.board_column (project_id, slug, name, position, is_final) values
    ('prj-dry-run', 'por-hacer', 'Por hacer', 0, false),
    ('prj-dry-run', 'en-curso',  'En curso',  1, false),
    ('prj-dry-run', 'hecho',     'Hecho',     2, true);
  insert into public.board_card (id, project_id, specialist_id, number, title, status, priority,
                                 assignee_name, labels, origin, kaneo_created_at)
    values ('tsk-dry-run', 'prj-dry-run', spec, 12, 'Revisar el brief de la pieza', 'en-curso',
            'high', 'Equipo Vrutal', array['contenido'], 'vrutal', now());
  insert into public.board_comment (id, card_id, specialist_id, author_name, body, kaneo_created_at)
    values ('cmt-dry-run', 'tsk-dry-run', spec, 'Equipo Vrutal', 'Primera version lista', now());
  r := r || '5) tablero de prueba insertado (1 proyecto, 3 columnas, 1 tarjeta, 1 comentario) | ';

  -- 6. Los `check` muerden
  begin
    insert into public.board_card (id, project_id, specialist_id, title, status, priority)
      values ('tsk-mala', 'prj-dry-run', spec, 'Prioridad inventada', 'en-curso', 'urgentisima');
    r := r || '6a) FALLO: una prioridad inventada ha entrado | ';
  exception when check_violation then
    r := r || '6a) prioridad fuera de la lista rechazada | ';
  end;

  begin
    insert into public.board_card (id, project_id, specialist_id, title, status, origin)
      values ('tsk-mala2', 'prj-dry-run', spec, 'Origen inventado', 'en-curso', 'staff');
    r := r || '6b) FALLO: un origin fuera de la lista ha entrado | ';
  exception when check_violation then
    r := r || '6b) origin fuera de la lista rechazado | ';
  end;

  begin
    insert into public.board_card (id, project_id, specialist_id, title, status)
      values ('tsk-mala3', 'prj-dry-run', spec, '   ', 'en-curso');
    r := r || '6c) FALLO: un titulo en blanco ha entrado | ';
  exception when check_violation then
    r := r || '6c) titulo en blanco rechazado | ';
  end;

  -- 7. La cascada: retirar el proyecto no deja nada huerfano
  delete from public.board_project where id = 'prj-dry-run';
  select (select count(*) from public.board_column  where project_id = 'prj-dry-run')
       + (select count(*) from public.board_card    where project_id = 'prj-dry-run')
       + (select count(*) from public.board_comment where card_id = 'tsk-dry-run')
    into v_c;
  r := r || format('7) filas huerfanas tras retirar el proyecto: %s (esperado 0) | ', v_c);

  -- 8. `board_authorize` existe, es invoker y la puede llamar `authenticated`
  select count(*) into v_c from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'board_authorize' and p.prosecdef = false;
  r := r || format('8a) board_authorize invoker: %s (esperado 1) | ', v_c);
  r := r || format('8b) la puede llamar authenticated: %s (esperado true) | ',
                   has_function_privilege('authenticated', 'public.board_authorize(uuid)', 'execute'));
  r := r || format('8c) la puede llamar anon: %s (esperado false)',
                   has_function_privilege('anon', 'public.board_authorize(uuid)', 'execute'));

  raise exception 'RESULTADO DRY-RUN -> %', r;
end $do$;
