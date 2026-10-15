-- =====================================================================
-- PLANTILLA DE UN PROYECTO SUPABASE DE CLIENTE (plano de datos, "VrutalOS")
-- Uno por cliente. NO ejecutar en Vrutal 1st (apmhvqlvwjcrwfaixgju).
--
-- REGENERADA el 2026-10-15 leyendo la base viva de Vrutal-labs
-- (rgauumxztblwurzebmsa), el cliente 0. La anterior tenía 10 tablas frente a
-- las 23 reales y su `handle_new_user` hacía admin al primer usuario: «plantilla
-- + cambios» no reproducía la base viva.
--
-- CÓMO SE DA DE ALTA UN CLIENTE NUEVO
--   1. Este fichero.
--   2. Después, TODOS los cambios de `cambios/` en orden de fecha.
--   scripts/aplicar-cambios-cliente.sh --apply --with-template  hace las dos cosas
--   y aborta en voz alta si una falla.
--
-- QUÉ NO ESTÁ AQUÍ, A PROPÓSITO
--   · `client_ticket` — los tickets viven en Vrutal1st (D-20, 2026-10-08). En
--     Vrutal-labs quedó creada de antes de esa decisión y se retira aparte.
--   · `staff_contract_specialist()` — existe en la base viva de Vrutal-labs pero
--     es de Vrutal1st: usa `catalog.job_role`, `public.tenant_specialist`,
--     `has_permission()` y `staff_can_access_tenant()`, que NO existen aquí. Es la
--     migración 024 aplicada por error en el proyecto del cliente, donde está
--     muerta. No se propaga a los clientes nuevos.
--   · Los datos. Esto es solo esquema.
--   · `auth`, `storage` y el resto de esquemas de Supabase: los gestiona Supabase.
--
-- LO QUE HAY QUE CONFIGURAR A MANO DESPUÉS (no es SQL)
--   · Registro público de Auth DESACTIVADO (D-05). No es verificable por SQL.
--   · Secrets de las Edge Functions: `APP_ORIGINS`, `ALLOWED_EMAIL_DOMAINS`,
--     `TENANT_ID`, `VRUTAL1ST_FUNCTIONS_BASE_URL`, `VRUTAL1ST_PUSH_TOKEN`,
--     `AP_INTEGRATION_TOKEN`, `SOCIAL_APP_TOKEN`, `POSTIZ_BASE_URL`.
--   · Redirect URL `<origen>/bienvenida` en Auth.
--   · Bucket de Storage `client-files`, privado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0 · ROLES
-- `anon`, `authenticated` y `service_role` los crea Supabase.
-- `vrutal_sync` lo crea Vrutal: es la conexión Postgres directa con la que el
-- sync escribe el catálogo. BYPASSRLS porque no actúa en nombre de nadie; sus
-- permisos se controlan con GRANT de tabla, no con políticas.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'vrutal_sync') then
    create role vrutal_sync login bypassrls;
    raise notice 'Rol vrutal_sync creado. PON SU CONTRASEÑA: alter role vrutal_sync password ''...'';';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1 · TABLAS
-- En orden de dependencia: una tabla no se crea antes que aquella a la que
-- apunta por clave foránea.
-- ---------------------------------------------------------------------

-- Usuarios del cliente. El rol sale de `app_metadata`, que solo escribe Vrutal
-- con la clave de servicio (D-04): `user_metadata` lo puede escribir el propio
-- usuario desde el navegador, así que no vale para decidir permisos.
create table public.profiles (
  id uuid not null,
  full_name text,
  role text default 'client_user'::text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_role_check check ((role = any (array['client_admin'::text, 'client_manager'::text, 'client_user'::text])))
);

-- Los agentes desplegados en este cliente. Metadatos, NUNCA el prompt (D-02):
-- el prompt vive solo en Vrutal1st y se inyecta en ejecución.
create table public.specialists (
  id uuid default gen_random_uuid() not null,
  job_role_key text not null,
  job_role_version integer not null,
  display_name text not null,
  phase text default '01_AUDIT'::text not null,
  autonomy_level text default 'draft_for_approval'::text not null,
  risk_level text not null,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint specialists_pkey primary key (id),
  constraint specialists_job_role_key_key unique (job_role_key),
  constraint specialists_autonomy_level_check check ((autonomy_level = any (array['read_only'::text, 'draft_for_approval'::text, 'auto_low_risk'::text, 'full_autonomy'::text]))),
  constraint specialists_phase_check check ((phase = any (array['01_AUDIT'::text, '02_PILOT'::text, '03_LIMITED'::text, '04_SUPERVISED'::text, '05_LIVE'::text]))),
  constraint specialists_risk_level_check check ((risk_level = any (array['low'::text, 'medium'::text, 'medium_high'::text, 'high'::text]))),
  constraint specialists_status_check check ((status = any (array['active'::text, 'paused'::text, 'retired'::text])))
);

