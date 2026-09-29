-- =====================================================================
-- VRUTAL OS · Plantilla de proyecto de CLIENTE (plano de datos)
-- Se instala UNA VEZ en el proyecto de Supabase propio de cada cliente.
-- No lleva tenant_id ni RLS multi-cliente: el aislamiento es que esta
-- base entera pertenece a un único cliente (LAB08, decisión resuelta).
-- Referencias al catálogo central (job_role, task) son "blandas":
-- texto/uuid guardado tal cual, sin FK real, porque viven en otra base.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. IDENTIDAD Y ROLES · solo 2 roles fijos, sin motor de RBAC genérico
--    (no hace falta: en un proyecto de un único cliente sobra la
--    flexibilidad multi-tenant que sí necesitaba el plano de control).
-- ---------------------------------------------------------------------
create table public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    full_name   text,
    role        text not null default 'client_user'
                  check (role in ('client_admin','client_user')),
    is_active   boolean not null default true,
    created_at  timestamptz not null default now()
);

-- El primer usuario que se registra en un proyecto nuevo se vuelve
-- client_admin automáticamente (arranque de cuenta); el resto entra
-- como client_user hasta que un admin lo cambie.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_is_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_is_first;
  insert into public.profiles (id, role)
    values (new.id, case when v_is_first then 'client_admin' else 'client_user' end);
  return new;
end $$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nadie puede subirse el propio rol a sí mismo; solo un admin editando
-- la fila de OTRO usuario puede cambiar el rol.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.role is distinct from old.role and new.id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;
  return new;
end $$;

create trigger trg_prevent_self_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

create or replace function public.my_role()
returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_role() = 'client_admin', false)
$$;

