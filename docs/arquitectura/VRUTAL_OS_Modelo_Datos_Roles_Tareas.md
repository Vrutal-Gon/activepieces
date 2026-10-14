# VRUTAL OS · Arquitectura de la Biblioteca de Roles y Tareas

*Especificación del modelo de datos, la taxonomía y el mecanismo de configuración por cliente*

---

## PARTE I · El principio

### La tarea es la unidad atómica. El rol es una vista.

Un rol no *contiene* tareas — un rol es un **subconjunto etiquetado** de una biblioteca de tareas compartida por toda la organización. Esto no es una preferencia de modelado: es la única forma de que 250 roles no se conviertan en 250 documentos que se contradicen entre sí.

Consecuencias inmediatas de aceptar este principio:

| Si el rol contiene tareas | Si el rol referencia tareas |
|---|---|
| ~25.000 filas (250 roles × ~100) | ~4.000 tareas distintas + 25.000 enlaces |
| "Verificar email" se especifica 6 veces | Se especifica una vez, se enlaza 6 veces |
| Corregir una tarea = buscarla en 6 documentos | Corregir una tarea = un UPDATE |
| 6 componentes construidos para lo mismo | 1 componente reutilizado 6 veces |
| El % de automatización del rol se escribe a mano | Se calcula desde las tareas activas |

**El activo real de Vrutal no es el catálogo de roles. Es la biblioteca de tareas y el mapa de qué componente resuelve cada una.** Los roles son la envoltura comercial de ese activo.

### Corolario: la ficha de especialista deja de escribirse

Los diez campos de la ficha de LAB 07, Capítulo 2 — alcance autónomo, requiere aprobación, nunca hace, herramientas, memoria, nivel de modelo, métrica de éxito — son todos derivables de las tareas asignadas al rol y de su configuración en un cliente concreto. La ficha pasa de ser un documento redactado a ser una **consulta**. Eso elimina de raíz la posibilidad de que la ficha diga una cosa y el sistema desplegado haga otra.

---

## PARTE II · La jerarquía de cuatro niveles

```
DOMINIO          Sales, Marketing, Finanzas, Operaciones, RRHH, Legal, IT…
   │             ~12 dominios
   ▼
PROCESO          Descubrimiento de cuentas, Lead Scoring, Outreach…
   │             ~200 procesos · equivale a tus bloques A–P
   ▼
TAREA            Verificar email · Calcular fit score · Detectar duplicados
   │             ~4.000 tareas distintas · unidad atómica · unidad de ROI
   ▼
COMPONENTE       CMP-PY-EMAILVERIFY · CMP-N8N-CRM-SYNC · CMP-AGT-RESEARCH
                 ~300 componentes · unidad de construcción · reutilizable
```

La distinción **tarea ↔ componente** es la que más dinero ahorra. La tarea es *qué hay que conseguir*; el componente es *el artefacto que lo consigue*. Un mismo componente sirve a muchas tareas, y una misma tarea puede resolverse con distintos componentes según el stack del cliente (Salesforce vs HubSpot).

### Regla de grano

> Una **tarea** tiene un disparador, un artefacto de salida y un patrón de automatización dominante.
> Si necesitas la conjunción "y" para describirla, es un **proceso**, no una tarea.

Aplicado a tu T001 actual:

**"T001 — Definir ICP · Agent · 90%"** falla la regla. Analiza sector *y* tamaño *y* facturación, produce un documento *y* requiere validación humana. Es un proceso. Descompuesto correctamente:

| Código | Tarea | Patrón | Auto. |
|---|---|---|---|
| TSK-000431 | Extraer atributos comunes de la cartera actual | SCRIPT (Python) | 99% |
| TSK-000432 | Correlacionar atributo con valor de cliente (LTV, margen) | ML | 95% |
| TSK-000433 | Proponer definición de ICP a partir de la correlación | AGENT | 85% |
| TSK-000434 | Validar y firmar el ICP propuesto | **HUMAN_ONLY** | 0% |
| TSK-000435 | Publicar ICP vigente en memoria organizativa | WORKFLOW | 99% |

Esa descomposición hace tres cosas que "Definir ICP · 90%" no hacía: expone que hay un paso humano irreductible en medio, permite construir TSK-000431 una sola vez para los quince roles que la necesitan, y convierte el "90%" en un número calculado en lugar de estimado.

---

## PARTE III · Modelo de datos (PostgreSQL)

### Capa 1 · Taxonomía