-- Espejo de solo lectura del catálogo de Vrutal, poblado por el sync.
-- PROPIEDAD DE VRUTAL: el cliente NO los lee nunca, ni por pantalla ni por API
-- (decidido 2026-10-06). Siguen aquí solo por las claves foráneas de
-- `approval_requests` y `run_log`. Comprobación:
--   has_table_privilege('authenticated','public.catalog_flow_ro','select') = false
create table public.catalog_report_ro (
  report_key text not null,
  specialist_id uuid not null,
  name text not null,
  description text,
  status text default 'enabled'::text not null,
  synced_at timestamp with time zone default now() not null,
  constraint catalog_report_ro_pkey primary key (report_key),
  constraint catalog_report_ro_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint catalog_report_ro_status_check check ((status = any (array['enabled'::text, 'disabled'::text])))
);

create table public.catalog_kpi_ro (
  report_key text not null,
  kpi_key text not null,
  specialist_id uuid not null,
  name text not null,
  explanation text not null,
  status text default 'enabled'::text not null,
  synced_at timestamp with time zone default now() not null,
  constraint catalog_kpi_ro_pkey primary key (report_key, kpi_key),
  constraint catalog_kpi_ro_report_key_fkey foreign key (report_key) references catalog_report_ro(report_key),
  constraint catalog_kpi_ro_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint catalog_kpi_ro_status_check check ((status = any (array['enabled'::text, 'disabled'::text])))
);

create table public.catalog_flow_ro (
  task_key text not null,
  specialist_id uuid not null,
  name text not null,
  description text,
  autonomy_level text not null,
  status text default 'enabled'::text not null,
  synced_at timestamp with time zone default now() not null,
  task_version integer default 1 not null,
  constraint catalog_flow_ro_pkey primary key (specialist_id, task_key),
  constraint catalog_flow_ro_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint catalog_flow_ro_autonomy_level_check check ((autonomy_level = any (array['suggest'::text, 'execute_with_approval'::text, 'autonomous'::text]))),
  constraint catalog_flow_ro_status_check check ((status = any (array['enabled'::text, 'disabled'::text])))
);

-- Flujos esperando autorización. `resume_url` es el enlace que reanuda el flujo
-- de Activepieces y NO tiene GRANT para `authenticated`: quien lo leyera podría
-- reanudar un flujo sin decidir nada. Lo dispara `approval-decide` en servidor.
create table public.approval_requests (
  id uuid default gen_random_uuid() not null,
  specialist_id uuid not null,
  task_key text,
  payload jsonb,
  status text default 'pending'::text not null,
  requested_at timestamp with time zone default now() not null,
  decided_by uuid,
  decided_at timestamp with time zone,
  assigned_to uuid,
  requested_by uuid,
  resume_url text,
  item_decisions jsonb,
  constraint approval_requests_pkey primary key (id),
  constraint approval_requests_assigned_to_fkey foreign key (assigned_to) references profiles(id),
  constraint approval_requests_decided_by_fkey foreign key (decided_by) references profiles(id),
  constraint approval_requests_requested_by_fkey foreign key (requested_by) references profiles(id),
  constraint approval_requests_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint approval_requests_specialist_task_fkey foreign key (specialist_id, task_key) references catalog_flow_ro(specialist_id, task_key),
  constraint approval_requests_status_check check ((status = any (array['pending'::text, 'approved'::text, 'rejected'::text])))
);

-- Delegación por vacaciones: por agente O por flujo concreto, nunca "todo" (D-14).
create table public.approval_delegation (
  id uuid default gen_random_uuid() not null,
  delegator_profile_id uuid not null,
  delegate_profile_id uuid not null,
  specialist_id uuid,
  flow_task_key text,
  starts_on date not null,
  ends_on date not null,
  revoked_at timestamp with time zone,
  revoked_by uuid,
  created_at timestamp with time zone default now() not null,
  constraint approval_delegation_pkey primary key (id),
  constraint approval_delegation_delegate_profile_id_fkey foreign key (delegate_profile_id) references profiles(id),
  constraint approval_delegation_delegator_profile_id_fkey foreign key (delegator_profile_id) references profiles(id),
  constraint approval_delegation_revoked_by_fkey foreign key (revoked_by) references profiles(id),
  constraint approval_delegation_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint approval_delegation_check check ((ends_on >= starts_on)),
  constraint approval_delegation_check1 check ((((specialist_id is not null) and (flow_task_key is null)) or ((specialist_id is null) and (flow_task_key is not null))))
);

create table public.conversations (
  id uuid default gen_random_uuid() not null,
  title text,
  started_by uuid not null,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint conversations_pkey primary key (id),
  constraint conversations_started_by_fkey foreign key (started_by) references profiles(id),
  constraint conversations_status_check check ((status = any (array['open'::text, 'closed'::text])))
);

create table public.conversation_participants (
  conversation_id uuid not null,
  specialist_id uuid not null,
  joined_at timestamp with time zone default now() not null,
  constraint conversation_participants_pkey primary key (conversation_id, specialist_id),
  constraint conversation_participants_conversation_id_fkey foreign key (conversation_id) references conversations(id) on delete cascade,
  constraint conversation_participants_specialist_id_fkey foreign key (specialist_id) references specialists(id)
);

