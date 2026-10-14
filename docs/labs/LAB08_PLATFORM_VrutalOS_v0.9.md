**VRUTAL OS**

**LAB 08 · PLATFORM**

**La Arquitectura del Sistema**

*El tronco y las ramas*

Documento vivo · v0.9 — Alcance cerrado, en espera de v1.0 al nacer Vrutal

*Building Intelligent Companies.*

# **Índice general**

**PARTE I — PRINCIPIOS** *· redactado*

> 1\. Por qué existe este documento
>
> 2\. Principios heredados de VRUTAL OS
>
> 3\. El Principio del Tronco Común

**PARTE II — EL TRONCO (infraestructura fija)** *· redactado*

> 4\. Vista de conjunto: capas del sistema
>
> 5\. Contenedores y despliegue: Docker
>
> 6\. Red y proxy: Traefik
>
> 7\. Entornos: Raspberry Pi vs. VPS
>
> 8\. Datos: PostgreSQL y Qdrant
>
> 9\. Backups y recuperación
>
> 10\. Orquestación: Activepieces
>
> 11\. Capa de modelos de IA
>
> 12\. Seguridad
>
> 13\. Monitorización y logs

**PARTE III — LAS RAMAS (capa adaptable)** *· redactado*

> 14\. Qué es un especialista y qué no
>
> 15\. El método de las 5 fases aplicado a una rama nueva
>
> 16\. Cómo se decide si un rol nace
>
> 17\. Límites de decisión por especialista
>
> 18\. Caso propio: el organigrama de Vrutal-lab
>
> 19\. Caso contrastante: un cliente con producto físico

**PARTE IV — GOBERNANZA TÉCNICA** *· redactado*

> 20\. Versionado de infraestructura y conocimiento
>
> 21\. Documentación técnica: cómo se mantiene viva
>
> 22\. Roadmap técnico

# **PARTE I**

**PRINCIPIOS**

## **Capítulo 1 · Por qué existe este documento**

**Vrutal-lab es el primer cliente de Vrutal.**

Antes de vender una arquitectura, hay que vivir dentro de ella. Cualquier fallo en el sistema que proponemos a un cliente lo sufriremos primero nosotros. Cualquier atajo que nos permitamos se convertirá en un atajo que ofrecemos a otros. Por eso este documento no describe una infraestructura genérica: describe la infraestructura real sobre la que opera Vrutal, con la disciplina de saber que será replicada.

Este documento resuelve un problema concreto. Cuando incorporemos al segundo cliente, al décimo, al centésimo, la pregunta “¿cómo lo montamos para este caso?” no puede empezar de cero cada vez. LAB 08 fija qué parte de la arquitectura es fija — el tronco — y qué parte se diseña caso por caso — las ramas. Sin esa distinción, cada cliente sería un proyecto de ingeniería nuevo. Con ella, cada cliente es una decisión de diseño sobre una base que ya funciona.

**Qué no es este documento**

- No es un manual de instalación. No contiene comandos paso a paso ni versiones de paquete — eso vive en la documentación operativa de cada componente.

- No es LAB 07. El detalle de cada especialista — sus prompts, su memoria, sus herramientas — vive en el catálogo de tareas y roles, gobernado fuera del sistema de LABs. LAB 07 (Agents) fija el método por el que ese catálogo se lee y se opera. Aquí solo se fija el método por el cual esas ramas nacen y encajan en el tronco.

- No es LAB 09. La experiencia digital — web, landing, SEO — vive en LAB 09 (Website) y usa esta infraestructura; no la define.

**A quién se dirige**

A cualquier persona que implemente o mantenga el sistema. Y, por uno de los principios heredados de VRUTAL OS (Capítulo 2) — todo debe poder entenderlo una IA —, a cualquier agente que necesite razonar sobre su propia infraestructura para operar, diagnosticar o proponer un cambio. Este documento está escrito para ambos lectores a la vez.

## **Capítulo 2 · Principios heredados de VRUTAL OS**

VRUTAL OS ya fijó cinco principios que gobiernan toda la documentación de la empresa. Ninguno se reescribe aquí. Se aplican.

**Una única fuente de verdad**

La configuración de cada entorno vive en un único lugar. No hay un docker-compose para producción y una copia “similar” para desarrollo que alguien actualiza a mano cuando se acuerda. Hay una fuente, y los entornos que no son esa fuente la referencian o la heredan — nunca la duplican.

**Todo tiene propietario**

Cada pieza del stack — la base de datos, el proxy, cada flujo de Activepieces — tiene un responsable identificado. Un servicio sin propietario es un servicio que nadie actualiza, nadie audita y nadie apaga cuando deja de ser necesario. Eso es deuda técnica silenciosa, y la deuda técnica silenciosa es la que más cuesta.

**Todo evoluciona**

No existe una “versión final” del stack. Existen versiones fechadas, con un motivo de cambio registrado. Si Traefik se sustituye, o Qdrant se cambia por otro motor vectorial, el documento no se reescribe por encima: se versiona, y la razón del cambio queda como memoria organizativa.

**El conocimiento vale más que la herramienta**

Hoy usamos Activepieces. Mañana podría no ser Activepieces. Lo que no cambia es la responsabilidad que cubre esa pieza: orquestar flujos entre especialistas y sistemas. Este documento describe funciones antes que productos, precisamente para que sobreviva a cualquier decisión de proveedor.

**Todo debe poder entenderlo una IA**

Este es el principio con más consecuencias prácticas para un documento de infraestructura. Significa que las decisiones no solo se toman: se explican. Un agente que necesite escalar un problema, proponer una migración o auditar un coste debe poder leer este documento y entender no solo qué existe, sino por qué existe.

## **Capítulo 3 · El Principio del Tronco Común**

Vrutal no tiene producto físico. Un cliente industrial sí. Si ese cliente necesita un especialista que gestione previsión de demanda y cuotas de producción, ese rol no existe en Vrutal — y no debería inventarse aquí de forma especulativa. Pero cuando ese cliente llegue, el rol se diseñará, se probará y se incorporará a su estructura, sin que eso obligue a rediseñar la infraestructura que lo sostiene.

**Esa distinción tiene nombre: el tronco no cambia, las ramas sí.**

**El tronco**

Es la infraestructura común: contenedores, red, bases de datos, orquestación, capa de modelos, memoria organizativa, seguridad. Es idéntica para Vrutal-lab y para cualquier cliente, salvo diferencias de escala. No depende de a qué se dedica la organización. Depende de cómo Vrutal construye sistemas.

**Las ramas**

Son el organigrama de especialistas: los roles, sus límites de decisión, sus herramientas concretas. Dependen enteramente de la cadena de valor real de cada organización. El Director de Marketing Agéntico existe en Vrutal-lab porque Vrutal genera demanda para vender. Un Supply Chain Manager agéntico no existe en Vrutal — y sí existirá en un cliente que fabrica y distribuye producto físico.

**La pregunta que separa una cosa de la otra**

Es siempre la misma:

> ***“¿Esto depende de qué vende o cómo opera la empresa, o depende de cómo Vrutal construye sistemas?”***

- Si depende de qué vende o cómo opera: es una rama. Se diseña por cliente, siguiendo el método de LAB 07 y las cinco fases ya fijadas en el modelo de negocio (auditoría, informe, diseño, testeo, despliegue).

- Si depende de cómo Vrutal construye sistemas: es tronco. Se construye una vez, se documenta aquí, y se reutiliza.

**El caso ambiguo: función tronco, configuración rama**

Conviene resolver ahora un caso intermedio, para no repetir la duda con cada cliente: el Agente de Documentación y Reporting transversal. Su existencia es tronco — todo organismo necesita memoria y reporting, sin excepción. Pero su alcance es rama — qué reporta y a qué fuentes se conecta depende de cada organización. Esta es la regla general para cualquier caso ambiguo: la función puede ser tronco mientras su configuración es rama.

**La consecuencia es comercial, no solo técnica**

Ya está fijado en el modelo de negocio de Vrutal Labs que el primer especialista entra en producción antes de que el resto esté diseñado. Eso solo es posible porque el tronco ya existe. Incorporar un cliente nuevo no es un proyecto de infraestructura: es una decisión de diseño sobre ramas, ejecutada sobre una base que ya funciona. Esa velocidad es, en sí misma, parte de lo que vendemos.

*Fin de la Parte I. Continúa en la Parte II — El Tronco (infraestructura fija).*

# **PARTE II**

**EL TRONCO**

