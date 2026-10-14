# MARKETING · Propuesta de roles v0.1

*Revisado por el founder el 2026-10-01 y aplicado en `db/migrations/020_vrutal_marketing_roles.sql` (ver «Decisiones del founder» al final).*

---

## 1. Por qué estos tres roles

Marketing es el primer departamento que llevamos de extremo a extremo, con Vrutal Labs como cliente 0 (LAB 08, Cap. 18). Tres especialistas cubren los seis procesos del dominio (Investigación → Planificación → Contenido → Distribución → Medición → Optimización):

| Especialista | Fuente O*NET | Qué absorbe |
|---|---|---|
| **Analista de Mercado** | 13-1161.00 | Investigación de mercado y competencia, métricas del embudo, criterio de MQL (LAB 11, Cap. 3 y 9). |
| **Especialista SEO/SEM** | 13-1161.01 | Keywords por dolor operativo del ICP, SEO técnico, campañas de búsqueda dentro de un techo de gasto. |
| **Especialista de Contenido y Promoción** | 11-2011.00 | Calendario, briefs, redacción, adaptación por canal, publicación y nutrición de leads. |

**El Marketing Manager (O*NET 11-2021.00) sigue siendo humano.** No es un especialista: es quien aprueba. En Vrutal Labs ese papel lo ejerce el Director de Marketing Agéntico (hoy, el founder). Aprueba cinco cosas y nada más:

1. Todo contenido nuevo de cara al público, antes de publicarse (LAB 11, Cap. 4).
2. El techo de presupuesto SEM y cualquier campaña antes de activarse (LAB 11, Cap. 6).
3. Cambios de keywords negativas y de metadatos en la web.
4. Secuencias de nutrición antes de encenderse.
5. El estado MQL de un lead, mientras el umbral de intención no esté calibrado con datos reales (LAB 11, Cap. 10).

**Voz de marca (LAB 03).** Claridad brutal, autoridad con evidencia, economía de palabras. Toda pieza nombra el coste operativo real que un especialista elimina, con cifra o caso. Diccionario obligatorio: «especialista», nunca «bot», «asistente» ni «herramienta». «Vrutal Labs», nunca «Vrutal-labs» en texto corrido.

**Regla de prompts.** Las tareas de catálogo (estándar) solo leen campos estructurados del cliente: ICP (tamaño, facturación, interlocutor), sectores, lista de competidores, dominios, cuentas conectadas, techo SEM, reglas de voz. Cualquier necesidad que dependa de texto libre del cliente va al nivel «a medida».

---

## 2. Roles

### 2.1 Analista de Mercado · `marketing_analyst`

| Campo | Valor |
|---|---|
| name | Analista de Mercado |
| seniority | operativo |
| family | Demand Generation |
| risk_level | low |
| model_tier | intermedio |
| mission | Convertir datos de mercado, competencia y embudo en hallazgos accionables, y proponer qué leads cumplen el criterio de MQL. |
| autonomy_scope | Investiga competencia y tendencias, consolida métricas de todos los canales y redacta informes internos sin supervisión previa. Puntúa leads contra el ICP y propone su estado. |
| requires_approval_scope | El cambio de estado de un lead a MQL, mientras el umbral de intención no esté calibrado con datos del piloto. |
| never_does | Nunca contacta a un lead ni a un cliente. Nunca publica nada de cara al público. Nunca entrega un lead a Ventas sin estado MQL aprobado. Nunca modifica campañas ni presupuesto. |

