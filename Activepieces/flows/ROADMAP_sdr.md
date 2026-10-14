# Roadmap — SDR (Sales Development Representative, dominio SALES)

8 tareas enlazadas a `sdr` en `catalog.job_role_task`. A diferencia de Data Entry Clerk, **ninguna de estas 7 tareas propias tiene `process_id` asignado** — `catalog.process` no tiene ninguna fila con `domain_id = 'SALES'` todavía (los 11 procesos existentes son todos de OPERATIONS). No hay pipeline oficial que las ordene; el orden de abajo es una lectura lógica del enunciado de cada tarea, no un dato del catálogo. Señalo esto porque es exactamente el tipo de vacío que "Como trabajas" pide nombrar, no rellenar en silencio.

| # | task_code | Tarea | Criticality | Patrón | Riesgo | Estado |
|---|---|---|---|---|---|---|
| 1 | TSK-001284 | Capturar y registrar lead desde formulario web | standard | WORKFLOW | low | 🟡 en curso |
| 2 | TSK-001285 | Generar y enviar enlace de agenda para la llamada | standard | API | low | ⬜ |
| 3 | TSK-001286 | Investigar la empresa del lead | **core** | AGENT | medium | ⬜ |
| 4 | TSK-001287 | Investigar a la persona de contacto del lead | **core** | AGENT | medium | ⬜ |
| 5 | TSK-001288 | Crear o actualizar el contacto del lead en HubSpot | standard | API | low | ⬜ |
| 6 | TSK-001289 | Crear la oportunidad asociada al lead en HubSpot | standard | API | low | ⬜ |
| 7 | TSK-001290 | Redactar informe de contexto pre-reunión (empresa y persona) | **core** | AGENT | medium | ⬜ |
| — | TSK-001222 | Detectar y clasificar email entrante *(compartida con Data Entry Clerk)* | standard | AGENT | low | 🟡 2 diagramas en curso |

Leyenda: ⬜ no iniciado · 🟡 en curso · 🟢 tronco aprobado · ✅ blueprint con herramientas cerrado
