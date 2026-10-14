# Dossier de Automatización: Qué Roles Reemplaza la IA (y Cómo)

*Auditoría por departamento — método Prompt / Flujo / Agente*

No hay adornos aquí. Cada fila es una tarea real, con el mecanismo exacto que la sustituye o la transforma, el stack técnico y el nivel de riesgo. Donde algo sigue siendo humano, se dice sin rodeos.

---

## Cómo leer esto

Tres niveles de intervención, de menor a mayor autonomía:

| Nivel | Qué es | Ejemplo de stack |
|---|---|---|
| **PROMPT** | Instrucción puntual a un LLM. Sin memoria persistente, sin herramientas, sin flujo de datos. Sirve para tareas de una sola vez. | Claude/GPT vía chat o API directa |
| **FLUJO** | Automatización con reglas fijas. Ejecuta, no delibera. Uno o varios nodos LLM incrustados en un pipeline determinista. | n8n / Make / Zapier + nodo LLM |
| **AGENTE** | Sistema con memoria (estructurada + vectorial), alcance de decisión documentado y escalado a humano cuando se sale de ese alcance. Puede equivocarse y aprender — por eso necesita límites explícitos. | Python: LangChain, LangGraph, CrewAI o AutoGen, con memoria en PostgreSQL (histórico) + Qdrant/pgvector (RAG), orquestado vía n8n |

**Nivel de riesgo** (determina qué modelo se usa y cuánta supervisión):
- 🟢 **Bajo** — interno, reversible, error barato.
- 🟡 **Medio** — reversible pero visible de cara al cliente o al negocio.
- 🔴 **Alto** — toca presupuesto, datos que contaminan otros sistemas, o compromisos públicos de marca. Requiere modelo de mayor capacidad + límites duros + aprobación humana.

---

## 1 · Marketing y Contenido

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Borradores de blog/SEO | Prompt | Claude/GPT + brief de marca | 🟢 | Voz final, aprobación de publicación |
| Calendario editorial y publicación | Flujo | n8n + CMS API (WordPress) | 🟢 | Línea editorial |
| Creatividades y banners publicitarios | Prompt | API de generación de imagen + revisión | 🟢 | Dirección de arte |
| Community management (respuestas en redes) | Agente | Python (CrewAI) + Qdrant (tono de marca) + n8n | 🟡 | Crisis, quejas graves, sarcasmo ambiguo |

## 2 · Adquisición (SEO / SEM)

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Keyword research y optimización on-page | Agente | Python + Search Console API + Qdrant (guía de marca) | 🟡 | Contenido nuevo de cara al público |
| Gestión de pujas y presupuesto SEM diario | Agente | Python + Ads API, límite de gasto duro, modelo de alta capacidad | 🔴 | Lanzar canal nuevo, subir presupuesto total |
| Reporting de rendimiento de campañas | Flujo | n8n + Python (pandas) → Power BI | 🟢 | Interpretación estratégica |

## 3 · Ventas

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Cualificación inicial de leads (SDR nivel 1) | Agente | Python (LangChain) conectado al CRM, guion de discovery fijo | 🟡 | Cierre, negociación de precio |
| Generación de propuestas comerciales | Flujo | n8n + plantilla + datos del CRM | 🟢 | Ajuste de pricing caso a caso |
| Follow-up y recordatorios | Flujo | n8n + CRM + email/WhatsApp API | 🟢 | — |

## 4 · Atención al Cliente

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Tickets nivel 1 (FAQs, estado de pedido) | Agente | Python + RAG sobre Qdrant, integrado en el helpdesk vía n8n | 🟡 | Reembolsos y excepciones a política |
| Triage y enrutado de tickets | Flujo | n8n + clasificador LLM | 🟢 | — |

## 5 · Finanzas y Administración

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Conciliación bancaria y validación de facturas | Flujo/Agente | Python + OCR + ERP API vía n8n | 🟡 | Discrepancias por encima de umbral |
| Reporting financiero mensual (P&L, cashflow) | Flujo | Python (pandas) + PostgreSQL → Power BI | 🟢 | Decisión de inversión |
| Análisis de pricing y elasticidad | Agente | Python (modelos estadísticos) + LLM para redactar hallazgos | 🔴 | Decisión final de precio |

## 6 · RRHH

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Cribado inicial de CVs | Agente | Python + LLM, criterios fijos, salida siempre a revisión humana | 🟡 | Decisión de contratación |
| Onboarding administrativo (docs, accesos) | Flujo | n8n + firma electrónica + provisioning de accesos | 🟢 | — |

## 7 · Operaciones y Logística

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Previsión de demanda e inventario | Agente | Python (forecasting) + LLM para explicar el output | 🔴 | Decisión de compra grande |
| Actualización de estado de pedidos | Flujo | n8n + API de transporte/ERP | 🟢 | — |

## 8 · Legal

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Primera revisión de contratos estándar (NDA, DPA) | Agente supervisado | Python + LLM, marcado de cláusulas fuera de plantilla | 🔴 | Firma, cualquier cláusula no estándar |
| Registro de cumplimiento | Flujo | n8n + checklist automatizado | 🟢 | — |

## 9 · IT / Datos

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Limpieza y deduplicación de CRM/ERP | Agente | Python + reglas de validación + LLM para casos ambiguos | 🔴 (contamina todo lo que depende del dato) | Cambios de esquema |
| QA y testing de releases menores | Agente | Python + frameworks de testing + LLM generador de casos | 🟡 | Despliegue a producción |

## 10 · Dirección / Reporting Ejecutivo

| Tarea / rol | Método | Stack técnico | Riesgo | Sigue siendo humano |
|---|---|---|---|---|
| Consolidación de KPIs multi-fuente (Ads, CRM, ERP, Web) | Flujo | Python (pandas/Airflow) + n8n → Power BI REST API / Dataflows | 🟢 | Definir qué KPI importa |
| Resumen ejecutivo semanal | Agente | Python + LLM leyendo el modelo semántico de Power BI vía API | 🟡 | Decisión estratégica |
| Alertas de anomalías (caída de CAC, ROAS, margen) | Flujo | n8n + Python (detección de outliers) → Slack/Teams | 🟢 | — |

---

## Nota de honestidad intelectual

Esto no es una lista para vaciar un organigrama de golpe. El propio despliegue de Vrutal fija que **un rol entra a producción a la vez, medido y corregido** — nunca se lanza la capa agéntica completa de una tacada. La razón no es prudencia de marketing: un agente con alcance de decisión mal calibrado propaga errores más rápido de lo que un humano los detecta. Cada fila roja (🔴) de esta tabla no se despliega sin fase de testeo en paralelo contra casos reales.

Lo que sí es cierto, sin matices: en cada fila de esta tabla, la tarea —no la persona— es lo que se estandariza. Lo que queda del lado humano es exactamente lo que no se puede documentar en una ficha: criterio, ambición, y la decisión de qué vale la pena construir.