| # | task_code | Tarea (ES) | Proceso | Patrón | Riesgo | Efecto | Criticidad | Sistemas | Bloques |
|---|---|---|---|---|---|---|---|---|---|
| A1 | TSK-000178 (13-1161.00.5441) | Recoger precios, mensajes y canales de los competidores definidos y entregar una ficha comparativa. | Investigación | AGENT | low | read_only | core | Web, Google Sheets | Recibe (cron mensual) → Consulta (competidores del cliente) → Consulta (web) → Ordena → Ejecuta (Sheets) → Deja rastro |
| A2 | TSK-000037 (13-1161.00.5433) | Analizar los leads del CRM frente al ICP y entregar el perfil real de quién entra por cada canal. | Investigación | LLM | low | read_only | standard | HubSpot, Sheets | Recibe (cron) → Consulta (HubSpot) → Ordena (Lead) → Decide (encaje ICP) → Ejecuta (Sheets) → Deja rastro |
| A3 | TSK-000154 (13-1161.00.5442) | Vigilar fuentes sectoriales y entregar un resumen semanal de tendencias relevantes para el ICP. | Investigación | RAG | low | read_only | peripheral | RSS/web, email | Recibe (cron) → Consulta (fuentes) → Ordena → Decide (relevancia) → Ejecuta (email) → Deja rastro |
| A4 | NEW VRL-MKT-A01 | Puntuar cada lead nuevo contra el ICP y las señales de intención y proponer su estado (lead o MQL). | Medición | RULES | medium | reversible | core | HubSpot, email | Recibe (lead nuevo) → Ordena (Lead) → Consulta (ICP + actividad) → Decide (reglas ICP+intención) → Pide permiso → Ejecuta (propiedad HubSpot) → Deja rastro |
| A5 | NEW VRL-MKT-A02 | Consolidar cada semana las métricas de todos los canales en un único MetricsSnapshot. | Medición | API | low | reversible | core | GA4, Search Console, LinkedIn, HubSpot, Google Ads, Sheets | Recibe (cron) → Consulta (×N fuentes) → Ordena (MetricsSnapshot) → Ejecuta (Sheets) → Deja rastro |
| A6 | TSK-000189 (13-1161.00.5438) | Medir la eficacia de cada canal frente a su objetivo y entregar un diagnóstico por canal. | Medición | LLM | low | read_only | core | Sheets (MetricsSnapshot) | Recibe (snapshot listo) → Consulta (objetivos) → Decide (vs. objetivo) → Ejecuta (Sheets) → Deja rastro |
| A7 | TSK-000185 (13-1161.00.5436) | Proyectar la tendencia de tráfico, leads y MQL a 4 semanas a partir del histórico. | Medición | SCRIPT | low | read_only | standard | Sheets | Recibe (cron) → Consulta (histórico) → Ordena → Ejecuta (Sheets) → Deja rastro |
| A8 | TSK-000081 (13-1161.00.5434) | Redactar el informe semanal de marketing con gráficos y tres conclusiones accionables. | Medición | LLM | low | reversible | core | Sheets, email | Recibe (snapshot listo) → Consulta (snapshot + diagnóstico) → Ordena → Ejecuta (email interno) → Deja rastro |
| A9 | NEW VRL-MKT-A03 | Detectar desviaciones de KPI frente al objetivo y emitir una alerta con hipótesis de causa. | Optimización | RULES | low | read_only | standard | Sheets, email | Recibe (snapshot listo) → Consulta (umbrales) → Decide (desviación) → Ejecuta (alerta) → Deja rastro |
| A10 | TSK-000179 (13-1161.00.5443) | Diseñar encuestas breves de validación de mensaje o de necesidad para el ICP. | Planificación | LLM | low | read_only | peripheral | Google Forms/Sheets | Recibe (petición) → Consulta (ICP + objetivo) → Ordena → Ejecuta (borrador) → Deja rastro |

Total: **10 tareas** (7 O*NET reutilizadas, 3 nuevas).

---

### 2.2 Especialista SEO/SEM · `search_marketing`

