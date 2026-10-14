VRUTAL OS

**LAB 12 · OPERATIONS**

Cómo Trabaja Vrutal

*Ningún proceso depende de **quien** lo ejecuta hoy*

**Documento vivo · v0.9 — Alcance cerrado, en espera de v1.0 al nacer Vrutal**

*Building Intelligent Companies.*

# Índice general

**PARTE I — MARCO**

1.  Por qué existe este documento

2.  El principio operativo central: el proceso, no la persona

**PARTE II — EL CICLO DE UN CLIENTE**

3.  Onboarding de cliente: de la firma al primer especialista

3 bis. Aprovisionamiento y alta técnica de un cliente

4.  Captura del conocimiento del cliente

5.  QA: el control de calidad antes de salir a producción

6.  Offboarding de cliente

**PARTE III — CÓMO TRABAJA EL EQUIPO INTERNO**

7.  Onboarding de una persona nueva

8.  Onboarding de un especialista de IA nuevo

9.  Playbooks: qué es y cómo se escribe uno en Vrutal

10. Mejora continua interna

**PARTE IV — GOBERNANZA OPERATIVA**

10 bis. Operación de la flota: actualizaciones, migraciones y restauración

11. Checklist maestro: lo que no puede saltarse nunca

12. Documentación viva: propietario y disparador de actualización

13. Roadmap operativo

# PARTE I

**MARCO**

\*Por qué existe este documento, y qué prueba tiene que superar cualquier proceso de \*\*Vrutal\*

## Capítulo 1 · Por qué existe este documento

LAB 05 fija por qué piensa Vrutal. LAB 07 fija cómo decide un especialista dentro de su alcance. LAB 08 fija sobre qué infraestructura corre todo lo anterior. Ninguno de los tres fija, sin embargo, la pregunta más simple y más fácil de dar por hecha: qué hace Vrutal, en orden, cada vez que un cliente entra, cada vez que una persona se incorpora, cada vez que un entregable sale a producción. Esa pregunta es la de este documento.

Un proceso que no está escrito no es un proceso — es la memoria de quien lo ejecutó la última vez, y desaparece con esa persona en los mismos términos que el Artículo III de la Constitución ya prohíbe para el conocimiento en general. LAB 12 existe para que ejecutar un proceso en Vrutal nunca dependa de recordar cómo se hizo la vez anterior.

Qué no es este documento: no es LAB 08 — el método de las 5 fases con el que nace un especialista ya está cerrado allí, y este documento no lo reabre, solo fija el proceso operativo que lo rodea. No es LAB 07 — el detalle de cada especialista de IA vive allí. No es LAB 10 ni LAB 11 — la estrategia comercial y de marketing no se decide aquí, aunque el proceso por el que se ejecuta, sí.

## Capítulo 2 · El principio operativo central: el proceso, no la persona

Todo proceso de Vrutal se diseña bajo una única prueba: ¿sobrevive este proceso a que la persona que lo ejecuta hoy se vaya mañana? Si la respuesta es no, el proceso está mal diseñado, con independencia de lo bien que funcione hoy en manos de quien lo ejecuta.

Esta prueba tiene tres consecuencias operativas directas. Primera: todo proceso tiene un propietario documentado, no un ejecutor habitual — el propietario responde por que el proceso siga siendo cierto, no por ejecutarlo personalmente cada vez, conforme al principio de propiedad ya fijado en LAB 00, Capítulo 2. Segunda: todo proceso admite que lo ejecute un especialista de IA allí donde su alcance de decisión, fijado en LAB 08, Capítulo 17, lo permita — un proceso que solo puede explicarse a una persona, y no a un agente, no está terminado. Tercera: todo proceso se audita contra un checklist explícito, nunca contra la satisfacción de quien lo revisa — la excelencia obsesiva se mide, no se siente.

# PARTE II

**EL CICLO DE UN CLIENTE**

*De la firma del contrato a la salida, con o sin conflicto*

## Capítulo 3 · Onboarding de cliente: de la firma al primer especialista

