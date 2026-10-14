-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 002
-- Catálogo (plantillas) + Despliegue (instancias) + Capa conversacional
--
-- SUSTITUYE al borrador anterior. Ejecutar después de 001 (schema fase 1).
--
-- Mapeo con las tres instancias ya definidas:
--   catalog.*                → ESPECIALISTA · PLANTILLA      (consola Vrutal)
--   deployment.specialist*   → ESPECIALISTA · INSTANCIA      (Admin Cliente)
--   deployment.conversation* → ESPECIALISTA · ENDPOINT CHAT  (Usuario cliente)
--
-- Resuelve tres puntos que quedaron abiertos:
--   · el primitivo de interacción (conversación/mensaje vs ejecución)
--   · la fuente de verdad de coste (run_log, todo lo demás es rollup)
--   · si superadmin es rol RBAC o flag, y cómo se audita el acceso de soporte
-- =====================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

create schema if not exists catalog;
create schema if not exists deployment;

comment on schema catalog is
  'TRONCO. Plantillas de especialista y biblioteca de tareas. Sin tenant_id:
   es idéntico para todos. Escritura solo para catalog admin.';
comment on schema deployment is
  'RAMAS. Instancias por tenant. Toda tabla lleva tenant_id y RLS.';


-- =====================================================================
-- 0 · IDENTIDAD Y ACCESO
--     Decisión: is_platform_admin y is_superadmin NO son sinónimos.
-- =====================================================================

-- Autoridad ordinaria sobre el catálogo. Uso diario del equipo de Vrutal.
create or replace function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_platform_admin
                     from public.profiles p
                    where p.id = auth.uid() and p.deleted_at is null), false);
$$;

-- Break-glass. NO concede por sí solo escritura de catálogo ni lectura de tenants.
-- Se reserva para operaciones de plataforma y debe exigir step-up MFA en la app.
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_superadmin
                     from public.profiles p
                    where p.id = auth.uid() and p.deleted_at is null), false);
$$;

-- Sesión de soporte: así entra Vrutal en un tenant, y queda registrado.
create table deployment.support_access_session (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id),
  reason        text not null,
  mfa_verified  boolean not null default false,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '4 hours',
  ended_at      timestamptz,
  constraint support_needs_mfa check (mfa_verified)
);

create index sas_active_idx on deployment.support_access_session (tenant_id, profile_id)
  where ended_at is null;

comment on table deployment.support_access_session is
  'Vrutal no tiene acceso permanente a los datos de un tenant. Abre una sesión
   con motivo y MFA, caduca sola, y queda auditada. Sin sesión activa, la RLS
   trata a un admin de Vrutal como a cualquier extraño.';

-- Acceso efectivo a los datos de un tenant.
create or replace function public.has_tenant_access(p_tenant uuid)
returns boolean language sql stable security definer
set search_path = public, deployment as $$
  select exists (select 1 from public.tenant_members tm
                  where tm.tenant_id = p_tenant and tm.profile_id = auth.uid())
      or exists (select 1 from deployment.support_access_session s
                  where s.tenant_id = p_tenant
                    and s.profile_id = auth.uid()
                    and s.ended_at is null
                    and s.expires_at > now());
$$;


-- =====================================================================
-- 1 · TAXONOMÍA Y BIBLIOTECA DE TAREAS
-- =====================================================================