*Infraestructura fija*

## **Capítulo 4 · Vista de conjunto: capas del sistema**

El tronco tiene seis capas. Cada capa resuelve un único problema y no invade la responsabilidad de la siguiente. Esta separación no es estética: es lo que permite sustituir una pieza sin rehacer las demás — consecuencia directa del principio “el conocimiento vale más que la herramienta”.

VRUTAL OS

│

├── Infraestructura → Docker + Traefik

├── Datos → PostgreSQL + Qdrant

├── Orquestación → Activepieces

├── Modelos de IA → capa de proveedores, por nivel de riesgo

├── Especialistas → ramas (LAB 07)

└── Interfaces → web, dashboards, canales de cliente

- Infraestructura. Dónde vive todo y cómo se accede. Docker aísla, Traefik enruta. Sin opinión sobre qué corre dentro.

- Datos. Qué es verdad ahora (PostgreSQL) y qué sabe el sistema (Qdrant). Sin esta capa no hay memoria organizativa, solo conversación que se pierde.

- Orquestación. Activepieces conecta especialistas, herramientas externas y datos. No decide — mueve.

- Modelos de IA. El razonamiento. Se factura por riesgo, no por prestigio, como ya fija el principio de asignación de modelo.

- Especialistas. Las ramas. Cada uno con rol, alcance de decisión y lugar en el organigrama — nunca “bot” ni “herramienta”.

- Interfaces. Dónde una persona ve y toca el sistema. La capa más visible y la que menos define la arquitectura.

Una capa nunca salta a otra directamente. Un especialista no escribe en PostgreSQL a mano ni abre un puerto propio: pasa por el orquestador o por una API definida. Esa disciplina es lo que evita que el sistema se convierta, con el tiempo, en una red de dependencias que nadie puede explicar.

**Dos planos, no un sistema**

Las seis capas anteriores describen una instalación — la de un cliente. En cuanto hay más de un cliente, aparece una pregunta que esa vista no responde: dónde vive el catálogo de tareas y roles que todos comparten, dónde se registra qué cliente corre qué versión, y quién aprovisiona una máquina nueva cuando se firma un contrato. Esa pregunta no la resuelve una séptima capa — la resuelve un segundo plano, con una regla distinta a la que gobierna las seis capas de arriba.

El **plano de datos** es lo descrito arriba: las seis capas, instanciadas por completo en el VPS de cada cliente. El **plano de control** corre en infraestructura propia de Vrutal y contiene lo que no pertenece a ningún cliente en particular: el catálogo de tareas, roles y prompts versionado; el registro de flota — qué cliente, qué VPS, qué versión de cada tarea corre ahí—; el back-office de operación; y la orquestación de despliegues y aprovisionamiento.

**La regla que separa a ambos**

El plano de control está en el camino del cambio, nunca en el de la ejecución. Un especialista desplegado no lo consulta para atender una tarea ni para pedir una aprobación humana — todo eso ocurre dentro del plano de datos de su propio cliente, con lo que ya tiene. El plano de control interviene solo para cambiar lo que un cliente tiene: empujar una versión nueva del catálogo, aprovisionar un VPS, mover un cliente de tramo. Si el plano de control cae, cada cliente sigue operando con normalidad; simplemente no recibe cambios hasta que vuelve. Esta regla, más que ninguna capa concreta, es la que hace que aislar por VPS tenga sentido: si el plano de control estuviera en el camino de cada ejecución, sería un punto único de fallo para toda la cartera, y el aislamiento físico del plano de datos no protegería de nada.

## **Capítulo 5 · Contenedores y despliegue: Docker**

Cada servicio del tronco corre en un contenedor Docker. No hay instalaciones directas sobre el sistema operativo del servidor, salvo el propio Docker. La razón no es moda: un contenedor es reproducible — el mismo servicio se comporta igual en la Raspberry Pi de desarrollo y en el VPS de producción, porque es literalmente la misma imagen.

**Una única fuente de verdad, en la práctica**

Existe un archivo docker-compose por entorno, y solo uno — con una salvedad que aparece en cuanto hay más de un cliente: el plano de datos no tiene un compose, tiene una plantilla única, la misma para todos los clientes, instanciada una vez por cada uno con sus propias variables. No se edita un contenedor a mano en producción para “probar algo rápido”: cualquier cambio se hace en la plantilla, se versiona, y se despliega a la flota. Si algo se probó a mano y funcionó, no existe hasta que está en el archivo — un principio incómodo al principio y barato para siempre después.

**Regla de justificación**

Ningún contenedor entra en el stack sin una razón escrita de por qué existe. Ya se aplicó este criterio al decidir qué plugins de WordPress se instalaban durante la puesta en marcha; aquí se eleva a regla permanente para todo el tronco. Un servicio de más no es gratis: es superficie de ataque, es consumo de recursos, y es una pregunta sin responder la próxima vez que alguien audite el sistema.

**Convención de nombres y versiones**

Cada servicio se fija a una versión explícita de imagen — nunca “latest” en producción. Una actualización es una decisión, con fecha y motivo registrados, no algo que ocurre solo porque el servidor se reinició.

**Aprovisionamiento: alta de cliente como procedimiento, no como proyecto**

Con un RTO de 24 horas fijado en el Capítulo 9, levantar un VPS a mano deja de ser una opción — una persona de vacaciones no puede ser el motivo de que un cliente esté fuera de plazo. El aprovisionamiento se describe en tres capas, y las tres son las mismas para dar de alta a un cliente nuevo, restaurar uno caído o graduarlo de compartido a dedicado: la máquina se declara como código, con la herramienta que lea el proveedor elegido en el Capítulo 7 — tipo de instancia, región, red, cortafuegos — de forma que graduar una instancia sea cambiar un parámetro y aplicar, no reconstruir desde cero. El arranque se automatiza mediante un script de inicialización que instala Docker, monta el volumen de datos y descarga la plantilla de la flota fijada en este capítulo. Y los secretos de esa instancia se inyectan desde el almacén fijado en el Capítulo 12 en el momento del aprovisionamiento — nunca escritos en el repositorio de infraestructura.

El estado de qué máquinas existen —cuáles, con qué configuración, para qué cliente— vive en el plano de control, junto al registro de flota del Capítulo 4: es el mismo lugar que ya sabe qué versión de catálogo corre cada cliente, así que es también el lugar correcto para saber sobre qué máquina corre.

## **Capítulo 6 · Red y proxy: Traefik**

Traefik es el único punto de entrada al sistema desde el exterior. Ningún servicio expone su puerto directamente a internet — todos hablan con Traefik, y Traefik decide qué dominio va a qué contenedor.

**Por qué un único punto de entrada**

Porque la seguridad de diez puertos abiertos es la seguridad del más débil de los diez. Con un único punto de entrada, hay un único lugar donde aplicar certificados SSL, reglas de acceso y límites de tráfico — y un único lugar que auditar cuando algo falla.

**Cómo se añade un servicio nuevo**

Se etiqueta en su definición de Docker Compose con las reglas de enrutado de Traefik: subdominio, certificado y destino. No se abre un puerto nuevo en el firewall. Añadir un especialista, un dashboard o una herramienta nueva es una etiqueta, no una operación de red.

**Certificados**

Renovación automática vía Let's Encrypt. Un certificado que depende de que alguien se acuerde de renovarlo manualmente no es un certificado — es una fecha de caducidad para la confianza del cliente.

## **Capítulo 7 · Entornos: Raspberry Pi vs. VPS**

Existen tres entornos. No hay un entorno intermedio de indefinición entre desarrollo y cliente real — cada uno tiene una regla explícita, precisamente para que la ambigüedad no sea la que genera incidentes.

**Desarrollo — Raspberry Pi**

Es el entorno donde se construye y se rompe sin consecuencia para ningún cliente. Corre la misma pila de contenedores que producción, a menor escala. Ningún dominio de cliente ni dato real de un cliente vive aquí bajo ninguna circunstancia. Su función es exclusivamente de desarrollo y aprendizaje interno — no es, y no debe convertirse en, el servidor de producción de Vrutal.

**Piloto y entrada — VPS compartido**

Un tercer entorno, distinto de los dos anteriores: una máquina que aloja a varios clientes a la vez, cada uno en su propio contenedor de cada servicio del Capítulo 8 — nunca en tablas compartidas de un mismo motor. Es aquí, y solo aquí, donde entra dato real de un cliente antes de que ese cliente pague por una máquina dedicada: el testeo interno y el testeo del cliente del Capítulo 15 ocurren en este entorno. Eso es una excepción explícita a la regla de la Raspberry Pi, no una ambigüedad — el aislamiento aquí es por contenedor sobre hardware compartido, no por máquina, y esa condición se comunica al cliente antes de empezar, no se descubre después.