create table public.messages (
  id bigint generated by default as identity,
  conversation_id uuid not null,
  sender_type text not null,
  sender_profile_id uuid,
  sender_specialist_id uuid,
  content text not null,
  created_at timestamp with time zone default now() not null,
  constraint messages_pkey primary key (id),
  constraint messages_conversation_id_fkey foreign key (conversation_id) references conversations(id) on delete cascade,
  constraint messages_sender_profile_id_fkey foreign key (sender_profile_id) references profiles(id),
  constraint messages_sender_specialist_id_fkey foreign key (sender_specialist_id) references specialists(id),
  constraint messages_check check ((((sender_type = 'user'::text) and (sender_profile_id is not null) and (sender_specialist_id is null)) or ((sender_type = 'specialist'::text) and (sender_specialist_id is not null) and (sender_profile_id is null)))),
  constraint messages_sender_type_check check ((sender_type = any (array['user'::text, 'specialist'::text])))
);

create table public.audit_log (
  id bigint generated by default as identity,
  actor_type text not null,
  actor_label text,
  action text not null,
  target_table text,
  target_id text,
  reason text,
  created_at timestamp with time zone default now() not null,
  constraint audit_log_pkey primary key (id),
  constraint audit_log_actor_type_check check ((actor_type = any (array['client_user'::text, 'vrutal_support'::text, 'system'::text])))
);

-- Conexiones a las APIs del cliente. El secreto real está en el Vault; aquí solo
-- su puntero. `secret_ref` SIN GRANT para `authenticated`: el Admin ve el estado,
-- no la clave. Único camino de lectura: `integration_read_secret()`, service_role.
create table public.integrations (
  id uuid default gen_random_uuid() not null,
  integration_type text not null,
  provider text not null,
  config jsonb,
  secret_ref text,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  validated_at timestamp with time zone,
  last_error text,
  constraint integrations_pkey primary key (id),
  constraint integrations_status_check check ((status = any (array['active'::text, 'paused'::text, 'revoked'::text])))
);

-- Qué sistemas puede configurar este cliente. Lo decide su Stack en Vrutal1st y
-- lo empuja el sync (migración 028).
create table public.integration_provider_ro (
  provider_key text not null,
  system_category text not null,
  system_name text not null,
  synced_at timestamp with time zone default now() not null,
  constraint integration_provider_ro_pkey primary key (provider_key)
);

create table public.knowledge_update_request (
  id uuid default gen_random_uuid() not null,
  specialist_id uuid not null,
  requested_by uuid not null,
  message text,
  attachment_url text,
  status text default 'pending'::text not null,
  approval_request_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint knowledge_update_request_pkey primary key (id),
  constraint knowledge_update_request_approval_request_id_fkey foreign key (approval_request_id) references approval_requests(id),
  constraint knowledge_update_request_requested_by_fkey foreign key (requested_by) references profiles(id),
  constraint knowledge_update_request_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint knowledge_update_request_status_check check ((status = any (array['pending'::text, 'approved'::text, 'rejected'::text, 'applied'::text])))
);

create table public.report_output (
  id uuid default gen_random_uuid() not null,
  specialist_id uuid not null,
  report_key text not null,
  file_type text not null,
  storage_path text,
  external_url text,
  generated_at timestamp with time zone default now() not null,
  generated_for uuid,
  constraint report_output_pkey primary key (id),
  constraint report_output_generated_for_fkey foreign key (generated_for) references profiles(id),
  constraint report_output_report_key_fkey foreign key (report_key) references catalog_report_ro(report_key),
  constraint report_output_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint report_output_check check (((file_type = 'web'::text) or (storage_path is not null))),
  constraint report_output_file_type_check check ((file_type = any (array['xlsx'::text, 'docx'::text, 'pdf'::text, 'web'::text])))
);

create table public.run_log (
  id bigint generated by default as identity,
  specialist_id uuid not null,
  task_key text,
  provider text not null,
  model_name text not null,
  tokens_in integer,
  tokens_out integer,
  cost_usd numeric(12,6),
  created_at timestamp with time zone default now() not null,
  constraint run_log_pkey primary key (id),
  constraint run_log_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint run_log_specialist_task_fkey foreign key (specialist_id, task_key) references catalog_flow_ro(specialist_id, task_key)
);

-- Rastro de los cambios de `cambios/` aplicados en esta base. Operación de
-- Vrutal: el cliente no la lee. La rellena aplicar-cambios-cliente.sh.
create table public.schema_change_log (
  filename text not null,
  sha256 text not null,
  applied_at timestamp with time zone default now() not null,
  applied_by text not null,
  source text default 'script'::text not null,
  notes text,
  constraint schema_change_log_pkey primary key (filename),
  constraint schema_change_log_source_check check ((source = any (array['script'::text, 'retro'::text, 'manual'::text])))
);

create table public.sdr_lead_intake (
  id uuid default gen_random_uuid() not null,
  specialist_id uuid not null,
  full_name text,
  email text not null,
  company text,
  phone text,
  message text,
  page_url text,
  utm jsonb,
  status text default 'received'::text not null,
  validation_errors jsonb,
  matched_contact_ref text,
  discard_reason text,
  reported_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint sdr_lead_intake_pkey primary key (id),
  constraint sdr_lead_intake_specialist_id_fkey foreign key (specialist_id) references specialists(id),
  constraint sdr_lead_intake_status_check check ((status = any (array['received'::text, 'validated'::text, 'discarded'::text, 'duplicate'::text, 'promoted'::text])))
);