El onboarding de un cliente no empieza el día de la firma — empieza el día en que LAB 10 marca ese cliente como calificado contra el ICP ya fijado en el Documento Fundacional: menos de 50 empleados, menos de 40 millones de euros de facturación, interlocutor CEO o propietario. Lo que este capítulo fija es lo que ocurre entre la firma y el primer especialista operativo, en cuatro fases.

Kickoff — una única sesión que fija el alcance real del proyecto contra lo vendido, y designa un propietario interno del cliente, que no cambia salvo decisión excepcional.

Auditoría — el mismo primer paso que LAB 08, Capítulo 15, ya exige para el nacimiento de cualquier rama nueva, aplicado aquí al cliente completo en lugar de a un solo rol: qué procesos existen hoy, dónde se pierde tiempo, qué conocimiento vive solo en la cabeza de alguien.

Diseño — qué especialista se despliega primero. La respuesta casi nunca es el especialista más ambicioso del catálogo, sino el que ataca la inercia organizativa más cara detectada en la auditoría, conforme al Artículo I de la Constitución.

Primer despliegue — el especialista sale a producción con el alcance autónomo más conservador que permite el Capítulo 17 de LAB 08, y se amplía solo con evidencia, nunca por calendario.

Este proceso fija cómo se despliega el primer especialista — no asume que tenga que llegar un segundo, ni un octavo. El ICP de Vrutal son empresas de menos de 50 empleados cuya señal de encaje es, precisamente, necesitar roles que no pueden justificar como contratación; para ese perfil, estabilizarse en dos o tres especialistas durante años no es una fase inicial que deba superarse, es el tamaño natural de la relación. Cada especialista es un coste fijo independiente, conforme al modelo de precios ya esbozado en el Documento Fundacional — no un paquete que solo tiene sentido completo. Un cliente que no amplía el número de especialistas no es un cliente que ha fallado en aprovechar Vrutal; con la misma frecuencia, es un cliente al que Vrutal ya le resolvió lo que tenía que resolver.

*Ningún cliente pasa de una fase a la siguiente sin que la anterior quede documentada — la misma regla que el principio de documentación ya exige en el resto del sistema.*

## Capítulo 3 bis · Aprovisionamiento y alta técnica de un cliente

El onboarding del Capítulo 3 fija qué se decide con el cliente; este fija cómo nace su infraestructura, y por qué ese nacimiento no puede ser un proyecto manual. LAB 08, Capítulo 9, fija un objetivo de recuperación de 24 horas ante la pérdida total de un VPS. Ese número tiene una consecuencia operativa que cae de lleno en este documento: si levantar la instancia de un cliente depende de que una persona concreta esté disponible y recuerde los pasos, el objetivo de 24 horas no se cumple el día que esa persona está de vacaciones. Por eso el alta técnica no es un procedimiento que se ejecuta a mano: es la ejecución del aprovisionamiento automatizado ya fijado en LAB 08, Capítulo 5 — infraestructura declarada como código, arranque automatizado y secretos inyectados desde el vault.

El alta técnica sigue siempre el mismo orden, y ese orden es idéntico al de una restauración ante desastre y al de una graduación de máquina, por diseño: se declara la máquina, se instancia la plantilla única de la flota, se inyectan los secretos del cliente desde el vault del Capítulo 12 de LAB 08, se restaura o inicializa su base, se conecta la monitorización mínima, y solo entonces —con backup ya configurado y verificado, conforme al criterio de promoción del Capítulo 7 de LAB 08— el cliente entra en el tramo compartido de piloto o en su VPS dedicado. Que las tres operaciones compartan procedimiento no es una coincidencia afortunada: es lo que garantiza que el plan de recuperación esté siempre vivo, porque se ejecuta en cada alta y en cada graduación, no solo el día del desastre.

Un cliente cuya alta requirió un paso manual no documentado no está dado de alta: está pendiente de que ese paso entre en la plantilla, exactamente igual que un proceso sin playbook no es un proceso.

## Capítulo 4 · Captura del conocimiento del cliente

Antes de que un especialista pueda operar, el conocimiento tácito del cliente tiene que convertirse en memoria recuperable, conforme al Artículo III de la Constitución. Este capítulo fija cómo, no por qué — el por qué ya está cerrado.