create table catalog.domain (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table catalog.process (
  id            uuid primary key default gen_random_uuid(),
  domain_id     uuid not null references catalog.domain(id),
  key           text unique not null,
  name          text not null,
  sequence_ord  int not null default 0,
  created_at    timestamptz not null default now()
);

create type catalog.automation_pattern as enum (
  'HUMAN','PROMPT','LLM','RULES','SCRIPT','API','ML','WORKFLOW','RAG','AGENT','MULTI_AGENT');
create type catalog.risk_level  as enum ('LOW','MEDIUM','HIGH','CRITICAL');
create type catalog.item_status as enum ('DRAFT','VALIDATED','DEPRECATED');
create type catalog.autonomy    as enum ('NONE','SUGGEST','EXECUTE_WITH_APPROVAL','AUTONOMOUS');

create table catalog.task (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null,
  slug               text unique not null,
  name               text not null,
  description        text not null,
  process_id         uuid not null references catalog.process(id),

  trigger_type       text check (trigger_type in ('event','schedule','request','continuous')),
  input_spec         jsonb not null default '{}'::jsonb,
  output_spec        jsonb not null default '{}'::jsonb,

  primary_pattern    catalog.automation_pattern not null,
  automation_min     numeric(4,3) check (automation_min between 0 and 1),
  automation_max     numeric(4,3) check (automation_max between 0 and 1),
  human_only         boolean not null default false,
  suggested_autonomy catalog.autonomy not null default 'NONE',

  -- Gobernanza LAB 07: los campos que la crítica marcó como ausentes
  risk               catalog.risk_level not null,
  reversible         boolean not null,
  requires_approval  boolean not null default false,
  touches_budget     boolean not null default false,
  customer_facing    boolean not null default false,
  never_does         text[] not null default '{}',
  success_metric     text,
  compliance_flags   text[] not null default '{}',

  avg_human_minutes  numeric,
  default_freq_year  numeric,
  economics_source   text not null default 'ESTIMATED'
                     check (economics_source in ('ESTIMATED','MEASURED')),

  status             catalog.item_status not null default 'DRAFT',
  version            int not null default 1,
  owner_profile_id   uuid references public.profiles(id),
  embedding          vector(1536),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint task_auto_range   check (automation_max >= automation_min),
  constraint task_human_zero   check (not human_only or automation_max = 0),
  constraint task_risk_autonomy check (
    risk not in ('HIGH','CRITICAL') or suggested_autonomy <> 'AUTONOMOUS')
);

create index task_process_idx on catalog.task (process_id);
create index task_embed_idx   on catalog.task using hnsw (embedding vector_cosine_ops);

create table catalog.task_version_history (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references catalog.task(id) on delete cascade,
  version       int not null,
  snapshot      jsonb not null,
  change_reason text not null,
  changed_by    uuid references public.profiles(id),
  changed_at    timestamptz not null default now(),
  unique (task_id, version)
);

create table catalog.task_dependency (
  task_id         uuid not null references catalog.task(id) on delete cascade,
  depends_on      uuid not null references catalog.task(id),
  dependency_type text not null check (dependency_type in ('hard','soft','data')),
  primary key (task_id, depends_on),
  constraint no_self_dep check (task_id <> depends_on)
);


-- =====================================================================
-- 2 · COMPONENTES Y HERRAMIENTAS
-- =====================================================================

create table catalog.component (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  name             text not null,
  comp_type        text not null check (comp_type in
                     ('agent','workflow','script','api','prompt','rag_index','model')),
  runtime          text,                    -- 'python'|'javascript'|'n8n'|'sql'|'llm'
  repo_ref         text,
  owner_profile_id uuid references public.profiles(id),
  maturity         text not null default 'prototype'
                   check (maturity in ('prototype','tested','production')),
  unit_cost_est    numeric,
  created_at       timestamptz not null default now()
);

create table catalog.task_component (
  task_id      uuid not null references catalog.task(id) on delete cascade,
  component_id uuid not null references catalog.component(id),
  role_in_task text not null default 'executor'
               check (role_in_task in ('executor','validator','enricher','fallback')),
  is_default   boolean not null default true,
  applies_when jsonb not null default '{}'::jsonb,
  primary key (task_id, component_id, role_in_task)
);

-- public.permissions gobierna a las personas. Esto gobierna a los especialistas.
create table catalog.tool (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,       -- 'send_email','book_meeting','create_lead'
  description text,
  is_mutating boolean not null default false,
  risk        catalog.risk_level not null default 'MEDIUM'
);

create table catalog.task_tool (
  task_id uuid not null references catalog.task(id) on delete cascade,
  tool_id uuid not null references catalog.tool(id),
  primary key (task_id, tool_id)
);


-- =====================================================================
-- 3 · PLANTILLA DE ESPECIALISTA
--     catalog.job_role NO es public.roles.
--     public.roles = RBAC de personas. Esto = ocupación / plantilla de rama.
-- =====================================================================

create table catalog.job_role (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,        -- 'ROLE-004'
  name       text not null,               -- 'Sales Development Representative'
  agent_name text,                        -- 'Sales Development Operations Agent'
  domain_id  uuid references catalog.domain(id),
  family     text,
  seniority  text check (seniority in ('operativo','mando','direccion')),
  status     catalog.item_status not null default 'DRAFT',
  created_at timestamptz not null default now()
);

create table catalog.job_role_task (
  job_role_id     uuid not null references catalog.job_role(id) on delete cascade,
  task_id         uuid not null references catalog.task(id),
  criticality     text not null default 'standard'
                  check (criticality in ('core','standard','peripheral')),
  time_weight_pct numeric(5,2) not null check (time_weight_pct > 0 and time_weight_pct <= 100),
  primary key (job_role_id, task_id)
);

create view catalog.v_job_role_weight_check as
select jr.code, jr.name, coalesce(sum(jrt.time_weight_pct),0) as total_pct
from catalog.job_role jr
left join catalog.job_role_task jrt on jrt.job_role_id = jr.id
group by jr.code, jr.name
having coalesce(sum(jrt.time_weight_pct),0) <> 100;

create table catalog.task_activation_rule (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references catalog.task(id) on delete cascade,
  attr_key    text not null,
  operator    text not null check (operator in ('=','!=','>','<','>=','<=','IN','EXISTS','NOT_EXISTS')),
  attr_value  text,
  logic_group int not null default 1
);


-- =====================================================================
-- 4 · PERFIL DEL TENANT Y STACK REAL DEL CLIENTE
--
--  CORRECCIÓN IMPORTANTE:
--  public.external_references mapea cada tenant contra el HubSpot y el Holded
--  DE VRUTAL — es el enlace de la ficha de empresa, de la que Vrutal OS es
--  maestro. NO describe las herramientas que usa el cliente.
--  El stack del cliente vive aquí y solo aquí.
-- =====================================================================

create table deployment.tenant_integration (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  system            text not null,          -- 'hubspot','salesforce','sap','shopify'
  category          text not null check (category in
                      ('crm','erp','ecommerce','ads','email','helpdesk','analytics','other')),
  status            text not null default 'connected'
                    check (status in ('connected','error','revoked')),
  n8n_credential_ref text,                  -- referencia, NUNCA el secreto
  connected_at      timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (tenant_id, system)
);

comment on column deployment.tenant_integration.n8n_credential_ref is
  'Solo referencia. Los secretos viven en Supabase Vault y se usan desde Edge Functions.';

create table deployment.tenant_attribute (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  attr_key   text not null,
  attr_value text not null,
  source     text not null default 'AUDIT' check (source in ('AUDIT','DETECTED','DECLARED')),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, attr_key)
);

