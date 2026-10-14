# Roadmap — Data Entry Clerk (dominio OPERATIONS)

55 tareas `core` (deduplicadas — el catálogo tiene 3 filas duplicadas del rol, ver README.md), agrupadas por proceso en el orden del pipeline de Operations (`sequence_ord`). El criterio de prioridad acordado es "por rol": agotar este rol antes de pasar a `data_entry_clerk_sales` o `sdr`.

Dentro del rol, sin un criterio explícito distinto, se sigue el orden del pipeline como desempate — no tiene sentido diseñar "Validación" antes de que "Recepción" esté cerrado. A confirmar si se prefiere otro desempate (ej. riesgo).

⚠ Dos tareas son `risk: high` con aprobación humana obligatoria explícita en el dato — no son buenas candidatas para automatizar pronto aunque sean `core`: **TSK-001249** (Eliminar registros) y **TSK-001274** (Fusionar duplicados).

| # | task_code | Tarea | Patrón | Riesgo | Estado |
|---|---|---|---|---|---|
| 1.1 | TSK-001222 | Detectar y clasificar email entrante | AGENT | low | 🟡 2 diagramas en curso (`TSK-001222_detectar-clasificar-email/`) |
| 1.2 | TSK-001223 | Registrar solicitud para procesamiento | WORKFLOW | low | ⬜ |
| 1.3 | TSK-001224 | Descargar documentos adjuntos | WORKFLOW | low | ⬜ |
| 1.4 | TSK-001225 | Clasificar documentos (adjuntos) | AGENT | low | ⬜ |
| 2.1 | TSK-001226 | Extraer datos de PDF | AGENT | medium | ⬜ |
| 2.2 | TSK-001227 | Extraer datos de Excel | SCRIPT | low | ⬜ |
| 2.3 | TSK-001228 | Extraer datos de imagen (OCR) | ML | medium | ⬜ |
| 2.4 | TSK-001229 | Extraer datos de formulario | WORKFLOW | low | ⬜ |
| 3.1 | TSK-001230 | Normalizar nombres | RULES | low | ⬜ |
| 3.2 | TSK-001231 | Normalizar direcciones | AGENT | low | ⬜ |
| 3.3 | TSK-001232 | Normalizar teléfonos | SCRIPT | low | ⬜ |
| 3.4 | TSK-001233 | Normalizar fechas | SCRIPT | low | ⬜ |
| 3.5 | TSK-001234 | Normalizar monedas | SCRIPT | low | ⬜ |
| 3.6 | TSK-001235 | Normalizar unidades | SCRIPT | low | ⬜ |
| 4.1 | TSK-001236 | Validar campos obligatorios | RULES | low | ⬜ |
| 4.2 | TSK-001237 | Validar formatos | RULES | low | ⬜ |
| 4.3 | TSK-001238 | Validar coherencia de importes | SCRIPT | low | ⬜ |
| 4.4 | TSK-001239 | Detectar duplicados | SCRIPT | medium | ⬜ |
| 4.5 | TSK-001240 | Detectar anomalías | AGENT | medium | ⬜ |
| 5.1 | TSK-001241 | Crear registro en CRM | API | low | ⬜ |
| 5.2 | TSK-001242 | Crear cliente en ERP | API | low | ⬜ |
| 5.3 | TSK-001243 | Crear proveedor | API | low | ⬜ |
| 5.4 | TSK-001244 | Crear factura | API | medium | ⬜ |
| 5.5 | TSK-001245 | Crear pedido | API | low | ⬜ |
| 5.6 | TSK-001246 | Crear producto | AGENT | medium | ⬜ |
| 5.7 | TSK-001247 | Actualizar registro existente | WORKFLOW | low | ⬜ |
| 5.8 | TSK-001248 | Modificar datos autorizados | WORKFLOW | low | ⬜ |
| 5.9 | TSK-001249 | Eliminar registros | WORKFLOW | **high** | ⬜ ⚠ aprobación humana obligatoria |
| 6.1 | TSK-001250 | Revisar registros introducidos | AGENT | low | ⬜ |
| 6.2 | TSK-001251 | Detectar errores de registro | AGENT | low | ⬜ |
| 6.3 | TSK-001252 | Resolver errores simples | AGENT | medium | ⬜ |
| 6.4 | TSK-001253 | Escalar errores complejos | AGENT | low | ⬜ |
| 7.1 | TSK-001254 | Buscar información interna | RAG | low | ⬜ |
| 7.2 | TSK-001255 | Completar datos faltantes | AGENT | medium | ⬜ |
| 7.3 | TSK-001256 | Solicitar información | AGENT | low | ⬜ |
| 7.4 | TSK-001257 | Hacer seguimiento de una solicitud | AGENT | low | ⬜ |
| 8.1 | TSK-001258 | Renombrar archivos | SCRIPT | low | ⬜ |
| 8.2 | TSK-001259 | Organizar carpetas | WORKFLOW | low | ⬜ |
| 8.3 | TSK-001260 | Archivar documentos | WORKFLOW | low | ⬜ |
| 8.4 | TSK-001261 | Etiquetar documentos | WORKFLOW | low | ⬜ |
| 8.5 | TSK-001262 | Detectar documentos fuera de lugar | AGENT | low | ⬜ |
| 9.1 | TSK-001263 | Crear informes periódicos | SCRIPT | low | ⬜ |
| 9.2 | TSK-001264 | Exportar datos | WORKFLOW | low | ⬜ |
| 9.3 | TSK-001265 | Crear CSV o Excel | SCRIPT | low | ⬜ |
| 9.4 | TSK-001266 | Preparar estadísticas | SCRIPT | low | ⬜ |
| 9.5 | TSK-001267 | Distribuir informes | WORKFLOW | low | ⬜ |
| 10.1 | TSK-001268 | Responder consultas internas simples | RAG | low | ⬜ |
| 10.2 | TSK-001269 | Notificar errores | AGENT | low | ⬜ |
| 10.3 | TSK-001270 | Notificar procesos completados | WORKFLOW | low | ⬜ |
| 10.4 | TSK-001271 | Recordar tareas pendientes | AGENT | low | ⬜ |
| 11.1 | TSK-001272 | Detectar registros incompletos | AGENT | low | ⬜ |
| 11.2 | TSK-001273 | Detectar registros obsoletos | AGENT | low | ⬜ |
| 11.3 | TSK-001274 | Fusionar duplicados | AGENT | **high** | ⬜ ⚠ aprobación humana obligatoria |
| 11.4 | TSK-001275 | Actualizar información desactualizada | AGENT | medium | ⬜ |
| 11.5 | TSK-001276 | Auditar cambios | WORKFLOW | low | ⬜ |

Leyenda: ⬜ no iniciado · 🟡 en curso · 🟢 tronco aprobado · ✅ blueprint con herramientas cerrado