La captura sigue tres canales, nunca uno solo: entrevista estructurada con quien ejecuta hoy el proceso que se va a aumentar; extracción directa de los documentos, hojas de cálculo y correos que ya contienen ese conocimiento, por dispersos que estén; y observación del proceso real en marcha, porque lo que alguien dice que hace y lo que efectivamente hace rara vez coinciden del todo.

A estos tres canales de captura inicial se suma, una vez el cliente está operativo, un cuarto que no es puntual sino continuo: el conector de red fijado en LAB 08, Capítulo 8, que lee los ficheros del propio cliente en las rutas que él declara, y alimenta la Memoria Organizativa como subproducto del trabajo diario, sin que nadie tenga que subir nada a mano. Ese conector impone una condición de trabajo al cliente, y esa condición se fija aquí como requisito de alta, no como recomendación: el cliente mantiene los archivos en curso en una carpeta de trabajo temporal dentro de la misma ruta, y solo los traslada a la carpeta oficial cuando están terminados. Solo lo que llega a la carpeta oficial entra en la memoria. Sin esa disciplina, la memoria se llena de borradores y versiones a medias, y una pregunta al especialista puede devolver una respuesta sacada de algo que nunca fue definitivo. Es una carga real para el cliente, y se comunica como tal durante el onboarding del Capítulo 3, no se descubre después.

Todo lo capturado entra en Qdrant siguiendo la misma arquitectura de dos motores ya fijada en LAB 08, Capítulo 8 — nunca en un documento aparte que solo abre el equipo de implementación. Si el conocimiento capturado no es recuperable por el propio especialista que lo va a usar, la captura ha fallado, aunque el documento que la contiene esté bien escrito.

## Capítulo 5 · QA: el control de calidad antes de salir a producción

La excelencia obsesiva, fijada como principio en el Artículo VII de la Constitución, no es una sensación de quien entrega — es un checklist que cualquiera puede aplicar y llegar al mismo resultado. Este capítulo fija ese checklist.

Ningún entregable de cara a cliente sale a producción sin responder que sí a cuatro preguntas, en este orden: ¿respeta la voz de marca sin excepción, conforme al Playbook de LAB 07? ¿Cada cifra o afirmación tiene una fuente verificable, conforme a la honestidad intelectual del Artículo VI? ¿Podría llevar la firma de Vrutal sin que nadie tenga que corregirlo después? ¿Existe una versión mejor que la que se está a punto de entregar?

Solo la última pregunta admite matiz — casi siempre existe una versión mejor, en algún nivel. La disciplina no es alcanzar la perfección, es decidir conscientemente el punto en que la mejora marginal deja de justificar el tiempo, y documentar esa decisión, no simplemente parar.

## Capítulo 6 · Offboarding de cliente

Un cliente que termina su relación con Vrutal se lleva su negocio y su propio conocimiento — nunca el método con el que Vrutal opera. El Artículo III no dice que todo el conocimiento generado durante un proyecto pertenezca al cliente: dice que pertenece «al sistema que lo produce». Cuando ese sistema es un patrón que Vrutal desarrolla y refina observando varios clientes a la vez, el sistema que lo produce es Vrutal, no el proyecto individual. El offboarding distingue, sin ambigüedad, entre dos categorías de memoria.

Dato propio del cliente — sus contactos, su contenido específico de marca, sus métricas históricas, y el alcance autónomo que tuvo cada especialista en su cuenta. Se exporta siempre, sin excepción.

Método y patrones transferibles de Vrutal — técnicas, plantillas y aprendizajes que Vrutal construye a través de varios clientes, y que siguen operando después de que este cliente se vaya. No se exportan: es la misma memoria compuesta que hace a Vrutal mejor con cada cliente nuevo, y entregarla equivaldría a entregar la ventaja competitiva construida con otros clientes, no la de este proyecto.