```sql
CREATE TABLE domain (
  domain_id     TEXT PRIMARY KEY,          -- 'SALES'
  name          TEXT NOT NULL,
  description   TEXT
);

CREATE TABLE process (
  process_id    TEXT PRIMARY KEY,          -- 'SALES.ACCOUNT_DISCOVERY'
  domain_id     TEXT NOT NULL REFERENCES domain,
  name          TEXT NOT NULL,             -- 'Descubrimiento de cuentas'
  sequence_ord  INT,                       -- orden dentro del dominio
  description   TEXT
);
```

### Capa 2 · La biblioteca de tareas

```sql
CREATE TYPE automation_pattern AS ENUM (
  'HUMAN',        -- no automatizable, se documenta igual
  'PROMPT',       -- instrucción puntual, sin estado
  'LLM',          -- generación embebida en un flujo
  'RULES',        -- motor de reglas determinista
  'SCRIPT',       -- Python / JavaScript
  'API',          -- llamada a servicio externo
  'ML',           -- modelo entrenado
  'WORKFLOW',     -- n8n, orquestación determinista
  'RAG',          -- recuperación sobre conocimiento propio
  'AGENT',        -- alcance de decisión + memoria + escalado
  'MULTI_AGENT'   -- orquestador sobre subagentes
);

CREATE TYPE risk_level AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE task_status AS ENUM ('DRAFT','VALIDATED','DEPRECATED');

CREATE TABLE task (
  task_id            BIGSERIAL PRIMARY KEY,
  task_code          TEXT UNIQUE NOT NULL,       -- 'TSK-000431' · global, opaco, inmutable
  slug               TEXT UNIQUE NOT NULL,       -- 'verificar-email-contacto'
  name               TEXT NOT NULL,              -- VERBO + OBJETO [+ CUALIFICADOR]
  description        TEXT NOT NULL,
  process_id         TEXT NOT NULL REFERENCES process,

  -- Contrato de ejecución
  trigger_type       TEXT,      -- 'event' | 'schedule' | 'request' | 'continuous'
  input_spec         JSONB,     -- qué necesita para empezar
  output_spec        JSONB,     -- qué artefacto entrega

  -- Automatización
  primary_pattern    automation_pattern NOT NULL,
  automation_min     NUMERIC(4,3) CHECK (automation_min BETWEEN 0 AND 1),
  automation_max     NUMERIC(4,3) CHECK (automation_max BETWEEN 0 AND 1),
  human_only         BOOLEAN NOT NULL DEFAULT FALSE,

  -- Riesgo y control (LAB 08, Cap. 11 y 17)
  risk               risk_level NOT NULL,
  reversible         BOOLEAN NOT NULL,
  requires_approval  BOOLEAN NOT NULL DEFAULT FALSE,
  touches_budget     BOOLEAN NOT NULL DEFAULT FALSE,
  customer_facing    BOOLEAN NOT NULL DEFAULT FALSE,
  compliance_flags   TEXT[],    -- {'GDPR','DNC','OPT_OUT','RETENTION'}

  -- Economía (base del ROI)
  avg_human_minutes  NUMERIC,   -- minutos humanos por ejecución, mediana
  default_freq_year  NUMERIC,   -- ejecuciones/año en una empresa tipo

  -- Gobierno
  status             task_status NOT NULL DEFAULT 'DRAFT',
  version            INT NOT NULL DEFAULT 1,
  owner              TEXT NOT NULL,
  embedding          VECTOR(1536),   -- pgvector · antiduplicados semántico
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),

  CHECK (automation_max >= automation_min),
  CHECK (NOT human_only OR automation_max = 0)
);

CREATE INDEX ON task USING hnsw (embedding vector_cosine_ops);
```

**Nota sobre `task_code`.** Opaco y secuencial a propósito. Un código semántico tipo `SALES-DISC-004` obliga a renumerar cuando reorganizas la taxonomía, y la taxonomía se reorganizará. La legibilidad la da `slug`; la identidad la da el código.

### Capa 3 · Componentes (qué se construye de verdad)

