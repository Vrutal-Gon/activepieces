# SaaS Startup Project Manager Playbook

> Status: Living document  
> Version: 1.1  
> Last Updated: 2026-10-09  
> Owner: Gonzalo (founder) — acting PM until the first hire ([[staff-access-model]])  
> Company: Vrutal Labs  
> Product: VRUTAL OS — the agentic specialist platform deployed per client, plus Panel Vrutal1st (Vrutal's own control plane) and VrutalOS/app (the client-facing app)

> This playbook adapts the generic SaaS-PM template to Vrutal Labs' actual state. Gaps are filled with what is documented in the LABs (`docs/labs/`) and the BRIEF, never with invented numbers — consistent with Vrutal's own rule: *"No inventes cifras, clientes, casos de éxito ni resultados. Si falta un dato, pregúntalo"* (BRIEF §11). Where a real figure doesn't exist yet, this document says so explicitly instead of fabricating one. Section 24 incorporates the engineering-collaboration principles from `CLAUDE.md` in this same folder (Andrej's guidelines) into how this PM role actually operates day to day.

## 1. Executive Summary

Vrutal Labs designs the agentic layer of companies: a second org chart of AI specialists that works in parallel to the human team, absorbs repetitive and analytical work, and leaves people what requires judgment (BRIEF §1). This document defines how Vrutal manages product, engineering, operations, and go-to-market work to deliver that platform — today as a one-person studio building on an internal pilot (Vrutal-lab), tomorrow as a team.