*Un cliente de distribución industrial que se va después de 18 meses se lleva sus contactos, su contenido y sus métricas. No se lleva la técnica de SEO para el sector industrial B2B que **Vrutal** afinó trabajando, a la vez, con otros cuatro clientes del mismo vertical — esa técnica sigue siendo memoria de **Vrutal**, y es lo que hace mejor al quinto cliente de ese vertical, no solo al primero.*

El offboarding fija dos entregas obligatorias sobre el dato propio del cliente, con independencia del motivo de la salida: exportación completa de sus datos y su memoria específica, en un formato utilizable sin depender de la infraestructura de Vrutal; y documentación de qué alcance autónomo tenía cada especialista desplegado en su cuenta, para que quien continúe — dentro o fuera de Vrutal — no tenga que descubrirlo por prueba y error. La frontera exacta de qué artefactos se transfieren y cuáles no —datos e índice vectorial del cliente frente a prompts, flujos y catálogo de Vrutal, incluido el caso del cerebro dedicado— está fijada en la tabla de transferencia de LAB 08, Capítulo 11; este capítulo fija el proceso, esa tabla fija el inventario.

La baja técnica sigue el procedimiento inverso al alta automatizada del Capítulo 3 bis: se conservan los backups del cliente durante el periodo de retención acordado, se revocan sus credenciales del vault fijado en LAB 08, Capítulo 12, y se libera su VPS solo una vez confirmada la entrega de la exportación. Una baja no termina cuando el cliente deja de pagar — termina cuando su dato está entregado y sus secretos revocados, documentado.

Sobre el método transferible, la única obligación es interna: un cierre documentado de qué funcionó y qué no con este cliente entra en la memoria organizativa de Vrutal exactamente igual que un fallo interno, conforme al Aprendizaje Continuo del Artículo IV — pero entra al sistema de Vrutal, no al del cliente que se va.

# PARTE III

**CÓMO TRABAJA EL EQUIPO INTERNO**

*Un solo manual para personas y especialistas de IA*

## Capítulo 7 · Onboarding de una persona nueva

Una persona que se incorpora a Vrutal recibe, el primer día, acceso a la misma fuente que ya usa cualquier especialista de IA: el Playbook fijado en LAB 07, Capítulo 1 — quién es Vrutal, cómo piensa, cómo escribe, cómo decide. No hay un manual de cultura distinto para personas y otro para agentes; hay uno solo, y ambos lo aprenden.

Lo que sí es exclusivamente humano es la fase siguiente: sombra de un propietario de proceso durante su primer ciclo completo — no una charla de bienvenida, sino ver ejecutarse de principio a fin al menos un proceso de los fijados en este documento, antes de asumir la propiedad de ninguno.

## Capítulo 8 · Onboarding de un especialista de IA nuevo

El método de las 5 fases con el que nace cualquier especialista — auditoría, informe, diseño, testeo, despliegue — ya está fijado en LAB 08, Capítulo 15, con esos cinco nombres exactos, y este documento no lo reabre. Lo que fija LAB 12 es el checklist operativo que envuelve ese método: quién aprueba el paso de cada fase a la siguiente, y con qué evidencia.

Ninguna fase avanza sobre la palabra de quien la ejecuta. La auditoría avanza con el documento de hallazgos ya escrito. El informe avanza con el entregable que decide si el rol nace, según el criterio de LAB 08, Capítulo 16. El diseño avanza con la ficha de especialista completa, conforme a la plantilla que fija LAB 07. El testeo avanza recorriendo la rampa de tres tramos del Capítulo 15 de LAB 08 —sombra, escritura acotada reversible, testeo del cliente— con el checklist de QA del Capítulo 5 superado antes de la aprobación del Admin. El despliegue avanza con el alcance autónomo más conservador que permite el Capítulo 17 de LAB 08. Sin el documento correspondiente, la fase no ha ocurrido, con independencia de que el trabajo esté hecho.

## Capítulo 9 · Playbooks: qué es y cómo se escribe uno en Vrutal

Un playbook no es documentación de referencia que alguien consulta si tiene dudas — es lo que Vrutal ya exige de cualquier especialista antes de operar, conforme al Playbook de LAB 07, Capítulo 1, extendido aquí a cualquier proceso, lo ejecute una persona o un agente.

