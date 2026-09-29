-- =====================================================================
-- VRUTAL OS · Migración 001
-- Biblioteca de tareas (tronco) + despliegue por tenant (ramas)
--
-- Se monta SOBRE el esquema existente. No modifica ni una tabla actual.
--   public.tenants          → es el cliente. No se duplica.
--   public.profiles         → es la persona. Aprobadores y propietarios.
--   public.tenant_members   → es la pertenencia. Base de toda la RLS.
--   public.roles            → es RBAC. NO se toca. Nada que ver con job_role.
--   public.external_references → detecta el stack del cliente sin preguntarlo.
-- =====================================================================

create extension if not exists vector;      -- deduplicación semántica
create extension if not exists pgcrypto;    -- gen_random_uuid()

create schema if not exists catalog;        -- TRONCO · global, sin tenant_id
create schema if not exists deployment;     -- RAMA   · tenant-scoped, con RLS

comment on schema catalog is
  'Biblioteca canónica de Vrutal. NO lleva tenant_id: es la misma para todos.
   Escritura reservada a platform_admin. Un tenant nunca edita el tronco.';
comment on schema deployment is
  'Instancias por cliente. Toda tabla lleva tenant_id y RLS obligatoria.';


-- =====================================================================
-- 0 · HELPERS DE SEGURIDAD
-- =====================================================================

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_platform_admin or p.is_superadmin
       from public.profiles p
      where p.id = auth.uid()
        and p.deleted_at is null),
    false);
$$;

create or replace function public.is_tenant_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.tenant_members tm
                  where tm.tenant_id = p_tenant
                    and tm.profile_id = auth.uid());
$$;


-- =====================================================================
-- 1 · TAXONOMÍA
-- =====================================================================

create table catalog.domain (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,          -- 'SALES'
  name          text not null,
  description   text,
  created_at    timestamptz not null default now()
);

create table catalog.process (
  id            uuid primary key default gen_random_uuid(),
  domain_id     uuid not null references catalog.domain(id) on delete restrict,
  key           text unique not null,          -- 'SALES.ACCOUNT_DISCOVERY'
  name          text not null,                 -- 'Descubrimiento de cuentas'
  sequence_ord  int  not null default 0,
  description   text,
  created_at    timestamptz not null default now()
);


-- =====================================================================
-- 2 · LA BIBLIOTECA DE TAREAS
-- =====================================================================

create type catalog.automation_pattern as enum (
  'HUMAN','PROMPT','LLM','RULES','SCRIPT','API','ML','WORKFLOW','RAG','AGENT','MULTI_AGENT');

create type catalog.risk_level  as enum ('LOW','MEDIUM','HIGH','CRITICAL');
create type catalog.item_status as enum ('DRAFT','VALIDATED','DEPRECATED');
create type catalog.autonomy    as enum ('NONE','SUGGEST','EXECUTE_WITH_APPROVAL','AUTONOMOUS');

create table catalog.task (
  id                  uuid primary key default gen_random_uuid(),
  code                text unique not null,      -- 'TSK-000431' · opaco, inmutable
  slug                text unique not null,      -- 'verificar-email-contacto'
  name                text not null,             -- VERBO + OBJETO [+ CUALIFICADOR]
  description         text not null,
  process_id          uuid not null references catalog.process(id),

  -- Contrato de ejecución
  trigger_type        text check (trigger_type in ('event','schedule','request','continuous')),
  input_spec          jsonb not null default '{}'::jsonb,
  output_spec         jsonb not null default '{}'::jsonb,

  -- Automatización
  primary_pattern     catalog.automation_pattern not null,
  automation_min      numeric(4,3) check (automation_min between 0 and 1),
  automation_max      numeric(4,3) check (automation_max between 0 and 1),
  human_only          boolean not null default false,
  suggested_autonomy  catalog.autonomy not null default 'NONE',

  -- Riesgo y control
  risk                catalog.risk_level not null,
  reversible          boolean not null,
  requires_approval   boolean not null default false,
  touches_budget      boolean not null default false,
  customer_facing     boolean not null default false,
  compliance_flags    text[] not null default '{}',   -- {'GDPR','DNC','OPT_OUT'}

  -- Economía (base del ROI)
  avg_human_minutes   numeric,
  default_freq_year   numeric,
  economics_source    text not null default 'ESTIMATED'
                      check (economics_source in ('ESTIMATED','MEASURED')),

  -- Gobierno
  status              catalog.item_status not null default 'DRAFT',
  version             int  not null default 1,
  owner_profile_id    uuid references public.profiles(id),
  embedding           vector(1536),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint task_auto_range check (automation_max >= automation_min),
  constraint task_human_zero check (not human_only or automation_max = 0),
  -- Ninguna tarea de riesgo alto nace sugiriendo autonomía total
  constraint task_risk_autonomy check (
    risk not in ('HIGH','CRITICAL') or suggested_autonomy <> 'AUTONOMOUS')
);