| Campo | Valor |
|---|---|
| name | Especialista SEO/SEM |
| seniority | operativo |
| family | Demand Generation |
| risk_level | high |
| model_tier | alto |
| mission | Traer tráfico de búsqueda cualificado por el dolor operativo del ICP, orgánico y pagado, sin que ambos compitan por la misma keyword y sin exceder nunca el techo de gasto. |
| autonomy_scope | Investiga keywords, audita el sitio, prepara briefs SEO e informes sin supervisión previa. Ajusta pujas y reparto diario dentro del techo aprobado, con límite duro y alerta automática. |
| requires_approval_scope | Activar o crear campañas, cambiar keywords negativas, cambiar metadatos o contenido publicado en la web, y cualquier cambio del techo de presupuesto. |
| never_does | Nunca excede el techo de gasto aprobado. Nunca activa una campaña sin aprobación. Nunca redacta contenido editorial — eso es Contenido y Promoción (LAB 11, Cap. 4). Nunca optimiza para términos genéricos de «inteligencia artificial» (LAB 11, Cap. 5). |

| # | task_code | Tarea (ES) | Proceso | Patrón | Riesgo | Efecto | Criticidad | Sistemas | Bloques |
|---|---|---|---|---|---|---|---|---|---|
| S1 | TSK-000163 (13-1161.01.16186) | Investigar tendencias de búsqueda y actividad de competidores en buscadores y entregar oportunidades. | Investigación | AGENT | low | read_only | core | Search Console, Google Ads (Keyword Planner), web | Recibe (cron) → Consulta (Search Console) → Consulta (Keyword Planner) → Ordena → Ejecuta (Sheets) → Deja rastro |
| S2 | TSK-000161 (13-1161.01.20319) | Construir el KeywordSet por dolor operativo del ICP, con volumen, intención y dificultad. | Investigación | LLM | low | read_only | core | Google Ads (Keyword Planner), Sheets | Recibe (petición / cron) → Consulta (ICP + tareas del catálogo) → Consulta (volúmenes) → Ordena (KeywordSet) → Ejecuta (Sheets) → Deja rastro |
| S3 | NEW VRL-MKT-S01 | Detectar solapes entre keywords orgánicas y pagadas y proponer el reparto SEO/SEM. | Planificación | RULES | low | read_only | standard | Search Console, Google Ads, Sheets | Recibe (cron) → Consulta (posiciones + términos pagados) → Decide (solape) → Ejecuta (Sheets) → Deja rastro |
| S4 | TSK-000128 (13-1161.01.16190) | Asignar keywords a páginas y entregar un ContentBrief SEO por página o pieza. | Planificación | LLM | low | reversible | core | Sheets, WordPress (lectura) | Recibe (KeywordSet) → Consulta (páginas existentes) → Decide (keyword→página) → Ordena (ContentBrief) → Ejecuta (Sheets) → Deja rastro |
| S5 | TSK-000151 (13-1161.01.20329) | Optimizar metatítulos, descripciones, alt y datos estructurados de páginas publicadas. | Creación de contenido | LLM | medium | reversible | standard | WordPress | Recibe (brief) → Consulta (página) → Ordena (propuesta) → Pide permiso → Ejecuta (WordPress) → Deja rastro |
| S6 | TSK-000119 (13-1161.01.20320) | Auditar indexación, Core Web Vitals y enlaces rotos y abrir incidencias priorizadas. | Optimización | SCRIPT | low | read_only | standard | Search Console, PageSpeed API | Recibe (cron) → Consulta (Search Console + PageSpeed) → Ordena → Decide (prioridad) → Ejecuta (incidencia) → Deja rastro |
| S7 | TSK-000166 (13-1161.01.16191) | Preparar campañas de búsqueda en Google Ads (grupos, anuncios, negativas) en pausa. | Distribución | API | high | reversible | core | Google Ads | Recibe (KeywordSet aprobado) → Consulta (techo + landing) → Ordena (campaña) → Pide permiso → Ejecuta (Google Ads, en pausa) → Deja rastro |
| S8 | NEW VRL-MKT-S02 | Ajustar pujas y reparto diario de presupuesto dentro del techo aprobado y registrar cada cambio. | Optimización | RULES | high | irreversible | core | Google Ads, email | Recibe (cron diario) → Consulta (gasto + rendimiento) → Decide (techo duro) → Ejecuta (pujas) → Deja rastro |
| S9 | NEW VRL-MKT-S03 | Proponer keywords negativas a partir del informe de términos de búsqueda. | Optimización | LLM | medium | reversible | standard | Google Ads | Recibe (cron semanal) → Consulta (términos) → Decide (irrelevantes) → Pide permiso → Ejecuta (Google Ads) → Deja rastro |
| S10 | TSK-000136 (13-1161.01.16192) | Recoger CTR, CPC, CPA, conversión y posición por keyword y dejarlos en el MetricsSnapshot. | Medición | API | low | read_only | core | GA4, Search Console, Google Ads | Recibe (cron) → Consulta (×3) → Ordena (MetricsSnapshot) → Ejecuta (Sheets) → Deja rastro |
| S11 | TSK-000117 (13-1161.01.20328) | Redactar el informe de búsqueda (posición, conversión orgánica, CAC, ROAS) para el Marketing Manager. | Medición | LLM | low | reversible | standard | Sheets, email | Recibe (snapshot listo) → Consulta (snapshot) → Ordena → Ejecuta (email interno) → Deja rastro |

