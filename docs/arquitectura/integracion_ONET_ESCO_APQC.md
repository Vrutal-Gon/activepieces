# Integración O*NET + ESCO + APQC — Plan de implementación

**Alcance de este documento:** cómo descargar, procesar e integrar las tres bases como catálogo de hipótesis de tareas por rol, que alimenta el panel interno de auditoría de Vrutal. No sustituye la auditoría real (LAB 12, Cap. 4) — la acelera.

**Principio de alcance (revisado):** la disciplina de "no todo de golpe" no aplica igual a la importación técnica que a la capa de valor de Vrutal. Los archivos fuente de O*NET/ESCO/APQC son compactos — importar el conjunto completo de tareas y ocupaciones no cuesta más que importar un subconjunto, y evita tener que volver a la fuente cada vez que se añade un departamento nuevo. Lo que sí se acota por fases es el trabajo manual: la tabla `vrutal_role_task_master` (Fase 6) solo se puebla con scoring de riesgo/autonomía para los roles que ya están en el catálogo o en el roadmap cercano (LAB 07 / LAB 15) — puntuar cientos de tareas que Vrutal no va a vender todavía sería el tipo de complejidad que el propio principio de simplicidad prohíbe.

---

## Fase 1 · O*NET

**Fuente:** onetcenter.org/database.html — versión **31.0** (última actualización, agosto 2026).
**Licencia:** Creative Commons Attribution 4.0. Uso y modificación libres, citando "O*NET 31.0 Database" y USDOL/ETA como fuente original, e indicando qué se modificó.

**Archivos a descargar — nombres corregidos de la versión 31.0:**

| Archivo real | Filas | Para qué sirve |
|---|---|---|
| `Occupation Data.xlsx` | 1.016 | Código O*NET-SOC, título y descripción de cada ocupación — tabla base |
| `Task Statements.xlsx` | 18.838 | Enunciado de cada tarea por ocupación |
| `Task Ratings.xlsx` | 165.780 | Importancia, relevancia y frecuencia de cada tarea — pre-scoring de peso |
| `Tasks to DWAs.xlsx` | 24.087 | Mapea cada tarea a su Detailed Work Activity |
| `GWAs to IWAs to DWAs.xlsx` | 2.087 | **Reemplaza** al antiguo "DWA Reference" — la jerarquía ahora tiene tres niveles (General → Intermediate → Detailed Work Activity), no dos |
| `Software Skills.xlsx` | 31.821 | **Reemplaza** al antiguo "Tools and Technology" — software y tecnologías asociadas a cada ocupación. *Nota: si necesitáis herramientas físicas además de software, esa info puede haberse retirado en esta revisión del modelo — no está confirmada como archivo separado en 31.0.* |
| `Related Occupations.xlsx` | 18.460 | 10 ocupaciones relacionadas primarias + 10 suplementarias por código — útil para descubrir ocupaciones vecinas al ampliar departamentos |

Todos se descargan sin registro desde la página de cada archivo, o el conjunto completo en un solo ZIP: `onetcenter.org/dl_files/database/db_31_0_excel.zip`.

**Recomendación de importación:** cargar `Task Statements` y `Task Ratings` completos (no son grandes) y filtrar por SOC code **en consulta SQL**, no en la descarga. Así ampliar a un departamento nuevo es una query, no una nueva descarga.

**Códigos SOC candidatos por departamento** (verificar cada uno en O*NET OnLine antes de dar por bueno — se revisan; el de Search Marketing Strategists cambió recientemente):

| Departamento | SOC candidatos |
|---|---|
| Marketing | `13-1161.01` Search Marketing Strategists · `11-2021.00` Marketing Managers · `13-1161.00` Market Research Analysts and Marketing Specialists |
| Ventas | `41-4012.00` Sales Representatives, Wholesale and Manufacturing · `11-2022.00` Sales Managers |
| Atención al cliente / CRM | `43-4051.00` Customer Service Representatives |
| Finanzas / Administración | `13-2011.00` Accountants and Auditors · `43-3031.00` Bookkeeping, Accounting, and Auditing Clerks · `11-3031.00` Financial Managers |
| Operaciones / Logística | `11-3071.00` Transportation, Storage, and Distribution Managers · `43-5061.00` Production, Planning, and Expediting Clerks |
| RRHH | `13-1071.00` Human Resources Specialists · `11-3121.00` Human Resources Managers |
| IT / Data | `15-1211.00` Computer Systems Analysts · `15-2051.00` Data Scientists |

---

## Fase 2 · ESCO

**Fuente:** esco.ec.europa.eu/en/use-esco/download.
**Licencia:** reutilización libre y gratuita para cualquier fin, conforme a la Decisión de la Comisión 2011/833/EU; contenido bajo CC BY 4.0.