create index task_process_idx on catalog.task (process_id);
create index task_status_idx  on catalog.task (status);
create index task_embed_idx   on catalog.task using hnsw (embedding vector_cosine_ops);

-- Versionado: nada se sobrescribe en silencio
create table catalog.task_version_history (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references catalog.task(id) on delete cascade,
  version       int  not null,
  snapshot      jsonb not null,
  change_reason text not null,
  changed_by    uuid references public.profiles(id),
  changed_at    timestamptz not null default now(),
  unique (task_id, version)
);

create table catalog.task_dependency (
  task_id         uuid not null references catalog.task(id) on delete cascade,
  depends_on      uuid not null references catalog.task(id) on delete restrict,
  dependency_type text not null check (dependency_type in ('hard','soft','data')),
  primary key (task_id, depends_on),
  constraint no_self_dep check (task_id <> depends_on)
);


-- =====================================================================
-- 3 · COMPONENTES · lo que realmente se construye
-- =====================================================================

create table catalog.component (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,       -- 'CMP-PY-EMAILVERIFY-01'
  name             text not null,
  comp_type        text not null check (comp_type in
                     ('agent','workflow','script','api','prompt','rag_index','model')),
  runtime          text,                       -- 'python'|'javascript'|'n8n'|'sql'|'llm'
  repo_ref         text,
  owner_profile_id uuid references public.profiles(id),   -- todo tiene propietario
  maturity         text not null default 'prototype'
                   check (maturity in ('prototype','tested','production')),
  unit_cost_est    numeric,
  created_at       timestamptz not null default now()
);

create table catalog.task_component (
  task_id       uuid not null references catalog.task(id) on delete cascade,
  component_id  uuid not null references catalog.component(id) on delete restrict,
  role_in_task  text not null default 'executor'
                check (role_in_task in ('executor','validator','enricher','fallback')),
  is_default    boolean not null default true,
  applies_when  jsonb not null default '{}'::jsonb,  -- {"system":"hubspot"} variante por stack
  primary key (task_id, component_id, role_in_task)
);

-- Herramientas expuestas a los agentes. El equivalente de public.permissions,
-- pero para especialistas en lugar de para personas.
create table catalog.tool (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,          -- 'send_email','book_meeting','create_lead'
  description   text,
  is_mutating   boolean not null default false,
  risk          catalog.risk_level not null default 'MEDIUM'
);

create table catalog.task_tool (
  task_id  uuid not null references catalog.task(id) on delete cascade,
  tool_id  uuid not null references catalog.tool(id),
  primary key (task_id, tool_id)
);


-- =====================================================================
-- 4 · PUESTOS DE TRABAJO
--     OJO: catalog.job_role NO es public.roles.
--     public.roles = permisos de aplicación (RBAC).
--     catalog.job_role = ocupación humana de referencia (SDR, Data Entry…).
-- =====================================================================

create table catalog.job_role (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,           -- 'ROLE-004'
  name         text not null,                  -- 'Sales Development Representative'
  agent_name   text,                           -- 'Sales Development Operations Agent'
  domain_id    uuid references catalog.domain(id),
  family       text,                           -- 'Revenue Operations'
  seniority    text check (seniority in ('operativo','mando','direccion')),
  status       catalog.item_status not null default 'DRAFT',
  created_at   timestamptz not null default now()
);