create table public.user_specialist_access (
  profile_id uuid not null,
  specialist_id uuid not null,
  enabled_at timestamp with time zone default now() not null,
  enabled_by uuid,
  constraint user_specialist_access_pkey primary key (profile_id, specialist_id),
  constraint user_specialist_access_enabled_by_fkey foreign key (enabled_by) references profiles(id),
  constraint user_specialist_access_profile_id_fkey foreign key (profile_id) references profiles(id),
  constraint user_specialist_access_specialist_id_fkey foreign key (specialist_id) references specialists(id)
);

-- Personalización por usuario (D-12): el KPI se liga a un reporte concreto.
create table public.user_report_subscription (
  profile_id uuid not null,
  specialist_id uuid not null,
  report_key text not null,
  is_active boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  constraint user_report_subscription_pkey primary key (profile_id, specialist_id, report_key),
  constraint user_report_subscription_profile_id_fkey foreign key (profile_id) references profiles(id),
  constraint user_report_subscription_report_key_fkey foreign key (report_key) references catalog_report_ro(report_key),
  constraint user_report_subscription_specialist_id_fkey foreign key (specialist_id) references specialists(id)
);

create table public.user_kpi_selection (
  profile_id uuid not null,
  specialist_id uuid not null,
  report_key text not null,
  kpi_key text not null,
  is_active boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  constraint user_kpi_selection_pkey primary key (profile_id, specialist_id, report_key, kpi_key),
  constraint user_kpi_selection_profile_id_fkey foreign key (profile_id) references profiles(id),
  constraint user_kpi_selection_report_kpi_fkey foreign key (report_key, kpi_key) references catalog_kpi_ro(report_key, kpi_key),
  constraint user_kpi_selection_specialist_id_fkey foreign key (specialist_id) references specialists(id)
);

-- Entregables del especialista. Sustituyen a las pestañas de Google Sheets:
-- `work_collection` son las pestañas y sus columnas (las define Vrutal),
-- `work_item` las filas (propuesta → aprobada/rechazada).
create table public.work_collection (
  id uuid default gen_random_uuid() not null,
  specialist_id uuid not null,
  collection_key text not null,
  label text not null,
  position integer default 0 not null,
  approvable boolean default false not null,
  columns jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  constraint work_collection_pkey primary key (id),
  constraint work_collection_id_specialist_id_key unique (id, specialist_id),
  constraint work_collection_specialist_id_collection_key_key unique (specialist_id, collection_key),
  constraint work_collection_specialist_id_fkey foreign key (specialist_id) references specialists(id) on delete cascade,
  constraint work_collection_columns_check check ((jsonb_typeof(columns) = 'array'::text))
);

create table public.work_item (
  id uuid default gen_random_uuid() not null,
  collection_id uuid not null,
  specialist_id uuid not null,
  data jsonb not null,
  status text not null,
  run_ref text,
  created_at timestamp with time zone default now() not null,
  decided_by uuid,
  decided_at timestamp with time zone,
  constraint work_item_pkey primary key (id),
  constraint work_item_collection_id_specialist_id_fkey foreign key (collection_id, specialist_id) references work_collection(id, specialist_id) on delete cascade,
  constraint work_item_decided_by_fkey foreign key (decided_by) references profiles(id),
  constraint work_item_data_check check ((jsonb_typeof(data) = 'object'::text)),
  constraint work_item_data_check1 check ((octet_length((data)::text) <= 20000)),
  constraint work_item_status_check check ((status = any (array['proposed'::text, 'approved'::text, 'rejected'::text, 'delivered'::text])))
);

-- ---------------------------------------------------------------------
-- 2 · FUNCIONES
-- Todas con `security definer` y `search_path` fijado: sin fijarlo, un esquema
-- en el search_path del llamante podría suplantar a `public`.
-- ---------------------------------------------------------------------

create or replace function public.my_role()
 returns text language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select role from public.profiles where id = auth.uid() and is_active
$function$;

create or replace function public.is_active_user()
 returns boolean language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false)
$function$;

create or replace function public.is_admin()
 returns boolean language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.my_role() = 'client_admin', false)
$function$;

create or replace function public.is_manager()
 returns boolean language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.my_role() = 'client_manager', false)
$function$;

create or replace function public.is_admin_or_manager()
 returns boolean language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(public.my_role() in ('client_admin', 'client_manager'), false)
$function$;

create or replace function public.can_access_specialist(p_specialist uuid)
 returns boolean language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select public.is_active_user() and (
    public.is_admin()
    or exists (
      select 1 from public.user_specialist_access a
       where a.profile_id = auth.uid() and a.specialist_id = p_specialist
    )
  )
$function$;

create or replace function public.has_approval_delegation(p_specialist_id uuid, p_task_key text)
 returns boolean language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.approval_delegation d
    where d.delegate_profile_id = auth.uid()
      and d.revoked_at is null
      and current_date between d.starts_on and d.ends_on
      and (d.specialist_id = p_specialist_id or d.flow_task_key = p_task_key)
  )