```sql
CREATE TABLE component (
  component_id   TEXT PRIMARY KEY,          -- 'CMP-PY-EMAILVERIFY-01'
  name           TEXT NOT NULL,
  comp_type      TEXT NOT NULL,             -- 'agent'|'workflow'|'script'|'api'|'prompt'|'rag_index'|'model'
  runtime        TEXT,                      -- 'python'|'javascript'|'n8n'|'sql'|'llm'
  repo_ref       TEXT,                      -- ruta/repositorio
  owner          TEXT NOT NULL,             -- todo tiene propietario (LAB 08, Cap. 2)
  maturity       TEXT,                      -- 'prototype'|'tested'|'production'
  unit_cost_est  NUMERIC                    -- coste estimado por ejecución
);

CREATE TABLE task_component (
  task_id        BIGINT REFERENCES task,
  component_id   TEXT   REFERENCES component,
  role_in_task   TEXT,                      -- 'executor'|'validator'|'enricher'|'fallback'
  is_default     BOOLEAN DEFAULT TRUE,
  applies_when   JSONB,                     -- {'crm':'hubspot'} · variante por stack
  PRIMARY KEY (task_id, component_id, role_in_task)
);
```

Aquí es donde aparece el número que sostiene el negocio: **una consulta de `COUNT(task_id) GROUP BY component_id` te dice cuántas tareas cubre cada componente construido.** Ese es tu ratio de apalancamiento. Si un componente sirve a una sola tarea, o está mal diseñado o la tarea está mal definida.

### Capa 4 · Roles

```sql
CREATE TABLE role (
  role_id        TEXT PRIMARY KEY,          -- 'ROLE-004'
  name           TEXT NOT NULL,             -- 'Sales Development Representative'
  agent_name     TEXT,                      -- 'Sales Development Operations Agent'
  domain_id      TEXT REFERENCES domain,
  family         TEXT,                      -- 'Revenue Operations'
  seniority      TEXT,                      -- 'operativo'|'mando'|'dirección'
  status         task_status DEFAULT 'DRAFT'
);

CREATE TABLE role_task (
  role_id          TEXT   REFERENCES role,
  task_id          BIGINT REFERENCES task,
  criticality      TEXT NOT NULL,           -- 'core'|'standard'|'peripheral'
  time_weight_pct  NUMERIC(5,2) NOT NULL,   -- % del tiempo del rol dedicado a esta tarea
  PRIMARY KEY (role_id, task_id)
);
```

**Regla dura: `SUM(time_weight_pct)` por rol debe ser 100.** No es cosmética. Obliga a saber cuánto pesa cada tarea dentro del rol, que es exactamente lo que hace falta para calcular ROI y para decidir si el rol merece existir. Un rol al que no sabes asignarle pesos es un rol que no has auditado, solo listado.

Esa restricción también revienta el impulso de meter 250 tareas en un rol: si una tarea pesa el 0,2% del tiempo de la persona, no pertenece a ese rol — o pertenece con `criticality = 'peripheral'` y no se despliega en la primera fase.

```sql
-- Validación como trigger o como test de CI
CREATE VIEW v_role_weight_check AS
SELECT role_id, SUM(time_weight_pct) AS total
FROM role_task GROUP BY role_id HAVING SUM(time_weight_pct) <> 100;
```

### Capa 5 · Dependencias

```sql
CREATE TABLE task_dependency (
  task_id          BIGINT REFERENCES task,
  depends_on       BIGINT REFERENCES task,
  dependency_type  TEXT NOT NULL,   -- 'hard' | 'soft' | 'data'
  PRIMARY KEY (task_id, depends_on),
  CHECK (task_id <> depends_on)
);
```

Dos usos, ambos críticos:

**Orden de despliegue.** Un orden topológico del grafo te dice qué se puede desplegar y en qué secuencia. No puedes desplegar "Calcular fit score" antes de "Enriquecer contacto". Esto convierte el "un rol cada vez" de LAB 08 en algo más preciso: *una capa de dependencias cada vez*.

**Radio de propagación del error.** El número de tareas que dependen de una tarea (grado de salida en el grafo) es una medida directa de cuánto daño hace si falla. Es la formalización de la nota de LAB 07 sobre Data (CRM/ERP): riesgo alto no por gasto, sino por contaminación aguas abajo.

```sql
CREATE VIEW v_task_blast_radius AS
WITH RECURSIVE downstream AS (
  SELECT depends_on AS root, task_id AS affected FROM task_dependency
  UNION
  SELECT d.root, td.task_id FROM downstream d
  JOIN task_dependency td ON td.depends_on = d.affected
)
SELECT root AS task_id, COUNT(DISTINCT affected) AS downstream_tasks
FROM downstream GROUP BY root;
```

Si `downstream_tasks` es alto y `risk` está marcado como LOW, hay una incoherencia que revisar antes de desplegar nada.

---

## PARTE IV · Configuración por cliente

Aquí está el núcleo de tu pregunta: *cómo configurar o no esas relaciones según lo que hace la empresa.*