**Archivos clave** (de los 19 disponibles por paquete de idioma):

- `occupations.csv` — ocupaciones con etiqueta preferida y alternativas en español.
- `skills.csv` — competencias y habilidades.
- `occupationSkillRelations.csv` — relación ocupación↔competencia, con `relationType` essential/optional.
- `ISCOGroups.csv` — jerarquía de clasificación (equivalente europeo a los grupos SOC).
- `skillsHierarchy.csv` / `broaderRelationsSkillPillar.csv` — agrupación de competencias relacionadas.

**Acción:** descargar el paquete completo en español (+ inglés de referencia) — no hace falta filtrar en descarga, igual que en O*NET. Filtrar `occupations.csv` por ISCO group al construir cada `role_task_master`, no antes.

---

## Fase 3 · Crosswalk O*NET ↔ ESCO — ya existe, no se construye a mano

Crosswalk oficial O*NET-SOC ↔ ESCO en onetcenter.org/crosswalks.html, construido combinando IA y validación humana, bajo CC BY 4.0. Cubre las 1.016 ocupaciones, no solo Marketing — se descarga una vez y sirve para todos los departamentos que se añadan después.

---

## Fase 4 · APQC PCF

**Fuente:** apqc.org/process-frameworks — versión Cross-Industry Excel 8.0.
**Licencia:** perpetua, mundial y gratuita, con atribución obligatoria a "APQC's Process Classification Framework®" en cualquier copia o derivado.

**Las 13 categorías del PCF Cross-Industry** (importar el Excel completo — es una sola hoja manejable, no justifica descargar por categoría):

| Categoría | Departamento Vrutal relacionado |
|---|---|
| 3.0 Market and Sell Products and Services | Marketing y Ventas |
| 6.0 Manage Customer Service | Atención al cliente / CRM |
| 7.0 Develop and Manage Human Capital | RRHH |
| 8.0 Manage Information Technology | IT / Data |
| 9.0 Manage Financial Resources | Finanzas / Administración |
| 4.0 / 5.0 Deliver Physical Products / Deliver Services | Operaciones |

Cada elemento conserva su ID de 5 dígitos, estable entre versiones — es la clave externa que une el PCF a `vrutal_role_task_master` sin depender de que el texto de la actividad no cambie.

---

## Fase 5 · Esquema unificado (PostgreSQL — mismo motor que ya usa el tronco de LAB 08)

```sql
-- Capa 1: taxonomías fuente completas, sin filtrar por departamento
CREATE TABLE onet_occupations (
    onet_soc_code   VARCHAR(10) PRIMARY KEY,
    title           TEXT NOT NULL
);

CREATE TABLE onet_tasks (
    task_id         VARCHAR(20) PRIMARY KEY,
    onet_soc_code   VARCHAR(10) REFERENCES onet_occupations(onet_soc_code),
    task_statement  TEXT NOT NULL,
    task_type       VARCHAR(20),
    importance      NUMERIC(4,2),
    frequency_cat   VARCHAR(50)
);

CREATE TABLE onet_dwa (
    dwa_id          VARCHAR(20) PRIMARY KEY,
    dwa_title       TEXT NOT NULL,
    iwa_id          VARCHAR(20),
    gwa_id          VARCHAR(20)
);

CREATE TABLE onet_task_dwa (
    task_id         VARCHAR(20) REFERENCES onet_tasks(task_id),
    dwa_id          VARCHAR(20) REFERENCES onet_dwa(dwa_id),
    PRIMARY KEY (task_id, dwa_id)
);

CREATE TABLE onet_software_skills (
    onet_soc_code   VARCHAR(10) REFERENCES onet_occupations(onet_soc_code),
    software_name   TEXT,
    hot_technology  BOOLEAN
);

CREATE TABLE esco_occupations (
    esco_uri            TEXT PRIMARY KEY,
    preferred_label_es  TEXT,
    isco_group          VARCHAR(10)
);

CREATE TABLE esco_skills (
    skill_uri            TEXT PRIMARY KEY,
    preferred_label_es   TEXT,
    skill_type            VARCHAR(20)
);

CREATE TABLE esco_occupation_skill (
    esco_uri        TEXT REFERENCES esco_occupations(esco_uri),
    skill_uri       TEXT REFERENCES esco_skills(skill_uri),
    relation_type   VARCHAR(20)       -- essential / optional
);

CREATE TABLE onet_esco_crosswalk (    -- del archivo oficial, no generada a mano
    onet_soc_code   VARCHAR(10) REFERENCES onet_occupations(onet_soc_code),
    esco_uri        TEXT REFERENCES esco_occupations(esco_uri)
);

CREATE TABLE apqc_pcf (
    pcf_id          VARCHAR(10) PRIMARY KEY,   -- ID de 5 dígitos
    category        TEXT,
    process_group   TEXT,
    process         TEXT,
    activity        TEXT,
    task_pcf        TEXT,
    level           INT
);

-- Capa 2: la tabla propia de Vrutal — donde vive el valor real.
-- Solo se puebla para roles del catálogo actual o del roadmap cercano (LAB 07 / LAB 15),
-- aunque las tablas fuente de arriba cubran todos los departamentos.
CREATE TABLE vrutal_role_task_master (
    id                      SERIAL PRIMARY KEY,
    departamento            TEXT NOT NULL,         -- Marketing, Ventas, CRM, Finanzas...
    vrutal_role             TEXT NOT NULL,
    task_label_es           TEXT NOT NULL,
    onet_task_id            VARCHAR(20) REFERENCES onet_tasks(task_id),
    esco_skill_uri          TEXT REFERENCES esco_skills(skill_uri),
    pcf_id                  VARCHAR(10) REFERENCES apqc_pcf(pcf_id),
    riesgo                  VARCHAR(10),
    requiere_aprobacion     BOOLEAN,
    depende_contexto_tacito BOOLEAN,
    ya_cubierta_por         TEXT,
    origen_hipotesis        VARCHAR(20),
    estado                  VARCHAR(20) DEFAULT 'hipotesis'  -- hipotesis / en_catalogo / roadmap / descartada
);
```

