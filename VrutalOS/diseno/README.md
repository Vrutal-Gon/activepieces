# VrutalOS · diseño (fase 0)

Mockup navegable de los dos layouts de la app del cliente. Mismo método que el panel Vrutal1st: **se aprueba el diseño antes de construir**.

Abrir `index.html` en el navegador. Barra inferior: cambia entre layout **Usuario** y **Admin**. Enlaces directos: `index.html#admin/integraciones`, `#usuario/aprobaciones`…

Reutiliza sin cambios los tokens de marca, la tipografía y los componentes de `Panel-Vrutal1st/src/styles` (copiados en `css/`). Lo propio de VrutalOS está en `mockup.css`.

## Los dos layouts

| | Usuario | Admin |
|---|---|---|
| Espacios | Solo **Mi trabajo** | **Mi trabajo** + **Administración** (selector, como Operación/Plataforma en Vrutal1st) |
| Aviso | — | Banda violeta en Administración: «estás configurando la empresa» |
| Menú | Inicio · Conversaciones · Especialistas · Aprobaciones · Reportes | + Soporte (solo admin, de momento) · Resumen · Equipo · Accesos · Integraciones · Consumo · Personalización · Delegaciones · Auditoría |

Cada pantalla lleva pegada, en gris, la tabla de VrutalOS que la alimenta (`↳ …`). La seguridad real está en RLS; el menú es solo UX.

## Pendiente de decidir
1. `specialist_prompts` (Personalización) no existe en el esquema actual.
2. ¿Invitar personas desde la app o lo hace Vrutal? (hoy: el primero que se registra es admin).
3. Notificaciones y búsqueda Ctrl K: ¿qué entra?
4. Idioma: solo ES por ahora; los textos del mockup ya están sin jerga técnica.

## Especialista de Contenido y Promoción (2026-10-07)

