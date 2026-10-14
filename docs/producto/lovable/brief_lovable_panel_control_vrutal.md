# Panel de Control de Vrutal — Brief para Lovable

## Antes de nada, instrucción crítica para Lovable
Conecta este proyecto al Supabase existente **"Vrutal 1st"** (Integraciones → Connect to Supabase,
con tu cuenta). **El esquema ya existe y ya está probado — no lo regeneres, no crees tablas nuevas
por tu cuenta.** Lee el esquema real antes de construir nada. Si algo parece faltar, pregunta antes
de inventarlo.

## Qué es esto
Herramienta interna, solo para el equipo de Vrutal. No la usa ningún cliente. Aquí es donde Vrutal
ve y gestiona toda la flota de clientes.

## Quién entra
Autenticación con Supabase Auth de este mismo proyecto. Dos niveles ya existen en `public.profiles`:
- `is_platform_admin` — uso diario del equipo.
- `is_superadmin` — acceso de más alcance, reservado.

No hace falta construir el registro de nuevos usuarios desde la app: los admins de Vrutal se dan de
alta manualmente por ahora.

## Pantalla 1 — Flota de clientes
Lista de `public.tenants`. Por cada fila, mostrar:
- Nombre, estado (`status`: trial/active/suspended/inactive)
- Si es interno (`is_internal`) — distínguelo visualmente de un cliente real (por ejemplo, una
  etiqueta "interno" en vez de mezclarlo sin más)
- Proyecto de Supabase asociado (`supabase_project_name`, `supabase_project_region`)
- Estado del plano de datos (`data_plane_status`: not_provisioned / provisioning / active / paused / offboarded)

Acción: crear un nuevo tenant (formulario simple — nombre, país, industria, tamaño). Esto **no**
crea el proyecto de Supabase del cliente ni instala su base — eso sigue siendo un paso manual
aparte por ahora. Este formulario solo registra la ficha.

## Pantalla 2 — Detalle de un cliente
Al entrar en un tenant: su ficha completa (los campos de perfil que ya existen: `tax_id`, `email`,
`website`, `address_line`, `city`, `country`, `industry`, `size_employees`), y edición de esos campos.

## Fuera de alcance por ahora — no lo construyas todavía
Cualquier acción que necesite **escribir dentro del proyecto de Supabase propio de un cliente**
(activar o pausar un especialista suyo, ver su consumo real, editar su prompt) **no se puede hacer
todavía desde aquí**. Eso requiere una función intermedia segura (Edge Function) que sepa a qué
proyecto conectarse por cada cliente y use una credencial que nunca debe llegar al navegador. Esa
pieza no está construida — si Lovable propone resolverlo con una llamada directa desde el frontend,
recházalo: sería exponer una clave de servicio de un cliente a quien abra las herramientas del
navegador.

## Tono visual
Claro, directo, sin adornos — nada de dashboards "gamificados" ni lenguaje de marketing. Es una
herramienta de trabajo para gente técnica del propio Vrutal, no una demo para vender.