---

## Fase 6 · Overlay de scoring propio

Ni O*NET, ni ESCO, ni APQC responden "¿esto lo puede hacer un agente?". Para cada fila de `vrutal_role_task_master` que corresponda a un rol ya en catálogo o en roadmap próximo, puntuar con el mismo criterio de LAB 08, Cap. 11 y Cap. 17: riesgo (bajo/medio/alto por coste del error), punto de aprobación humana, y si depende de contexto tácito del cliente (si sí, no se confirma sin entrevista/observación real, LAB 12 Cap. 4).

Para departamentos que aún no están en el catálogo, la tabla queda poblada con `estado = 'hipotesis'` y sin scoring — es inventario, no trabajo terminado. Se puntúa cuando ese departamento entra en Audit según LAB 15.

---

## Fase 7 · Cómo entra esto en el producto

- **Panel interno de Vrutal:** la entrevista arranca con la tabla precargada por rol y departamento.
- **Informe de auditoría (LAB 08, Cap. 15):** columnas de tiempo/frecuencia estimadas alimentan un dashboard de PowerBI — tarea × tiempo estimado × riesgo — corregido después con el dato real del cliente.

---

## Punto de partida técnico

```python
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine("postgresql://user:pass@localhost:5432/vrutal_taxonomy")

# 1. O*NET — importar completo, sin filtrar por SOC code en la descarga
tasks = pd.read_excel("Task Statements.xlsx")
tasks.to_sql("onet_tasks_raw", engine, if_exists="replace", index=False)

ratings = pd.read_excel("Task Ratings.xlsx")
ratings.to_sql("onet_task_ratings_raw", engine, if_exists="replace", index=False)

# 2. ESCO — igual, completo
esco_occ = pd.read_csv("occupations_es.csv")
esco_occ.to_sql("esco_occupations_raw", engine, if_exists="replace", index=False)

# 3. Crosswalk oficial O*NET-ESCO — no se genera a mano
crosswalk = pd.read_excel("O_NET-ESCO_Crosswalk.xlsx")
crosswalk.to_sql("onet_esco_crosswalk", engine, if_exists="append", index=False)

# 4. Filtrado por departamento se hace en SQL a partir de aquí, no en la descarga:
# SELECT * FROM onet_tasks_raw WHERE "O*NET-SOC Code" IN ('41-4012.00','11-2022.00');  -- Ventas
```

---

## Estimación de esfuerzo (honesta, no redondeada al alza)

Importar las tres bases completas: 3-4 días (más que solo Marketing, porque hay más volumen que parsear y más limpieza de encoding en ESCO en español). Poblar el esquema y el scoring de Vrutal para el catálogo de Marketing ya construido: 1-2 semanas, igual que antes — ese paso no cambia por importar más datos fuente, porque el scoring sigue acotado al catálogo real. Añadir Ventas o Atención al Cliente después: días, no semanas, porque el andamiaje ya existe.

---

## Fuentes

- O*NET Database (v31.0) — onetcenter.org/database.html
- O*NET-ESCO Crosswalk — onetcenter.org/crosswalks.html
- ESCO Download — esco.ec.europa.eu/en/use-esco/download
- APQC Process Classification Framework — apqc.org/process-frameworks