**Producción — VPS dedicado**

Hetzner Cloud, región UE (Alemania o Finlandia), sigue siendo la recomendación por los mismos motivos de siempre: residencia de datos en la Unión Europea y un modelo de facturación que no penaliza el tráfico de salida. Lo que ya no se sostiene es la cifra: la familia CPX que este documento recomendaba subió entre 2,4 y 2,75 veces su precio mensual en junio de 2026. La instancia de entrada para un cliente dedicado es hoy un CPX32 (4 vCPU, 8 GB) — Activepieces por sí solo pide 2 vCPU y 4 GB en su documentación oficial, y un CPX22 no deja margen para el resto del stack ni para un pico de ejecuciones concurrentes. Un cliente con especialistas conversacionales de alta concurrencia empieza directamente en CPX42. El criterio de subir de tramo es la concurrencia de ejecuciones sostenida, no el número de especialistas contratados — pendiente de un umbral numérico, según el Capítulo 22.

**Criterio de promoción**

Nada pasa de Raspberry Pi al VPS compartido, ni de compartido a dedicado, por estar “terminado”. Pasa cuando cumple cuatro condiciones: corre desde la plantilla del Capítulo 5 sin pasos manuales, sus secretos están externalizados y no hardcodeados, tiene backup configurado antes del primer dato real, y tiene monitorización mínima conectada. Estas cuatro condiciones se detallan en los capítulos 9, 12 y 13. Graduar de compartido a dedicado es, además, el mismo procedimiento que restaurar tras un desastre — mover el volumen de datos a máquina nueva y reconectar secretos —, así que cada graduación es también un ensayo real del plan de recuperación.

## **Capítulo 8 · Datos: PostgreSQL y Qdrant**

El tronco tiene dos bases de datos porque responde a dos preguntas distintas, y confundirlas es el error de arquitectura más caro de deshacer más tarde.

**PostgreSQL — qué es verdad ahora**

Estado operativo, transacciones, configuración, registros de decisión de cada especialista, y todo dato estructurado donde la integridad relacional importa. Si una fila dice que una tarea está completada, tiene que estarlo — para eso existe una base de datos relacional y no un documento suelto.

**Qdrant — qué sabe el sistema**

Memoria organizativa en forma de embeddings: documentación, conversaciones relevantes, conocimiento acumulado que un especialista necesita recuperar por significado, no por clave exacta. Es el motor detrás de que un agente pueda “conocer” a Vrutal sin que alguien le pegue el manual entero en cada prompt.

**Qué es tronco y qué es rama, aquí**

El motor es tronco: PostgreSQL y Qdrant corren igual para Vrutal-lab y para cualquier cliente — en un contenedor propio de cada motor por cliente, nunca un motor compartido con filas separadas por identificador de cliente. Esa precisión no estaba en la versión anterior de este documento, y hace falta porque hay un tercer tipo de dato que ni es tronco de infraestructura ni es rama de cliente: el catálogo de tareas, roles y prompts que LAB 07 opera vive en el plano de control, es único para toda la cartera y no se rediseña por cliente — es tronco de datos, y tratarlo como rama violaría la propia distinción de este capítulo. Lo que sí es rama, dentro del plano de datos de cada cliente, es el esquema completo: un cliente con producto físico tendrá tablas de inventario que Vrutal no necesita, y ambos —Vrutal y ese cliente— corren el mismo motor, en su propio contenedor, con su propio contenido.

Con un motor por cliente, no hay tenencia múltiple dentro de una misma base, así que la separación por identificador de cliente mediante políticas de fila queda retirada de este esquema: no protege nada que el contenedor no proteja ya, y añade una capa de consulta que no compensa. El identificador de cliente sobrevive como etiqueta en la telemetría que sube al plano de control — nunca como mecanismo de aislamiento.

**Roles de acceso: Admin y Usuario estándar**

La interfaz de cliente reconoce dos roles, no uno. El Admin es la única persona, por cliente, con acceso a la pestaña de contexto y con el Agente Organizador de Contexto habilitado (LAB 07, Cap. 16); un Usuario estándar interactúa con los especialistas, pero no puede subir, reasignar ni eliminar lo que estos recuperan. Esta distinción es tronco: existe igual para cualquier cliente. Quién ocupa el rol de Admin en cada cuenta es rama.

El permiso se verifica en servidor, no ocultando la pestaña en el frontend — misma disciplina de privilegio mínimo ya fijada en el Capítulo 12.

**Ingesta de contexto: los dos motores, otra vez**

Cuando el Admin sube un archivo, la operación no termina en Qdrant. Cada subida escribe en los dos motores, por la misma razón de siempre: PostgreSQL registra qué se subió, quién, cuándo, a qué especialista y en qué estado — la pregunta de qué es cierto ahora; Qdrant embebe el contenido para que el especialista lo recupere por relevancia. Un archivo que solo existe en Qdrant, sin ese registro, no tiene historia — nadie puede responder después qué entró al contexto de un especialista ni por qué.

**Baja lógica, no borrado físico**

Cuando el Admin retira un archivo, el especialista deja de recuperarlo de inmediato, pero el registro de que existió y fue retirado permanece en PostgreSQL — la misma trazabilidad que ya exige el offboarding de cliente en LAB 12. El borrado físico e irreversible queda reservado a una solicitud explícita de cumplimiento normativo, y se ejecuta como una acción aparte, registrada por separado.

**El conector de red del cliente**

La subida manual del Admin no es la única vía de entrada, ni la principal a la larga. Un especialista que necesita la ficha técnica de un producto no debería esperar a que alguien se la suba: debe poder ir a buscarla a la ruta de red donde el cliente ya la guarda. Eso exige un componente nuevo, que no encajaba en ninguna capa del Capítulo 4 anterior a esta versión: un conector desplegado dentro de la red del propio cliente, de conexión exclusivamente saliente —nunca se abre un puerto entrante en su cortafuegos—, con un alcance de rutas declarado explícitamente y no un acceso genérico "al servidor de ficheros", y con cada lectura registrada en PostgreSQL: qué archivo, qué especialista, cuándo. Ese registro es lo que convierte "la IA lee tus archivos" en algo auditable en vez de inquietante.

No toda lectura necesita pasar por Qdrant. Buscar un fichero concreto por nombre o ruta es recuperación directa: el conector lo trae, se usa en esa ejecución, y se descarta — no hay copia persistente, no hay dato de cliente almacenado en infraestructura de Vrutal. El índice vectorial solo hace falta para la pregunta que no se puede resolver por nombre: "¿qué sabemos sobre X?". Separar ambos casos importa, porque buena parte de lo que un cliente necesita es del primer tipo, y ese tipo no exige indexar nada.

**La Memoria Organizativa como subproducto, no como tarea aparte**

El fallo habitual de cualquier proyecto de memoria vectorial es que alguien tiene que acordarse de alimentarla, y a los pocos meses nadie se acuerda. La salida de este sistema es que indexar deja de ser una tarea propia y pasa a ser un efecto secundario del trabajo que los especialistas ya hacen: si uno de ellos recoge una ficha técnica para redactar un artículo o subir un producto a la web, ese mismo contenido entra también al índice, sin que eso exija una segunda acción de nadie. Es la etapa 06 de LAB 06 —ningún hallazgo entra en memoria permanente sin registrarse— aplicada a la operación del cliente en lugar de a la investigación interna de Vrutal.

Es un flujo, no un especialista: extraer, trocear, generar el vector y guardar es determinista, sin alcance de decisión que declarar — llamarlo agente añadiría coste de modelo a algo que siempre debe hacer lo mismo. Y no hay un agente único que lo reciba todo: eso sería alcance de decisión ilimitado sobre el dato entero del cliente, exactamente lo que el Capítulo 17 prohíbe, y punto único de fallo además. Cuatro reglas gobiernan qué entra:

- **Permisos heredados, no recalculados.** Cada fragmento indexado lleva su ruta de origen y el nivel de acceso que tenía ahí. Sin esto, alguien de marketing puede preguntar y recibir una respuesta construida con datos de nóminas — un índice común no hereda por sí solo los permisos del servidor de ficheros del que viene.