$function$;

-- Alta de usuario. El rol sale de `app_metadata` (D-04), que solo escribe Vrutal
-- con la clave de servicio; `user_metadata` lo escribe el usuario y no sirve.
-- OJO: en la base viva de Vrutal-labs esta función solo aceptaba
-- 'client_admin'/'client_user' — el rol Manager se añadió el 2026-10-06 y nadie
-- actualizó aquí, así que invitar a un Manager lo dejaba como usuario normal.
-- Corregido en esta plantilla (2026-10-15); en Vrutal-labs va su propio cambio.
create or replace function public.handle_new_user()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_role text;
  v_full_name text;
begin
  v_role := new.raw_app_meta_data ->> 'role';
  v_full_name := new.raw_user_meta_data ->> 'full_name';

  insert into public.profiles (id, role, full_name)
    values (
      new.id,
      case when v_role in ('client_admin','client_manager','client_user') then v_role else 'client_user' end,
      v_full_name
    );
  return new;
end $function$;

-- Activar/desactivar cuentas: solo el Admin sobre otra persona, o Vrutal
-- (sin usuario en la sesión). Nadie se desactiva a sí mismo.
create or replace function public.guard_profile_is_active()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.is_active is distinct from old.is_active then
    if auth.uid() is null then
      return new;
    end if;
    if new.id = auth.uid() then
      raise exception 'No puedes activar ni desactivar tu propia cuenta.' using errcode = '42501';
    end if;
    if not public.is_admin() then
      raise exception 'Solo un administrador puede activar o desactivar cuentas.' using errcode = '42501';
    end if;
  end if;
  return new;
end $function$;

create or replace function public.prevent_self_role_escalation()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.role is distinct from old.role and new.id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol.';
  end if;
  return new;
end $function$;

create or replace function public.set_updated_at()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  new.updated_at = now();
  return new;
end $function$;

create or replace function public.default_assigned_to()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.assigned_to is null then
    new.assigned_to := new.requested_by;
  end if;
  return new;
end $function$;

create or replace function public.validate_flow_task_key()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.flow_task_key is not null
     and not exists (select 1 from public.catalog_flow_ro where task_key = new.flow_task_key) then
    raise exception 'flow_task_key % no existe en catalog_flow_ro', new.flow_task_key;
  end if;
  return new;
end $function$;

create or replace function public.prevent_orphan_flow_delegation()
 returns trigger language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if exists (
    select 1 from public.approval_delegation
    where flow_task_key = old.task_key and revoked_at is null and ends_on >= current_date
  ) then
    raise exception 'no se puede borrar catalog_flow_ro.% con delegaciones activas que la referencian', old.task_key;
  end if;
  return old;
end $function$;

-- Único camino para decidir una aprobación. Fija `decided_by`/`decided_at` en
-- SERVIDOR: con un UPDATE directo, quien tuviera la aprobación asignada podría
-- falsearlos. Solo actúa sobre filas `pending`.
create or replace function public.decide_approval(p_id uuid, p_approve boolean, p_item_decisions jsonb default null::jsonb)
 returns boolean language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_puede boolean;
  v_filas int;
begin
  if not public.is_active_user() then
    raise exception 'Cuenta no activa.' using errcode = '42501';
  end if;

  select (
    public.is_admin()
    or a.assigned_to = auth.uid()
    or exists (
      select 1 from public.approval_delegation d
       where d.delegate_profile_id = auth.uid()
         and d.revoked_at is null
         and current_date between d.starts_on and d.ends_on
         and (d.specialist_id = a.specialist_id or d.flow_task_key = a.task_key)
    )
  )
  into v_puede
  from public.approval_requests a
  where a.id = p_id;

  if coalesce(v_puede, false) = false then
    raise exception 'No puedes decidir esta aprobación.' using errcode = '42501';
  end if;

  update public.approval_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(),
         decided_at = now(),
         item_decisions = coalesce(p_item_decisions, item_decisions)
   where id = p_id
     and status = 'pending';

  get diagnostics v_filas = row_count;
  return v_filas = 1;
end $function$;

-- Guardar una clave de integración en el Vault. Único camino de escritura.
create or replace function public.integration_store_secret(p_provider text, p_type text, p_secret text)
 returns uuid language plpgsql security definer
 set search_path to 'public', 'vault', 'pg_temp'
as $function$
declare
  v_id uuid;
  v_ref text;
  v_secret uuid;
begin
  if coalesce(trim(p_provider), '') = '' or coalesce(trim(p_type), '') = '' or coalesce(p_secret, '') = '' then
    raise exception 'Faltan datos de la integración.' using errcode = '22023';
  end if;

  select id, secret_ref into v_id, v_ref from public.integrations where provider = p_provider for update;

  if v_id is not null and v_ref is not null then
    perform vault.update_secret(secret_id := v_ref::uuid, new_secret := p_secret);
    update public.integrations
       set validated_at = now(), last_error = null,
           status = case when status = 'revoked' then 'active' else status end
     where id = v_id;
    return v_id;
  end if;

  v_secret := vault.create_secret(p_secret, 'integration:' || p_provider, 'Clave de la integración ' || p_provider);
  if v_id is not null then
    update public.integrations
       set secret_ref = v_secret::text, validated_at = now(), last_error = null, status = 'active'
     where id = v_id;
    return v_id;
  end if;

  insert into public.integrations (integration_type, provider, secret_ref, status, validated_at)
  values (p_type, p_provider, v_secret::text, 'active', now())
  returning id into v_id;
  return v_id;