-- ---------------------------------------------------------------------
-- 2. ESPECIALISTAS DESPLEGADOS · instancia de un job_role del catálogo
--    central. Solo Vrutal (service_role) los da de alta o los cambia
--    de fase/autonomía -- "Vrutal habilita y deshabilita".
-- ---------------------------------------------------------------------
create table public.specialists (
    id                  uuid primary key default gen_random_uuid(),
    job_role_key        text not null,   -- referencia blanda a catalog.job_role.key
    job_role_version    integer not null,
    display_name        text not null,
    phase               text not null default '01_AUDIT'
                          check (phase in ('01_AUDIT','02_PILOT','03_LIMITED','04_SUPERVISED','05_LIVE')),
    autonomy_level      text not null default 'draft_for_approval'
                          check (autonomy_level in ('read_only','draft_for_approval','auto_low_risk','full_autonomy')),
    risk_level          text not null check (risk_level in ('low','medium','medium_high','high')),
    status              text not null default 'active' check (status in ('active','paused','retired')),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- Historial de versiones del prompt personalizado -- así el panel de
-- Vrutal puede ver qué versión de catálogo usa y cuál es su personalización,
-- sin perder las versiones anteriores.
create table public.specialist_prompts (
    id                      uuid primary key default gen_random_uuid(),
    specialist_id           uuid not null references public.specialists(id) on delete cascade,
    based_on_task_key       text,          -- referencia blanda a catalog.task.key
    based_on_task_version   integer,
    prompt_text             text not null,
    customization_notes     text,
    is_active               boolean not null default true,
    created_by              uuid references public.profiles(id),
    created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CONVERSACIONES · un especialista o varios a la vez (tier 4-5,
--    "reuniones"). Antes solo permitía uno; se corrige aquí con una
--    tabla puente en vez de una columna fija.
-- ---------------------------------------------------------------------
create table public.conversations (
    id              uuid primary key default gen_random_uuid(),
    title           text,
    started_by      uuid not null references public.profiles(id),
    status          text not null default 'open' check (status in ('open','closed')),
    created_at      timestamptz not null default now()
);

create table public.conversation_participants (
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    specialist_id   uuid not null references public.specialists(id),
    joined_at       timestamptz not null default now(),
    primary key (conversation_id, specialist_id)
);

create table public.messages (
    id              bigserial primary key,
    conversation_id uuid not null references public.conversations(id) on delete cascade,
    sender_type     text not null check (sender_type in ('user','specialist')),
    sender_profile_id     uuid references public.profiles(id),
    sender_specialist_id  uuid references public.specialists(id),
    content         text not null,
    created_at      timestamptz not null default now(),
    check (
      (sender_type = 'user' and sender_profile_id is not null and sender_specialist_id is null)
      or
      (sender_type = 'specialist' and sender_specialist_id is not null and sender_profile_id is null)
    )
);

-- ---------------------------------------------------------------------
-- 4. CONSUMO, APROBACIONES E INTEGRACIONES
-- ---------------------------------------------------------------------
create table public.run_log (
    id              bigserial primary key,
    specialist_id   uuid not null references public.specialists(id),
    task_key        text,
    provider        text not null,
    model_name      text not null,
    tokens_in       integer,
    tokens_out      integer,
    cost_usd        numeric(12,6),
    created_at      timestamptz not null default now()
);

create table public.approval_requests (
    id              uuid primary key default gen_random_uuid(),
    specialist_id   uuid not null references public.specialists(id),
    task_key        text,
    payload         jsonb,
    status          text not null default 'pending' check (status in ('pending','approved','rejected')),
    requested_at    timestamptz not null default now(),
    decided_by      uuid references public.profiles(id),
    decided_at      timestamptz
);

create table public.integrations (
    id                  uuid primary key default gen_random_uuid(),
    integration_type    text not null,   -- 'crm', 'erp', 'ads', 'email'...
    provider            text not null,
    config              jsonb,
    secret_ref          text,            -- ruta en el almacén de secretos, nunca el secreto
    status              text not null default 'active' check (status in ('active','paused','revoked')),
    created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. AUDITORÍA · incluye el acceso de soporte de Vrutal vía service_role
--    (el MFA se exige antes, en el plano de control -- aquí solo queda
--    constancia de que ocurrió, cuándo y por qué).
-- ---------------------------------------------------------------------
create table public.audit_log (
    id              bigserial primary key,
    actor_type      text not null check (actor_type in ('client_user','vrutal_support','system')),
    actor_label     text,        -- email o identificador, no uuid (puede ser de otro proyecto)
    action          text not null,
    target_table    text,
    target_id       text,
    reason          text,
    created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_specialists_updated_at
  before update on public.specialists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY · por rol, no por tenant (aquí ya solo hay uno)
-- ---------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.specialists             enable row level security;
alter table public.specialist_prompts      enable row level security;
alter table public.conversations           enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                enable row level security;
alter table public.run_log                 enable row level security;
alter table public.approval_requests       enable row level security;
alter table public.integrations            enable row level security;
alter table public.audit_log               enable row level security;

-- profiles: todo el equipo se ve entre sí; cada uno edita lo suyo,
-- un admin edita a cualquiera (el trigger de arriba bloquea el auto-ascenso).
create policy profiles_select_team on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- specialists y su historial de prompts: el equipo los ve (para poder
-- chatear y para que el admin revise KPIs), pero nadie del cliente
-- los da de alta ni los edita -- eso es exclusivamente de Vrutal.
create policy specialists_select_team on public.specialists
  for select to authenticated using (true);
create policy specialist_prompts_select_team on public.specialist_prompts
  for select to authenticated using (true);

-- conversaciones y mensajes: cada uno ve y participa en las suyas.
create policy conversations_select_participant on public.conversations
  for select to authenticated
  using (started_by = auth.uid() or public.is_admin());
create policy conversations_insert_self on public.conversations
  for insert to authenticated with check (started_by = auth.uid());

create policy participants_select on public.conversation_participants
  for select to authenticated using (true);

create policy messages_select_in_own_conversation on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.started_by = auth.uid() or public.is_admin())
  ));
create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (sender_type = 'user' and sender_profile_id = auth.uid());

-- run_log: el admin ve el consumo (KPIs/coste); un usuario estándar no.
create policy run_log_select_admin on public.run_log
  for select to authenticated using (public.is_admin());

-- aprobaciones: el admin ve y decide; nadie más.
create policy approvals_select_admin on public.approval_requests
  for select to authenticated using (public.is_admin());
create policy approvals_decide_admin on public.approval_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- integraciones: solo el admin las ve y las configura.
create policy integrations_admin_only on public.integrations
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- auditoría: el admin puede revisarla; nadie inserta desde el cliente.
create policy audit_select_admin on public.audit_log
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. GRANTS
-- ---------------------------------------------------------------------
revoke all on schema public from public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on
    public.profiles, public.conversations, public.conversation_participants, public.messages
  to authenticated;
grant select on
    public.specialists, public.specialist_prompts, public.run_log,
    public.approval_requests, public.integrations, public.audit_log
  to authenticated;
grant update on public.approval_requests, public.integrations to authenticated;
grant usage on all sequences in schema public to authenticated;

-- specialists, specialist_prompts, run_log, audit_log, y los inserts en
-- approval_requests: los escribe Vrutal vía service_role (que además
-- salta el RLS por defecto en Supabase), nunca el cliente directamente.

-- service_role salta las POLÍTICAS de RLS, pero Postgres exige igualmente
-- el permiso de tabla de base -- sin esto, ni siquiera Vrutal podría
-- provisionar especialistas o reasignar el admin de un cliente.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