- **Solo entra lo que el cliente marca como definitivo.** El cliente mantiene los archivos en curso en una carpeta de trabajo dentro de la misma ruta, y solo los traslada a la carpeta oficial cuando están terminados; el conector excluye por convención cualquier ruta marcada como temporal, sin configurarla carpeta por carpeta. Es una disciplina que se le pide al cliente, no un problema que el software pueda resolver por su cuenta — se fija como requisito de alta en LAB 12, no como supuesto implícito. Como red de seguridad técnica, el indexador además no lee un archivo hasta que su fecha de modificación lleva varios minutos sin cambiar, para no leer a mitad de una copia.

- **Sustitución, no acumulación.** Cuando la ruta oficial recibe una versión nueva del mismo archivo, los fragmentos de la versión anterior quedan marcados como superados, no borrados ni indexados en paralelo — el mismo criterio de versionado que ya rige el catálogo de tareas, aplicado a fragmentos de memoria.

- **Cobertura visible durante la carga inicial.** El primer volcado del histórico de un cliente es un pico, no un goteo, y mientras dura, "qué sabemos sobre X" puede responder de forma incompleta por omisión, no por error. El cliente ve un indicador de cobertura durante esa fase — no se le deja creer que la memoria está completa cuando no lo está, por la misma razón que el Artículo VI prohíbe presentar una cifra sin margen de incertidumbre visible.

El motor de embeddings que sostiene este flujo es, por defecto, un modelo abierto operado por Vrutal — el volumen de indexado no exige la capacidad de un modelo frontera, y el coste por token de un modelo pequeño hace que autoalojarlo compense desde el primer cliente, a diferencia del razonamiento conversacional del Capítulo 11. Si corre centralizado en el plano de control, el contenido del cliente lo atraviesa de forma transitoria para calcular el vector y no se conserva ahí — la misma regla de procesar sin almacenar que gobierna cualquier otro cruce del aislamiento entre clientes.

**Registro interno de Vrutal-lab**

El aislamiento por cliente (Cap. 22) sigue siendo la regla: ningún dato de un cliente cruza hacia otro, ni hacia Vrutal, por defecto. El único cruce deliberado es un registro interno, propio de Vrutal, que agrega metadatos de actividad de todos los clientes para supervisión de cuenta — nunca contenido. Por cliente y por semana, guarda cuántos archivos cambiaron, qué archivos y a qué especialista se dirigieron. No guarda quién los subió — mientras el Admin sea la única persona habilitada por cuenta, ese campo no añade información — ni el contenido de los archivos en sí. Es la aplicación del privilegio mínimo del Capítulo 12 al propio equipo de Vrutal: cruza el aislamiento lo mínimo que la supervisión de cuenta necesita, nunca el dato de cliente completo.

Si el rol de Admin deja de ser de una sola persona por cuenta, este registro necesita reincorporar quién ejecutó cada cambio — hoy se omite porque el dato es redundante, no porque sea irrelevante por principio.

## **Capítulo 9 · Backups y recuperación**

El backup se aparcó deliberadamente durante la fase de configuración inicial de WordPress, con la nota expresa de resolverlo “más adelante mediante un sistema de copias consistente”. Este documento es ese más adelante. Por el principio de propiedad ya fijado en el Capítulo 2 — todo tiene propietario — un sistema sin backup no tiene, en la práctica, propietario real: nadie puede garantizar que lo que gestiona sobrevive a un fallo.

**La recomendación, sin catálogo de opciones**

Tres niveles, cada uno protegiendo de algo distinto — confundirlos es tratar una reversión rápida como si fuera recuperación de desastre. Copia horaria y copia previa a cada actualización, ambas en el propio VPS del cliente: protegen de un borrado accidental o una migración que sale mal, y se restauran en minutos porque están cerca. Copia diaria completa fuera de esa máquina, cifrada antes de salir con una clave que no vive ahí: es la única que sobrevive si el VPS entero desaparece, y por eso es la obligatoria, nunca opcional. Retención de 30 días con copias semanales conservadas más allá de ese plazo.

**RTO y RPO, con número y no solo con intención**

El objetivo de tiempo de recuperación es de 24 horas: un cliente vuelve a estar operativo dentro de ese plazo tras perder su VPS por completo, lo que exige que el aprovisionamiento del Capítulo 5 esté automatizado — no se cumple un RTO de 24 horas levantando una máquina a mano. El objetivo de punto de recuperación —cuánto trabajo puede perderse— no queda cubierto por el backup diario en solitario: un día de PostgreSQL perdido es un día de registro de ejecuciones que sostiene la facturación, y esa pérdida no es aceptable. Por eso el backup diario se complementa con archivado continuo del registro de escritura de PostgreSQL hacia el mismo destino externo, mediante una herramienta hecha para esto —pgBackRest o WAL-G—: permite restaurar a un punto en el tiempo arbitrario, y baja el RPO real de 24 horas a minutos, sin multiplicar el tráfico ni el almacenamiento, porque los segmentos que envía son pequeños. Una alerta salta si el archivado deja de recibir segmentos — un mecanismo que puede fallar en silencio y nadie lo note es peor que no tenerlo.

**La prueba de restauración**

Un backup que nunca se ha restaurado es una suposición, no una garantía. Se programa un simulacro de restauración periódico — no basta con que el proceso de copia termine sin error. Graduar un cliente de VPS compartido a dedicado, según el Capítulo 7, cumple esta prueba en la práctica cada vez que ocurre.

**Regla de despliegue**

Ningún cliente entra en producción, y ningún dato real de Vrutal-lab se trata como definitivo, antes de que el backup esté verificado. Esta condición ya apareció en el criterio de promoción del Capítulo 7 y no es negociable por velocidad de lanzamiento. Y si un VPS y su backup se pierden a la vez —el escenario que el destino externo existe para evitar—, las credenciales de integración de ese cliente tampoco se recuperan de ningún sitio salvo el almacén fijado en el Capítulo 12: el backup de datos y el respaldo de secretos son dos garantías distintas, y esta sección solo cubre la primera.

## **Capítulo 10 · Orquestación: Activepieces**

Activepieces es el sistema nervioso del tronco: conecta especialistas, herramientas externas y datos mediante flujos disparados por eventos, horarios o llamadas de otros servicios.

**Lo que Activepieces hace**

Mueve información. Dispara un flujo cuando llega un lead, cuando se cierra una campaña, cuando un especialista de reporting necesita datos de una fuente externa. Integra APIs de terceros — CRM, plataformas publicitarias, correo — sin que cada especialista tenga que hablar directamente con cada sistema externo.

**Lo que Activepieces no hace**

No decide. La inteligencia vive en la capa de modelos y en los especialistas, no en el flujo que los conecta. Un flujo de Activepieces que empieza a tomar decisiones de negocio por su cuenta —qué presupuesto asignar, qué cliente priorizar— ha dejado de ser orquestación y se ha convertido en un especialista sin nombre, sin propietario y sin límite de decisión. Eso viola el diccionario ya fijado: lo que decide es un especialista, con rol y alcance definidos, no una automatización suelta.

**Versionado de flujos**

Los flujos de Activepieces se exportan y se versionan igual que el resto del tronco. Un flujo que solo existe dentro de la interfaz de Activepieces, sin copia versionada, viola la misma regla de fuente única de verdad que ya se aplicó a Docker Compose.

**Es la pieza más pesada del stack, y trae la suya propia**

La instalación estándar de Activepieces despliega cuatro contenedores, incluyendo su propio PostgreSQL y su propio Redis — no comparte el PostgreSQL del cliente descrito en el Capítulo 8, y no debería configurarse para hacerlo, porque mezclar el estado interno del orquestador con los datos operativos del cliente rompe el aislamiento entre ambos. La documentación oficial recomienda al menos 2 vCPU y 4 GB de RAM para producción; es, con diferencia, el mayor consumidor de recursos de todo el plano de datos, y dimensiona el tamaño mínimo de VPS por delante de cualquier otro componente.

## **Capítulo 11 · Capa de modelos de IA**

Ya está fijado como principio: el coste del modelo de IA usado por cada especialista es proporcional al riesgo y al coste de un posible error, no al prestigio del modelo. Este capítulo convierte ese principio en arquitectura.

**La capa como abstracción, no como proveedor**

El tronco no ata a un especialista a un proveedor concreto de forma rígida. Existe una capa intermedia que decide qué modelo atiende qué tarea según su nivel de riesgo, de forma que cambiar de proveedor — por coste, por capacidad o porque uno deja de estar disponible — no obliga a rediseñar cada especialista uno por uno. Es la aplicación directa, en esta capa, del principio “el conocimiento vale más que la herramienta”.

