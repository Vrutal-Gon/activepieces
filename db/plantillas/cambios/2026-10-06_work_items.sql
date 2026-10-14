-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
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