create table catalog.job_role_task (
  job_role_id      uuid not null references catalog.job_role(id) on delete cascade,
  task_id          uuid not null references catalog.task(id) on delete restrict,
  criticality      text not null default 'standard'
                   check (criticality in ('core','standard','peripheral')),
  time_weight_pct  numeric(5,2) not null check (time_weight_pct > 0 and time_weight_pct <= 100),
  primary key (job_role_id, task_id)
);

-- Regla dura: los pesos de un rol suman 100. Un rol cuyos pesos no suman 100
-- es un rol listado, no auditado. Se comprueba en CI, no como trigger,
-- para permitir estados intermedios durante la edición.
create view catalog.v_job_role_weight_check as
select jr.code, jr.name, coalesce(sum(jrt.time_weight_pct),0) as total_pct
from catalog.job_role jr
left join catalog.job_role_task jrt on jrt.job_role_id = jr.id
group by jr.code, jr.name
having coalesce(sum(jrt.time_weight_pct),0) <> 100;


-- =====================================================================
-- 5 · REGLAS DE ACTIVACIÓN
-- =====================================================================

create table catalog.task_activation_rule (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references catalog.task(id) on delete cascade,
  attr_key     text not null,        -- 'industry','size_employees','system','has_ecommerce'
  operator     text not null check (operator in ('=','!=','>','<','>=','<=','IN','EXISTS','NOT_EXISTS')),
  attr_value   text,                 -- para IN: valores separados por '|'
  logic_group  int not null default 1  -- AND dentro del grupo · OR entre grupos
);

comment on table catalog.task_activation_rule is
  'Una tarea SIN reglas aplica a todos los tenants. Con reglas, aplica si algún
   logic_group se cumple por completo.';


-- =====================================================================
-- 6 · PERFIL DEL TENANT
-- =====================================================================

create table deployment.tenant_attribute (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  attr_key     text not null,
  attr_value   text not null,
  source       text not null default 'AUDIT'
               check (source in ('AUDIT','DETECTED','DECLARED')),
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, attr_key)
);

-- Perfil unificado: columnas de tenants + atributos de auditoría +
-- stack DETECTADO automáticamente desde external_references.
create or replace view deployment.v_tenant_profile as
  select t.id as tenant_id, 'industry'::text as attr_key, t.industry as attr_value
    from public.tenants t where t.industry is not null
  union all
  select t.id, 'size_employees', t.size_employees::text
    from public.tenants t where t.size_employees is not null
  union all
  select t.id, 'country', t.country
    from public.tenants t where t.country is not null
  union all
  select t.id, 'region', t.region
    from public.tenants t where t.region is not null
  union all
  -- El stack no se pregunta: se deduce de los sistemas ya conectados
  select distinct er.tenant_id, 'system', er.system
    from public.external_references er
  union all
  select a.tenant_id, a.attr_key, a.attr_value
    from deployment.tenant_attribute a;


-- =====================================================================
-- 7 · MOTOR DE REGLAS
-- =====================================================================

create or replace function deployment.rule_matches(
  p_tenant uuid, p_key text, p_op text, p_val text)
returns boolean language sql stable set search_path = deployment, public as $$
  select case p_op
    when 'EXISTS' then
      exists (select 1 from deployment.v_tenant_profile v
               where v.tenant_id = p_tenant and v.attr_key = p_key)
    when 'NOT_EXISTS' then
      not exists (select 1 from deployment.v_tenant_profile v
                   where v.tenant_id = p_tenant and v.attr_key = p_key)
    when '=' then
      exists (select 1 from deployment.v_tenant_profile v
               where v.tenant_id = p_tenant and v.attr_key = p_key and v.attr_value = p_val)
    when '!=' then
      not exists (select 1 from deployment.v_tenant_profile v
                   where v.tenant_id = p_tenant and v.attr_key = p_key and v.attr_value = p_val)
    when 'IN' then
      exists (select 1 from deployment.v_tenant_profile v
               where v.tenant_id = p_tenant and v.attr_key = p_key
                 and v.attr_value = any(string_to_array(p_val,'|')))
    when '>' then
      exists (select 1 from deployment.v_tenant_profile v
               where v.tenant_id = p_tenant and v.attr_key = p_key
                 and v.attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                 and v.attr_value::numeric > p_val::numeric)
    when '>=' then
      exists (select 1 from deployment.v_tenant_profile v
               where v.tenant_id = p_tenant and v.attr_key = p_key
                 and v.attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                 and v.attr_value::numeric >= p_val::numeric)
    when '<' then
      exists (select 1 from deployment.v_tenant_profile v
               where v.tenant_id = p_tenant and v.attr_key = p_key
                 and v.attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                 and v.attr_value::numeric < p_val::numeric)
    when '<=' then
      exists (select 1 from deployment.v_tenant_profile v
               where v.tenant_id = p_tenant and v.attr_key = p_key
                 and v.attr_value ~ '^-?[0-9]+(\.[0-9]+)?$'
                 and v.attr_value::numeric <= p_val::numeric)
    else false
  end;