create or replace view deployment.v_tenant_profile
with (security_invoker = on) as
  select t.id as tenant_id, 'industry'::text as attr_key, t.industry as attr_value
    from public.tenants t where t.industry is not null and t.deleted_at is null
  union all
  select t.id, 'size_employees', t.size_employees::text
    from public.tenants t where t.size_employees is not null and t.deleted_at is null
  union all
  select t.id, 'country', t.country
    from public.tenants t where t.country is not null and t.deleted_at is null
  union all
  -- Stack real del cliente. NO se lee de external_references.
  select ti.tenant_id, 'system', ti.system
    from deployment.tenant_integration ti
   where ti.status = 'connected' and ti.deleted_at is null
  union all
  select ti.tenant_id, 'has_' || ti.category, 'true'
    from deployment.tenant_integration ti
   where ti.status = 'connected' and ti.deleted_at is null
  union all
  select a.tenant_id, a.attr_key, a.attr_value
    from deployment.tenant_attribute a;


-- =====================================================================
-- 5 · MOTOR DE REGLAS · propone, nunca activa
-- =====================================================================

create or replace function deployment.rule_matches(
  p_tenant uuid, p_key text, p_op text, p_val text)
returns boolean language sql stable set search_path = deployment, public as $$
  with p as (select attr_value from deployment.v_tenant_profile
              where tenant_id = p_tenant and attr_key = p_key)
  select case p_op
    when 'EXISTS'     then exists (select 1 from p)
    when 'NOT_EXISTS' then not exists (select 1 from p)
    when '='          then exists (select 1 from p where attr_value = p_val)
    when '!='         then not exists (select 1 from p where attr_value = p_val)
    when 'IN'         then exists (select 1 from p where attr_value = any(string_to_array(p_val,'|')))
    when '>'          then exists (select 1 from p where attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                                     and attr_value::numeric >  p_val::numeric)
    when '>='         then exists (select 1 from p where attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                                     and attr_value::numeric >= p_val::numeric)
    when '<'          then exists (select 1 from p where attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                                     and attr_value::numeric <  p_val::numeric)
    when '<='         then exists (select 1 from p where attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                                     and attr_value::numeric <= p_val::numeric)
    else false end;
