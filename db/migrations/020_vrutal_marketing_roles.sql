-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 020 · Roles de Marketing
--
-- Revisado por el founder (2026-10-01): aprobador único (founder); puntuar leads pasa a Ventas (SDR);
-- pujas con aprobación en v1; nurturing fuera de Contenido (rol futuro). Refleja la propuesta
-- docs/producto/MARKETING_roles_propuesta_v0.1.md
--
-- Qué hace:
--   1. Inserta 9 tareas internas nuevas (source 'internal', language 'es', status 'draft',
--      owner 'Vrutal Labs'), identificadas por source_code VRL-MKT-*.
--   2. Fija process_id / primary_pattern / risk y flags en 22 tareas O*NET/APQC reutilizadas,
--      SOLO si su process_id sigue a null (no pisa curación previa).
--   3. Inserta 3 job_role (version 1, status 'draft', domain 'MARKETING') y sus enlaces
--      job_role_task. Si la key ya existe, salta ese rol y sus enlaces.
--
-- Idempotente: se puede ejecutar dos veces sin duplicar nada.
-- Valores validados contra los checks de catalog.task / catalog.job_role / catalog.job_role_task
-- (consulta a pg_constraint del 2026-09-30).
-- =====================================================================

do $$
declare
  v_role uuid;
  n int;