Todo playbook de Vrutal responde a la misma estructura mínima, sin excepción: qué dispara este proceso; qué pasos sigue, en orden; qué decide quien lo ejecuta y dónde escala; qué evidencia queda documentada al terminar. Un playbook que no puede seguir alguien que nunca ha ejecutado ese proceso antes no es un playbook — es una nota personal de quien lo escribió.

## Capítulo 10 · Mejora continua interna

El Aprendizaje Continuo fijado en el Artículo IV de la Constitución no rige solo lo que Vrutal construye para sus clientes — rige, con la misma exigencia, cómo Vrutal se construye a sí misma. Cada vez que un proceso de este documento falla o se queda corto, ese fallo recorre el mismo ciclo del conocimiento de diez etapas ya fijado en LAB 00, Capítulo 8: no se corrige en silencio y se sigue adelante.

La métrica de control es simple y ya está en uso en otras partes del sistema: ningún error se repite dos veces de la misma forma. La primera vez es un fallo del proceso. La segunda vez, si el proceso no cambió, es un fallo de gobernanza — y ese fallo es responsabilidad del propietario del proceso, no de quien lo ejecutó.

# PARTE IV

**GOBERNANZA OPERATIVA**

*Lo que no puede saltarse, quién responde por cada proceso, y lo que queda abierto*

## Capítulo 10 bis · Operación de la flota: actualizaciones, migraciones y restauración

La arquitectura de LAB 08 tiene una consecuencia que no existía cuando este documento se escribió por primera vez: Vrutal no opera un sistema, opera una flota. Cada cliente es una pila completa —base, memoria vectorial, orquestador— en su propio VPS. Veinte clientes son veinte pilas que parchear, migrar y vigilar. LAB 08 fija cómo nace y cómo se aísla cada una; este capítulo fija cómo se mantienen todas a la vez sin que la operación se vuelva ingobernable. LAB 08 lo dice sin rodeos: el mecanismo de actualización de flota hace falta antes del segundo cliente, no antes del vigésimo.

Actualización de catálogo. Un cambio en una tarea, un prompt o un flujo del catálogo central no llega a los clientes en vivo — se empuja, de forma deliberada, conforme al modelo de planos de LAB 08, Capítulo 4. El control plane sabe qué versión corre cada cliente; la deuda de versión es visible, y actualizar es una decisión con destinatario, no un despliegue global a ciegas. Un cliente en periodo de testeo no recibe empujes de catálogo que no hayan pasado su propia rampa del Capítulo 15.

Migración de esquema. Cuando cambia la estructura de la base del plano de datos —no el catálogo, sino las tablas que viven en el VPS de cada cliente— hay que migrar N bases, no una. Toda migración de esquema se prueba primero en el entorno de piloto, se ejecuta con el backup previo a actualización ya tomado (el segundo de los tres niveles del Capítulo 9 de LAB 08), y es reversible o no se ejecuta. Una migración que no se puede revertir sobre un cliente en producción no está lista, por muy probada que esté en desarrollo.

Actualización de infraestructura. Parches de sistema, versiones de imagen de contenedor, renovación de certificados: todo se fija a versión explícita en la plantilla de la flota, nunca «latest», conforme al Capítulo 5 de LAB 08. Actualizar es cambiar la plantilla y desplegarla de forma controlada, cliente a cliente o por lotes, con capacidad de detener el despliegue si el primer lote falla. Nunca se actualiza la flota entera de golpe, por la misma razón que nunca se lanza la capa agéntica completa de golpe.

Restauración. El procedimiento de restauración ante pérdida de un VPS es el mismo que el alta técnica del Capítulo 3 bis, ejecutado sobre una máquina nueva, con el objetivo de 24 horas de LAB 08 como límite. La prueba de que funciona no es que el backup termine sin error: es haber restaurado de verdad. Cada graduación de un cliente de tramo compartido a dedicado cuenta como un ensayo real de este procedimiento, y se registra como tal — es la disciplina de simulacro del Capítulo 9 de LAB 08, cumplida en la operación normal en lugar de en un ejercicio aparte.