### Separación tronco / rama, aplicada al dato

- Las tablas de las Partes II y III son **el tronco**: catálogo canónico, versionado, propiedad de Vrutal. Nunca se editan desde un despliegue de cliente.
- Las tablas siguientes son **la rama**: la instancia concreta en un cliente.

Un cliente que necesita una tarea que no existe en la biblioteca **no la crea en su rama**. La propone al tronco por el flujo de gobierno (Parte VI). Sin esta regla, en seis meses tienes 40 versiones divergentes de la misma tarea y ningún componente reutilizable.

### Perfil de empresa y reglas de activación

```sql
CREATE TABLE client (
  client_id      TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  sector         TEXT,
  employees      INT,
  revenue_band   TEXT,
  country        TEXT,
  business_model TEXT[]            -- {'B2B','SAAS','ECOMMERCE'}
);

-- Perfil extensible: lo que se rellena en la fase 01 · Auditoría
CREATE TABLE client_attribute (
  client_id      TEXT REFERENCES client,
  attr_key       TEXT NOT NULL,    -- 'crm' | 'erp' | 'has_ecommerce' | 'sells_international'
  attr_value     TEXT NOT NULL,
  PRIMARY KEY (client_id, attr_key)
);

-- Condiciones bajo las que una tarea aplica
CREATE TABLE task_activation_rule (
  rule_id      BIGSERIAL PRIMARY KEY,
  task_id      BIGINT REFERENCES task,
  attr_key     TEXT NOT NULL,
  operator     TEXT NOT NULL,      -- '='|'!='|'>'|'<'|'IN'|'EXISTS'
  attr_value   TEXT,
  logic_group  INT DEFAULT 1       -- AND dentro del grupo, OR entre grupos
);
```

Ejemplo: `TSK-000512 · Sincronizar catálogo con marketplace` solo aplica si `has_ecommerce = true` **y** `channels INCLUDE 'marketplace'`. Un cliente industrial sin canal online nunca la ve propuesta.

### La tabla de instancia

```sql
CREATE TYPE deploy_status AS ENUM
  ('PROPOSED','APPROVED','TESTING','ACTIVE','DEFERRED','EXCLUDED','HUMAN_RETAINED');

CREATE TYPE autonomy AS ENUM
  ('NONE','SUGGEST','EXECUTE_WITH_APPROVAL','AUTONOMOUS');

CREATE TABLE client_specialist (          -- una rama = un rol desplegado en un cliente
  specialist_id  BIGSERIAL PRIMARY KEY,
  client_id      TEXT REFERENCES client,
  role_id        TEXT REFERENCES role,
  display_name   TEXT,
  phase          TEXT,                    -- fase 01–05 del método
  deployed_at    DATE,
  UNIQUE (client_id, role_id)
);

CREATE TABLE client_task (
  client_id        TEXT REFERENCES client,
  task_id          BIGINT REFERENCES task,
  specialist_id    BIGINT REFERENCES client_specialist,
  status           deploy_status NOT NULL DEFAULT 'PROPOSED',
  autonomy_level   autonomy NOT NULL DEFAULT 'NONE',
  task_version     INT NOT NULL,          -- versión del tronco a la que se ancló
  component_bind   JSONB,                 -- qué componente concreto se usó aquí
  actual_freq_year NUMERIC,               -- medido en auditoría, no estimado
  actual_minutes   NUMERIC,
  approver         TEXT,                  -- quién aprueba cuando requiere aprobación
  deployed_at      DATE,
  notes            TEXT,
  PRIMARY KEY (client_id, task_id)
);
```

Tres campos hacen todo el trabajo de configuración:

- **`status`** responde *¿esta tarea entra?* — incluido `HUMAN_RETAINED`, que es distinto de `EXCLUDED`: la tarea existe, se hace, y se decide conscientemente que la siga haciendo una persona. Que quede registrado por qué es tan valioso como registrar lo que se automatiza.
- **`autonomy_level`** responde *¿cuánto puede decidir sola?* — es el "alcance autónomo" de la ficha, pero como dato configurable por cliente, no como párrafo redactado. El mismo especialista puede ser `AUTONOMOUS` en un cliente y `EXECUTE_WITH_APPROVAL` en otro más conservador.
- **`task_version`** ancla la instancia a una versión del tronco. Cuando la biblioteca evoluciona, ves exactamente qué clientes están corriendo una versión antigua y decides si migrarlos.

### El flujo de configuración completo