end $function$;

-- Único camino de LECTURA de un secreto. Solo `service_role` (ver GRANTs abajo).
create or replace function public.integration_read_secret(p_provider text)
 returns text language plpgsql security definer
 set search_path to 'public', 'vault', 'pg_temp'
as $function$
declare v_ref text; v_secret text;
begin
  select secret_ref into v_ref from public.integrations where provider = p_provider;
  if v_ref is null then
    return null;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_ref::uuid;
  return v_secret;
end $function$;

create or replace function public.guard_integration_status()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.status is distinct from old.status and auth.uid() is not null then
    if old.status = 'revoked' then
      raise exception 'Una integración revocada se reconecta con una clave nueva.' using errcode = '42501';
    end if;
    if new.status not in ('active', 'paused') then
      raise exception 'Estado no permitido.' using errcode = '42501';
    end if;
  end if;
  return new;
end $function$;

-- Los flujos entregan filas con esto (solo service_role).
create or replace function public.work_items_add(p_specialist uuid, p_collection text, p_rows jsonb, p_run_ref text default null::text)
 returns integer language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
end $function$;

-- La app decide entregables con esto. Comprueba el acceso EN SERVIDOR.
create or replace function public.decide_work_items(p_ids uuid[], p_decision text)
 returns integer language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
end $function$;

create or replace function public.team_members()
 returns table(id uuid, full_name text, email text, role text, is_active boolean, created_at timestamp with time zone, last_sign_in_at timestamp with time zone)
 language sql stable security definer
 set search_path to 'public', 'auth', 'pg_temp'
as $function$
  select p.id, p.full_name, u.email::text, p.role, p.is_active, p.created_at, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at
$function$;

create or replace function public.usage_summary(p_from timestamp with time zone, p_to timestamp with time zone)
 returns table(specialist_id uuid, runs bigint, tokens_in bigint, tokens_out bigint, cost_usd numeric)
 language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select r.specialist_id,
         count(*),
         coalesce(sum(r.tokens_in), 0)::bigint,
         coalesce(sum(r.tokens_out), 0)::bigint,
         coalesce(sum(r.cost_usd), 0)
  from public.run_log r
  where public.is_admin()
    and r.created_at >= p_from
    and r.created_at < p_to
  group by r.specialist_id
$function$;

-- ---------------------------------------------------------------------
-- 3 · VISTA
-- Respeta las políticas de quien consulta (no es security definer).
-- ---------------------------------------------------------------------
create or replace view public.work_collection_overview as
 select c.id,
    c.specialist_id,
    c.collection_key,
    c.label,
    c."position",
    c.approvable,
    c.columns,
    count(i.id) filter (where (i.status = 'proposed'::text)) as proposed,
    count(i.id) filter (where (i.status = 'approved'::text)) as approved,
    count(i.id) filter (where (i.status = 'rejected'::text)) as rejected,
    count(i.id) filter (where (i.status = 'delivered'::text)) as delivered
   from (work_collection c
     left join work_item i on ((i.collection_id = c.id)))
  group by c.id;

-- ---------------------------------------------------------------------
-- 4 · TRIGGERS
-- ---------------------------------------------------------------------
create trigger trg_validate_flow_task_key before insert or update on public.approval_delegation for each row execute function validate_flow_task_key();
create trigger trg_default_assigned_to before insert on public.approval_requests for each row execute function default_assigned_to();
create trigger trg_prevent_orphan_flow_delegation before delete on public.catalog_flow_ro for each row execute function prevent_orphan_flow_delegation();
create trigger trg_guard_integration_status before update on public.integrations for each row execute function guard_integration_status();
create trigger trg_guard_profile_is_active before update on public.profiles for each row execute function guard_profile_is_active();
create trigger trg_prevent_self_role_escalation before update on public.profiles for each row execute function prevent_self_role_escalation();
create trigger trg_specialists_updated_at before update on public.specialists for each row execute function set_updated_at();

-- El trigger de alta vive en `auth.users`, no en `public`. Hace falta ser
-- `supabase_admin` o `postgres` para crearlo.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 5 · ÍNDICES (los de clave primaria y única ya van en las tablas)
-- ---------------------------------------------------------------------
create unique index integrations_provider_key on public.integrations using btree (provider);
create index work_item_collection_status_idx on public.work_item using btree (collection_id, status, created_at desc);

