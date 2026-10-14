# En espera

Cambios escritos pero **no aplicables todavía**. No aplicar sin rediseñar.

## `2026-10-06_task_autonomy.sql` (+ `.test.sql`)

Autonomía por tarea (el Admin decide si una tarea pide aprobación o va en automático, hasta un techo que fija Vrutal).
La lógica del techo (nivel de autonomía y fase del especialista) es válida y reutilizable, pero esta versión **lista y
cambia todas las tareas del catálogo**, y el catálogo de Vrutal no puede ser legible por el cliente (ver
`2026-10-06_grants_pantallas.sql`). Rediseño pendiente: la autonomía se ofrece solo sobre las tareas que **ya han
producido algo** (aprobaciones o entregables), con la etiqueta que escribe el propio flujo, sin leer el catálogo.