Total: **11 tareas** (8 O*NET reutilizadas, 3 nuevas).

*Bloqueos LAB 11:* S5 depende del dominio y aviso legal (Cap. 5). S7–S9 se diseñan y prueban, pero no se activan sin entidad legal y cuenta publicitaria (Cap. 6).

---

### 2.3 Especialista de Contenido y Promoción · `content_promotion`

| Campo | Valor |
|---|---|
| name | Especialista de Contenido y Promoción |
| seniority | operativo |
| family | Demand Generation |
| risk_level | medium_high |
| model_tier | intermedio |
| mission | Convertir hallazgos de investigación y experiencia operativa en piezas publicables en la voz de la marca, y hacerlas llegar al ICP por el canal correcto. |
| autonomy_scope | Mantiene el calendario, redacta briefs y borradores, adapta piezas por canal y revisa la voz sin supervisión previa. Programa publicaciones y secuencias solo tras aprobación. |
| requires_approval_scope | Todo contenido nuevo de cara al público y toda secuencia de nutrición, sin excepción (LAB 11, Cap. 4). |
| never_does | Nunca publica ni envía nada sin aprobación humana. Nunca inventa cifras, casos ni clientes. Nunca usa «bot», «asistente» ni «herramienta» para un especialista. Nunca escribe contenido personal del Director de Marketing Agéntico. Nunca toca SEO técnico ni presupuesto. |