**Niveles de riesgo, no niveles de prestigio**

- Riesgo bajo, error barato y reversible: tareas de clasificación, extracción de datos, primeros borradores. Modelos rápidos y económicos.

- Riesgo medio: redacción de cara al cliente, análisis que alimenta una decisión humana. Modelos de capacidad intermedia con revisión humana antes de publicar.

- Riesgo alto, toca presupuesto real o compromiso público de la marca: gasto en SEM, comunicación pública, decisiones con impacto económico directo. Modelo de mayor capacidad, con supervisión y límites de decisión explícitos — nunca autonomía total.

**Qué es tronco y qué es rama, aquí**

La capa de enrutado por riesgo es tronco: existe igual para cualquier cliente. Qué modelo concreto atiende cada especialista, y dónde está el límite exacto de autonomía de cada uno, es una decisión de rama que se toma al diseñar el organigrama de ese cliente en LAB 07.

**Dónde vive el coste del modelo: dos rutas**

El coste de inferencia no se refactura como token. Existen dos rutas, y la elección es una decisión de rama por cliente:

— **Ruta frontera (por defecto).** Los roles corren contra modelos frontera (Anthropic, OpenAI u otros) a través de cuentas creadas a nombre del cliente. El dato sale hacia el proveedor; el consumo lo paga el cliente en su propia factura. Máxima capacidad, coste variable que Vrutal no intermedia.  
— **Ruta privada (autoalojada).** Para clientes que no pueden o no quieren entregar su dato a un proveedor externo, los roles corren sobre un modelo open autoalojado en infraestructura de Vrutal en la UE. El dato no sale de esa frontera. El coste deja de ser variable y pasa a ser el coste fijo del GPU, tratado como se fija en LAB 13.

La privacidad la determina dónde corre el modelo, no su tamaño. Un modelo open pequeño o mediano sobre una sola GPU cubre la mayoría de necesidades de bajo y medio riesgo de un cliente del ICP; un modelo de nivel frontera autoalojado es la excepción cara, no la norma. El detalle de necesidades y alternativas de la ruta privada vive en el documento «Modelo Privado de LLM».

**Suelo de modelo por riesgo: el cliente sube, nunca baja**

Que el cliente elija el motor —ruta frontera o privada, un proveedor u otro— no significa que pueda elegir un modelo por debajo del que la tarea exige. Vrutal fija un nivel mínimo de capacidad por cada nivel de riesgo: una tarea de riesgo alto no corre sobre un modelo pequeño porque salga más barato. El cliente puede subir de ese mínimo cuando quiera; bajar de él requiere que lo firme explícitamente, asumiendo la consecuencia. Sin este suelo, la asignación por riesgo de este capítulo sería una recomendación en lugar de una regla, y el primer error caro de un modelo infradimensionado lo pagaría la reputación de Vrutal, no solo el presupuesto del cliente.

**El consumo no se factura, pero sí se mide**

Que el token lo pague el cliente a su proveedor no exime a Vrutal de medirlo. Cada ejecución registra en el registro de ejecuciones los tokens de entrada, los de salida, el modelo usado y el coste calculado — no para cobrarlo, sino para mostrarlo. Esa telemetría es lo que sostiene la métrica que LAB 05 promete al inversor: coste por resultado entregado. Sin ella, el sistema sabe cuántas ejecuciones hubo pero no cuánto costaron, la primera factura grande del proveedor es una sorpresa que Vrutal no pudo anticipar, y el servicio de optimización de coste que se quiere vender no tiene línea base sobre la que demostrar un ahorro. El dato se captura en el momento de la ejecución o no existe: no hay forma de reconstruirlo después.

**Cerebro dedicado: operado por Vrutal, no in-house**

La ruta privada tiene una variante para el cliente que quiere su propio modelo: Vrutal lo aloja en un servidor de inferencia separado que Vrutal opera, no en la máquina del cliente. La distinción es la misma que protege los prompts en todo el sistema — quien tiene acceso administrativo a la máquina ve lo que pasa por ella. Con el modelo en un servidor de Vrutal, el cliente obtiene su modelo dedicado sin ver los prompts que lo alimentan; si insistiera en alojarlo físicamente en su propia casa, vería esos prompts, y esa renuncia a la confidencialidad tiene que firmarla sabiéndolo. El coste del servidor se transfiere al cliente con margen de gestión, no de reventa, y arrastra el mismo problema de ocupación que cualquier GPU dedicada a un solo cliente: es producto premium con suelo de contratación, no opción de catálogo general. Su tratamiento económico completo vive en LAB 13.

Cuando ese cliente deja de serlo, se lleva su cerebro — pero conviene fijar por escrito qué significa eso, porque la ambigüedad juega en contra el día de la ruptura:

|                                                        |                                                              |
|--------------------------------------------------------|--------------------------------------------------------------|
| **Se transfiere**                                      | **No se transfiere**                                         |
| Sus datos y su índice vectorial (Memoria Organizativa) | Prompts, flujos y definiciones de tarea del catálogo         |
| El ajuste fino entrenado con su información            | El catálogo, su versionado, la orquestación y los conectores |
| Los pesos del modelo abierto que usaba (base pública)  | Cualquier propiedad intelectual de método de Vrutal          |

El detalle contractual de esta transferencia se cierra en LAB 14; aquí se fija solo la frontera técnica de qué es del cliente y qué es de Vrutal.

Revisión de licencia, obligatoria. Ningún modelo open entra en producción para un cliente sin una revisión de licencia documentada, conforme a LAB 14. La condición de «open-weight» no implica libertad comercial: una licencia puede fijar umbrales de uso comercial, restricciones de redistribución o límites sobre el dato. Sin ese visto bueno registrado, la fase no ha ocurrido, con independencia de que el modelo ya funcione.

## **Capítulo 12 · Seguridad**

**Gestión de secretos**

Ninguna credencial vive escrita dentro de un docker-compose ni duplicada en varios archivos. Cada entorno tiene su propio archivo de variables de entorno, excluido del control de versiones, y ese archivo es la única fuente de verdad de sus secretos — misma disciplina del Capítulo 5, aplicada a credenciales en vez de a contenedores. A medida que el número de servicios crezca, esta gestión debe migrar a un almacén de secretos dedicado en lugar de archivos sueltos por servidor.

Las credenciales de las integraciones del cliente —las claves de su CRM, su ERP, su proveedor de modelo— viven en el VPS de ese cliente, nunca en el plano de control: una brecha en el centro no expone las credenciales de nadie. Pero eso deja un hueco que el Capítulo 9 ya señaló: si un VPS y su backup se pierden a la vez, esas claves no se recuperan de ningún sitio. La respuesta es un almacén de secretos externo —un vault de un tercero— que actúa como registro de origen de esas credenciales: de ahí se recuperan si se pierde todo, y de ahí las inyecta el aprovisionamiento del Capítulo 5 al levantar o restaurar una máquina. El VPS del cliente guarda una copia de trabajo local, cifrada, de modo que reiniciarlo no dependa de que el vault esté disponible en ese momento — el mismo criterio de "el plano de control nunca está en el camino de la ejecución", aplicado al vault.

El acceso al vault se restringe a dos o tres personas nombradas —no "dos o tres personas" en abstracto—, con registro de cada acceso y un procedimiento escrito para cuando ninguna esté disponible. Esto hace explícito lo que ya era cierto y conviene no exagerar en ventas: el aislamiento entre Vrutal y el dato del cliente es organizativo, no criptográfico. Quien opera el VPS del cliente puede leer sus secretos ahí; lo que el diseño garantiza es que una brecha del centro no los expone, no que Vrutal sea un operador de conocimiento cero. Presentarlo de otra forma sería la clase de promesa que el Artículo VI prohíbe.

**Cifrado en tránsito no es confidencialidad frente al que aloja**

Toda llamada al modelo va cifrada en tránsito, y eso protege del que escucha el cable — no del que administra la máquina donde el prompt se construye en memoria. Esa distinción es la que gobierna dónde puede correr un modelo sin exponer la propiedad intelectual de Vrutal: en infraestructura que Vrutal controla, los prompts están protegidos; en una máquina del cliente, no, por mucho cifrado en tránsito que haya. Es la razón técnica detrás de la regla del cerebro dedicado del Capítulo 11.

**Acceso**