-- ---------------------------------------------------------------------
-- 6 · RLS
-- Toda tabla con RLS. Sin políticas permisivas, deniega por defecto.
-- ---------------------------------------------------------------------
alter table public.approval_delegation enable row level security;
alter table public.approval_requests enable row level security;
alter table public.audit_log enable row level security;
alter table public.catalog_flow_ro enable row level security;
alter table public.catalog_kpi_ro enable row level security;
alter table public.catalog_report_ro enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.conversations enable row level security;
alter table public.integration_provider_ro enable row level security;
alter table public.integrations enable row level security;
alter table public.knowledge_update_request enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;
alter table public.report_output enable row level security;
alter table public.run_log enable row level security;
alter table public.schema_change_log enable row level security;
alter table public.sdr_lead_intake enable row level security;
alter table public.specialists enable row level security;
alter table public.user_kpi_selection enable row level security;
alter table public.user_report_subscription enable row level security;
alter table public.user_specialist_access enable row level security;
alter table public.work_collection enable row level security;
alter table public.work_item enable row level security;

-- ---------------------------------------------------------------------
-- 7 · POLÍTICAS
-- `active_only` es RESTRICTIVA: se suma a las demás, no las sustituye. Una
-- cuenta desactivada pierde el acceso a los datos EN SERVIDOR, no solo en la
-- interfaz. Toda tabla nueva necesita la suya: no se hereda (regla 5).
-- ---------------------------------------------------------------------
create policy active_only on public.approval_delegation as restrictive for all to authenticated using (is_active_user());
create policy delegate_can_view on public.approval_delegation for select to public using ((delegate_profile_id = auth.uid()));
create policy own_or_admin_manage on public.approval_delegation for all to public using (((delegator_profile_id = auth.uid()) or is_admin())) with check (((delegator_profile_id = auth.uid()) or is_admin()));

create policy active_only on public.approval_requests as restrictive for all to authenticated using (is_active_user());
create policy approvals_decide_admin on public.approval_requests for update to authenticated using (is_admin()) with check (is_admin());
create policy approvals_select_admin on public.approval_requests for select to authenticated using (is_admin());
create policy decide_own_or_delegated on public.approval_requests for update to public using (((assigned_to = auth.uid()) or has_approval_delegation(specialist_id, task_key))) with check (true);
create policy select_own_or_delegated on public.approval_requests for select to public using (((assigned_to = auth.uid()) or has_approval_delegation(specialist_id, task_key)));

create policy active_only on public.audit_log as restrictive for all to authenticated using (is_active_user());
create policy audit_select_admin on public.audit_log for select to authenticated using (is_admin());

-- Las tres `catalog_*_ro`: la política existe, pero `authenticated` NO tiene
-- GRANT de tabla (ver sección 8), así que el cliente no las lee. Las lee el sync.
create policy active_only on public.catalog_flow_ro as restrictive for all to authenticated using (is_active_user());
create policy read_all_authenticated on public.catalog_flow_ro for select to public using (true);
create policy active_only on public.catalog_kpi_ro as restrictive for all to authenticated using (is_active_user());
create policy read_all_authenticated on public.catalog_kpi_ro for select to public using (true);
create policy active_only on public.catalog_report_ro as restrictive for all to authenticated using (is_active_user());
create policy read_all_authenticated on public.catalog_report_ro for select to public using (true);

create policy active_only on public.conversation_participants as restrictive for all to authenticated using (is_active_user());
create policy participants_select on public.conversation_participants for select to authenticated using (true);

create policy active_only on public.conversations as restrictive for all to authenticated using (is_active_user());
create policy conversations_insert_self on public.conversations for insert to authenticated with check ((started_by = auth.uid()));
create policy conversations_select_participant on public.conversations for select to authenticated using (((started_by = auth.uid()) or is_admin()));

create policy read_all_authenticated on public.integration_provider_ro for select to public using (true);

create policy active_only on public.integrations as restrictive for all to authenticated using (is_active_user());
create policy integrations_admin_only on public.integrations for all to authenticated using (is_admin()) with check (is_admin());

create policy active_only on public.knowledge_update_request as restrictive for all to authenticated using (is_active_user());
create policy admin_manage on public.knowledge_update_request for all to public using (is_admin()) with check (is_admin());
create policy own_manage on public.knowledge_update_request for all to public using ((requested_by = auth.uid())) with check ((requested_by = auth.uid()));

create policy active_only on public.messages as restrictive for all to authenticated using (is_active_user());
create policy messages_insert_own on public.messages for insert to authenticated with check (((sender_type = 'user'::text) and (sender_profile_id = auth.uid())));
create policy messages_select_in_own_conversation on public.messages for select to authenticated using ((exists ( select 1
   from conversations c
  where ((c.id = messages.conversation_id) and ((c.started_by = auth.uid()) or is_admin())))));

-- `active_only_select` deja ver tu propia fila aunque estés desactivado: si no,
-- la app no podría ni decirte por qué no entras.
create policy active_only_select on public.profiles as restrictive for select to authenticated using ((is_active_user() or (id = auth.uid())));
create policy active_only_update on public.profiles as restrictive for update to authenticated using (is_active_user());
create policy profiles_select_team on public.profiles for select to authenticated using (true);
create policy profiles_update_self_or_admin on public.profiles for update to authenticated using (((id = auth.uid()) or is_admin()));

create policy active_only on public.report_output as restrictive for all to authenticated using (is_active_user());
create policy select_own_or_admin on public.report_output for select to public using (((generated_for = auth.uid()) or is_admin()));