$$;

create or replace function deployment.propose_tasks(p_tenant uuid)
returns table (task_id uuid, task_code text, task_name text, risk catalog.risk_level)
language sql stable set search_path = deployment, catalog, public as $$
  select t.id, t.code, t.name, t.risk
  from catalog.task t
  where t.status = 'VALIDATED'
    and ( not exists (select 1 from catalog.task_activation_rule r where r.task_id = t.id)
          or exists (select 1 from catalog.task_activation_rule r
                      where r.task_id = t.id
                      group by r.logic_group
                     having bool_and(deployment.rule_matches(p_tenant, r.attr_key, r.operator, r.attr_value))));
$$;


-- =====================================================================
-- 6 · INSTANCIA DESPLEGADA
-- =====================================================================

create type deployment.deploy_status as enum
  ('PROPOSED','APPROVED','TESTING','ACTIVE','DEFERRED','EXCLUDED','HUMAN_RETAINED');

create table deployment.specialist (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  job_role_id        uuid not null references catalog.job_role(id),
  display_name       text not null,
  phase              text not null default '01_AUDIT'
                     check (phase in ('01_AUDIT','02_REPORT','03_DESIGN','04_TEST','05_LIVE','RETIRED')),
  manager_profile_id uuid references public.profiles(id),
  is_chat_enabled    boolean not null default false,   -- visible en la ventana de usuario
  system_prompt_ref  text,                             -- referencia al playbook compilado
  deployed_at        date,
  created_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (tenant_id, job_role_id)
);

comment on table deployment.specialist is
  'Unidad de facturación. LAB 10 fija coste fijo por especialista, no por plan:
   una fila activa aquí es una línea de suscripción.';

create table deployment.specialist_task (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  task_id             uuid not null references catalog.task(id),
  specialist_id       uuid references deployment.specialist(id) on delete set null,
  status              deployment.deploy_status not null default 'PROPOSED',
  autonomy_level      catalog.autonomy not null default 'NONE',
  task_version        int not null,
  component_bind      jsonb not null default '{}'::jsonb,
  actual_freq_year    numeric,
  actual_minutes      numeric,
  approver_profile_id uuid references public.profiles(id),
  exclusion_reason    text,
  deployed_at         date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (tenant_id, task_id),
  constraint reason_required check (
    status not in ('EXCLUDED','HUMAN_RETAINED') or exclusion_reason is not null)
);

create index st_tenant_idx on deployment.specialist_task (tenant_id, status);

create or replace function deployment.enforce_autonomy_guardrail()
returns trigger language plpgsql set search_path = catalog, deployment, public as $$
declare v_risk catalog.risk_level; v_approval boolean;
begin
  select t.risk, t.requires_approval into v_risk, v_approval
    from catalog.task t where t.id = new.task_id;
  if new.autonomy_level = 'AUTONOMOUS' and v_risk in ('HIGH','CRITICAL') then
    raise exception 'Tarea de riesgo % no puede desplegarse como AUTONOMOUS', v_risk;
  end if;
  if v_approval and new.status = 'ACTIVE' and new.approver_profile_id is null then
    raise exception 'Esta tarea requiere aprobación: falta approver_profile_id';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_autonomy_guardrail
  before insert or update on deployment.specialist_task
  for each row execute function deployment.enforce_autonomy_guardrail();