```
FASE 01 · AUDITORÍA
   Rellenar client + client_attribute (perfil real, medido)
        ↓
   MOTOR DE REGLAS
   task_activation_rule × client_attribute
        ↓
   Propone conjunto de tareas → client_task (status = PROPOSED)
        ↓
FASE 02 · INFORME
   Consultor revisa. Cada tarea sale como:
   APPROVED · DEFERRED · EXCLUDED · HUMAN_RETAINED
   → el informe se genera desde la tabla, no se redacta
        ↓
FASE 03 · DISEÑO
   Agrupar tareas APPROVED en client_specialist (roles)
   Fijar autonomy_level tarea a tarea
   Ordenar por task_dependency (orden topológico)
        ↓
FASE 04 · TESTEO
   status = TESTING · ejecución en paralelo contra casos reales
        ↓
FASE 05 · DESPLIEGUE
   status = ACTIVE, una capa de dependencias cada vez
```

El motor de reglas **propone**; nunca activa. La aprobación humana entre PROPOSED y APPROVED es innegociable — es lo que impide que el sistema despliegue una tarea de riesgo alto porque un atributo estaba mal rellenado en la auditoría.

---

## PARTE V · Cálculo derivado: ROI y cobertura

Nada de esto se almacena. Todo se calcula. Es la diferencia entre un catálogo y un sistema.

```sql
CREATE VIEW v_client_task_roi AS
SELECT
  ct.client_id,
  ct.task_id,
  t.name,
  t.process_id,
  t.primary_pattern,
  t.risk,
  ct.status,
  ct.autonomy_level,
  COALESCE(ct.actual_freq_year, t.default_freq_year)              AS freq_year,
  COALESCE(ct.actual_minutes,  t.avg_human_minutes)               AS minutes,
  (COALESCE(ct.actual_freq_year, t.default_freq_year)
   * COALESCE(ct.actual_minutes, t.avg_human_minutes) / 60.0)     AS horas_ano,
  (COALESCE(ct.actual_freq_year, t.default_freq_year)
   * COALESCE(ct.actual_minutes, t.avg_human_minutes) / 60.0
   * (t.automation_min + t.automation_max) / 2.0)                 AS horas_recuperables
FROM client_task ct
JOIN task t ON t.task_id = ct.task_id;
```

Y el porcentaje de automatización de un rol — que en tu documento actual es un número escrito a mano ("65–90%") — pasa a ser esto:

```sql
CREATE VIEW v_role_automation AS
SELECT
  rt.role_id,
  SUM(rt.time_weight_pct * t.automation_min) / 100 AS auto_min,
  SUM(rt.time_weight_pct * t.automation_max) / 100 AS auto_max
FROM role_task rt
JOIN task t ON t.task_id = rt.task_id
GROUP BY rt.role_id;
```

Ponderado por tiempo, no por número de tareas. La diferencia importa: un rol con 90 tareas automatizables al 99% que ocupan el 20% del tiempo, y 10 tareas humanas que ocupan el 80%, **no está automatizado al 90%**. Contar tareas en lugar de ponderar por tiempo es la forma más común de inflar una cifra de automatización, y es exactamente lo que el Artículo VI de la Constitución prohíbe.

### Capa Power BI

Modelo en estrella sobre vistas, no sobre tablas:

```
FACT_CLIENT_TASK               grano: 1 fila por cliente × tarea
  ├── DIM_TASK                 patrón, riesgo, reversibilidad, human_only
  ├── DIM_PROCESS → DIM_DOMAIN
  ├── DIM_ROLE
  ├── DIM_CLIENT               sector, tamaño, banda de facturación
  ├── DIM_COMPONENT            madurez, runtime, propietario
  └── DIM_STATUS / DIM_AUTONOMY
```

Medidas base en DAX:

- `Horas Recuperables = SUM(FACT[horas_recuperables])`
- `Cobertura % = DIVIDE([Tareas ACTIVE], [Tareas Auditadas])`
- `Coste Evitado = [Horas Recuperables] * [Coste Hora Rol]`
- `Apalancamiento Componente = DIVIDE([Tareas Cubiertas], [Componentes Construidos])`
- `Deuda de Versión = COUNTROWS(FILTER(FACT, FACT[task_version] < MAX(DIM_TASK[version])))`

Ese último es el que nadie construye y el que más pronto duele: cuántas instancias en producción corren una versión de tarea que la biblioteca ya ha superado.

---

## PARTE VI · Gobierno: cómo entra una tarea nueva sin ensuciar la biblioteca