create policy active_only on public.run_log as restrictive for all to authenticated using (is_active_user());
create policy run_log_select_admin on public.run_log for select to authenticated using (is_admin());

create policy active_only on public.sdr_lead_intake as restrictive for all to authenticated using (is_active_user());

create policy active_only on public.specialists as restrictive for all to authenticated using (is_active_user());
create policy specialists_select_team on public.specialists for select to authenticated using (true);

create policy active_only on public.user_kpi_selection as restrictive for all to authenticated using (is_active_user());
create policy admin_view on public.user_kpi_selection for select to public using (is_admin());
create policy own_manage on public.user_kpi_selection for all to public using ((profile_id = auth.uid())) with check ((profile_id = auth.uid()));

create policy active_only on public.user_report_subscription as restrictive for all to authenticated using (is_active_user());
create policy admin_view on public.user_report_subscription for select to public using (is_admin());
create policy own_manage on public.user_report_subscription for all to public using ((profile_id = auth.uid())) with check ((profile_id = auth.uid()));

create policy active_only on public.user_specialist_access as restrictive for all to authenticated using (is_active_user());
create policy admin_manage on public.user_specialist_access for all to public using (is_admin()) with check (is_admin());
create policy self_select on public.user_specialist_access for select to public using ((profile_id = auth.uid()));

create policy active_only on public.work_collection as restrictive for all to authenticated using (is_active_user());
create policy work_collection_select on public.work_collection for select to authenticated using (can_access_specialist(specialist_id));

create policy active_only on public.work_item as restrictive for all to authenticated using (is_active_user());
create policy work_item_select on public.work_item for select to authenticated using (can_access_specialist(specialist_id));

-- ---------------------------------------------------------------------
-- 8 · PERMISOS DE TABLA
-- Partir de cero: Supabase regala permisos que nadie pidió. Sin GRANT, una
-- política no sirve de nada — y con GRANT y sin política, tampoco.
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Lo que el cliente puede tocar
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, update, delete on public.conversation_participants to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, delete on public.user_specialist_access to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.run_log to authenticated;
grant select on public.specialists to authenticated;
grant select on public.integration_provider_ro to authenticated;
grant select on public.work_collection to authenticated;
grant select on public.work_item to authenticated;
grant select on public.work_collection_overview to authenticated;

-- `integrations`: ningún GRANT para `authenticated`. El Admin lee el estado y
-- pausa/reanuda a través de las Edge Functions, nunca `secret_ref`.
-- `approval_requests` y `approval_delegation`: tampoco. Se decide con
-- `decide_approval()`, que fija quién decidió en servidor.
-- `report_output`, `user_kpi_selection`, `user_report_subscription`,
-- `knowledge_update_request`: tienen política pero NO GRANT. Se conceden al
-- construir su pantalla, con su revisión.
-- `catalog_*_ro` y `schema_change_log`: nunca. Son de Vrutal.

-- Todo para los procesos de servidor
grant all on all tables in schema public to service_role;

-- El sync: solo lo que escribe. SIN DELETE sobre `specialists` a propósito —
-- retirar uno es `status='retired'`; borrarlo dejaría huérfanas sus aprobaciones
-- y sus entregables.
grant select, insert, update, delete on public.catalog_flow_ro to vrutal_sync;
grant select, insert, update, delete on public.catalog_report_ro to vrutal_sync;
grant select, insert, update, delete on public.catalog_kpi_ro to vrutal_sync;
grant select, insert, update, delete on public.integration_provider_ro to vrutal_sync;
grant select, insert, update on public.specialists to vrutal_sync;
grant select on public.integrations to vrutal_sync;

-- Funciones: solo las que la app llama con sesión de usuario.
revoke all on function public.integration_read_secret(text) from anon, authenticated;
revoke all on function public.integration_store_secret(text, text, text) from anon, authenticated;
revoke all on function public.work_items_add(uuid, text, jsonb, text) from anon, authenticated;
grant execute on function public.decide_approval(uuid, boolean, jsonb) to authenticated;
grant execute on function public.decide_work_items(uuid[], text) to authenticated;
grant execute on function public.team_members() to authenticated;
grant execute on function public.usage_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_admin_or_manager() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.my_role() to authenticated;
grant execute on function public.can_access_specialist(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9 · PRIVILEGIOS POR DEFECTO
-- Sin esto, la próxima tabla que alguien cree nace otra vez con TRUNCATE,
-- REFERENCES, TRIGGER y MAINTAIN para el cliente. Es la causa raíz que se
-- encontró el 2026-10-15: no basta con revocar en las tablas de hoy.
-- ---------------------------------------------------------------------
alter default privileges in schema public
  revoke truncate, references, trigger, maintain
  on tables from anon, authenticated;

-- ---------------------------------------------------------------------
-- 10 · COMPROBACIÓN FINAL
-- Tiene que dar: catalogo_cerrado = false, tablas = 23.
-- ---------------------------------------------------------------------
select
  has_table_privilege('authenticated', 'public.catalog_flow_ro', 'select') as catalogo_cerrado,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r') as tablas,
  (select count(distinct table_name) from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon','authenticated')
      and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')) as permisos_regalados;