$$;

-- Propone, NUNCA activa. La transición PROPOSED → APPROVED es humana.
create or replace function deployment.propose_tasks(p_tenant uuid)
returns table (task_id uuid, task_code text, task_name text, risk catalog.risk_level)
language sql stable set search_path = deployment, catalog, public as $$
  select t.id, t.code, t.name, t.risk
  from catalog.task t
  where t.status = 'VALIDATED'
    and ( not exists (select 1 from catalog.task_activation_rule r where r.task_id = t.id)
          or exists (
            select 1 from catalog.task_activation_rule r
             where r.task_id = t.id
             group by r.logic_group
            having bool_and(deployment.rule_matches(p_tenant, r.attr_key, r.operator, r.attr_value))
          ));
$$;


-- =====================================================================
-- 8 · DESPLIEGUE POR TENANT
-- =====================================================================

create type deployment.deploy_status as enum
  ('PROPOSED','APPROVED','TESTING','ACTIVE','DEFERRED','EXCLUDED','HUMAN_RETAINED');

create table deployment.specialist (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  job_role_id    uuid not null references catalog.job_role(id),
  display_name   text not null,
  phase          text not null default '01_AUDIT'
                 check (phase in ('01_AUDIT','02_REPORT','03_DESIGN','04_TEST','05_LIVE','RETIRED')),
  manager_profile_id uuid references public.profiles(id),
  deployed_at    date,
  created_at     timestamptz not null default now(),
  unique (tenant_id, job_role_id)
);

create table deployment.specialist_task (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  task_id           uuid not null references catalog.task(id),
  specialist_id     uuid references deployment.specialist(id) on delete set null,

  status            deployment.deploy_status not null default 'PROPOSED',
  autonomy_level    catalog.autonomy not null default 'NONE',
  task_version      int not null,                 -- ancla a la versión del tronco
  component_bind    jsonb not null default '{}'::jsonb,

  actual_freq_year  numeric,                      -- medido en auditoría
  actual_minutes    numeric,
  approver_profile_id uuid references public.profiles(id),
  exclusion_reason  text,                         -- obligatorio si EXCLUDED/HUMAN_RETAINED
  deployed_at       date,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (tenant_id, task_id),
  constraint reason_required check (
    status not in ('EXCLUDED','HUMAN_RETAINED') or exclusion_reason is not null)
);

create index st_tenant_idx on deployment.specialist_task (tenant_id, status);

-- Guardrail duro: ninguna tarea de riesgo alto llega a AUTONOMOUS sin aprobador.
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
-- 9 · HUMAN-IN-THE-LOOP Y AUDITORÍA
--     Tu ROLE-004 exige audit_log obligatorio. No existe todavía.
-- =====================================================================

create table deployment.approval_request (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  specialist_task_id  uuid not null references deployment.specialist_task(id) on delete cascade,
  payload             jsonb not null,          -- qué propone hacer el especialista
  status              text not null default 'PENDING'
                      check (status in ('PENDING','APPROVED','REJECTED','EXPIRED')),
  requested_at        timestamptz not null default now(),
  resolved_at         timestamptz,
  resolved_by         uuid references public.profiles(id),
  resolution_note     text
);

create index ar_pending_idx on deployment.approval_request (tenant_id, status)
  where status = 'PENDING';