-- =====================================================================
-- 7 · CAPA CONVERSACIONAL
--     Resuelve el desencaje chat vs ejecución.
--     Un mensaje es el primitivo de INTERACCIÓN.
--     Una run es el primitivo de EJECUCIÓN.
--     Un mensaje dispara 0..N runs. Una run programada no tiene mensaje.
-- =====================================================================

create table deployment.conversation (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  specialist_id   uuid not null references deployment.specialist(id) on delete restrict,
  opened_by       uuid not null references public.profiles(id),
  title           text,
  status          text not null default 'open' check (status in ('open','closed','archived')),
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  deleted_at      timestamptz
);

create index conv_tenant_idx on deployment.conversation (tenant_id, last_message_at desc);

create table deployment.message (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references deployment.conversation(id) on delete cascade,
  author_kind     text not null check (author_kind in ('user','specialist','system')),
  profile_id      uuid references public.profiles(id),   -- null si author_kind <> 'user'
  content         text not null,
  attachments     jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  constraint msg_author check (
    (author_kind = 'user' and profile_id is not null) or
    (author_kind <> 'user' and profile_id is null))
);

create index msg_conv_idx on deployment.message (conversation_id, created_at);

comment on table deployment.message is
  'No lleva tokens ni coste. Toda contabilidad vive en run_log, para que no
   existan dos cifras de coste que puedan divergir.';


-- =====================================================================
-- 8 · HUMAN-IN-THE-LOOP Y AUDITORÍA
--     run_log es la ÚNICA fuente de verdad de consumo y coste.
--     Cualquier tabla de costes futura es un rollup derivado. Si divergen,
--     gana run_log.
-- =====================================================================

create table deployment.approval_request (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  specialist_task_id uuid not null references deployment.specialist_task(id) on delete cascade,
  conversation_id    uuid references deployment.conversation(id) on delete set null,
  payload            jsonb not null,
  status             text not null default 'PENDING'
                     check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  requested_at       timestamptz not null default now(),
  expires_at         timestamptz,
  resolved_at        timestamptz,
  resolved_by        uuid references public.profiles(id),
  resolution_note    text
);

create index ar_pending_idx on deployment.approval_request (tenant_id, status)
  where status = 'PENDING';

create table deployment.run_log (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  specialist_task_id uuid references deployment.specialist_task(id) on delete set null,
  component_id       uuid references catalog.component(id),
  conversation_id    uuid references deployment.conversation(id) on delete set null,
  message_id         uuid references deployment.message(id) on delete set null,
  trigger_source     text not null check (trigger_source in ('chat','schedule','event','api','manual')),
  run_at             timestamptz not null default now(),
  input_ref          jsonb,
  output_ref         jsonb,
  confidence         numeric,
  approval_id        uuid references deployment.approval_request(id),
  model              text,
  tokens_in          int,
  tokens_out         int,
  estimated_cost     numeric,
  compliance_checked boolean not null default false,
  dnc_checked        boolean not null default false,
  result             text not null check (result in ('SUCCESS','ESCALATED','ERROR','BLOCKED')),
  error_detail       text,
  constraint chat_needs_message check (trigger_source <> 'chat' or message_id is not null)
);

create index run_tenant_idx on deployment.run_log (tenant_id, run_at desc);
create index run_msg_idx    on deployment.run_log (message_id);

-- Retención (UE). Ajustar el intervalo a lo que fije LAB 14.
create or replace function deployment.purge_run_log(p_keep interval default interval '24 months')
returns int language sql volatile set search_path = deployment as $$
  with d as (delete from deployment.run_log where run_at < now() - p_keep returning 1)
  select count(*)::int from d;
$$;


-- =====================================================================
-- 9 · VISTAS DERIVADAS
-- =====================================================================

