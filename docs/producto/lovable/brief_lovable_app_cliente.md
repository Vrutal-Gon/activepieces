# App de Cliente (Admin + Usuario) — Brief para Lovable

## Antes de nada, instrucción crítica para Lovable
Conecta este proyecto al Supabase **"VrutalOS"** (es el plano de datos de Vrutal-lab, el primer
caso real). **El esquema ya existe y ya está probado — no lo regeneres, no crees tablas nuevas.**
Lee las tablas y las políticas de RLS reales antes de construir nada.

Importante para el futuro (no afecta a lo que construyes hoy): este mismo código se volverá a
desplegar, sin cambios, para cada cliente nuevo — cada uno con su propio proyecto de Supabase.
No hace falta que lo prepares para eso ahora, solo que sepas que no debe quedar nada
"hardcodeado" del nombre "VrutalOS" ni de Vrutal-lab en el código de la app.

## Qué es esto
La app que usa el propio cliente. Dos roles, un único panel: lo que se ve cambia según el rol de
quien ha entrado (columna `role` en `public.profiles`: `client_admin` o `client_user`).

## Quién entra
Supabase Auth de este proyecto. El primer usuario que se registra se vuelve `client_admin`
automáticamente (ya está resuelto por un trigger); el resto entra como `client_user` hasta que
un admin lo cambie.

## Pantallas para AMBOS roles
- **Especialistas** — lista de `public.specialists` (nombre, fase, nivel de autonomía). Es de
  solo lectura desde aquí: ni admin ni usuario pueden crear, activar o desactivar uno — eso lo
  hace Vrutal desde su propio panel. Si Lovable propone añadir botones de crear/editar aquí,
  recházalo.
- **Conversaciones** — cada usuario ve las suyas. Al crear una conversación nueva, se puede
  elegir **uno o varios especialistas a la vez** (tabla `conversation_participants` — no está
  limitado a uno solo, es intencional, sirve para reuniones con varios agentes).
- Dentro de una conversación: enviar mensajes (`messages`), ver el historial.

## Pantallas SOLO para `client_admin`
- **Equipo** — gestionar `public.profiles` de su empresa: ver quién tiene acceso, cambiar el rol
  de otra persona (nunca el propio — está bloqueado a propósito por un trigger, no lo "arregles").
- **Consumo** — vista de solo lectura de `public.run_log`: coste y uso por especialista. Un
  `client_user` no debe poder ver esta pantalla ni acceder a esos datos (ya está bloqueado por
  RLS, pero tampoco le muestres el enlace en el menú).
- **Aprobaciones** — `public.approval_requests` pendientes: aprobar o rechazar.
- **Integraciones** — `public.integrations`: qué herramientas tiene conectadas (CRM, ERP...) y
  su configuración. Nunca mostrar ni pedir el secreto real, solo referencias (`secret_ref`) y
  metadatos (`config`).
- **Historial de personalización** — `public.specialist_prompts`: qué versión de prompt tiene
  cada especialista y su personalización, con el histórico completo (de solo lectura).

## Fuera de alcance por ahora
Dar de alta o modificar especialistas, escribir en `run_log`, y cualquier acción que hoy hace
Vrutal desde su propio panel. Esta app solo lee esas tablas.

## Tono visual
Igual que el panel de Vrutal: claro, directo, sin adornos. Aquí además hay una audiencia no
técnica (el cliente), así que el lenguaje en pantalla debe ser sencillo, sin jerga de IT.