begin
  -- -------------------------------------------------------------------
  -- 0. Precondiciones
  -- -------------------------------------------------------------------
  if not exists (select 1 from catalog.domain where id = 'MARKETING') then
    raise exception 'Falta el dominio MARKETING (migración 018)';
  end if;

  select count(*) into n from catalog.process
   where id in ('mkt_investigacion','mkt_planificacion','mkt_contenido',
                'mkt_distribucion','mkt_medicion','mkt_optimizacion');
  if n <> 6 then
    raise exception 'Faltan procesos de Marketing: hay % de 6', n;
  end if;

  select count(*) into n from catalog.task where id in (
    'e3683fbd-0f2a-45e9-9b07-a080893da37e','76b8db74-7f3c-4eb5-ab68-b7e94751edca',
    'a30e63b3-7d4a-40c0-a0c9-c21d7a992260','fe53d9ff-e6ca-49d0-b0e0-c7de25766e87',
    'efc89a4c-9020-4662-9b93-d43777479e17','d8d7a907-05e2-40ef-bd65-f279125a305c',
    'e396f429-70b6-42fa-8f77-7c0bff62eafa',
    'bfc4bb4a-95c1-4cad-b183-0aae2ae80cc2','bc76e5ff-8435-4a27-8708-2704283d8606',
    '5c8156e7-f500-4c1e-87f2-b8bf35101470','90508304-494e-49b6-921f-dc25abc564f9',
    '4764d180-41df-4e67-918c-75ecb15d5d82','c8e05c76-3aa5-420d-b564-1bb4e4a9b7b6',
    '70d6f988-e525-4857-ae60-5530230eaa52','36135c91-a555-42dd-9729-1abdca6867fa',
    '09246a13-3a2e-42cf-a5ab-1e5fadb9e182','3554482d-6392-4a69-bad1-93e1d5667b0f',
    'a3c5eea7-8e66-4ed5-93c6-c9d98abb1225','d634d4d1-30e4-4d3d-b128-0e31f32db02e',
    'ce7e2d75-c2c8-49ad-9567-66e1e824a45f','a99573f3-5cd1-4f7f-b180-5498ee9164f6',
    '77339ae2-4513-405b-93df-6b84ef8a8f33');
  if n <> 22 then
    raise exception 'Faltan tareas O*NET/APQC reutilizadas: hay % de 22', n;
  end if;

  -- -------------------------------------------------------------------
  -- 1. Tareas internas nuevas
  -- -------------------------------------------------------------------
  insert into catalog.task
    (source, source_code, statement, language, status, owner, version,
     process_id, primary_pattern, risk, reversible, requires_approval, customer_facing, touches_budget)
  values
    -- Analista de Mercado
    ('internal','VRL-MKT-A01',
     'Puntuar cada lead nuevo contra el ICP y las señales de intención y proponer su estado (lead o MQL).',
     'es','draft','Vrutal Labs',1,null,'RULES','medium', true,  true,  false, false), -- de Ventas (SDR)
    ('internal','VRL-MKT-A02',
     'Consolidar cada semana las métricas de todos los canales en un único MetricsSnapshot.',
     'es','draft','Vrutal Labs',1,'mkt_medicion','API','low',      true,  false, false, false),
    ('internal','VRL-MKT-A03',
     'Detectar desviaciones de KPI frente al objetivo y emitir una alerta con hipótesis de causa.',
     'es','draft','Vrutal Labs',1,'mkt_optimizacion','RULES','low', true,  false, false, false),
    -- Especialista SEO/SEM
    ('internal','VRL-MKT-S01',
     'Detectar solapes entre keywords orgánicas y pagadas y proponer el reparto SEO/SEM.',
     'es','draft','Vrutal Labs',1,'mkt_planificacion','RULES','low', true, false, false, false),
    ('internal','VRL-MKT-S02',
     'Ajustar pujas y reparto diario de presupuesto dentro del techo aprobado y registrar cada cambio.',
     'es','draft','Vrutal Labs',1,'mkt_optimizacion','RULES','high', false, true,  true, true), -- v1: con aprobación
    ('internal','VRL-MKT-S03',
     'Proponer keywords negativas a partir del informe de términos de búsqueda.',
     'es','draft','Vrutal Labs',1,'mkt_optimizacion','LLM','medium', true,  true,  false, true),
    -- Especialista de Contenido y Promoción
    ('internal','VRL-MKT-C01',
     'Mantener el calendario editorial a 4 semanas a partir de hallazgos, keywords y fechas clave.',
     'es','draft','Vrutal Labs',1,'mkt_planificacion','LLM','low',  true,  false, false, false),
    ('internal','VRL-MKT-C02',
     'Adaptar una pieza aprobada a cada canal respetando formato, longitud y CTA.',
     'es','draft','Vrutal Labs',1,'mkt_contenido','LLM','medium',   true,  true,  true,  false),
    ('internal','VRL-MKT-C03',
     'Programar la publicación de una pieza aprobada en LinkedIn en la fecha del calendario.',
     'es','draft','Vrutal Labs',1,'mkt_distribucion','API','medium_high', false, true, true, false)
  on conflict (source, source_code, language, version) do nothing;

  -- -------------------------------------------------------------------
  -- 2. Tareas O*NET / APQC reutilizadas: solo si aún no están curadas
  -- -------------------------------------------------------------------
  update catalog.task t
     set process_id        = v.process_id,
         primary_pattern   = v.pattern,
         risk              = v.risk,
         reversible        = v.reversible,
         requires_approval = v.approval,
         customer_facing   = v.customer,
         touches_budget    = v.budget
    from (values
      -- Analista de Mercado (13-1161.00)
      ('e3683fbd-0f2a-45e9-9b07-a080893da37e','mkt_investigacion','AGENT', 'low',        true,  false, false, false), -- TSK-000178
      ('76b8db74-7f3c-4eb5-ab68-b7e94751edca','mkt_investigacion','LLM',   'low',        true,  false, false, false), -- TSK-000037
      ('a30e63b3-7d4a-40c0-a0c9-c21d7a992260','mkt_investigacion','RAG',   'low',        true,  false, false, false), -- TSK-000154
      ('fe53d9ff-e6ca-49d0-b0e0-c7de25766e87','mkt_medicion',     'LLM',   'low',        true,  false, false, false), -- TSK-000189
      ('efc89a4c-9020-4662-9b93-d43777479e17','mkt_medicion',     'SCRIPT','low',        true,  false, false, false), -- TSK-000185
      ('d8d7a907-05e2-40ef-bd65-f279125a305c','mkt_medicion',     'LLM',   'low',        true,  false, false, false), -- TSK-000081
      ('e396f429-70b6-42fa-8f77-7c0bff62eafa','mkt_planificacion','LLM',   'low',        true,  false, false, false), -- TSK-000179
      -- Especialista SEO/SEM (13-1161.01)
      ('bfc4bb4a-95c1-4cad-b183-0aae2ae80cc2','mkt_investigacion','AGENT', 'low',        true,  false, false, false), -- TSK-000163
      ('bc76e5ff-8435-4a27-8708-2704283d8606','mkt_investigacion','LLM',   'low',        true,  false, false, false), -- TSK-000161
      ('5c8156e7-f500-4c1e-87f2-b8bf35101470','mkt_planificacion','LLM',   'low',        true,  false, false, false), -- TSK-000128
      ('90508304-494e-49b6-921f-dc25abc564f9','mkt_contenido',    'LLM',   'medium',     true,  true,  true,  false), -- TSK-000151
      ('4764d180-41df-4e67-918c-75ecb15d5d82','mkt_optimizacion', 'SCRIPT','low',        true,  false, false, false), -- TSK-000119
      ('c8e05c76-3aa5-420d-b564-1bb4e4a9b7b6','mkt_distribucion', 'API',   'high',       true,  true,  true,  true ), -- TSK-000166
      ('70d6f988-e525-4857-ae60-5530230eaa52','mkt_medicion',     'API',   'low',        true,  false, false, false), -- TSK-000136
      ('36135c91-a555-42dd-9729-1abdca6867fa','mkt_medicion',     'LLM',   'low',        true,  false, false, false), -- TSK-000117
      -- Especialista de Contenido y Promoción (11-2011.00 + APQC 3.4)
      ('09246a13-3a2e-42cf-a5ab-1e5fadb9e182','mkt_planificacion','LLM',   'low',        true,  false, false, false), -- TSK-000197 APQC 3.4.3.2
      ('3554482d-6392-4a69-bad1-93e1d5667b0f','mkt_contenido',    'LLM',   'medium',     true,  true,  true,  false), -- TSK-000010
      ('a3c5eea7-8e66-4ed5-93c6-c9d98abb1225','mkt_contenido',    'LLM',   'low',        true,  false, false, false), -- TSK-000057
      ('d634d4d1-30e4-4d3d-b128-0e31f32db02e','mkt_distribucion', 'WORKFLOW','medium_high',false, true, true,  false), -- TSK-000415 APQC 3.4.3.6
      ('ce7e2d75-c2c8-49ad-9567-66e1e824a45f','mkt_medicion',     'LLM',   'low',        true,  false, false, false), -- TSK-000077
      ('a99573f3-5cd1-4f7f-b180-5498ee9164f6','mkt_medicion',     'SCRIPT','low',        true,  false, false, false), -- TSK-000061
      ('77339ae2-4513-405b-93df-6b84ef8a8f33','mkt_optimizacion', 'LLM',   'low',        true,  false, false, false)  -- TSK-000309 APQC 3.4.5.6
    ) as v(id, process_id, pattern, risk, reversible, approval, customer, budget)
   where t.id = v.id::uuid
     and t.process_id is null;
  get diagnostics n = row_count;
  raise notice 'Tareas reutilizadas curadas ahora: % (las ya curadas se respetan)', n;

  -- -------------------------------------------------------------------
  -- 3. Roles y enlaces. Referencia de tarea: uuid (reutilizada) o source_code (interna).
  -- -------------------------------------------------------------------

  -- 3.1 Analista de Mercado
  if exists (select 1 from catalog.job_role where key = 'marketing_analyst') then
    raise notice 'marketing_analyst ya existe: se salta';
  else
    insert into catalog.job_role
      (key, name, version, status, domain_id, family, seniority, risk_level, model_tier,
       mission, autonomy_scope, requires_approval_scope, never_does, consults_memory_before_producing)
    values
      ('marketing_analyst', 'Analista de Mercado', 1, 'draft', 'MARKETING', 'Demand Generation', 'operativo', 'low', 'intermedio',
       'Convertir datos de mercado, competencia y embudo en hallazgos accionables.',
       'Investiga competencia y tendencias, consolida métricas de todos los canales y redacta informes internos sin supervisión previa.',
       'Cualquier recomendación que cambie presupuesto, canales o mensajes antes de llegar al founder.',
       'Nunca contacta a un lead ni a un cliente. Nunca publica nada de cara al público. Nunca puntúa ni cualifica leads: eso es de Ventas (SDR). Nunca modifica campañas ni presupuesto.',
       true)
    returning id into v_role;

    insert into catalog.job_role_task (job_role_id, task_id, effect_classification, criticality)
    select v_role, t.id, v.effect, v.crit
      from (values
        ('e3683fbd-0f2a-45e9-9b07-a080893da37e','read_only', 'core'),       -- A1  TSK-000178
        ('76b8db74-7f3c-4eb5-ab68-b7e94751edca','read_only', 'standard'),   -- A2  TSK-000037
        ('a30e63b3-7d4a-40c0-a0c9-c21d7a992260','read_only', 'peripheral'), -- A3  TSK-000154
        ('VRL-MKT-A02',                         'reversible','core'),       -- A5
        ('fe53d9ff-e6ca-49d0-b0e0-c7de25766e87','read_only', 'core'),       -- A6  TSK-000189
        ('efc89a4c-9020-4662-9b93-d43777479e17','read_only', 'standard'),   -- A7  TSK-000185
        ('d8d7a907-05e2-40ef-bd65-f279125a305c','reversible','core'),       -- A8  TSK-000081
        ('VRL-MKT-A03',                         'read_only', 'standard'),   -- A9
        ('e396f429-70b6-42fa-8f77-7c0bff62eafa','read_only', 'peripheral')  -- A10 TSK-000179
      ) as v(ref, effect, crit)
      join catalog.task t
        on (v.ref not like 'VRL-%' and t.id::text = v.ref)
        or (v.ref like 'VRL-%' and t.source = 'internal' and t.source_code = v.ref and t.language = 'es' and t.version = 1)
    on conflict (job_role_id, task_id) do nothing;
    get diagnostics n = row_count;
    if n <> 9 then raise exception 'marketing_analyst: % enlaces de 9', n; end if;
  end if;

  -- 3.2 Especialista SEO/SEM
  if exists (select 1 from catalog.job_role where key = 'search_marketing') then
    raise notice 'search_marketing ya existe: se salta';
  else
    insert into catalog.job_role
      (key, name, version, status, domain_id, family, seniority, risk_level, model_tier,
       mission, autonomy_scope, requires_approval_scope, never_does, consults_memory_before_producing)
    values
      ('search_marketing', 'Especialista SEO/SEM', 1, 'draft', 'MARKETING', 'Demand Generation', 'operativo', 'high', 'alto',
       'Traer tráfico de búsqueda cualificado por el dolor operativo del ICP, orgánico y pagado, sin que ambos compitan por la misma keyword y sin exceder nunca el techo de gasto.',
       'Investiga keywords, audita el sitio, prepara briefs SEO e informes sin supervisión previa. Propone ajustes de pujas y reparto diario dentro del techo aprobado. Objetivo: aplicarlos sin aprobación dentro del techo cuando haya histórico; en v1, todos con aprobación.',
       'En v1, todo cambio de pujas y reparto de presupuesto. Siempre: activar o crear campañas, cambiar keywords negativas, cambiar metadatos o contenido publicado en la web, y cualquier cambio del techo de presupuesto.',
       'Nunca excede el techo de gasto aprobado. Nunca activa una campaña sin aprobación. Nunca redacta contenido editorial -- eso es Contenido y Promoción. Nunca optimiza para términos genéricos de inteligencia artificial.',
       true)
    returning id into v_role;

    insert into catalog.job_role_task (job_role_id, task_id, effect_classification, criticality)
    select v_role, t.id, v.effect, v.crit
      from (values
        ('bfc4bb4a-95c1-4cad-b183-0aae2ae80cc2','read_only',   'core'),     -- S1  TSK-000163
        ('bc76e5ff-8435-4a27-8708-2704283d8606','read_only',   'core'),     -- S2  TSK-000161
        ('VRL-MKT-S01',                         'read_only',   'standard'), -- S3
        ('5c8156e7-f500-4c1e-87f2-b8bf35101470','reversible',  'core'),     -- S4  TSK-000128
        ('90508304-494e-49b6-921f-dc25abc564f9','reversible',  'standard'), -- S5  TSK-000151
        ('4764d180-41df-4e67-918c-75ecb15d5d82','read_only',   'standard'), -- S6  TSK-000119
        ('c8e05c76-3aa5-420d-b564-1bb4e4a9b7b6','reversible',  'core'),     -- S7  TSK-000166
        ('VRL-MKT-S02',                         'irreversible','core'),     -- S8
        ('VRL-MKT-S03',                         'reversible',  'standard'), -- S9
        ('70d6f988-e525-4857-ae60-5530230eaa52','read_only',   'core'),     -- S10 TSK-000136
        ('36135c91-a555-42dd-9729-1abdca6867fa','reversible',  'standard')  -- S11 TSK-000117
      ) as v(ref, effect, crit)
      join catalog.task t
        on (v.ref not like 'VRL-%' and t.id::text = v.ref)
        or (v.ref like 'VRL-%' and t.source = 'internal' and t.source_code = v.ref and t.language = 'es' and t.version = 1)
    on conflict (job_role_id, task_id) do nothing;
    get diagnostics n = row_count;
    if n <> 11 then raise exception 'search_marketing: % enlaces de 11', n; end if;
  end if;

  -- 3.3 Especialista de Contenido y Promoción
  if exists (select 1 from catalog.job_role where key = 'content_promotion') then
    raise notice 'content_promotion ya existe: se salta';
  else
    insert into catalog.job_role
      (key, name, version, status, domain_id, family, seniority, risk_level, model_tier,
       mission, autonomy_scope, requires_approval_scope, never_does, consults_memory_before_producing)
    values
      ('content_promotion', 'Especialista de Contenido y Promoción', 1, 'draft', 'MARKETING', 'Demand Generation', 'operativo', 'medium_high', 'intermedio',
       'Convertir hallazgos de investigación y experiencia operativa en piezas publicables en la voz de la marca, y hacerlas llegar al ICP por el canal correcto.',
       'Mantiene el calendario, redacta briefs y borradores, adapta piezas por canal y revisa la voz sin supervisión previa. Programa publicaciones solo tras aprobación.',
       'Todo contenido nuevo de cara al público, sin excepción.',
       'Nunca publica ni envía nada sin aprobación humana. Nunca gestiona secuencias de nurturing: son de un rol propio (Email y Fidelización). Nunca inventa cifras, casos ni clientes. Nunca llama bot, asistente ni herramienta a un especialista. Nunca escribe contenido personal del Director de Marketing Agéntico. Nunca toca SEO técnico ni presupuesto.',
       true)
    returning id into v_role;

    insert into catalog.job_role_task (job_role_id, task_id, effect_classification, criticality)
    select v_role, t.id, v.effect, v.crit
      from (values
        ('VRL-MKT-C01',                         'reversible',  'core'),       -- C1
        ('09246a13-3a2e-42cf-a5ab-1e5fadb9e182','reversible',  'core'),       -- C2  TSK-000197 APQC 3.4.3.2
        ('3554482d-6392-4a69-bad1-93e1d5667b0f','reversible',  'core'),       -- C3  TSK-000010
        ('a3c5eea7-8e66-4ed5-93c6-c9d98abb1225','read_only',   'core'),       -- C4  TSK-000057
        ('VRL-MKT-C02',                         'reversible',  'standard'),   -- C5
        ('VRL-MKT-C03',                         'irreversible','core'),       -- C6
        ('ce7e2d75-c2c8-49ad-9567-66e1e824a45f','read_only',   'standard'),   -- C8  TSK-000077
        ('a99573f3-5cd1-4f7f-b180-5498ee9164f6','reversible',  'peripheral'), -- C9  TSK-000061
        ('77339ae2-4513-405b-93df-6b84ef8a8f33','read_only',   'standard')    -- C10 TSK-000309 APQC 3.4.5.6
      ) as v(ref, effect, crit)
      join catalog.task t
        on (v.ref not like 'VRL-%' and t.id::text = v.ref)
        or (v.ref like 'VRL-%' and t.source = 'internal' and t.source_code = v.ref and t.language = 'es' and t.version = 1)
    on conflict (job_role_id, task_id) do nothing;
    get diagnostics n = row_count;
    if n <> 9 then raise exception 'content_promotion: % enlaces de 9', n; end if;
  end if;

  -- 3.4 Puntuar leads (VRL-MKT-A01) es de Ventas: se enlaza al SDR, versión más reciente no retirada.
  select j.id into v_role from catalog.job_role j
   where j.key = 'sdr' and j.status <> 'retired' order by j.version desc limit 1;
  if v_role is null then raise exception 'No hay rol sdr para enlazar la puntuación de leads'; end if;
  insert into catalog.job_role_task (job_role_id, task_id, effect_classification, criticality)
  select v_role, t.id, 'reversible', 'core' from catalog.task t
   where t.source = 'internal' and t.source_code = 'VRL-MKT-A01' and t.language = 'es' and t.version = 1
  on conflict (job_role_id, task_id) do nothing;
end $$;