Privilegio mínimo. Cada servicio se conecta a la base de datos con un usuario propio y permisos acotados a lo que necesita — nunca con el usuario administrador de la base de datos. No se comparten credenciales de servidor entre personas; cada acceso es nominal y trazable.

**Superficie de ataque**

Todo puerto abierto tiene que justificar su existencia, igual que todo contenedor. Por defecto, ningún servicio es accesible directamente desde internet salvo a través de Traefik. Menos puertos abiertos no es una limitación: es la aplicación literal del principio de simplicidad — la complejidad es un fallo de diseño, y en seguridad, la complejidad es además una vulnerabilidad con fecha de descubrimiento pendiente.

## **Capítulo 13 · Monitorización y logs**

Un sistema que falla en silencio es peor que un sistema que falla de forma visible. El objetivo de esta capa no es la vanidad de un dashboard bonito: es que Vrutal se entere de un problema antes que el cliente.

**Mínimo viable**

Monitorización de disponibilidad sobre cada servicio expuesto vía Traefik, con alerta directa cuando algo deja de responder. Logs centralizados de los contenedores del tronco, no dispersos servidor por servidor ni contenedor por contenedor.

**El latido de la flota**

Cada VPS de cliente envía al plano de control una señal de vida cada pocos minutos — un latido ligero, unos pocos kilobytes, no la telemetría completa. Sin ese latido frecuente, el plano de control no puede detectar dos cosas que sí necesita detectar: que un VPS ha dejado de responder, y que una tarea con aprobación humana lleva bloqueada más de 24 horas esperando a que alguien la firme. Cuando ese bloqueo se detecta, se avisa al Admin del cliente para que gestione la delegación descrita en el Capítulo 17. Esta detección degrada con elegancia: si el propio plano de control está caído, el latido no llega y la alerta no salta — el cliente sigue operando, pero la supervisión centralizada se pausa hasta que el centro vuelve. Es una consecuencia aceptada de que el plano de control no esté en el camino de la ejecución, no un fallo.

**Los logs son memoria organizativa**

Cuando un fallo ocurre, entra en el sistema documentado — no se corrige en silencio y se olvida. Esto no es una idea nueva: ya está fijado que cuando un experimento fracasa o un agente aprende una mejora, entra en el sistema. Un log de un incidente resuelto sin registro es una lección que la empresa pagó y decidió no conservar.

**Qué se mide, además de que algo esté vivo**

Coste de la capa de modelos de IA por especialista, tiempos de respuesta de los flujos críticos de Activepieces, y tasa de error de cada integración externa. Estas métricas son las que, más adelante, alimentan el reporting — el punto natural de conexión con LAB 11 (Marketing) y con cualquier panel de control que el propio equipo de Vrutal use para dirigir la operación.

*Fin de la Parte II. Continúa en la Parte III — Las Ramas (capa adaptable).*

# **PARTE III**

**LAS RAMAS**

*Capa adaptable*

## **Capítulo 14 · Qué es un especialista y qué no**

Una rama no es un agente suelto. Es un especialista: un agente de IA con un rol definido, un alcance de decisión y un lugar en la operación del cliente. La palabra importa, y ya está fijada en el diccionario de marca — no se dice “bot”, no se dice “asistente”, no se dice “herramienta”. Una herramienta se usa. Un especialista trabaja.

**Capa agéntica, no agente suelto**

Lo que se diseña por cliente nunca es un especialista aislado. Es la capa agéntica completa: la estructura paralela de especialistas coordinados entre sí, con jerarquía, dependencias y un lugar claro en el organigrama existente. Externamente se puede llamar “segundo organigrama” — es una metáfora comercial útil. Internamente es siempre capa agéntica, porque es lo que se construye de verdad.

**Empresa aumentada, no empresa automatizada**

Una rama no sustituye personas por sistemas. Coordina personas y especialistas en la misma operación. La automatización ejecuta una tarea sin criterio propio; el especialista tiene un alcance de decisión — puede equivocarse, puede aprender, y por eso necesita límites explícitos, no solo un flujo que corre solo. Esta distinción se detalla en el Capítulo 17.

## **Capítulo 15 · El método de las 5 fases aplicado a una rama nueva**

El modelo de negocio de Vrutal Labs ya fija un proceso de cinco fases y no admite atajos: nada se conecta el primer día. Este capítulo lo aplica al caso concreto de diseñar una rama — un rol nuevo dentro de una capa agéntica ya existente o en construcción.

- 01 · Auditoría (1-2 semanas). Se entra en la operación real de ese rol candidato y se mapea dónde se va el tiempo. No se audita “el marketing” en abstracto: se audita la tarea concreta que ese posible especialista haría.

- 02 · Informe (entregable escrito). Qué puede delegarse, qué debe seguir siendo humano, y cuánto vale — en tiempo y en coste. Este informe es el que decide si el rol nace, según el criterio del Capítulo 16.

- 03 · Diseño (planificación). Rol, límites de decisión y el punto exacto en el que interviene una persona. Aquí se fija también qué nivel de modelo de IA le corresponde, según el principio de asignación por riesgo del Capítulo 11.

- 04 · Testeo (controlado). Ejecución en paralelo contra casos reales. Nada entra en producción sin supervisión — el especialista trabaja junto a la persona que hoy hace esa tarea, no en su lugar, hasta que demuestra que puede.

- 05 · Despliegue y evolución (continuo). Un rol cada vez. Medido, corregido, ampliado. Nunca se lanza la capa agéntica completa de golpe.

**La fase 04 en detalle: una rampa, no un interruptor**

Testear no es un estado único. Un especialista no pasa de "no existe" a "actúa en producción" de golpe: recorre tres tramos, y el eje que decide cuánto puede escribir en cada uno no es el nivel de riesgo, sino si la operación se puede deshacer. Crear un proveedor y enviar un correo a un cliente final son ambos de riesgo medio, pero el primero es reversible y el segundo no — tratarlos igual sería permitir escrituras de prueba justo donde más duelen. Cada tarea lleva por eso una clasificación de efecto —solo lectura, reversible o irreversible— sin la cual esta rampa no puede aplicarse de forma automática.

- **Sombra, siempre primero.** Lecturas reales contra los sistemas del cliente; escrituras construidas, registradas y bloqueadas —el registro de ejecuciones marca esas escrituras no ejecutadas. Demuestra que el especialista decide bien y arma el payload correcto. Es el tramo que responde a la objeción del CEO escéptico: su primer especialista no escribe nada hasta que él ha visto una semana de lo que habría hecho.

- **Escrituras reales acotadas, solo si la operación es reversible.** Un puñado de transacciones, no un volumen: crear tres proveedores de prueba, verificarlos, borrarlos. Demuestra el camino de escritura, que la sombra no puede probar — la mayoría de fallos de integración viven ahí. Cada registro creado en este tramo lleva marca identificable, y la limpieza es parte del testeo, no una tarea pendiente. Las operaciones irreversibles nunca pasan por aquí: van directas al tramo siguiente, con aprobación humana en cada ejecución.

- **Testeo del cliente.** Una semana como máximo, según la frecuencia del flujo, con escritura real y aprobación humana sobre todo. El Admin ve el comportamiento en su propia operación y decide. La primera vez que una operación irreversible se ejecuta de verdad, hay una persona mirando.

Los tres tramos son en realidad el mismo nivel de autonomía del Capítulo 17 recorrido de menos a más: sombra es autonomía cero con registro; escritura acotada es autonomía con aprobación por ejecución; activo es la autonomía que la ficha declare. Testear no es un estado aparte — es el recorrido por los niveles que ya se definen para cualquier especialista. Estos tres tramos son testeo interno de Vrutal y testeo del cliente: son estados distintos con dueños distintos —el interno lo cierra Vrutal, el del cliente lo cierra el Admin—, y ambos ocurren en el VPS compartido de piloto del Capítulo 7, el único entorno donde entra dato real antes de que el cliente pague por máquina dedicada.

**Qué cambio obliga a re-testear y cuál no**

No todo ajuste reabre una semana de testeo, pero el criterio no es el tipo de cambio, es el riesgo de la tarea. En tareas de riesgo bajo y medio, un cambio de prompt, de memoria o de índice se despliega y queda versionado, sin re-testeo. En tareas de riesgo alto, cualquier cambio que toque el comportamiento —el prompt incluido— pasa por una pasada corta en sombra antes de volver a activo: no la semana entera, pero sí ejecución observada. Y un cambio estructural —componentes, herramientas, plataformas o APIs— pasa por testeo completo en cualquier nivel de riesgo. El prompt no es una excepción a esto: es, precisamente, lo que define el comportamiento, así que en una tarea de riesgo alto se trata como tal.

