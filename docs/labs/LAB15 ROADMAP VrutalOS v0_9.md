VRUTAL OS

**LAB 15 · ROADMAP**

Hasta Dónde Llega Vrutal

*Un **roadmap** no cuenta lo que ya se hizo — cuenta hasta dónde se puede llegar, y cómo*

**Documento vivo · v0.9 — Alcance cerrado, en espera de v1.0 al nacer Vrutal**

*Building Intelligent Companies.*

# QUÉ ES ESTE DOCUMENTO

La primera versión de este documento confundía roadmap con changelog: enumeraba qué LAB estaba construido y cuál no. Esa información sigue siendo necesaria, pero no es esto — pertenece al índice documental de LAB 00, ya existente como documento propio, no a la estrategia de producto.

Esta versión corrige el enfoque. LAB 15 no cuenta lo que ya se hizo. Cuenta hasta dónde puede llegar Vrutal, y con qué método se llega.

# EL MÉTODO — DE AUDITAR A EVOLUCIONAR

Toda idea que entra en este roadmap recorre las mismas seis etapas, en el mismo orden, sin excepción:

| **Etapa** | **Qué responde**                                                                      |
|-----------|---------------------------------------------------------------------------------------|
| Audit     | ¿Qué existe hoy, y dónde está realmente el problema?                                  |
| Report    | ¿Qué patrón queda una vez comparados varios casos, no uno solo?                       |
| Design    | ¿Cuál es la solución más simple que resuelve el patrón, no el caso aislado?           |
| Test      | ¿Sobrevive la solución a un uso real, antes de prometerla?                            |
| Deploy    | ¿Sale con el alcance autónomo más conservador que admite, conforme a LAB 08, Cap. 17? |
| Evolve    | ¿Qué aprende el sistema de esta iteración, y a dónde entra esa memoria?               |

*Este método comparte columna vertebral con las 5 fases ya fijadas en LAB 08, Capítulo 15, para el nacimiento de un especialista — auditoría, informe, diseño, testeo, despliegue — pero no son intercambiables sin más: LAB 08 describe cómo nace un especialista concreto; este método describe cómo avanza cualquier iniciativa de producto, desde una función de la plataforma hasta la fusión de dos equipos. **Report** y Test no tienen hoy un paso equivalente explícito en LAB 08. Alinear el vocabulario entre ambos documentos queda pendiente, y está registrado como punto abierto en LAB 00, Capítulo 12, sin que eso bloquee el avance de ninguno de los dos.*

# EL HORIZONTE

Tres franjas, no dos. No todo lo que Vrutal quiere construir tiene la misma certeza ni la misma distancia.

**AHORA — en Deploy o recién en Evolve**

**Especialistas por rol**

SEO, SEM, Data/CRM, Email/Loyalty y el resto del catálogo ya operativo, desplegados por cliente según el ICP.

*Fijado en LAB 07. En **Evolve** continuo.*

**Plataforma base**

Docker, Activepieces, PostgreSQL y Qdrant como tronco de infraestructura sobre el que corre cualquier especialista.

*Fijado en LAB 08. En **Evolve** continuo.*

**PRÓXIMO — Audit o Design ya iniciado**

**Asistente tipo PA**

Toma apuntes durante una reunión y redacta y envía la minuta automáticamente a los asistentes, sin que nadie tenga que transcribir nada a mano.

*Nace como especialista nuevo, por el método de 5 fases de LAB 08, Cap. 15.*

**Memoria Organizativa consultable**

La pregunta «¿qué sabemos sobre X?» respondida sobre todo el conocimiento del cliente — fichas, correos, documentos, decisiones pasadas — expuesta como producto que el cliente consulta directamente, no solo como contexto que los especialistas usan por dentro.

*El flujo que construye esta memoria como subproducto del trabajo diario ya está fijado en LAB 08, Cap. 8. Lo que falta es la capa de producto que la hace consultable; por eso está en Próximo y no en Explorando: la infraestructura existe, falta exponerla.*