Lo que este capítulo deja explícitamente pendiente de medir: el umbral de concurrencia sostenida que dispara la graduación de un cliente de máquina compartida a dedicada, y de un tramo de máquina al siguiente. LAB 08 fija la métrica; el número sale del despliegue piloto de Vrutal, y hasta entonces la graduación es una decisión con juicio humano sobre datos de monitorización, no una regla automática.

## Capítulo 11 · Checklist maestro: lo que no puede saltarse nunca

Cinco situaciones concentran casi todo el riesgo operativo de Vrutal. El resto del sistema puede improvisar dentro de su alcance; estas cinco, no.

| **Situación**                       | **Nunca se salta**                                                                                                                        |
|-------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Entregable de cara a cliente        | El checklist de QA del Capítulo 5, completo.                                                                                              |
| Especialista de IA nuevo            | Las 5 fases del Capítulo 8, con evidencia documentada en cada paso.                                                                       |
| Salida de un cliente                | Las dos entregas del Capítulo 6 sobre el dato propio del cliente — nunca el método transferible de Vrutal.                                |
| Cambio de alcance autónomo          | Aprobación humana explícita (LAB 08, Cap. 17) — nunca una ampliación silenciosa.                                                          |
| Fallo repetido de un proceso        | Revisión del propio proceso, no solo de quien lo ejecutó.                                                                                 |
| Migración de esquema sobre la flota | Backup previo tomado y verificado, prueba en piloto, y reversibilidad confirmada (Cap. 10 bis) — nunca sobre producción sin vuelta atrás. |
| Alta o restauración de un cliente   | El procedimiento automatizado del Cap. 3 bis, con backup verificado antes de entrar en producción — nunca un paso manual no documentado.  |

## Capítulo 12 · Documentación viva: propietario y disparador de actualización

Como cualquier documento del sistema, LAB 12 tiene un propietario identificado, conforme al principio de propiedad ya fijado en LAB 00, Capítulo 2, y no se revisa por calendario: se actualiza cuando un proceso cambia en la realidad, no cuando toca revisarlo. La pregunta de control es la misma que ya fija LAB 08: si alguien sigue este documento hoy, ¿describe cómo trabaja Vrutal ahora, o cómo trabajaba la semana pasada?

Cada proceso fijado en este documento hereda esa misma regla a nivel individual: tiene su propio propietario, y ese propietario responde por la vigencia del proceso, no necesariamente por ejecutarlo cada vez.

## Capítulo 13 · Roadmap operativo

Lo que este documento deja abierto, deliberadamente, en su primera versión:

— El checklist de QA del Capítulo 5 necesita al menos tres ciclos reales de entrega antes de considerarse estable; hasta entonces, se trata como borrador en uso, no como ley cerrada.

— El offboarding de cliente del Capítulo 6 no se ha probado todavía contra un caso real; su diseño es, por ahora, la mejor hipótesis disponible, no un proceso validado.

— La relación exacta entre este documento y LAB 10 y LAB 11 — qué procesos comerciales y de marketing entran aquí y cuáles quedan en sus propios laboratorios — se resuelve a medida que esos dos documentos tomen forma, conforme al orden ya fijado en LAB 15.

— El umbral de concurrencia que dispara la graduación de máquina (Capítulo 10 bis) queda pendiente de medir con el despliegue piloto de Vrutal; hasta entonces, la graduación se decide con juicio humano sobre datos de monitorización.

— El requisito de carpeta temporal del Capítulo 4 se apoya en una disciplina del cliente que todavía no se ha probado contra un cliente real; como el offboarding, es la mejor hipótesis disponible hasta el primer caso en producción.

Fin de LAB 12 · OPERATIONS v0.9. Quince capítulos fijan cómo trabaja Vrutal, dentro y fuera, con personas y con especialistas de IA, y cómo se mantiene una flota de clientes aislados sin que la operación se vuelva ingobernable, bajo una sola prueba: que ningún proceso dependa de quien lo ejecuta hoy. LAB 10 · Sales es la siguiente rama en la cola fijada por LAB 15.
