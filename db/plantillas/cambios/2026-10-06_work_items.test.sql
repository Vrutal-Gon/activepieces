-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-06_work_items.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Incluye la migración tal cual, la prueba, y TERMINA CON UN ERROR A PROPÓSITO:
-- Postgres revierte todo (tablas, filas de prueba y los dos usuarios de prueba). No queda nada.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Antes de ejecutar: sustituir admin_id por el id del admin del proyecto
--   select id, role, is_active from public.profiles;
-- (Este archivo se generó pegando la migración dentro del bloque de prueba.)
-- =====================================================================
do $do$
declare
  r text := '';
  n int;
  v_c bigint;
  spec uuid;
  col_k uuid;
  col_b uuid;
  ids uuid[];
  ids_b uuid[];
  st text;
  u1 uuid := gen_random_uuid();   -- usuario CON acceso al especialista
  u2 uuid := gen_random_uuid();   -- usuario SIN acceso
  admin_id constant text := 'ff4b1313-e086-4815-b03c-2d9b3a0f6752';
begin
  -- ===== migración (copia literal de 2026-10-06_work_items.sql) =====
-- =====================================================================
-- VRUTAL OS · Plano de datos del CLIENTE · Trabajo del especialista (entregables)
--
-- Lo que los flujos escribían en las pestañas de Google Sheets (p. ej. «Keywords») pasa a tablas de esta base,
-- y la app lo enseña por pestañas dentro de cada especialista. El gestor con acceso a ese especialista aprueba
-- o rechaza las propuestas, por fila o en bloque.
--
-- Modelo (decidido 2026-10-06): tablas genéricas con columnas descritas.
--   work_collection  Qué pestañas tiene un especialista y cómo se dibujan (columnas). Las define Vrutal.
--   work_item        Cada fila. Estado: proposed -> approved | rejected   (pestañas aprobables)
--                                        delivered                        (pestañas solo informativas)
--
-- Quién ve y quién decide (lo aplica el SERVIDOR, no la pantalla):
--   · Un Admin activo ve y decide todo.
--   · Cualquier otra persona activa, solo lo de los especialistas a los que el Admin le dio acceso
--     (user_specialist_access). Sin acceso, ni lee ni decide.
--   · Una cuenta desactivada no ve nada.
--   · Nadie del cliente escribe filas ni columnas: las escriben los flujos con service_role, por work_items_add().
--
-- NO se lee nunca el catálogo de Vrutal (catalog_*_ro): una colección describe lo que el especialista ENTREGA,
-- no cómo está definido su trabajo.
--
-- CONTRATO CON LOS FLUJOS (bloque «Escribir en la tabla», sustituye a «Escribir en la hoja»):
--   select public.work_items_add(<specialist_id>, '<collection_key>', '[{...fila...}, ...]'::jsonb, '<run_ref>');
--   Cada fila es un objeto JSON cuyas claves son las `key` de las columnas de la colección. Máx. 500 filas por
--   llamada y 20 kB por fila. En colecciones aprobables las filas nacen «proposed»; en las demás, «delivered».
--   Los flujos siguientes deben leer solo las filas con status = 'approved'.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. ¿Puede esta persona ver y decidir lo de este especialista?
create or replace function public.can_access_specialist(p_specialist uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select public.is_active_user() and (
    public.is_admin()
    or exists (
      select 1 from public.user_specialist_access a
       where a.profile_id = auth.uid() and a.specialist_id = p_specialist
    )
  )
$f$;

revoke all on function public.can_access_specialist(uuid) from public, anon;
grant execute on function public.can_access_specialist(uuid) to authenticated, service_role;

-- 2. Pestañas de un especialista y cómo se dibujan.
--    columns: [{ "key": "keyword", "label": "Keyword", "type": "text|number|date|badge|url" }, ...]
create table if not exists public.work_collection (
  id             uuid primary key default gen_random_uuid(),
  specialist_id  uuid not null references public.specialists(id) on delete cascade,
  collection_key text not null,
  label          text not null,
  position       int  not null default 0,
  approvable     boolean not null default false,
  columns        jsonb not null default '[]'::jsonb check (jsonb_typeof(columns) = 'array'),
  created_at     timestamptz not null default now(),
  unique (specialist_id, collection_key),
  unique (id, specialist_id)
);

-- 3. Cada fila entregada.
create table if not exists public.work_item (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null,
  specialist_id uuid not null,
  data          jsonb not null,
  status        text not null check (status in ('proposed', 'approved', 'rejected', 'delivered')),
  run_ref       text,
  created_at    timestamptz not null default now(),
  decided_by    uuid references public.profiles(id),
  decided_at    timestamptz,
  foreign key (collection_id, specialist_id) references public.work_collection (id, specialist_id) on delete cascade,
  check (jsonb_typeof(data) = 'object'),
  check (octet_length(data::text) <= 20000)
);

create index if not exists work_item_collection_status_idx on public.work_item (collection_id, status, created_at desc);

-- 4. Seguridad por fila y permisos.
alter table public.work_collection enable row level security;
alter table public.work_item enable row level security;

drop policy if exists work_collection_select on public.work_collection;
create policy work_collection_select on public.work_collection
  for select to authenticated using (public.can_access_specialist(specialist_id));

drop policy if exists work_item_select on public.work_item;
create policy work_item_select on public.work_item
  for select to authenticated using (public.can_access_specialist(specialist_id));

-- Cuenta desactivada = sin datos (misma regla que el resto de tablas).
drop policy if exists active_only on public.work_collection;
create policy active_only on public.work_collection as restrictive for all to authenticated using (public.is_active_user());
drop policy if exists active_only on public.work_item;
create policy active_only on public.work_item as restrictive for all to authenticated using (public.is_active_user());

revoke all on public.work_collection, public.work_item from anon, authenticated;
grant select on public.work_collection, public.work_item to authenticated;
grant all on public.work_collection, public.work_item to service_role;

-- 5. Resumen por pestaña (cuántas filas hay en cada estado). Respeta las políticas de quien consulta.
create or replace view public.work_collection_overview with (security_invoker = true) as
select
  c.id, c.specialist_id, c.collection_key, c.label, c.position, c.approvable, c.columns,
  count(i.id) filter (where i.status = 'proposed')  as proposed,
  count(i.id) filter (where i.status = 'approved')  as approved,
  count(i.id) filter (where i.status = 'rejected')  as rejected,
  count(i.id) filter (where i.status = 'delivered') as delivered
from public.work_collection c
left join public.work_item i on i.collection_id = c.id
group by c.id;

revoke all on public.work_collection_overview from anon, authenticated;
grant select on public.work_collection_overview to authenticated, service_role;

-- 6. Los flujos entregan filas (solo service_role).
create or replace function public.work_items_add(p_specialist uuid, p_collection text, p_rows jsonb, p_run_ref text default null)
returns int
language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_col public.work_collection%rowtype;
  v_n int;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Las filas deben ir en una lista.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'Máximo 500 filas por llamada.' using errcode = '22023';
  end if;

  select * into v_col from public.work_collection where specialist_id = p_specialist and collection_key = p_collection;
  if not found then
    raise exception 'La colección no existe para este especialista.' using errcode = '22023';
  end if;

  insert into public.work_item (collection_id, specialist_id, data, status, run_ref)
  select v_col.id, p_specialist, r.value, case when v_col.approvable then 'proposed' else 'delivered' end, p_run_ref
    from jsonb_array_elements(p_rows) as r(value);
  get diagnostics v_n = row_count;
  return v_n;
end $f$;

revoke all on function public.work_items_add(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.work_items_add(uuid, text, jsonb, text) to service_role;

-- 7. Aprobar o rechazar propuestas. Devuelve cuántas filas cambió de verdad: ignora las que ya estaban
--    decididas, las de pestañas no aprobables y las de especialistas a los que esta persona no tiene acceso.
create or replace function public.decide_work_items(p_ids uuid[], p_decision text)
returns int
language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_n int;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'Sin permiso.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Decisión no válida.' using errcode = '22023';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 200 then
    raise exception 'Elige entre 1 y 200 filas.' using errcode = '22023';
  end if;

  with upd as (
    update public.work_item i
       set status = p_decision, decided_by = auth.uid(), decided_at = now()
      from public.work_collection c
     where i.id = any (p_ids)
       and c.id = i.collection_id
       and c.approvable
       and i.status = 'proposed'
       and public.can_access_specialist(i.specialist_id)
    returning i.specialist_id, c.collection_key
  ), logged as (
    insert into public.audit_log (actor_type, actor_label, action, target_table, target_id, reason)
    select 'client_user',
           (select email from auth.users where id = auth.uid()),
           'work.' || p_decision,
           'work_item',
           u.specialist_id::text,
           u.collection_key || ': ' || count(*)
      from upd u
     group by u.specialist_id, u.collection_key
    returning 1
  )
  select count(*) into v_n from upd;

  return v_n;
end $f$;

revoke all on function public.decide_work_items(uuid[], text) from public, anon;
grant execute on function public.decide_work_items(uuid[], text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Para revertir (borra también todas las filas entregadas):
--   drop function public.decide_work_items(uuid[], text);
--   drop function public.work_items_add(uuid, text, jsonb, text);
--   drop view public.work_collection_overview;
--   drop table public.work_item;
--   drop table public.work_collection;
--   drop function public.can_access_specialist(uuid);
-- ---------------------------------------------------------------------

  -- ===== datos de prueba (como Vrutal) =====
  select id into spec from public.specialists order by display_name limit 1;
  insert into public.work_collection (specialist_id, collection_key, label, position, approvable, columns)
  values (spec, 'keywords', 'Keywords', 1, true,
          '[{"key":"keyword","label":"Keyword","type":"text"},{"key":"volumen","label":"Volumen / mes","type":"number"}]'::jsonb)
  returning id into col_k;
  insert into public.work_collection (specialist_id, collection_key, label, position, approvable, columns)
  values (spec, 'briefs', 'Briefs', 2, false, '[{"key":"titulo","label":"Título","type":"text"}]'::jsonb)
  returning id into col_b;

  set local role service_role;
  n := public.work_items_add(spec, 'keywords', '[{"keyword":"a","volumen":10},{"keyword":"b","volumen":20},{"keyword":"c","volumen":30}]'::jsonb, 'run-1');
  r := r || format('1a) flujo entrega 3 keywords: %s (esperado 3) | ', n);
  n := public.work_items_add(spec, 'briefs', '[{"titulo":"x"},{"titulo":"y"}]'::jsonb);
  reset role;
  select string_agg(distinct status, ',') into st from public.work_item where collection_id = col_k;
  r := r || format('1b) estado de keywords: %s (esperado proposed) | ', st);
  select string_agg(distinct status, ',') into st from public.work_item where collection_id = col_b;
  r := r || format('1c) estado de briefs: %s (esperado delivered) | ', st);

  insert into auth.users (id, instance_id, aud, role, email) values
    (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u1@prueba.invalid'),
    (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'u2@prueba.invalid');
  insert into public.user_specialist_access (profile_id, specialist_id) values (u1, spec);
  select array_agg(id order by created_at, id) into ids from public.work_item where collection_id = col_k;
  select array_agg(id) into ids_b from public.work_item where collection_id = col_b;

  -- ===== 2. Quien NO tiene acceso (u2) =====
  perform set_config('request.jwt.claims', json_build_object('sub', u2::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_c from public.work_collection;
  r := r || format('2a) sin acceso ve %s pestañas (esperado 0) | ', v_c);
  select count(*) into v_c from public.work_item;
  r := r || format('2b) sin acceso ve %s filas (esperado 0) | ', v_c);
  n := public.decide_work_items(ids, 'approved');
  r := r || format('2c) sin acceso decide: %s filas cambiadas (esperado 0) | ', n);

  -- ===== 3. Quien SÍ tiene acceso (u1) =====
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_c from public.work_collection;
  r := r || format('3a) con acceso ve %s pestañas (esperado 2) | ', v_c);
  select count(*) into v_c from public.work_item;
  r := r || format('3b) con acceso ve %s filas (esperado 5) | ', v_c);
  select proposed into v_c from public.work_collection_overview where collection_key = 'keywords';
  r := r || format('3c) resumen: %s propuestas (esperado 3) | ', v_c);
  n := public.decide_work_items(ids[1:2], 'approved');
  r := r || format('3d) aprueba 2: %s (esperado 2) | ', n);
  n := public.decide_work_items(ids[1:2], 'rejected');
  r := r || format('3e) vuelve a decidir las mismas: %s (esperado 0, ya estaban decididas) | ', n);
  n := public.decide_work_items(ids_b, 'approved');
  r := r || format('3f) decide filas de una pestaña no aprobable: %s (esperado 0) | ', n);

  begin perform public.decide_work_items(array[gen_random_uuid()], 'quizas'); r := r || '3g) MAL: decisión inválida aceptada | ';
  exception when others then r := r || '3g) decisión inválida rechazada (esperado rechazada) | '; end;
  begin insert into public.work_item (collection_id, specialist_id, data, status) values (col_k, spec, '{}'::jsonb, 'approved'); r := r || '3h) MAL: INSERT directo | ';
  exception when others then r := r || '3h) insert directo bloqueado (esperado bloqueado) | '; end;
  begin update public.work_item set status = 'approved'; r := r || '3i) MAL: UPDATE directo | ';
  exception when others then r := r || '3i) update directo bloqueado (esperado bloqueado) | '; end;
  begin delete from public.work_item; r := r || '3j) MAL: DELETE directo | ';
  exception when others then r := r || '3j) delete directo bloqueado (esperado bloqueado) | '; end;
  begin insert into public.work_collection (specialist_id, collection_key, label) values (spec, 'x', 'x'); r := r || '3k) MAL: crea pestaña | ';
  exception when others then r := r || '3k) crear pestaña bloqueado (esperado bloqueado) | '; end;
  begin perform public.work_items_add(spec, 'keywords', '[{"keyword":"z"}]'::jsonb); r := r || '3l) MAL: cliente entrega filas | ';
  exception when others then r := r || '3l) el cliente no entrega filas (esperado bloqueado) | '; end;

  -- ===== 4. u1 desactivado =====
  reset role;
  perform set_config('request.jwt.claims', '', true);   -- como Vrutal: sin usuario en la sesión (si no, el guard lo tomaría por u1)
  update public.profiles set is_active = false where id = u1;
  perform set_config('request.jwt.claims', json_build_object('sub', u1::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_c from public.work_item;
  r := r || format('4a) desactivado ve %s filas (esperado 0) | ', v_c);
  begin perform public.decide_work_items(ids, 'approved'); r := r || '4b) MAL: desactivado decide | ';
  exception when others then r := r || '4b) desactivado no decide (esperado bloqueado) | '; end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  update public.profiles set is_active = true where id = u1;

  -- ===== 5. El Admin =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_c from public.work_item;
  r := r || format('5a) admin ve %s filas (esperado 5) | ', v_c);
  select array_agg(id) into ids from public.work_item where collection_id = col_k and status = 'proposed';
  n := public.decide_work_items(ids, 'rejected');
  r := r || format('5b) admin rechaza la que quedaba: %s (esperado 1) | ', n);
  reset role;

  -- ===== 6. Rastro y estados finales =====
  select count(*) into v_c from public.audit_log where action in ('work.approved', 'work.rejected');
  r := r || format('6) filas de auditoría: %s (esperado 2 o más) | ', v_c);
  select format('%s aprobadas, %s rechazadas, %s aprobadas por u1',
    count(*) filter (where status = 'approved'), count(*) filter (where status = 'rejected'),
    count(*) filter (where status = 'approved' and decided_by = u1)) into st from public.work_item where collection_id = col_k;
  r := r || format('7) estados finales: %s (esperado 2 aprobadas, 1 rechazada, 2 por u1)', st);

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