| # | task_code | Tarea (ES) | Proceso | Patrón | Riesgo | Efecto | Criticidad | Sistemas | Bloques |
|---|---|---|---|---|---|---|---|---|---|
| C1 | NEW VRL-MKT-C01 | Mantener el calendario editorial a 4 semanas a partir de hallazgos, keywords y fechas clave. | Planificación | LLM | low | reversible | core | Google Sheets | Recibe (cron semanal) → Consulta (hallazgos + KeywordSet + calendario) → Ordena → Ejecuta (Sheets) → Deja rastro |
| C2 | TSK-000197 (APQC 3.4.3.2) | Redactar el ContentBrief de cada pieza: objetivo, audiencia, mensaje, prueba, CTA y keyword. | Planificación | LLM | low | reversible | core | Sheets | Recibe (entrada de calendario) → Consulta (ICP + voz + keyword) → Ordena (ContentBrief) → Ejecuta (Sheets) → Deja rastro |
| C3 | TSK-000010 (11-2011.00.21222) | Redactar el borrador de una pieza (post LinkedIn, artículo, guía) a partir de su ContentBrief. | Creación de contenido | LLM | medium | reversible | core | Sheets / Google Docs | Recibe (brief) → Consulta (memoria de marca + fuentes) → Ordena (ContentDraft) → Ejecuta (Docs) → Deja rastro |
| C4 | TSK-000057 (11-2011.00.3226) | Revisar cada borrador contra la voz de LAB 03 y el diccionario y devolver incidencias concretas. | Creación de contenido | LLM | low | read_only | core | Docs | Recibe (ContentDraft) → Consulta (voz + diccionario) → Decide (cumple / incidencias) → Ejecuta (anotar) → Deja rastro |
| C5 | NEW VRL-MKT-C02 | Adaptar una pieza aprobada a cada canal respetando formato, longitud y CTA. | Creación de contenido | LLM | medium | reversible | standard | Docs | Recibe (pieza aprobada) → Consulta (reglas por canal) → Ordena (ContentDraft ×canal) → Pide permiso → Ejecuta (Docs) → Deja rastro |
| C6 | NEW VRL-MKT-C03 | Programar la publicación de una pieza aprobada en LinkedIn en la fecha del calendario. | Distribución | API | medium_high | irreversible | core | LinkedIn (página de empresa), Sheets | Recibe (pieza aprobada) → Consulta (calendario) → Pide permiso → Ejecuta (LinkedIn) → Deja rastro |
| C7 | TSK-000415 (APQC 3.4.3.6) | Montar la secuencia de nutrición de leads por encaje ICP hasta estado MQL. | Distribución | WORKFLOW | medium_high | irreversible | standard | HubSpot, email | Recibe (lead nuevo) → Ordena (Lead) → Consulta (secuencia aprobada) → Pide permiso (solo al alta de la secuencia) → Ejecuta (HubSpot) → Deja rastro |
| C8 | TSK-000077 (11-2011.00.3233) | Medir el rendimiento de cada pieza y campaña (alcance, clics, leads) frente a su objetivo. | Medición | LLM | low | read_only | standard | LinkedIn, HubSpot, GA4, Sheets | Recibe (snapshot listo) → Consulta (piezas publicadas) → Ordena → Ejecuta (Sheets) → Deja rastro |
| C9 | TSK-000061 (11-2011.00.21225) | Archivar cada pieza publicada con su brief, versión aprobada y métricas en la memoria organizativa. | Medición | SCRIPT | low | reversible | peripheral | Drive / memoria | Recibe (pieza publicada) → Ordena → Ejecuta (archivo) → Deja rastro |
| C10 | TSK-000309 (APQC 3.4.5.6) | Proponer cambios al calendario y a los briefs a partir del rendimiento de las últimas piezas. | Optimización | LLM | low | read_only | standard | Sheets | Recibe (cron mensual) → Consulta (rendimiento + calendario) → Decide (qué repetir / qué quitar) → Ejecuta (propuesta) → Deja rastro |

Total: **10 tareas** (7 reutilizadas: 4 O*NET + 3 APQC L4; 3 nuevas).

*Arranque LAB 11:* solo contenido corporativo en LinkedIn. No hereda el bloqueo de la web.

---

## 3. Bloques que se repiten

Todos los flujos son lineales. Donde hay «si pasa X» (alerta, techo), la lógica vive dentro del bloque Decide o del Ejecuta, nunca como rama del lienzo.