Tercera tarjeta en **Especialistas** → `#usuario/especialista_contenido`. Cuatro pestañas (con estado `ctab`, primera pantalla con pestañas que cambian de verdad, no solo decorativas): Calendario, Borradores (por canal, con aprobar/rechazar), Publicaciones y Métricas. Es el diseño de cómo [Postiz](https://github.com/gitroomhq/postiz-app) (ver `Activepieces/flows/MKT-F2_linkedin/README.md`) entra en VrutalOS: **el cliente nunca ve la interfaz de Postiz**, solo estas pantallas propias, alimentadas por `work_collection`/`work_item` y, en Publicaciones/Métricas, por la API de Postiz vía el flujo. Canales conectados y su estado también se enseñan en **Integraciones** (admin) como una tarjeta más, de solo lectura — conectar o reconectar un canal lo hace Vrutal desde Postiz, no el cliente.

**2026-10-07, iteración:** Calendario alterna entre lista y cuadrícula (`data-calview`); los dos abren el mismo modal de edición. Borradores se leen enteros y se aprueban/rechazan en un modal (`data-draft`, `data-approve-draft`/`data-reject-draft`), que resta del contador de la pestaña. Publicaciones programadas llevan Pausar (`data-pause`, cambia el estado a Pausado) y Editar (`data-edit`, mismo modal que Calendario). Métricas: el nombre de cada canal abre un modal con el detalle por publicación (`data-metric`) — alcance, me gusta, comentarios, compartidos y clics por pieza, no solo el agregado, más un gráfico de evolución de 8 semanas con tooltip al pasar el ratón (y una minigráfica igual dentro de la tabla agregada). Patrón de modal genérico nuevo (`.modal-scrim`/`.modal`, cierra con la `✕`, con Cancelar o clicando fuera) y datos compartidos en `CP_DATA` para que la pantalla y los modales lean la misma fuente. El texto visible ya no nombra la herramienta (Postiz/HubSpot) — solo describe el dato; el nombre del proveedor se queda en Integraciones, que es la única pantalla donde aporta.

**2026-10-07, etiquetado interno:** `CP_DATA` modela `tags_ia` (`#tema:…`, `#formato:…`) en borradores/publicaciones/detalle por publicación, pero **no se pinta en ninguna pantalla**: lo pone la IA sola para su propio aprendizaje (qué tema o formato rinde mejor), nunca lo ve el cliente — mismo criterio que «el catálogo no se enseña». Diseño completo en `Activepieces/flows/MKT-F14_adaptacion/README.md` («Etiquetado interno»).

**2026-10-07, hablar con el especialista desde cualquier referencia:** cada fila de Calendario y Publicaciones lleva un icono 💬 (`data-chat`, mismo sitio que Pausar/Editar — no un popup por tiempo de permanencia del cursor, descartado por el riesgo de disparo accidental y por no funcionar en touch/teclado). Abre **Conversaciones** en el tercer hilo de ejemplo ("Reprogramar por el lanzamiento") con un anclaje dinámico a la fila exacta desde la que se abrió. `CONVOS` (datos compartidos, junto a `CP_DATA`) y `renderMsg()` generalizan las burbujas del hilo: texto normal, o una burbuja de **acción propuesta** que reutiliza el marcado de `.approval` (resumen + campos + Confirmar/Rechazar) — la misma fila que vería Aprobaciones, resuelta sin salir del chat (`data-chat-approve`/`data-chat-reject`, estado en `state.chatDecision`). El hilo de ejemplo escenifica el caso real que motivó esto: el cliente pide reprogramar la semana por un lanzamiento, el especialista pregunta lo que le falta, y propone pausar + montar el nuevo calendario con confirmación inline.

**2026-10-08:** el icono de hablar con el especialista (Calendario, Publicaciones) pasa de 💬 genérico a la marca de Vrutal Labs (`vrutal-mark.svg`, `.chat-icon` en `mockup.css`) — deja claro que al pulsarlo se habla con el gestor de Vrutal, no con un chat cualquiera. `aria-label` actualizado a "Hablar con tu gestor Vrutal...".

**2026-10-08, control manual total:** botón "Nueva publicación" en la cabecera de Publicaciones (`data-new-post`) abre un modal de creación (texto, canal, cuándo — sin borrador previo, lo escribe el gestor) que al guardar (`data-save-create`) empuja una fila nueva directamente a `CP_DATA.publicaciones`, en estado Programado, sin pasar por Borradores ni aprobación. Se marca con una pill "Manual" (`state.manualPostIdx`) solo para que se note en esta revisión qué nació del gestor — Pausar/Editar funcionan igual porque son genéricos por índice, no necesitaron cambios. De paso, se corrigió `.table-card__head` (le faltaba `display:flex`, a diferencia de `.card__head` — título y meta se apilaban verticalmente en varias pantallas desde antes de esta sesión).

**2026-10-08, segunda vuelta de layout:**
- **Calendario**: la vista por defecto pasa a ser la cuadrícula (`state.calView = 'calendario'`), la lista queda como alternativa. En lista, el canal se enseña con `channelLabel()` (insignia de color + nombre, sin depender de logos de terceros) — mismo helper reutilizado en Borradores y Publicaciones.
- **Icono de hablar con el especialista: se quita de cada fila.** En su lugar, nueva entrada fija en el menú lateral **"VrutalOS"** (marca de Vrutal, `data-open-chat`) que abre una **ventana flotante** (`.floating-chat`, sin scrim — no bloquea la pantalla de detrás) en vez de navegar a Conversaciones. El hilo de ejemplo (antes "Reprogramar por el lanzamiento" con el especialista) se renombra a **"Tu gestor Vrutal"**, participante `Vrutal` — se habla con el gestor central, no con el especialista directamente, coherente con el agente administrador (Qwen3-30B) ya decidido. Crítica señalada y aceptada por el usuario: esto pierde el anclaje automático a una fila concreta (antes "Sobre: tal publicación"); cada conversación ahora empieza en blanco. `state.chatAnchor`/`CONVOS[2].anchorDefault` quedan sin uso, no se borraron.
- **Nueva publicación**: añadidos **Hashtags** (se anexan al texto) e **Imagen** (`input type="file"`, sin procesar en el mockup — solo demuestra que el campo existe). El campo "Cuándo" (aquí y en los modales Editar y Borrador) pasa de texto libre a **selector de fecha + hora** (`type="date"` / `type="time"`), con `parseWhen()`/`formatWhen()` convirtiendo hacia y desde el texto que se enseña en las tablas ("14 oct · 09:00").
- **Borradores**: el botón "Leer" pasa a ser **"+"**; el modal gana **Canal** y **Cuándo** editables (con "Guardar cambios", además de Aprobar/Rechazar) — editar y aprobar ya no son cosas separadas.
- **Aprobar un borrador ahora empuja una fila a Publicaciones** (`state.draftPublished`, evita duplicados si se aprueba dos veces) con el canal/fecha que se hayan editado — cierra el hueco que señaló el usuario ("aquí se deben ver las publicadas y aprobadas").
- **Publicaciones, acciones con icono según estado**: Publicado → Ver (↗) + Rendimiento (📊, abre el detalle por canal ya existente); Programado → Pausar (⏸) + Editar (✎); Pausado → Reanudar (▶) + Editar; Error → mensaje de reconexión + Editar.
- Validado con render headless (jsdom): vista por defecto, insignias de canal, cero `data-chat` en filas, flotante abre/cierra y confirma sin navegar de pantalla, pickers de fecha/hora, Borradores edita y aprobar empuja la fila correcta a Publicaciones con los datos editados (confirmado comprobando la fila por posición, no por título — dos filas pueden compartir texto).

## Tablero (2026-10-23)

Pantalla nueva en **Mi trabajo** → `#usuario/tablero`. Es lo que el cliente no podía ver hasta ahora: **en qué se está trabajando**, entre el resultado (entregables, aprobaciones) y la nada.

Columnas en fila con scroll horizontal (en móvil se arrastra; apiladas se pierde justo lo que aporta un tablero, ver las fases a la vez) y la tarjeta con su referencia corta en mono (`MKT-12`), prioridad, etiquetas y quién la lleva.

**Se ven todos los agentes a la vez** (2026-10-23). El cliente quiere saber de un vistazo en qué anda su equipo entero; una pantalla por agente le obligaba a ir uno por uno para enterarse. Para que no se mezclen, cada tarjeta lleva una franja de color y el nombre de su agente, y los chips de arriba pasan a ser **filtros** acumulativos (`Todos` + uno por agente, con su recuento). El color sale del `job_role_key`, no de la posición en la lista: contratar un agente nuevo no le cambia el color a los demás. No son colores de marca —el violeta y el lima significan acción y activo—: van desaturados y en fondo tenue para no competir con un botón. Al pulsarla se abre el modal con la descripción y la conversación, y desde ahí se comenta. En la cabecera, **Pedir una tarea**: entra en la primera columna marcada «Pedida por ti».

Lo que **no** hace, a propósito: mover una tarjeta de columna. El estado del trabajo lo fija Vrutal; el cliente propone y comenta.

Detrás hay [Kaneo](https://github.com/usekaneo/kaneo) (MIT), una instancia por cliente en su propio Docker, donde el equipo de Vrutal gestiona ese trabajo de verdad. **El cliente nunca ve la interfaz de Kaneo** — mismo criterio que con Postiz: lo que se enseña es una pantalla propia alimentada por un espejo en su base (`board_project`/`board_column`/`board_card`/`board_comment`, cambio `db/plantillas/cambios/2026-10-22_tablero_kaneo.sql`), refrescado cada 5 minutos. El trabajo interno de Vrutal se queda fuera con la etiqueta `interno`, que el sync filtra, así que en esta pantalla no hay nada que esconder.