create or replace view deployment.v_task_roi
with (security_invoker = on) as
select st.tenant_id, st.task_id, t.code, t.name, t.primary_pattern, t.risk,
       st.status, st.autonomy_level,
       coalesce(st.actual_freq_year, t.default_freq_year) as freq_year,
       coalesce(st.actual_minutes,  t.avg_human_minutes)  as minutes,
       coalesce(st.actual_freq_year, t.default_freq_year)
         * coalesce(st.actual_minutes, t.avg_human_minutes) / 60.0 as horas_ano,
       coalesce(st.actual_freq_year, t.default_freq_year)
         * coalesce(st.actual_minutes, t.avg_human_minutes) / 60.0
         * (t.automation_min + t.automation_max) / 2.0             as horas_recuperables,
       (st.actual_freq_year is not null) as economics_measured,
       (st.task_version < t.version)     as version_debt
from deployment.specialist_task st
join catalog.task t on t.id = st.task_id
where st.deleted_at is null;

-- Coste real, siempre desde run_log
create or replace view deployment.v_cost_daily
with (security_invoker = on) as
select tenant_id, date_trunc('day', run_at)::date as day,
       count(*) as runs,
       sum(tokens_in) as tokens_in, sum(tokens_out) as tokens_out,
       sum(estimated_cost) as cost,
       count(*) filter (where result = 'ESCALATED') as escalations,
       count(*) filter (where result = 'ERROR')     as errors
from deployment.run_log group by 1,2;

-- Automatización del rol ponderada por tiempo, no por número de tareas
create or replace view catalog.v_job_role_automation as
select jr.code, jr.name,
       round(sum(jrt.time_weight_pct * t.automation_min)/100, 3) as auto_min,
       round(sum(jrt.time_weight_pct * t.automation_max)/100, 3) as auto_max,
       count(*) as task_count
from catalog.job_role jr
join catalog.job_role_task jrt on jrt.job_role_id = jr.id
join catalog.task t on t.id = jrt.task_id
group by jr.code, jr.name;

create or replace view catalog.v_task_blast_radius as
with recursive downstream as (
  select depends_on as root, task_id as affected from catalog.task_dependency
  union
  select d.root, td.task_id from downstream d
    join catalog.task_dependency td on td.depends_on = d.affected)
select t.code, t.name, t.risk, count(distinct d.affected) as downstream_tasks
from catalog.task t left join downstream d on d.root = t.id
group by t.code, t.name, t.risk;

create or replace view catalog.v_component_leverage as
select c.code, c.name, c.comp_type, c.maturity, count(tc.task_id) as tasks_covered
from catalog.component c
left join catalog.task_component tc on tc.component_id = c.id
group by c.code, c.name, c.comp_type, c.maturity
order by tasks_covered desc;


-- =====================================================================
-- 10 · RLS
-- =====================================================================

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'domain','process','task','task_dependency','component','task_component',
    'tool','task_tool','job_role','job_role_task','task_activation_rule',
    'task_version_history']
  loop
    execute format('alter table catalog.%I enable row level security', tbl);
    execute format('create policy %I_read on catalog.%I for select to authenticated using (true)', tbl, tbl);
    execute format('create policy %I_write on catalog.%I for all to authenticated
                    using (public.is_catalog_admin()) with check (public.is_catalog_admin())', tbl, tbl);
  end loop;
end $$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'tenant_attribute','tenant_integration','specialist','specialist_task',
    'conversation','message','approval_request','run_log']
  loop
    execute format('alter table deployment.%I enable row level security', tbl);
    execute format('create policy %I_tenant on deployment.%I for all to authenticated
                    using (public.has_tenant_access(tenant_id))
                    with check (public.has_tenant_access(tenant_id))', tbl, tbl);
  end loop;
end $$;

-- La tabla de sesiones de soporte no puede usar has_tenant_access: sería recursiva.
alter table deployment.support_access_session enable row level security;

create policy sas_own on deployment.support_access_session for select to authenticated
  using (profile_id = auth.uid() or public.is_catalog_admin());

create policy sas_open on deployment.support_access_session for insert to authenticated
  with check (profile_id = auth.uid() and (public.is_catalog_admin() or public.is_superadmin()));

create policy sas_close on deployment.support_access_session for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant usage on schema catalog, deployment to authenticated, service_role;
grant select on all tables in schema catalog to authenticated;
grant all    on all tables in schema deployment to authenticated;

-- Supabase → Settings → API → Exposed schemas: añadir 'catalog' y 'deployment'.