| Tipo | Bloque candidato | Sistema | Lo usan |
|---|---|---|---|
| intake | Recibe · Programación (cron) | Activepieces Schedule | A1–A3, A5, A7, S1–S3, S6, S8–S10, C1, C10 |
| intake | Recibe · Lead nuevo | HubSpot (webhook / trigger) | A4, C7 |
| intake | Recibe · Pieza aprobada / snapshot listo | Evento interno Vrutal | A6, A8, A9, S11, C5, C6, C8, C9 |
| normalize | Ordena · a MetricsSnapshot | — | A5, S10, C8 |
| normalize | Ordena · a Lead | — | A2, A4, C7 |
| normalize | Ordena · a ContentBrief / ContentDraft | — | S4, C2, C3, C5 |
| context | Consulta · GA4 (runReport) | GA4 Data API | A5, S10, C8 |
| context | Consulta · Search Console (searchAnalytics) | Search Console API | A5, S1, S3, S6, S10 |
| context | Consulta · Google Ads (informe / keyword planner) | Google Ads API | A5, S1, S2, S3, S8, S9, S10 |
| context | Consulta · LinkedIn estadísticas de página | LinkedIn Community Mgmt API | A5, C8 |
| context | Consulta · HubSpot contactos y actividad | HubSpot | A2, A4, A5, C7, C8 |
| context | Consulta · Perfil estructurado del cliente (ICP, competidores, techo SEM) | Vrutal (tenant) | A1, A2, A4, S2, S7, C2 |
| context | Consulta · Memoria de marca (voz + diccionario) | Vrutal (memoria) | C2, C3, C4, C5 |
| context | Consulta · Hoja de cálculo | Google Sheets | A6–A9, S4, S11, C1, C6, C10 |
| decide | Decide · Reglas ICP + intención | — | A2, A4 |
| decide | Decide · Umbral / desviación | — | A6, A9, S3 |
| decide | Decide · Techo de gasto duro | — | S8 |
| decide | Decide · Control de voz | LLM | C4 |
| gate | Pide permiso · Marketing Manager | Panel / email | A4, S5, S7, S9, C5, C6, C7 |
| act | Ejecuta · Escribir filas | Google Sheets | A1, A2, A5–A7, S1–S4, S10, C1, C2, C8 |
| act | Ejecuta · Enviar email interno | Gmail / SMTP | A3, A8, A9, S11 |
| act | Ejecuta · Actualizar propiedad | HubSpot | A4, C7 |
| act | Ejecuta · Programar post | LinkedIn | C6 |
| act | Ejecuta · Cambios en Google Ads | Google Ads API | S7, S8, S9 |
| act | Ejecuta · Actualizar página | WordPress REST | S5 |
| audit | Deja rastro · Registro de ejecución | Vrutal | Todas |

### Contratos mínimos

| Contrato | Campos |
|---|---|
| **MetricsSnapshot** | `period_start` (date), `period_end` (date), `channel` (linkedin\|seo\|sem\|email\|web), `metric` (text), `value` (numeric), `source` (ga4\|gsc\|google_ads\|linkedin\|hubspot) |
| **KeywordSet** | `keyword` (text), `icp_pain` (text: tarea del catálogo), `intent` (informational\|commercial\|transactional), `monthly_volume` (int), `difficulty` (0–100), `owner` (seo\|sem) |
| **ContentBrief** | `brief_id`, `objective` (text), `audience` (ref ICP), `key_message` (text), `evidence` (cifra o caso + fuente), `cta` (text), `target_keyword` (ref KeywordSet), `channel` |
| **ContentDraft** | `brief_id`, `channel`, `body` (text), `version` (int), `voice_check` (ok\|issues), `status` (draft\|approved\|scheduled\|published) |
| **Lead** | `lead_id` (ref CRM), `company_size` (int), `revenue_band` (text), `role` (ceo\|owner\|other), `intent_signals` (array), `stage` (lead\|mql_proposed\|mql) |
| **ApprovalRequest** | `subject_type`, `subject_ref`, `summary` (≤3 líneas), `risk`, `requested_by` (role key), `decision` (approved\|rejected\|pending) |

---

## 4. Qué construir primero

LAB 11 deja un solo canal desbloqueado hoy: contenido corporativo en LinkedIn. SEO espera al dominio y al aviso legal; SEM espera a la entidad legal. El orden sigue esa realidad.