Con 250 roles alimentando el catálogo, el riesgo no es quedarse corto de tareas. Es acumular sinónimos.

### Nomenclatura obligatoria

**VERBO (infinitivo) + OBJETO + [CUALIFICADOR]**

Verbo tomado de una **lista cerrada**, no libre:

```
Identificar · Buscar · Investigar · Detectar · Analizar · Clasificar
Verificar · Validar · Enriquecer · Completar · Deduplicar · Limpiar
Calcular · Priorizar · Segmentar · Generar · Redactar · Adaptar
Enviar · Publicar · Programar · Registrar · Actualizar · Sincronizar
Escalar · Aprobar · Notificar · Documentar · Medir · Optimizar
```

Una lista abierta de verbos es lo que produce "Analizar website" y "Revisar la web del prospecto" como dos filas distintas para la misma tarea. Cerrar la lista fuerza la colisión, y la colisión es lo que quieres: significa que has encontrado el duplicado.

### Protocolo antiduplicados

```
Alguien propone una tarea nueva
        ↓
Generar embedding de (nombre + descripción)
        ↓
Consultar pgvector / Qdrant · similitud coseno
        ↓
   ┌────────────┼────────────┐
 > 0.92      0.85–0.92     < 0.85
   │            │            │
DUPLICADO    REVISIÓN      NUEVA
Enlazar la   HUMANA        status = DRAFT
tarea        obligatoria   → validación → VALIDATED
existente
al rol nuevo
```

Ese paso de embeddings es barato de construir y es lo que impide que la biblioteca se degrade. Sin él, a las 4.000 tareas ya no sabes qué tienes.

### Versionado

Las tareas no se sobrescriben. `version` incrementa, la anterior pasa a `DEPRECATED` con un motivo registrado, y las instancias de cliente ancladas a la versión antigua aparecen en el informe de deuda de versión. Es el principio de "ningún cambio se sobrescribe en silencio", aplicado al dato en lugar de al documento.

---

## PARTE VII · Orden de construcción

No construyas las 4.000 tareas. Construye el esqueleto y llénalo por presión de demanda real.

| Fase | Qué se hace | Criterio de salida |
|---|---|---|
| **1** | DDL completo + taxonomía de dominios y procesos | Las ~200 filas de `process` cerradas |
| **2** | Migrar ROLE-004 (SDR) como caso piloto, aplicando la regla de grano | 103 "tareas" actuales → tareas reales con pesos que suman 100 |
| **3** | Migrar 4 roles adyacentes (AE, Customer Success, Soporte, Data Entry) | **Medir el % de tareas que ya existían.** Si es <30%, el grano está mal |
| **4** | Catálogo de componentes + `task_component` sobre esos 5 roles | Ratio de apalancamiento por componente |
| **5** | Motor de reglas + primer cliente real | Informe de fase 02 generado desde la BD, no redactado |
| **6** | Modelo Power BI | Cuadro de cobertura y ROI por cliente |
| **7** | Escalar al resto de roles | Solo cuando un rol nuevo aporte >70% de tareas ya existentes |

El indicador de que el modelo funciona es contraintuitivo: **el quinto rol debería aportar muy pocas tareas nuevas.** Si cada rol nuevo sigue añadiendo 80 tareas inéditas al catálogo, no tienes una biblioteca — tienes 250 documentos en una tabla, que es exactamente el problema que este modelo existe para evitar.

---

## Las tres decisiones que quedan abiertas

Este diseño no las cierra porque dependen de datos que aún no tienes:

1. **¿`avg_human_minutes` y `default_freq_year` se pueblan por estimación o solo con dato medido?** Estimarlos permite vender antes; medirlos hace el ROI defendible. La opción honesta es poblar la estimación con un flag de procedencia y sustituirla por el dato real tras la primera auditoría.

2. **¿El `autonomy_level` por defecto vive en la tarea o solo en la instancia?** Un defecto en la tarea acelera la configuración pero arrastra el riesgo de que nadie lo revise. Recomendación: guardar un `suggested_autonomy` en `task`, obligar a confirmación explícita en `client_task`, y no permitir `AUTONOMOUS` por defecto en ninguna tarea con `risk` HIGH o CRITICAL.

3. **¿Los 250 roles son el catálogo comercial o el inventario interno?** No tienen por qué coincidir. Puedes tener 250 roles en el inventario y vender 12 especialistas empaquetados. Si coinciden, tu propuesta comercial tendrá 250 opciones, que es una forma eficaz de no vender ninguna.