It provides:
- A clear operating rhythm for decisions and communication
- A roadmap structure for product and technical execution (built on Vrutal's own Audit→Report→Design→Test→Deploy→Evolve method, LAB 15)
- Risk and dependency tracking
- A lightweight but effective project governance model
- Delivery metrics tied to business impact — reported only once real data exists, never estimated to look useful (BRIEF §7, "Honestidad intelectual")

The PM (today: the founder) is accountable for planning, prioritization, communication, delivery tracking, stakeholder alignment, and launch readiness.

---

## 2. Mission and Objectives

### Product Mission
"Ayudar a las empresas, especialmente pymes, a escalar sus operaciones con IA y especialistas agénticos sin aumentar sus costes fijos de estructura" (Misión, BRIEF §2).
Purpose: construir empresas capaces de evolucionar más rápido que su entorno. Tagline: *Building Intelligent Companies.*

### Business Objectives
Real state today (BRIEF §9 — no se comunica nada que lo contradiga): sin entidad legal constituida, sin clientes fuera del piloto interno, sin cifras de MRR/CAC que reportar. The objectives below are therefore qualitative, not quota-based, until the pilot produces real numbers:
- Constituir la entidad legal y fiscal — bloqueante principal: sin ella no se firman contratos, no se publica aviso legal y no se activa SEM (BRIEF §9)
- Cerrar el piloto interno (Vrutal-lab) con al menos un especialista operando de forma medible, para dejar de depender de "operativo en teoría" (BRIEF §9, incoherencia conocida con LAB 15)
- Conseguir el primer cliente externo real contra el ICP ya fijado (§3.1 abajo)
- Cerrar los puntos abiertos de LAB 10/13 (catálogo de objeciones, umbral de concurrencia, descuento por volumen) con datos reales, no estimados
- Mantener el roadmap de producto avanzando por el método Audit→Report→Design→Test→Deploy→Evolve (LAB 15)

### Project Objectives
- Deliver customer value consistently
- Reduce delivery risk
- Improve decision speed
- Keep milestones realistic
- Maintain a high-quality product experience
- Resolver cualquier empate de prioridad por el orden fijo de Vrutal, no por preferencia: evidencia > ambición comercial, documentación > velocidad, simplicidad > sofisticación, principio > herramienta concreta (BRIEF §7)

---

## 3. Scope and Constraints

### 3.1 ICP (for reference across this document)
Empresa B2B, menos de 50 empleados, menos de 40 M€ de facturación, cualquier sector, interlocutor CEO/propietario sin tiempo y escéptico por defecto, capaz de nombrar al menos una tarea repetitiva que hoy hace una persona y que no puede justificar como contratación (BRIEF §4.2). No encaja quien quiere "implementar IA" como proyecto de innovación sin problema operativo real detrás.

### In Scope
- Plataforma base (Docker, Activepieces, PostgreSQL, Qdrant) y los especialistas por rol ya fijados en el catálogo (LAB 07)
- Panel Vrutal1st (plano de control de Vrutal) y VrutalOS/app (app del cliente) — ambos React 19 + Vite + TS + Supabase
- Flujos de Activepieces: diseño en draw.io, aprobación, y solo entonces construcción 1 a 1 ([[feedback-flows-batch-method]])
- Integraciones de cliente (HubSpot, Anthropic, etc.) vía Vault cifrado, altas solo por el Admin del cliente desde Integraciones ([[client-keys-admin-only]])
- Onboarding de cliente (Kickoff → Auditoría → Informe → Diseño → Testeo → Despliegue, LAB 12/BRIEF §4.3)

### Out of Scope
- Unapproved large-scale rewrites
- Broad platform overhauls without leadership sign-off
- Feature work not tied to clear customer or revenue value
- Sustituir el stack ya en uso del cliente (Vrutal se construye alrededor, nunca lo reemplaza — BRIEF §4.3)
- Prometer alcance autónomo que un especialista no tiene validado en producción (LAB 08, Cap. 17)
- Un especialista que sustituye el juicio de una persona y no solo su ejecución — límite fijo de la Empresa Aumentada, Artículo II (LAB 15)
- Vender IA o herramientas sueltas — Vrutal no es agencia, consultora genérica, software house ni empresa de automatización (BRIEF §1)

### Constraints
- Budget: sin cifra pública fijada; LAB 13 fija el suelo de coste de infraestructura, no un presupuesto operativo — no se inventa una cifra aquí
- Team: 1 (el founder, Gonzalo), haciendo de Product/Eng/Ops/PM a la vez; esta sección se revisa en la primera contratación ([[staff-access-model]])
- Timeline: sin fecha de cierre fijada; LABs en v0.9 "en espera de v1.0 al nacer Vrutal" (constitución legal de la entidad)
- Dependencies: constitución legal (bloqueante principal), Hetzner (VPS), Supabase, Activepieces autoalojado, HubSpot (CRM interno), proveedor de datos B2B para el especialista SDR (pendiente de elegir, LAB 13 Cap. 9)
- Resource limitations: equipo de una persona; todo el desarrollo se apoya en agentes de código (Claude Code) bajo los principios de la Sección 24
- Platform constraints: Docker (aislamiento por cliente, nunca se mezclan datos), Activepieces como orquestador (sustituyó a n8n), PostgreSQL, Qdrant (memoria vectorial), VPS Hetzner (compartido → dedicado CPX22/32/42 según tier), React 19 + Vite + TypeScript + Supabase en ambos frontends

---

## 4. Stakeholders

Hoy Vrutal Labs es un equipo de una persona: el founder cubre todos los roles de la tabla genérica de abajo a la vez (Product, Eng, Design, Sales, Marketing, Finance). Se mantiene la tabla de roles como referencia para cuándo se incorpore el primer hire, no como organigrama actual ([[staff-access-model]]: founder sole superadmin; ops verán solo su cartera vía `staff_can_access_tenant`; se revisan permisos en la primera contratación).

| Stakeholder | Role | Interest | Influence | Communication Cadence |
|---|---|---|---|---|
| Founder/CEO (Gonzalo) | Visión, producto, ingeniería, ventas — todo, hoy | Crecimiento, llegar al primer cliente, constituir la entidad | Alta (única decisora) | Continua |
| Especialistas agénticos (IA) | Director de Marketing Agéntico, PM Agéntico, managers de línea y ejecución (SEO, SEM, Data/CRM, Email/Loyalty, etc.) — catálogo LAB 07 | Ejecutan el trabajo real una vez desplegados; todo contenido público exige aprobación humana | Media (ejecutan, no decide) | Por flujo/tarea |
| Vrutal-lab (piloto interno) | Cliente 0 | Caso de aplicación real mientras no hay clientes externos | Media | Continua |
| Futuro cliente (ICP) | CEO/propietario de pyme B2B, < 50 empleados, < 40 M€ | Delegar una tarea repetitiva cara sin contratar | Alta una vez en discovery | Según LAB 10 (discovery → propuesta → contrato) |
| Legal/gestoría | Constitución de la entidad, contratos (LAB 14) | Desbloquear facturación, aviso legal, SEM | Alta (bloqueante) | Según necesidad |
| Proveedores de infraestructura (Hetzner, Supabase) | Coste real del tronco compartido (LAB 13 Cap. 4) y de cada tier | Estabilidad de coste, SLA | Media | Trimestral (cláusula de revisión, LAB 13 Cap. 7) |

---

## 5. PM Responsibilities

### Core Responsibilities
- Define scope, milestones, and delivery plans
- Prioritize work based on business value and risk
- Coordinate team activities across product, engineering, design, and ops
- Keep stakeholders informed with clear status reporting
- Manage risk, blockers, and assumptions
- Drive decision-making and escalation
- Own project health dashboards and reporting
- Ensure launches are planned, tested, and communicated

### Decision Rights
Hoy, todas estas filas son la misma persona (el founder); se listan separadas porque son los roles que se repartirán en la primera contratación, no porque existan hoy comités distintos:
- PM owns timeline coordination and communication
- Product lead owns feature prioritization
- Engineering manager owns technical feasibility and estimates — hoy, además, aplica los principios de la Sección 24 (Andrej) a cualquier trabajo ejecutado con un agente de código
- Leadership approves scope, budget, and strategic pivots
- Customer-facing teams validate adoption and customer experience issues
- Ningún cambio estructural depende de un proveedor concreto (Hetzner, Supabase, Activepieces); si uno falla, el principio se mantiene y se cambia la pieza (BRIEF §7, "Herramienta concreta vs principio: gana el principio")

---

## 6. Delivery Framework

### Método real de Vrutal (no genérico)
Vrutal ya tiene un método documentado de seis etapas para cualquier iniciativa de producto, fijado en LAB 15, y no se sustituye por un framework Agile genérico:

| Etapa | Qué responde |
|---|---|
| Audit | ¿Qué existe hoy, y dónde está realmente el problema? |
| Report | ¿Qué patrón queda una vez comparados varios casos, no uno solo? |
| Design | ¿Cuál es la solución más simple que resuelve el patrón, no el caso aislado? |
| Test | ¿Sobrevive la solución a un uso real, antes de prometerla? |
| Deploy | ¿Sale con el alcance autónomo más conservador que admite (LAB 08, Cap. 17)? |
| Evolve | ¿Qué aprende el sistema de esta iteración, y a dónde entra esa memoria? |

Para el nacimiento de un especialista concreto (no una función de plataforma), el método equivalente es el de 5 fases de BRIEF §4.3 / LAB 08 Cap. 15: **Auditoría → Informe → Diseño → Testeo → Despliegue y evolución**, siempre un rol cada vez, nunca sustituyendo el stack del cliente.

Para flujos de Activepieces en concreto, el método ya validado es más estricto todavía ([[feedback-flows-batch-method]]): se diseñan 10 flujos en draw.io, se aprueban, y solo entonces se construyen 1 a 1 en Activepieces — nunca se toca la API antes de tener el diseño aprobado. Esto es la aplicación directa del principio "Think Before Coding" de la Sección 24.

### Cadence
Pensada para equipo de 1; se activa el resto al incorporar más personas:
- Revisión de alcance antes de construir: por flujo/feature, no diaria (sustituye al daily stand-up mientras el equipo sea una persona)
- Revisión de roadmap: cuando una función entra en Audit, avanza de etapa, o se descarta — no en una revisión periódica fija (disparador de LAB 15, no calendario)
- Revisión de precios/infraestructura: trimestral programada, o inmediata si el coste de VPS/GPU/memoria sube más de 15-20% (cláusula de LAB 13 Cap. 7)
- Al incorporar equipo: añadir daily stand-up (10-15 min), sprint planning semanal, status semanal, roadmap biweekly y revisión mensual de liderazgo, en ese orden de prioridad

---

## 7. Project Charter

### Project Name
[Project / initiative name]

### Problem Statement
[What problem are we solving?]

### Goal
[Desired outcome and measurable impact]

### Success Criteria
- [Metric 1] improves from [baseline] to [target]
- [Metric 2] improves from [baseline] to [target]
- Launch complete by [date]
- User satisfaction score above [target]
- Support issues reduced by [target %]

### Scope Summary
- User segment: [Who]
- Primary workflow: [What]
- Secondary benefits: [What else]
- Constraints: [Limitations]

### Assumptions
- [Assumption 1]
- [Assumption 2]
- [Assumption 3]

### Dependencies
- [Dependency 1]
- [Dependency 2]

### Risks
- [Risk 1]
- [Risk 2]

### Ejemplo real (en vez de inventar uno): Panel Vrutal1st, Fase 2
- **Problem:** Vrutal (el founder) necesita un plano de control propio para gestionar clientes, catálogo y flujos sin depender de hojas sueltas.
- **Goal:** panel operativo con login/2FA, catálogo de roles y tareas, composiciones, biblioteca de bloques, y ficha de cliente con dashboard.
- **Success criteria:** Fase 1 (login, 2FA, router, marca, endurecimiento) y Fase 2 (diseño aprobado, dashboard, ficha de cliente) completadas — ya commiteadas (`3365bc50`, `2e20c3a5`, `3b4a0499`); siguiente hito: completar la Fase 2 de pantallas restante.
- **Dependencies:** migraciones 001-007 aplicadas; diseño aprobado antes de construir cada pantalla ([[composition-no-branching]]: una Composición es siempre secuencial, cualquier lógica de branching va dentro de un Bloque de Activepieces, nunca en el canvas).
- **Risks:** acoplar el panel a decisiones de producto todavía abiertas (p. ej. administradores pendientes de decidir, ver `VrutalOS/README.md`).

---

## 8. Roadmap

### Product Roadmap (horizonte real, LAB 15 — no por trimestre)
Vrutal no planifica por quarter con fecha fija; planifica por certeza y etapa (Audit/Design/Deploy), conforme al método de la Sección 6:

| Horizonte | Qué incluye | Etapa |
|---|---|---|
| **Ahora** | Especialistas por rol del catálogo (SEO, SEM, Data/CRM, Email/Loyalty…); plataforma base (Docker, Activepieces, PostgreSQL, Qdrant) | En Deploy o recién en Evolve |
| **Próximo** | Asistente tipo PA (minutas de reunión); Memoria Organizativa consultable por el cliente; app móvil para ventas de calle | Audit o Design ya iniciado |
| **Explorando** | Varios especialistas en una misma sesión; voz; agentes de estrategia; índice de conocimiento alojado en casa del cliente; fusión de equipo humano y agéntico | En Audit, sin Design todavía |

Límite fijo de todo el roadmap: un especialista que sustituye el juicio de una persona, y no solo su ejecución, deja de ser aumentación — no se construye (Artículo II de la Constitución).

### Release Planning (estado real de las piezas internas, no fechas de venta — Vrutal aún no vende al mercado externo)
| Pieza | Estado | Exit Criteria |
|---|---|---|
| VrutalOS/app — Fase 0 · diseño | Aprobado en principio (layouts usuario y admin) | Mockup navegable validado |
| VrutalOS/app — Fase 1 · shell | Hecho | Login, recuperación, perfil/rol, shell con los dos layouts |
| VrutalOS/app — Fase 2 · pantallas | En curso, una a una | Especialistas, Equipo, Accesos, Integraciones, Consumo y Aprobaciones ya construidas; resto "próximamente" |
| VrutalOS/app — Pendiente | No iniciado | 2FA, búsqueda, notificaciones |
| Panel Vrutal1st — Fase 1 | Hecho (`2e20c3a5`) | Login, 2FA, router, marca, endurecimiento |
| Panel Vrutal1st — Fase 2 | Diseño aprobado, en construcción (`3b4a0499`) | Dashboard y ficha de cliente completos |

---

## 9. Prioritization Framework

Use this framework for prioritization:

### Scoring Criteria
- Customer value: 1-5
- Revenue impact: 1-5
- Strategic alignment: 1-5
- Effort required: 1-5
- Risk reduction: 1-5
- Urgency: 1-5

### Priority Formula
Priority Score = Customer Value + Revenue Impact + Strategic Alignment + Risk Reduction + Urgency - Effort

### Prioritization Categories
- P0: Critical blockers / must ship
- P1: High value, next sprint
- P2: Important but can wait
- P3: Nice-to-have

### Regla de empate de Vrutal (gana antes que la puntuación)
Cuando dos iniciativas puntúan igual o el score no es claro, no se decide por intuición: se aplica el orden fijo de BRIEF §7, en este orden —
1. Evidencia > ambición comercial (prometer de más es el único error irreversible)
2. Documentación > velocidad (lo no documentado no ha existido)
3. Simplicidad > sofisticación
4. Principio > herramienta concreta (ninguna decisión estructural depende de un proveedor)

Y P0 real hoy: constituir la entidad legal — es lo único que bloquea contratos, aviso legal y SEM (BRIEF §9).

---

## 10. Work Breakdown Structure

### Workstreams (reales, por carpeta del repo)
- Documentación LAB (`docs/labs/`) — fuente de verdad de qué es Vrutal y cómo funciona
- Panel Vrutal1st (`Panel-Vrutal1st/`) — plano de control de Vrutal
- VrutalOS/app (`VrutalOS/app/`) — app del cliente, un despliegue por cliente
- Flujos y bloques (`Activepieces/flows/`, `Activepieces/tools/`) — diseño en draw.io, aprobación, construcción 1 a 1
- Base de datos (`db/migrations/`, `db/plantillas/`) — migraciones numeradas del plano de control y plantilla por cliente
- Infraestructura (`infra/`) — plantillas Docker, edge (Traefik) e instancia de cliente
- Marca (`marca/`) — identidad visual, Brand Book
- Comercial (`docs/comercial/`) — presentaciones y diagramas

### Example Work Breakdown (estado real, no ejemplo inventado)
| Workstream | Deliverables | Owner | Status |
|---|---|---|---|
| Panel Vrutal1st | Login, 2FA, router, marca, endurecimiento (Fase 1) | Founder | Hecho |
| Panel Vrutal1st | Biblioteca de bloques, composiciones, migraciones 001-007 | Founder | Hecho |
| Panel Vrutal1st | Dashboard y ficha de cliente (Fase 2) | Founder | En curso |
| VrutalOS/app | Especialistas, Equipo, Accesos, Integraciones, Consumo, Aprobaciones | Founder | Hecho |
| VrutalOS/app | 2FA, búsqueda, notificaciones | Founder | No iniciado |
| Marketing (F4) | Catálogo en draft, falta commit a VrutalOS para publicar Ordena y la composición | Founder | Bloqueado ([[mkt-f4-pending-commit]]) |

---

## 11. Sprint Planning Template

> **Sprint en curso:** [`SPRINT_02.md`](SPRINT_02.md) (semana del 2026-10-15). Anterior: [`SPRINT_01.md`](SPRINT_01.md), cerrado. La plantilla de
> abajo se queda para reutilizar; cada sprint se escribe en su propio `SPRINT_NN.md`.

### Sprint Goal
[Describe the purpose of this sprint]

### Success Metrics
- [Metric 1]
- [Metric 2]

### Scope
#### Planned
- [Story / Task]
- [Story / Task]

#### Deferred
- [Story / Task]

### Dependencies
- [Dependency]
- [Dependency]

### Risks
- [Risk]
- [Risk]

### Definition of Done
- Code reviewed
- Tests complete
- Documentation updated — en Vrutal, lo no documentado no ha existido (BRIEF §7); una migración o decisión sin su `.sql`/LAB actualizado no cuenta como hecho
- QA sign-off complete
- Feature validated with user flow
- Release notes prepared
- Criterio de éxito verificable definido *antes* de empezar, no al final (Sección 24, "Goal-Driven Execution" — Andrej)
- Cambio trazable 1:1 a la petición: si el diff toca algo que no estaba pedido, se separa o se señala, no se cuela (Sección 24, "Surgical Changes" — Andrej)

---

## 12. Risk Register

| Risk | Likelihood | Impact | Owner | Mitigation | Status |
|---|---|---|---|---|---|
| Sin entidad legal ni fiscal constituida | Alta (hoy cierto) | Alto — bloquea contratos, aviso legal y SEM | Founder | Constituir la entidad (BRIEF §9) | Active |
| Sin clientes ni casos de éxito fuera del piloto interno | Alta (hoy cierto) | Alto — nada que mostrar en ventas/demo real | Founder | Cerrar el piloto Vrutal-lab con resultado medible | Active |
| Volatilidad de coste de infraestructura (VPS Hetzner +2,4-2,75x en jun-2026; DRAM +88-93% en Q1-2026) | Media-Alta (ya ocurrió una vez) | Alto — se come el margen de los 5 tiers (LAB 13 Cap. 5-6) | Founder | Cláusula de revisión trimestral o disparada si sube >15-20% (LAB 13 Cap. 7) | Monitoring |
| Proveedor de datos B2B para el especialista SDR sin filtro de cumplimiento (precedente LinkedIn/Microsoft vs. Proxycurl, ene-2025) | Media | Alto — riesgo legal trasladable al cliente | Founder | Filtro de cumplimiento antes de precio (LAB 13 Cap. 9); candidatos Apollo.io / People Data Labs, pendiente de cerrar | Active |
| Equipo de una persona (bus factor) | Alta (hoy cierto) | Medio — capacidad limitada, todo pasa por el founder | Founder | Priorizar por el framework de la Sección 9; documentar todo en LABs/memoria, no en la cabeza de una persona | Active |
| Umbral de concurrencia (compartido → dedicado) sin medir | Alta (hoy cierto) | Medio — los costes de LAB 13 son estimación, no medición | Founder | Medir con el despliegue piloto de Vrutal-lab (LAB 08 Cap. 22) | Active |
| Scope creep en el desarrollo asistido por agente de código | Media | Medio | Founder | Aplicar "Simplicity First" y "Surgical Changes" de la Sección 24 en cada tarea | Active |

---

## 13. Dependency Tracking

### Internal Dependencies
- Diseño aprobado en `diseno/` antes de construir cualquier pantalla (fuente de verdad del diseño)
- Flujos aprobados en draw.io antes de tocar la API de Activepieces ([[feedback-flows-batch-method]])
- Migraciones numeradas aplicadas en orden (`db/migrations/`, `db/plantillas/cambios/`)
- Catálogo de Vrutal (tareas, KPIs) nunca expuesto al cliente — decidido 2026-10-06

### External Dependencies
- Constitución legal de la entidad (gestoría/notario) — bloqueante de LAB 14
- Hetzner (VPS, edge Traefik)
- Supabase — dos proyectos: Vrutal 1st (`apmhvqlvwjcrwfaixgju`, plano de control) y VrutalOS (`rgauumxztblwurzebmsa`, cliente 0)
- Activepieces autoalojado (sustituyó a n8n)
- HubSpot — CRM interno de Vrutal, operado por el especialista de Data vía Activepieces
- Proveedor de datos B2B para el especialista SDR — pendiente de elegir (LAB 13 Cap. 9)
- Anthropic — hoy con clave de test en Gmail personal, deuda a pagar antes del primer cliente ([[client-keys-admin-only]])

### Dependency Log
| Dependency | Owner | Due Date | Status | Notes |
|---|---|---|---|---|
| Constitución de la entidad legal | Founder | Sin fecha fijada | Pending | Bloquea contratos, aviso legal, SEM (BRIEF §9) |
| Función `team-invite` desplegada | Founder | Sin fecha fijada | Pending | Necesaria para "Invitar persona" en VrutalOS/app Equipo |
| Edge Function `client-users` + permiso de conexión del cliente | Founder | Sin fecha fijada | Pending | Necesaria para pestaña Usuarios de la ficha de cliente en Vrutal1st |
| Commit a VrutalOS del catálogo F4 (Marketing) | Founder | Sin fecha fijada | Pending | Bloquea publicar Ordena y la composición ([[mkt-f4-pending-commit]]) |

---

## 14. Launch Readiness Checklist

Adaptado al proceso real de Vrutal para el primer cliente externo (BRIEF §4.3 / LAB 12): Auditoría (se cobra siempre) → Informe → Diseño → Testeo → Despliegue de un especialista a la vez.

### Product Readiness
- [ ] Core functionality tested
- [ ] Stability tested under expected load
- [ ] Analytics instrumentation complete
- [ ] Error handling and fallback flows validated
- [ ] Security review completed
- [ ] Nada entra en producción sin supervisión; testeo en paralelo contra casos reales (BRIEF §4.3, etapa "Testeo")
- [ ] Claves del cliente cargadas solo por su Admin vía Integraciones, nunca por Vrutal ([[client-keys-admin-only]])

### Go-to-Market Readiness
- [ ] Entidad legal constituida y aviso legal publicado — bloqueante antes de firmar nada (BRIEF §9)
- [ ] Discovery abierto con las tres preguntas fijas de LAB 10 Cap. 3 (tarea repetitiva más cara, qué pasaría si desaparece, qué se probó ya y por qué falló)
- [ ] Propuesta construida con un solo especialista — el que ataca la inercia identificada, no el catálogo completo (LAB 10 Cap. 4)
- [ ] Precio del tier correcto citado tal cual LAB 13 lo fija, sin tabla propia que se desincronice (LAB 10 Cap. 7)
- [ ] Auditoría inicial cobrada siempre, firme o no el prospecto (LAB 10 Cap. 8)

### Operational Readiness
- [ ] Monitoring and alerts configured
- [ ] Incident response process documented
- [ ] Permanencia mínima de 3 meses fijada en el contrato (LAB 10 Cap. 9)
- [ ] Aislamiento de datos del cliente verificado: bases de datos propias en contenedores propios, nunca mezcladas (BRIEF §5.1)
- [ ] Catálogo de tareas/KPIs de Vrutal no expuesto al cliente ni en pantalla ni por API (decidido 2026-10-06)

---

## 15. Communication Plan

### Status Updates
- Mientras el equipo es una persona: el founder registra decisiones y estado en los LABs y en memoria, no en un reporte semanal a sí mismo
- Weekly project status to leadership — se activa al incorporar el primer hire
- Daily sprint updates to team — se activa al incorporar el primer hire
- Weekly customer-facing updates when relevant — se activa con el primer cliente externo

### Reporting Format
- Progress vs. plan
- Risks and blockers
- Decisions needed
- Dependencies
- Next milestones
- Budget/resource status

### Sample Status Summary
"Overall status: On track / At risk / Off track  
Major achievements this week: [...]  
Key risks: [...]  
Decisions needed: [...]  
Next milestone: [...]"

---

## 16. Metrics Dashboard

Nota importante ([[no-objectives-before-operating]] / BRIEF §7 "Honestidad intelectual" y §11 "no inventes cifras"): Vrutal no tiene todavía datos reales de uso, activación, churn, MRR ni CAC — cero clientes externos, solo el piloto interno. Las categorías de abajo son el marco a poblar cuando existan datos reales; **no se rellenan con cifras de ejemplo**. Las únicas cifras reales hoy son las de coste/precio ya cerradas en LAB 13.

### Product Metrics (framework — sin datos reales todavía)
- Daily active users (DAU)
- Weekly active users (WAU)
- Retention rate
- Activation rate
- Onboarding completion rate
- Feature adoption rate
- Churn rate

### Business Metrics (framework — sin datos reales todavía; cero clientes externos a 2026-10-09)
- MRR / ARR
- CAC / LTV
- Gross margin — ya conocido por tier vía LAB 13, no por cliente real todavía
- Conversion rate (Lead → MQL → contrato, funnel de LAB 10/11)

### Delivery Metrics
- Sprint completion rate
- Planned vs. actual delivery
- Defect rate
- Cycle time
- Time to resolution for blockers

### Lo único con cifra real hoy: margen bruto por tier (LAB 13 Cap. 5)
| Tier | Precio/mes | Infraestructura real | Margen bruto aprox. |
|---|---|---|---|
| 1 · Simple | 150 € | 8-12 € | ~92% |
| 2 · Medio-bajo | 200-250 € | 15-20 € | ~90% |
| 3 · Medio | 450-500 € | 40-60 € | ~87% |
| 4 · Alto | 700-800 € | 70-140 € | ~82% |
| 5 · Seller (ruta privada) | 1.200 € | 150-250 € (GPU compartida) / 500-1.500 € (dedicada) | 60-87% variable |

Estas cifras son una fotografía de 2026, sujetas a la cláusula de revisión de LAB 13 Cap. 7 (trimestral, o inmediata si el coste sube >15-20%).

---

## 17. Decision Log

| Date | Decision | Rationale | Owner | Status |
|---|---|---|---|---|
| 2026-10-05 | Activar/desactivar/reactivar cuentas: solo Admin (sobre otro) y Vrutal; nadie toca su propio estado | Evitar que una cuenta se autodesactive o se autoescalone | Founder | Aplicado en servidor |
| 2026-10-06 | Claves de integraciones cifradas en el Vault del Supabase del cliente; nunca visibles, solo sobrescribibles | Seguridad; el Admin ve estado, nunca la clave | Founder | Aplicado |
| 2026-10-06 | El catálogo de Vrutal (tareas, KPIs) no se enseña al cliente, ni en pantalla ni por API | Propiedad de Vrutal-labs; el especialista se valora por lo que produce | Founder | Aplicado |
| 2026-10-06 | Trabajo del especialista = entregables en tablas (`work_collection`/`work_item`), no en Google Sheets | Las hojas eran interinas; cada pestaña es ya una tabla de VrutalOS ([[sheets-as-interim-tables]]) | Founder | Aplicado |
| 2026-10-06 | Administradores: pendiente de decidir si solo Vrutal crea/cambia admins (Art. D-05) o si el Admin del cliente puede seguir haciéndolo | Conflicto entre D-05 y el comportamiento actual de VrutalOS | Founder | Pendiente |
| 2026-10-08 | Soporte (tickets) centralizado en Vrutal1st, no en la base del cliente | Un ticket es conversación sobre el servicio, no dato de negocio del cliente | Founder | Aplicado |

---

## 18. Meeting Agenda Templates

### Weekly PM Status Meeting
- Progress since last update
- Milestones achieved
- Upcoming milestones
- Risks and blockers
- Decisions needed
- Dependencies
- Budget/resource update

### Sprint Review
- What shipped
- What changed
- Customer feedback
- Metrics impact
- Next steps

### Retrospective
- What worked well
- What did not work
- What should improve
- Action items with owners

---

## 19. Project Closure Checklist

- [ ] Business goal achieved
- [ ] Customer value validated
- [ ] Final metrics reviewed
- [ ] Launch or release complete
- [ ] Documentation finalized
- [ ] Support process communicated
- [ ] Lessons learned captured
- [ ] Post-launch monitoring scheduled
- [ ] Stakeholder sign-off received

---

## 20. Lessons Learned Template

### What Went Well
- [Example]

### What Did Not Go Well
- [Example]

### What Should Change Next Time
- [Example]

### Actions to Carry Forward
- [Action 1]
- [Action 2]

---

## 21. Operating Principles for a SaaS Startup

- Prefer simple, high-value execution over heavy process
- Align every initiative to revenue, retention, or strategic value
- Make decisions with customer insight, not just internal opinion
- Keep execution transparent and lightweight
- Reduce risk early through validation and quick feedback loops
- Maintain clear ownership and decision rights
- Balance speed with quality and operational safety

### Valores de Vrutal Labs (BRIEF §7 — no genéricos, ya fijados)
1. **Curiosidad radical:** ninguna respuesta queda exenta de revisión si aparece un dato nuevo.
2. **Honestidad intelectual:** los datos están por encima del ego; nunca se estima un dato que no se tiene para parecer útil.
3. **Excelencia obsesiva:** si algo puede hacerse mejor, se rehace.
4. **Simplicidad:** la complejidad es un fallo de diseño, no una señal de rigor.
5. **Evolución constante:** nada está terminado.
6. **Libertad:** las herramientas deben liberar tiempo, no consumirlo.
7. **Impacto real:** solo cuenta lo que cambia la operación del cliente de forma medible, no lo entregado ni lo prometido.

Orden fijo de resolución de conflictos: evidencia > ambición comercial · documentación > velocidad · simplicidad > sofisticación · principio > herramienta concreta.

---

## 22. Final Note

This document should be adapted to your startup's specific goals, team size, product stage, and technical maturity. In startup environments, project management must remain lightweight, fast, and outcome-driven without creating unnecessary bureaucracy.

A strong PM in a SaaS startup is not just a scheduler—they are a force multiplier for product delivery, customer value, and operational clarity.

Para Vrutal Labs hoy, el PM y el fuerza multiplicadora son la misma persona (el founder), trabajando junto a un agente de código. La Sección 24 fija cómo esa colaboración se mantiene disciplinada en lugar de improvisada.

---

## 23. Quick PM Checklist

- [ ] Roadmap aligned to business goals
- [ ] Priorities reviewed weekly
- [ ] Risks tracked and mitigated
- [ ] Customer feedback incorporated
- [ ] Engineering capacity understood
- [ ] Launch plan validated
- [ ] Metrics reviewed regularly
- [ ] Stakeholders informed and aligned
- [ ] Decisions documented
- [ ] Team focused on value delivery

---

## 24. Engineering & AI-Pair Collaboration Principles (Andrej — `CLAUDE.md`)

Este proyecto se construye con un agente de código (Claude Code) como par de ingeniería del founder. `CLAUDE.md`, en esta misma carpeta, fija las guías de comportamiento que Andrej estableció para reducir los errores comunes de un LLM programando. Este PM Playbook no las repite como texto aparte: las incorpora como la forma real en que se ejecuta el trabajo de las secciones 6, 10 y 11 de este documento.

### 1. Think Before Coding
No asumir, no esconder la confusión, exponer el trade-off. Antes de implementar: declarar los supuestos; si hay varias interpretaciones, presentarlas sin elegir en silencio; si existe un camino más simple, decirlo; si algo no está claro, parar y preguntar.
*Aplicación en Vrutal:* es el mismo principio que ya exige [[feedback-flows-batch-method]] — diseñar y aprobar los 10 flujos en draw.io antes de tocar la API de Activepieces — y el mismo que BRIEF §11 exige al propio asistente ("ante una petición ambigua, haz las preguntas necesarias antes de responder").

### 2. Simplicity First
El mínimo código que resuelve el problema. Nada especulativo: sin features no pedidas, sin abstracciones de un solo uso, sin "flexibilidad" no solicitada, sin manejo de errores para escenarios imposibles.
*Aplicación en Vrutal:* es literalmente el valor "Simplicidad" de BRIEF §7 — "la complejidad es un fallo de diseño, no una señal de rigor" — aplicado al código, no solo al producto.

### 3. Surgical Changes
Tocar solo lo que hace falta; limpiar solo el propio desorden. No "mejorar" código adyacente, no refactorizar lo que no está roto, mantener el estilo existente. Si el cambio genera huérfanos (imports, variables), limpiarlos; si se nota código muerto preexistente, señalarlo, no borrarlo sin que lo pidan.
*Aplicación en Vrutal:* así se editó este propio documento — rellenando huecos reales, sin reescribir la estructura que ya funcionaba. Es la misma disciplina que exige el README raíz: "una sola copia de cada documento", "versión nueva = misma ruta", nunca dos versiones vigentes conviviendo.

### 4. Goal-Driven Execution
Definir el criterio de éxito y verificarlo en bucle, no asumir que "funciona" porque compila. Transformar cada tarea en un objetivo comprobable ("arregla el bug" → "escribe un test que lo reproduzca, luego hazlo pasar").
*Aplicación en Vrutal:* ya incorporado en la Definition of Done de la Sección 11 de este documento, y es el mismo espíritu que el método Audit→Report→Design→Test→Deploy→Evolve de LAB 15 — ninguna etapa avanza sin que la anterior se verifique primero.

### Nota de alcance
`CLAUDE.md` advierte que estas guías "sesgan hacia la cautela sobre la velocidad" y que para tareas triviales se use criterio. En Vrutal, ese criterio lo fija el orden de la Sección 9: ante cualquier duda real, gana evidencia > ambición, documentación > velocidad — nunca al revés.