| Orden | Tarea | Rol | Por qué |
|---|---|---|---|
| 1 | **C3 · TSK-000010** Redactar pieza desde brief (con C4 · TSK-000057 revisión de voz dentro del mismo recorrido) | content_promotion | Es el único canal activable ya. Estrena los bloques de memoria de marca, ContentBrief/ContentDraft y la puerta de aprobación. |
| 2 | **C6 · VRL-MKT-C03** Programar publicación en LinkedIn | content_promotion | Cierra el ciclo de extremo a extremo. Primera acción irreversible del sistema, detrás de Pide permiso. |
| 3 | **A5 · VRL-MKT-A02** MetricsSnapshot semanal (LinkedIn + HubSpot + GA4) | marketing_analyst | Sin medición el piloto no genera el caso de éxito que LAB 11 declara pendiente. Alimenta A6, A8, A9, S11, C8. |
| 4 | **A4 · VRL-MKT-A01** Puntuar lead y proponer MQL | marketing_analyst | Es la frontera Marketing→Ventas (LAB 11, Cap. 9) y el punto de entrada del SDR ya diseñado. Con aprobación hasta calibrar. |
| 5 | **S2 · TSK-000161** KeywordSet por dolor del ICP | search_marketing | Solo lectura, sin bloqueo. Alimenta los briefs de contenido hoy y deja SEO/SEM listos para cuando se levanten los bloqueos. |

---

## 5. Preguntas abiertas para el founder

1. **Aprobador.** ¿El founder aprueba todo mientras no haya Marketing Manager humano, o se nombra un suplente desde el alta (LAB 08, Cap. 17 exige suplente)?
2. **MQL.** ¿A4 queda en Marketing (LAB 11) o se reserva para el futuro Lead Qualifier de Ventas que menciona el SDR? La propuesta lo deja en Marketing con aprobación obligatoria.
3. **SEM autónomo.** S8 ajusta pujas sin aprobación dentro del techo, como fija LAB 11, Cap. 6. ¿Confirmas, o en v1 también pasa por Pide permiso hasta ver datos?
4. **Contenido y Promoción en un solo rol.** LAB 08 separa «Promociones / PDV» y «Email / Loyalty». ¿Fusionamos promoción y nutrición (C7) aquí para v1, o la nutrición va a un rol Email aparte?
5. **model_tier.** No hay valores normalizados en el catálogo. Propuesta: `bajo | intermedio | alto` (LAB 08, capa de enrutado por riesgo). ¿Lo fijamos como check?
6. **Reutilizar APQC L4.** Tres tareas enlazan filas APQC genéricas (3.4.3.2, 3.4.3.6, 3.4.5.6). ¿Aceptable, o prefieres siempre tarea interna con enunciado propio y APQC solo como referencia?
7. **Flags en tareas O*NET compartidas.** El SQL fija proceso, patrón, riesgo y flags en filas O*NET que hoy están vacías. Esos valores pasan a ser globales para cualquier rol que las use. ¿De acuerdo?
8. **Sistemas.** ¿Confirmas HubSpot como CRM y Google Sheets como almacén de calendario y métricas en v1, o hay otro destino (Notion, Supabase)?

---

## Decisiones del founder (2026-10-01) · aplicado en la migración 020

| Pregunta | Decisión | Qué cambia en el catálogo |
|---|---|---|
| ¿Quién aprueba? | El founder, único aprobador por ahora | Nada: los roles ya exigen aprobación humana |
| Puntuar leads (MQL) | Es de Ventas, aunque hoy sea la misma persona | VRL-MKT-A01 sale del Analista y se enlaza al **SDR**. El Analista queda con 9 tareas |
| Pujas de Google Ads | v1 con aprobación; después, sin aprobación dentro del presupuesto máximo | VRL-MKT-S02 `requires_approval = true`; el objetivo queda escrito en el alcance del rol |
| Nurturing | Rol propio, futuro: **Email y Fidelización** | TSK-000415 sale de Contenido (queda con 9 tareas). El rol nuevo se diseña aparte |
| CRM y hojas | HubSpot como CRM. Hojas online: **Google Sheets** | Las hojas son vistas para el founder, no la fuente de datos: los datos viven en HubSpot y en la BBDD del cliente |

**Estado en Vrutal1st:** Analista de Mercado (9), Especialista SEO/SEM (11), Contenido y Promoción (9), todos en borrador. El SDR suma la puntuación de leads.