create table deployment.run_log (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  specialist_task_id  uuid references deployment.specialist_task(id) on delete set null,
  component_id        uuid references catalog.component(id),
  run_at              timestamptz not null default now(),
  trigger_source      text,
  input_ref           jsonb,
  output_ref          jsonb,
  confidence          numeric,
  human_approval_id   uuid references deployment.approval_request(id),
  tokens_in           int,
  tokens_out          int,
  estimated_cost      numeric,
  compliance_checked  boolean not null default false,
  dnc_checked         boolean not null default false,
  result              text not null check (result in ('SUCCESS','ESCALATED','ERROR','BLOCKED')),
  error_detail        text
);

create index run_log_tenant_idx on deployment.run_log (tenant_id, run_at desc);


-- =====================================================================
-- 10 · VISTAS DERIVADAS · ROI, blast radius, automatización real
-- =====================================================================

create or replace view deployment.v_task_roi as
select
  st.tenant_id,
  st.task_id,
  t.code, t.name, t.primary_pattern, t.risk,
  st.status, st.autonomy_level,
  coalesce(st.actual_freq_year, t.default_freq_year)  as freq_year,
  coalesce(st.actual_minutes,  t.avg_human_minutes)   as minutes,
  coalesce(st.actual_freq_year, t.default_freq_year)
    * coalesce(st.actual_minutes, t.avg_human_minutes) / 60.0        as horas_ano,
  coalesce(st.actual_freq_year, t.default_freq_year)
    * coalesce(st.actual_minutes, t.avg_human_minutes) / 60.0
    * (t.automation_min + t.automation_max) / 2.0                    as horas_recuperables,
  (st.actual_freq_year is not null) as economics_measured,
  (st.task_version < t.version)     as version_debt
from deployment.specialist_task st
join catalog.task t on t.id = st.task_id;

-- Automatización del rol PONDERADA POR TIEMPO, no por número de tareas.
create or replace view catalog.v_job_role_automation as
select jr.code, jr.name,
       round(sum(jrt.time_weight_pct * t.automation_min) / 100, 3) as auto_min,
       round(sum(jrt.time_weight_pct * t.automation_max) / 100, 3) as auto_max,
       count(*) as task_count
from catalog.job_role jr
join catalog.job_role_task jrt on jrt.job_role_id = jr.id
join catalog.task t on t.id = jrt.task_id
group by jr.code, jr.name;

-- Radio de propagación: cuántas tareas caen si esta falla.
create or replace view catalog.v_task_blast_radius as
with recursive downstream as (
  select depends_on as root, task_id as affected from catalog.task_dependency
  union
  select d.root, td.task_id
    from downstream d
    join catalog.task_dependency td on td.depends_on = d.affected
)
select t.code, t.name, t.risk, count(distinct d.affected) as downstream_tasks
from catalog.task t
left join downstream d on d.root = t.id
group by t.code, t.name, t.risk;

-- Apalancamiento: cuántas tareas cubre cada componente construido.
create or replace view catalog.v_component_leverage as
select c.code, c.name, c.comp_type, c.maturity, count(tc.task_id) as tasks_covered
from catalog.component c
left join catalog.task_component tc on tc.component_id = c.id
group by c.code, c.name, c.comp_type, c.maturity
order by tasks_covered desc;


-- =====================================================================
-- 11 · RLS · aquí es donde tronco y rama se separan de verdad
-- =====================================================================

-- CATÁLOGO: lectura para cualquier autenticado, escritura solo platform_admin.
-- Esto hace IMPOSIBLE, a nivel de motor, que un cliente edite el tronco.
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
                    using (public.is_platform_admin()) with check (public.is_platform_admin())', tbl, tbl);
  end loop;
end $$;

-- DESPLIEGUE: aislamiento por tenant vía tenant_members.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'tenant_attribute','specialist','specialist_task','approval_request','run_log']
  loop
    execute format('alter table deployment.%I enable row level security', tbl);
    execute format('create policy %I_tenant on deployment.%I for all to authenticated
                    using (public.is_tenant_member(tenant_id))
                    with check (public.is_tenant_member(tenant_id))', tbl, tbl);
  end loop;
end $$;

grant usage on schema catalog, deployment to authenticated, service_role;
grant select on all tables in schema catalog to authenticated;
grant all    on all tables in schema deployment to authenticated;

-- RECUERDA: en Supabase → Settings → API → Exposed schemas,
-- añadir 'catalog' y 'deployment' para que PostgREST los sirva.
-- Alternativa si prefieres no exponerlos: crear vistas en public.