**Quién promueve a producción**

El estado del especialista se refleja en el panel del Admin del cliente, y es el Admin quien aprueba el paso a activo. Vrutal puede extender el periodo de testeo, nunca acortarlo por debajo de lo que el propio Admin acepte. El umbral numérico que hace recomendable esa promoción —a partir de qué tasa de acierto en sombra— queda pendiente de medir con el despliegue piloto, según el Capítulo 22.

**Se construye alrededor, no en sustitución**

No sustituimos el stack existente del cliente. Construimos alrededor de las herramientas que la empresa ya usa. Una rama nueva se conecta al CRM, al ERP o a la plataforma publicitaria que el cliente ya tiene — a través de la capa de orquestación del tronco (Capítulo 10) —, nunca obliga a migrar de herramienta como condición de entrada.

**Por qué empezar pequeño es una decisión de diseño, no prudencia**

El primer especialista entra en producción antes de que el resto de la capa agéntica esté diseñado. El cliente lo ve funcionando antes de comprometerse a más. Esto no es solo una táctica comercial: es la aplicación del principio de evolución constante a un organigrama entero — se despliega como se despliega software, en incrementos verificables, no como un proyecto que se juega entero a una fecha de lanzamiento.

## **Capítulo 16 · Cómo se decide si un rol nace**

Un rol no nace porque “toda empresa de este tipo lo tiene”. Nace porque la auditoría lo justifica. Cuatro condiciones, y las cuatro tienen que cumplirse:

- Trabajo recurrente. Si ocurre una vez, es un proyecto, no un especialista.

- Coste medible. El informe de la fase 02 tiene que poder poner una cifra de tiempo o dinero encima — sin cifra, no hay forma de saber si el especialista compensa su propio coste de modelo.

- Alcance de decisión definible. Si nadie puede describir dónde empieza y dónde termina lo que ese rol decide, no está listo para nacer — está listo para seguir en fase de diseño.

- No hay ya un rol que lo cubra razonablemente bien. Ampliar el alcance de un especialista existente es preferible a crear uno nuevo cuando la tarea es afín — la simplicidad es un valor de marca, no solo de producto, y aplica también al tamaño del organigrama agéntico.

**El test rápido**

Es el mismo test del Capítulo 3, aplicado ahora a un rol individual en lugar de a una pieza de infraestructura: ¿esto depende de qué vende o cómo opera este cliente en concreto? Si la respuesta es sí y cumple las cuatro condiciones, es una rama legítima. El Supply Chain Manager agéntico no nace en Vrutal-lab porque falla en el primer filtro — no hay producto físico cuya demanda prever. Nacería de inmediato en un cliente industrial, porque ahí sí hay trabajo recurrente, coste medible y decisiones acotables.

## **Capítulo 17 · Límites de decisión por especialista**

Todo especialista se documenta con tres límites explícitos antes de entrar en testeo. No es papeleo — es lo que permite que un especialista opere sin supervisión constante sin dejar de ser seguro.

- Alcance autónomo. Qué puede decidir y ejecutar sin pedir permiso.

- Requiere aprobación humana. Qué puede proponer, pero no ejecutar, hasta que una persona lo confirma. Aquí vive todo lo que toca presupuesto real o compromiso público de la marca.

- Nunca hace. La lista más corta y la más importante. Un especialista que no tiene un “nunca hace” explícito no está terminado de diseñar, esté funcionando o no.

**Relación con la capa de modelos**

Estos límites no son independientes del nivel de modelo asignado en el Capítulo 11 — son la misma decisión vista desde dos ángulos. Un especialista con alcance autónomo amplio sobre decisiones de riesgo alto necesita, por definición, el nivel de modelo más capaz y la supervisión más estrecha. Diseñar límites de decisión sin revisar el nivel de modelo asignado dejaría una rama coherente sobre el papel y desalineada en la práctica.

**Escalado, no improvisación**

Cuando un especialista llega al borde de su alcance autónomo, escala — a una persona, o al especialista manager de su línea si el organigrama tiene ese nivel intermedio. No improvisa una decisión fuera de su alcance con más confianza de la que su diseño le permite. Un especialista que se equivoca dentro de su alcance es un error a corregir. Uno que decide fuera de su alcance es un fallo de diseño de esta capa, no del modelo que lo ejecuta.

**Dónde se aprueba, y por qué canal**

La aprobación humana ocurre en el plano de datos del cliente, no en el plano de control: la petición nace en el orquestador de su VPS, sale por su canal y la respuesta vuelve al mismo sitio. Así, si el centro cae, las aprobaciones no se detienen. El canal por el que se notifica —Slack, Teams, correo, WhatsApp o el panel del cliente— transporta la notificación, pero la decisión se escribe siempre en la base del cliente: el canal es el cable, el registro de aprobaciones es la verdad. El enlace de aprobación es de un solo uso y caduca, para que no se pulse dos veces ni se reenvíe.

El canal mínimo lo fija el riesgo, con el mismo patrón que el suelo de modelo: una tarea de riesgo alto exige un canal autenticado —Slack, Teams o el panel con sesión iniciada—, porque su registro de quién aprobó es la base de la auditoría del Artículo VI; el correo se falsifica y un número de WhatsApp se puede perder, así que quedan reservados a riesgo bajo y medio. El cliente puede exigir más, nunca menos.

**Qué pasa si nadie responde**

El usuario configura un segundo aprobador en su panel, igual que configura una regla de correo antes de irse de vacaciones — es su responsabilidad, y el suplente debe cumplir condiciones: mismo dominio de correo, dado de alta por el Admin del cliente. Designar suplente no es opcional: es requisito del alta, porque si el único aprobador de un flujo desaparece sin suplente, no hay a quién escalar. La delegación tiene un límite que no se puede saltar: el suplente solo recibe las aprobaciones que ya estaba autorizado a firmar por su propio nivel; lo que exceda su nivel sube al Admin, nunca se le concede por el hecho de delegar. Si una tarea lleva bloqueada más de 24 horas por falta de aprobación, el plano de control avisa al Admin —según el latido del Capítulo 13—, y al activarse la delegación, las aprobaciones pendientes que el delegado sí puede firmar se le reenvían automáticamente. El Admin puede ver y aprobar todas en cualquier caso.

## **Capítulo 18 · Caso propio: el organigrama de Vrutal-lab**

Vrutal-lab es el primer caso de aplicación de todos los principios anteriores. No hay producto físico que fabricar ni distribuir: la operación entera gira alrededor de generar demanda. Por eso la capa agéntica es, casi en su totalidad, una capa de marketing.

VRUTAL-LAB · CAPA AGÉNTICA

│

├── Dirección → Director de Marketing Agéntico

├── Coordinación → Project Manager Agéntico

├── Managers de línea

│ ├── Adquisición

│ ├── Retención / CRM

│ └── Trade Marketing

├── Ejecución

│ ├── SEO

│ ├── SEM

│ ├── Data (CRM / ERP)

│ ├── Email / Loyalty

│ ├── Promociones / PDV

│ └── Distribución / Trade Analytics

└── Transversal → Documentación y Reporting

Ningún nodo de este organigrama se inventó por completitud. Cada uno responde a una función real de generación de demanda: adquisición, retención, ejecución táctica por canal y un nodo transversal que consolida entregables y alimenta el reporting — el mismo nodo que en el Capítulo 13 se identificó como el punto de conexión natural con la capa de monitorización del tronco.

Este organigrama es, además, la prueba de que Vrutal aplica sus propios principios antes de venderlos. El Director de Marketing Agéntico y el PM Agéntico no son jerarquía decorativa: son el nivel donde se toman las decisiones que un especialista de ejecución no tiene alcance para tomar por sí solo, conforme al Capítulo 17.

## **Capítulo 19 · Caso contrastante: un cliente con producto físico**

Para fijar el patrón del Capítulo 3 con un ejemplo completo, conviene construir el caso contrario al de Vrutal-lab: un cliente industrial, con producto físico, fabricación y distribución propias. Es un caso hipotético, ilustrativo — no corresponde a ningún cliente real ni a datos de ningún cliente.

CLIENTE INDUSTRIAL (hipotético) · CAPA AGÉNTICA

│

├── Dirección → Director de Operaciones Agéntico

├── Coordinación → Project Manager Agéntico

