-- =====================================================================
-- Vrutal 1st (apmhvqlvwjcrwfaixgju) · catálogo
-- Modo pre-live: mientras no haya clientes externos, todo se puede borrar y rehacer.
--
-- POR QUÉ. La inmutabilidad de lo publicado (triggers de la migración 002) es correcta cuando
-- hay clientes: un artefacto validado tiene que seguir siendo el mismo que se verificó. Pero
-- hoy el catálogo se está buscando la forma: cada flujo que se migra a VrutalOS deja atrás
-- bloques, contratos y composiciones que ya no describen nada. Si no se pueden borrar, el
-- catálogo acumula mentiras y deja de servir para lo único que sirve: saber qué hay montado.
--
-- CÓMO. Un interruptor de un solo registro y una función que lo lee. Los cuatro guardianes la
-- consultan y, en pre-live, dejan editar, volver a draft y borrar. No se quita ninguna regla:
-- se declara una excepción con fecha de caducidad.
--
-- LA PUERTA. `catalog.is_prelive()` devuelve false en cuanto exista un tenant que no sea
-- interno, por mucho que el interruptor siga encendido. No se puede olvidar apagarlo: el primer
-- cliente real lo apaga solo. Y `catalog_set_prelive(true, …)` se niega a encenderlo si ya hay
-- uno. Apagarlo a mano antes del primer cliente sigue siendo parte del alta.
--
-- Reversible: ver bloque al final.
-- =====================================================================

-- 1 · El interruptor. Un solo registro, con rastro de quién lo tocó y por qué.
create table if not exists catalog.release_gate (
  id         boolean primary key default true check (id),
  prelive    boolean not null default true,
  note       text,
  changed_at timestamptz not null default now(),
  changed_by uuid
);

insert into catalog.release_gate (id, prelive, note)
values (true, true, 'Pre-live desde el principio: cero clientes externos, el catálogo todavía se está construyendo.')
on conflict (id) do nothing;

alter table catalog.release_gate enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'catalog' and tablename = 'release_gate' and policyname = 'release_gate_read') then
    create policy release_gate_read on catalog.release_gate
      for select to authenticated using (public.is_platform_admin());
  end if;
end $$;

revoke all on catalog.release_gate from anon, authenticated;
grant select on catalog.release_gate to authenticated;
grant all on catalog.release_gate to service_role;

-- 2 · La función que mandan los guardianes. Dos condiciones, y la segunda no se puede olvidar.
create or replace function catalog.is_prelive()
returns boolean
language sql stable security definer set search_path = catalog, public, pg_temp as $f$
  select coalesce((select g.prelive from catalog.release_gate g where g.id), false)
     and not exists (
       select 1 from public.tenants t
        where coalesce(t.is_internal, false) = false and t.deleted_at is null
     )
$f$;

revoke all on function catalog.is_prelive() from public, anon;
grant execute on function catalog.is_prelive() to authenticated, service_role;

-- 3 · Los cuatro guardianes, con la excepción declarada al principio de cada uno.
create or replace function catalog.guard_published_immutable()
returns trigger
language plpgsql set search_path to 'catalog', 'public', 'pg_temp' as $function$
begin
  -- Pre-live: se puede borrar y rehacer. Ver migración 040.
  if catalog.is_prelive() then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception '% publicado (%): no se borra, se depreca', tg_table_name, old.status using errcode = '23514';
    end if;
    return old;
  end if;
  if old.status <> 'draft' then
    if new.status = 'draft' then
      raise exception '% publicado: no puede volver a draft', tg_table_name using errcode = '23514';
    end if;
    if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception '% publicado (%): no se modifica, publica una versión nueva', tg_table_name, old.status using errcode = '23514';
    end if;
  end if;
  return new;
end $function$;

create or replace function catalog.guard_slot_change()
returns trigger
language plpgsql set search_path to 'catalog', 'public', 'pg_temp' as $function$
declare st text; cid uuid := coalesce(new.composition_id, old.composition_id);
begin
  if catalog.is_prelive() then return coalesce(new, old); end if;

  select status into st from catalog.task_composition where id = cid;
  if st is not null and st <> 'draft' then
    raise exception 'La composición % no está en draft: publica una versión nueva en lugar de modificarla', cid using errcode = '23514';
  end if;
  return coalesce(new, old);
end $function$;

create or replace function catalog.prevent_task_content_mutation()
returns trigger
language plpgsql set search_path to 'catalog', 'public', 'pg_temp' as $function$
begin
  if catalog.is_prelive() then return new; end if;

  if old.status in ('validated','deprecated') and (
    new.statement is distinct from old.statement or
    new.primary_pattern is distinct from old.primary_pattern or
    new.automation_min is distinct from old.automation_min or
    new.automation_max is distinct from old.automation_max or
    new.human_only is distinct from old.human_only or
    new.risk is distinct from old.risk or
    new.reversible is distinct from old.reversible or
    new.requires_approval is distinct from old.requires_approval or
    new.touches_budget is distinct from old.touches_budget or
    new.customer_facing is distinct from old.customer_facing or
    new.process_id is distinct from old.process_id
  ) then
    raise exception 'catalog.task % (version %) es validated/deprecated: usa catalog.create_task_version() para cambiar contenido, no UPDATE in-place', old.task_code, old.version;
  end if;
  return new;
end $function$;

-- `check_slot_kind` no se toca: que un bloque solo entre en un slot de su mismo tipo no es
-- inmutabilidad, es coherencia. Eso vale igual en pre-live.