**Aplicación móvil para el equipo de ventas en calle**

ICP, propuestas y estado del CRM disponibles fuera de la oficina, para quien vende cara a cara y no frente a un escritorio.

*Depende de que LAB 10 · Sales fije primero el proceso que la aplicación va a mostrar.*

**EXPLORANDO — en Audit, sin Design todavía**

**Varios especialistas en una misma sesión**

Seleccionar, desde el backend, más de un especialista para una misma sesión de trabajo — varios agentes colaborando en vivo, no uno detrás de otro.

*Depende de que Sinapsis complete su recorrido conceptual en LAB 05 — hoy sigue en desarrollo — antes de convertirse en producto.*

**Conversación por motores de voz**

Hablar con un especialista y que responda hablando, en lugar de a través de texto.

*Depende de infraestructura de voz que hoy no existe en LAB 08.*

**Agentes de estrategia**

Especialistas de nivel superior que no ejecutan una tarea operativa, sino que leen la Memoria Organizativa y el histórico de ejecuciones del propio cliente para recomendar dónde actuar — qué canal, qué prioridad, qué está funcionando y qué no. Un producto de gama alta, muy por encima del precio de un especialista operativo.

*Depende de materia prima que solo existe con el tiempo: una Memoria Organizativa ya poblada y un histórico de ejecuciones acumulado. Un agente de estrategia sin ese histórico opina; con él, recomienda con evidencia. Por eso está en Explorando aunque su valor esté claro.*

**Índice de conocimiento alojado en casa del cliente**

Para el cliente que no puede permitir que su conocimiento privado salga de su propia red, el índice vectorial reside en su infraestructura en lugar de en el VPS que Vrutal gestiona. Opción de despliegue premium, no función nueva.

*La lógica de procesar sin almacenar ya está fijada en LAB 08, Cap. 8 y Cap. 12. Es una variante de infraestructura con contrapartidas —cada consulta cruza la red, la memoria depende de que la máquina del cliente esté en pie— y por eso es una opción de gama alta con su propio precio, no el modo por defecto.*

**La fusión de equipo humano y equipo de especialistas**

El punto en que dejar de distinguir entre quién es persona y quién es agente en una misma sesión de trabajo, más allá de quién decide en el límite. No es una función que se lance de golpe: es la dirección hacia la que apunta todo lo demás en este horizonte.

*El horizonte final de la Empresa Aumentada, Artículo II de la Constitución.*

# EL LÍMITE — HASTA DÓNDE NO SE LLEGA

La pregunta de hasta dónde puede llegar Vrutal añadiendo funcionalidades tiene una respuesta que ya está fijada, no que se descubre función a función: el límite lo pone el Artículo II de la Constitución. Un especialista que sustituye el juicio de una persona, y no solo su ejecución, deja de ser aumentación. Cada función de este roadmap, por ambiciosa que sea, se diseña dentro de ese límite — no se propone romperlo.

# NOTA DE ARQUITECTURA DOCUMENTAL

El seguimiento de qué documento del sistema está construido, en desarrollo o descartado —el contenido de la versión anterior de este documento— vive en LAB 00, que ya existe como documento propio. El orden de construcción vigente entre LABs tampoco se fija aquí: lo fija LAB 00, Capítulo 11, y este roadmap no lo repite para no mantener el mismo dato en dos sitios. LAB 15 se ocupa del horizonte de producto; LAB 00, del orden de construcción de la documentación.

# DISPARADOR DE ACTUALIZACIÓN

Este roadmap cambia cada vez que una función entra en Audit, avanza de etapa, o se descarta conscientemente — no en una revisión periódica. Ninguna función se ha descartado todavía en esta versión; este apartado se activa la primera vez que una idea se investiga y se abandona con conocimiento de causa, no antes.