├── Managers de línea

│ ├── Demanda y Previsión

│ ├── Producción

│ └── Calidad

├── Ejecución

│ ├── Supply Chain / Cuotas de producción

│ ├── Inventario y Almacén

│ ├── Control de Calidad

│ └── Logística y Distribución

└── Transversal → Documentación y Reporting

El tronco que sostiene este organigrama es idéntico al de Vrutal-lab: mismo Docker, mismo Traefik, mismo PostgreSQL y Qdrant, mismo Activepieces, misma capa de modelos por nivel de riesgo. Lo único que cambia es el contenido de las ramas — porque cambia la cadena de valor real que la auditoría del Capítulo 15 encuentra al entrar en la operación.

El nodo transversal de Documentación y Reporting se repite en ambos organigramas, y no por casualidad: es el caso de función-tronco-configuración-rama descrito en el Capítulo 3. Existe siempre. Lo que reporta y a qué fuentes se conecta —cuotas de producción en un caso, rendimiento de campañas en el otro— es lo que varía.

**El tronco es la garantía de velocidad. Las ramas son la garantía de que el sistema encaja en cada negocio real, y no al revés.**

*Fin de la Parte III. Continúa en la Parte IV — Gobernanza Técnica.*

# **PARTE IV**

**GOBERNANZA TÉCNICA**

*Cómo se mantiene vivo el sistema*

## **Capítulo 20 · Versionado de infraestructura y conocimiento**

No existe una versión final del tronco, ni de este documento. Existen versiones fechadas, con motivo de cambio registrado — el principio de evolución constante ya fijado en el Capítulo 2, aplicado sin excepción. La historia nunca desaparece: la empresa necesita saber no solo qué decidió, sino por qué cambió de opinión.

**Una única fuente de verdad, también para el código de infraestructura**

Se recomienda un único camino: un repositorio Git como fuente de verdad de todo lo versionable del tronco — los archivos docker-compose de cada entorno, la configuración de Traefik, los flujos de Activepieces exportados y los documentos LAB en sí. No como buena práctica genérica, sino como aplicación literal del principio de fuente única ya fijado en el Capítulo 2: cuando infraestructura y documentación viven en el mismo sistema de versiones, referenciar en vez de copiar deja de ser un esfuerzo extra y pasa a ser la ruta más simple.

**Qué lleva cada cambio**

- Fecha. Sin excepción, incluso para cambios menores.

- Propietario. Quién lo hizo — el principio de propiedad del Capítulo 2, no se sostiene solo con buenas intenciones.

- Motivo. Por qué cambió, no solo qué cambió. “Se sustituye X por Y” no es un motivo; “se sustituye X por Y porque Z dejó de cumplir el criterio del Capítulo 5” sí lo es.

**Registro de versiones de este documento**

A modo de ejemplo del propio principio que describe, así se ha versionado LAB 08 hasta esta entrega:

| **Versión** | **Fecha**   | **Alcance**                                                                                                                                                                                                   | **Motivo**                                                                                                                                                                                                                                   |
|-------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| v0.1        | 11 ago 2026 | Parte I                                                                                                                                                                                                       | Fijar principios antes de tocar una sola herramienta concreta.                                                                                                                                                                               |
| v0.2        | 11 ago 2026 | Partes I–II                                                                                                                                                                                                   | Documentar el tronco: infraestructura, datos, seguridad.                                                                                                                                                                                     |
| v0.3        | 11 ago 2026 | Partes I–III                                                                                                                                                                                                  | Añadir las ramas: método, límites, casos de organigrama.                                                                                                                                                                                     |
| v1.0        | 11 ago 2026 | Documento completo                                                                                                                                                                                            | Cerrar con gobernanza técnica; el documento pasa a mantenimiento.                                                                                                                                                                            |
| **v0.9**    | sep 2026    | Reescritura mayor: dos planos, tres entornos, contenedor por cliente, conector de red, Memoria Organizativa, backup en tres niveles, aprovisionamiento, Activepieces, rampa de testeo, canales de aprobación. | La arquitectura de flota multi-cliente y el traslado del contenido de rama al catálogo. Renumerado de v1.0 a v0.9: v1.0 se reserva para el nacimiento de Vrutal como empresa (LAB 00, Cap. 6), no para el cierre de alcance de un documento. |

## **Capítulo 21 · Documentación técnica: cómo se mantiene viva**

Si una idea no termina documentada, nunca ha existido para Vrutal. Ese principio, ya fijado para el conocimiento de la empresa en general, es aún más estricto para el tronco: un cambio de infraestructura que no se refleja aquí es un cambio que, para efectos prácticos, nadie más puede auditar, revertir ni explicarle a un agente.

**Disparador de actualización**

Este documento no se revisa por calendario. Se actualiza cuando el sistema cambia — un servicio nuevo, un proveedor sustituido, un límite de decisión ajustado. La pregunta de control es siempre la misma: si alguien lee este documento hoy, ¿describe el sistema que existe, o el que existía la semana pasada? La segunda respuesta es una alerta, no un detalle menor.

**Propietario del documento**

LAB 08 tiene un responsable identificado, como exige el principio de propiedad del Capítulo 2. Ese responsable no es necesariamente quien ejecuta cada cambio técnico, pero sí quien garantiza que el documento sigue siendo cierto después de que ese cambio ocurre.

**Qué vive aquí y qué vive en otro sitio**

Este documento es arquitectura: por qué existe cada pieza y cómo encajan entre sí. No es un manual de instalación — los comandos, versiones exactas de paquete y pasos de puesta en marcha de cada servicio viven en la documentación operativa de ese servicio, no aquí, para no duplicar lo que cambia con más frecuencia de lo que cambia la arquitectura misma.

El mismo criterio separa LAB 08 de LAB 07, aunque su frontera se ha movido: aquí vive el tronco y el método por el que nace una rama; el contenido de cada rama —qué hace cada especialista, con qué alcance y qué herramientas— vive en el catálogo de tareas y roles, gobernado fuera del sistema de LABs por la misma razón que ese catálogo no se cierra nunca. LAB 07 fija el método por el que ese catálogo se lee, se opera y se convierte en especialista desplegado. Ninguno de los tres —LAB 08, LAB 07, el catálogo— repite lo que ya fija otro; se referencian, conforme al principio de fuente única.

## **Capítulo 22 · Roadmap técnico**

Todo proyecto pasa por LAB 15 (Roadmap) antes de comenzar. Este capítulo es la parte de ese roadmap que corresponde específicamente al tronco — las decisiones que este documento dejó abiertas a propósito, en vez de forzarlas antes de tiempo.

**Pendiente de decisión inmediata**

- Contratar el VPS de producción — recomendación ya fijada en el Capítulo 7, pendiente de ejecución.

- Configurar el ciclo de backup automatizado y ejecutar el primer simulacro de restauración, antes de que cualquier dato real de cliente se trate como definitivo.

- Medir, con el despliegue piloto de Vrutal-lab sobre un CPX22, dos números que este documento dejó como umbral y no como cifra: el consumo real de la pila por cliente —para confirmar o corregir el CPX32 como instancia de entrada del Capítulo 7— y la concurrencia de ejecuciones sostenida a partir de la cual un cliente pasa de tramo compartido a dedicado, y de CPX32 a CPX42. El aislamiento de datos por cliente ya no es punto abierto: queda resuelto como contenedor propio por cliente en el Capítulo 8.

- Poner en marcha el repositorio Git único descrito en el Capítulo 20, con la estructura de carpetas para infraestructura y documentación.

**Pendiente a medida que el sistema escale**

- Migrar la gestión de secretos de archivos de entorno a un almacén dedicado, cuando el número de servicios lo justifique.

- Evaluar si un único nodo de VPS sigue siendo suficiente, o si el volumen de especialistas activos empieza a justificar separar cargas de trabajo.

**Lo que este documento no decide**

El roadmap comercial y de captación de clientes vive en LAB 10 (Sales) y LAB 15 (Roadmap general). El roadmap de cada rama concreta — qué especialista se diseña a continuación para Vrutal-lab — vive en LAB 07. Este capítulo se limita, deliberadamente, al tronco: es la disciplina que el propio documento pide desde el Capítulo 1.

**Fin de LAB 08 · PLATFORM v0.9.**

El tronco y el método por el que crecen las ramas quedan fijados. A partir de aquí, este documento no vuelve a escribirse desde cero: se versiona, conforme al Capítulo 20, cada vez que el sistema real cambie.