-- 4 · Encender y apagar el interruptor. Solo superadmin, y nunca con un cliente externo dentro.
create or replace function public.catalog_set_prelive(p_on boolean, p_note text default null)
returns boolean
language plpgsql security definer set search_path = public, catalog, pg_temp as $f$
declare n int;
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_on then
    select count(*) into n from public.tenants t
     where coalesce(t.is_internal, false) = false and t.deleted_at is null;
    if n > 0 then
      raise exception 'Hay % cliente(s) externo(s): el modo pre-live no se puede encender.', n using errcode = '23514';
    end if;
  end if;
  update catalog.release_gate
     set prelive = p_on,
         note = coalesce(p_note, note),
         changed_at = now(),
         changed_by = auth.uid()
   where id;
  return catalog.is_prelive();
end $f$;

revoke all on function public.catalog_set_prelive(boolean, text) from public, anon;
grant execute on function public.catalog_set_prelive(boolean, text) to authenticated, service_role;

-- 5 · Borrar una tarea entera del catálogo operativo: sus composiciones y sus slots, y la tarea
--     vuelve a draft. No borra bloques ni contratos: pueden estar compartidos, y eso se decide
--     con criterio. Devuelve lo que ha borrado y lo que queda huérfano, para verlo de un vistazo.
create or replace function public.catalog_purge_task(p_task_code text)
returns text
language plpgsql security definer set search_path = public, catalog, pg_temp as $f$
declare v_task uuid; n_comp int; n_slot int; huerfanos text;
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not catalog.is_prelive() then
    raise exception 'Fuera de pre-live no se borra: depreca la composición y publica una versión nueva.' using errcode = '23514';
  end if;

  select id into v_task from catalog.task where task_code = p_task_code;
  if v_task is null then
    raise exception 'No existe la tarea %', p_task_code using errcode = '23503';
  end if;

  with borrados as (
    delete from catalog.task_composition_slot s
     where s.composition_id in (select c.id from catalog.task_composition c where c.task_id = v_task)
    returning 1
  ) select count(*) into n_slot from borrados;

  with borradas as (
    delete from catalog.task_composition c where c.task_id = v_task returning 1
  ) select count(*) into n_comp from borradas;

  update catalog.task set status = 'draft' where id = v_task;

  select coalesce(string_agg(x.nombre || ' v' || x.version, ', ' order by x.nombre), 'ninguno')
    into huerfanos
    from (
      select c.name as nombre, cv.version
        from catalog.component_version cv
        join catalog.component c on c.id = cv.component_id
       where not exists (select 1 from catalog.task_composition_slot s where s.component_version_id = cv.id)
    ) x;

  return format('%s: %s composición(es) y %s slot(s) borrados, la tarea vuelve a draft. Versiones de bloque sin usar ahora mismo: %s',
                p_task_code, n_comp, n_slot, huerfanos);
end $f$;

revoke all on function public.catalog_purge_task(text) from public, anon;
grant execute on function public.catalog_purge_task(text) to authenticated, service_role;

-- 6 · Barrer los bloques que ya no usa nadie. En seco por defecto: primero se mira, luego se borra.
create or replace function public.catalog_purge_orphan_blocks(p_dry_run boolean default true)
returns text
language plpgsql security definer set search_path = public, catalog, pg_temp as $f$
declare lista text; n_ver int := 0; n_comp int := 0;
begin
  if not public.is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if not catalog.is_prelive() then
    raise exception 'Fuera de pre-live no se borran bloques: se deprecan.' using errcode = '23514';
  end if;

  select coalesce(string_agg(c.name || ' v' || cv.version || ' (' || cv.status || ')', ', ' order by c.name, cv.version), 'ninguno')
    into lista
    from catalog.component_version cv
    join catalog.component c on c.id = cv.component_id
   where not exists (select 1 from catalog.task_composition_slot s where s.component_version_id = cv.id);

  if p_dry_run then
    return format('EN SECO (nada borrado). Versiones sin usar: %s', lista);
  end if;

  with v as (
    delete from catalog.component_version cv
     where not exists (select 1 from catalog.task_composition_slot s where s.component_version_id = cv.id)
    returning 1
  ) select count(*) into n_ver from v;

  with c as (
    delete from catalog.component comp
     where not exists (select 1 from catalog.component_version cv where cv.component_id = comp.id)
       and not exists (select 1 from catalog.task_component tc where tc.component_id = comp.id)
       and not exists (select 1 from catalog.job_role_task_component jrtc where jrtc.component_id = comp.id)
    returning 1
  ) select count(*) into n_comp from c;

  return format('Borradas %s versión(es) y %s bloque(s) sin usar. Eran: %s', n_ver, n_comp, lista);
end $f$;

revoke all on function public.catalog_purge_orphan_blocks(boolean) from public, anon;
grant execute on function public.catalog_purge_orphan_blocks(boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Para revertir (vuelve la inmutabilidad dura):
--   select public.catalog_set_prelive(false, 'Fin del pre-live');   -- la vía normal
--   -- y si se quiere quitar el mecanismo entero:
--   drop function public.catalog_purge_orphan_blocks(boolean);
--   drop function public.catalog_purge_task(text);
--   drop function public.catalog_set_prelive(boolean, text);
--   -- restaurar los tres guardianes de la migración 002 sin la excepción de pre-live
--   drop function catalog.is_prelive();
--   drop table catalog.release_gate;
-- ---------------------------------------------------------------------
