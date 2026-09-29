-- =====================================================================
-- VRUTAL 1st · Migración 002
-- Composición de tareas: bloques versionados, contratos y variantes por stack
--
-- Aditiva: no modifica datos existentes ni rompe las RPC catalog_* del panel
-- (devuelven columnas explícitas). Convenciones heredadas de 001:
--   · RLS activado con política platform_admin_all (is_platform_admin()).
--   · FKs sin cascade salvo slot -> composición.
--   · "Ningún cambio se sobrescribe en silencio": lo publicado es inmutable.
--
-- Modelo:
--   contract           tipo de dato que se pasan los bloques (EmailEvent, Clasificacion…)
--   component (+kind)  familia/variante de un bloque; variant = stack al que aplica
--   component_version  versión inmutable de un bloque (artefacto + contrato de salida)
--   task_composition   una forma de realizar una versión de tarea (pipeline, agente…)
--   task_composition_slot  posición ordenada; varias opciones por slot con applies_when
-- =====================================================================

-- 1 · Bloque: rol y variante ------------------------------------------
alter table catalog.component
  add column kind    text check (kind in ('intake','normalize','context','decide','gate','act','audit')),
  add column variant jsonb not null default '{}'::jsonb;

comment on column catalog.component.kind is
  'Rol del bloque en una composición. NULL = componente monolítico anterior (p. ej. un flujo entero); no puede ocupar un slot.';
comment on column catalog.component.variant is
  'Stack al que aplica esta variante, p. ej. {"mailbox":"imap"}. Vacío = agnóstico.';

-- 2 · Contratos ---------------------------------------------------------
create table catalog.contract (
  key         text not null,
  version     int  not null default 1,
  description text not null,
  json_schema jsonb not null default '{}'::jsonb,
  status      text not null default 'draft' check (status in ('draft','validated','deprecated')),
  created_at  timestamptz not null default now(),
  primary key (key, version)
);

-- 3 · Versiones de bloque -------------------------------------------------
create table catalog.component_version (
  id                      uuid primary key default gen_random_uuid(),
  component_id            uuid not null references catalog.component(id) on delete restrict,
  version                 int  not null,
  status                  text not null default 'draft' check (status in ('draft','validated','deprecated')),
  artifact_ref            text,                       -- flujo exportado, piece@versión o ruta en repo
  output_contract_key     text,
  output_contract_version int,
  consumes                text[] not null default '{}', -- claves de contrato que necesita en la entrada
  changelog               text not null,
  created_at              timestamptz not null default now(),
  unique (component_id, version),
  foreign key (output_contract_key, output_contract_version) references catalog.contract(key, version),
  check ((output_contract_key is null) = (output_contract_version is null))
);

-- 4 · Composición por versión de tarea ---------------------------------------
create table catalog.task_composition (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references catalog.task(id) on delete restrict,
  task_version int  not null,
  key          text not null,                         -- 'pipeline', 'agent'…
  version      int  not null default 1,
  name         text not null,
  pattern      text not null check (pattern in
                 ('HUMAN','PROMPT','LLM','RULES','SCRIPT','API','ML','WORKFLOW','RAG','AGENT','MULTI_AGENT')),
  status       text not null default 'draft' check (status in ('draft','validated','deprecated')),
  changelog    text not null,
  created_at   timestamptz not null default now(),
  unique (task_id, key, version)
);

create table catalog.task_composition_slot (
  id                   uuid primary key default gen_random_uuid(),
  composition_id       uuid not null references catalog.task_composition(id) on delete cascade,
  position             int  not null,
  slot_key             text not null,                 -- 'intake', 'normalize', 'context.crm'…
  kind                 text not null check (kind in ('intake','normalize','context','decide','gate','act','audit')),
  optional             boolean not null default false,
  component_version_id uuid not null references catalog.component_version(id) on delete restrict,
  applies_when         jsonb not null default '{}'::jsonb,  -- se cumple si el stack del cliente lo contiene
  is_default           boolean not null default false,
  unique (composition_id, slot_key, component_version_id)
);
create index task_composition_slot_order_idx on catalog.task_composition_slot (composition_id, position);

-- 5 · Guardas ------------------------------------------------------------------
-- Lo publicado no se modifica ni se borra; solo avanza draft -> validated -> deprecated.
create or replace function catalog.guard_published_immutable() returns trigger
language plpgsql set search_path = catalog, pg_temp as $$
begin
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
end $$;

create trigger contract_immutable          before update or delete on catalog.contract
  for each row execute function catalog.guard_published_immutable();
create trigger component_version_immutable before update or delete on catalog.component_version
  for each row execute function catalog.guard_published_immutable();
create trigger task_composition_immutable  before update or delete on catalog.task_composition
  for each row execute function catalog.guard_published_immutable();

-- Los slots solo se tocan mientras la composición está en draft.
create or replace function catalog.guard_slot_change() returns trigger
language plpgsql set search_path = catalog, pg_temp as $$
declare st text; cid uuid := coalesce(new.composition_id, old.composition_id);
begin
  select status into st from catalog.task_composition where id = cid;
  if st is not null and st <> 'draft' then
    raise exception 'La composición % no está en draft: publica una versión nueva en lugar de modificarla', cid using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;

create trigger task_composition_slot_guard before insert or update or delete on catalog.task_composition_slot
  for each row execute function catalog.guard_slot_change();

-- El tipo del slot debe coincidir con el del bloque (un 'decide' no ocupa un slot 'intake').
create or replace function catalog.check_slot_kind() returns trigger
language plpgsql set search_path = catalog, pg_temp as $$
declare ck text;
begin
  select c.kind into ck
    from catalog.component_version v join catalog.component c on c.id = v.component_id
   where v.id = new.component_version_id;
  if ck is distinct from new.kind then
    raise exception 'slot % es de tipo % pero el bloque es de tipo %', new.slot_key, new.kind, coalesce(ck, 'NULL (monolítico)') using errcode = '23514';
  end if;
  return new;
end $$;

create trigger task_composition_slot_kind before insert or update on catalog.task_composition_slot
  for each row execute function catalog.check_slot_kind();

-- 6 · RLS (misma política que el resto del catálogo) ---------------------------------
alter table catalog.contract              enable row level security;
alter table catalog.component_version     enable row level security;
alter table catalog.task_composition      enable row level security;
alter table catalog.task_composition_slot enable row level security;

create policy platform_admin_all on catalog.contract
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_admin_all on catalog.component_version
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_admin_all on catalog.task_composition
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy platform_admin_all on catalog.task_composition_slot
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());
