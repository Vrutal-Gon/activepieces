<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>◇ VRUTAL</strong></p>
<p><strong>VRUTAL OS</strong></p>
<p><strong>LAB 00</strong></p>
<p><strong>OS</strong></p>
<p>El Índice Maestro</p>
<p><em>No contiene estrategia. Contiene organización. Es el mapa, no el territorio.</em></p>
<p>Documento vivo · v0.3 — arquitectura fijada, registro actualizado</p>
<p><em>Building Intelligent Companies.</em></p></td>
</tr>
</tbody>
</table>

**LAB 00 · OS**

**Qué es este documento**

LAB 00 es el índice maestro del sistema documental de Vrutal: el documento que organiza a todos los demás. No contiene estrategia — la estrategia vive en cada LAB. Contiene organización: qué documentos existen, en qué estado están, bajo qué reglas se escriben y cómo se relacionan entre sí. Es el mapa, no el territorio.

Por eso es, a la vez, el primero y el último. El primero, porque fija las leyes que rigen a todo el sistema. El último, porque su registro solo puede estar completo cuando el resto de LABs existe — y como el sistema es un organismo vivo, ese registro nunca queda cerrado del todo. LAB 00 es, junto con LAB 15 y LAB 06, uno de los tres documentos que *nunca* se terminan de escribir.

Este documento existía como necesidad mucho antes que como texto. LAB 15 delegó aquí, explícitamente, el seguimiento de qué está construido y qué no —*«mientras LAB 00 no exista como documento propio…»*—, y LAB 02 apunta aquí el hogar operativo del ciclo del conocimiento. Esta es la versión v0.3: corrige una autorreferencia rota en el registro, retira una etiqueta de la Parte II que había dejado de ser exacta, fija una nueva regla de versionado y actualiza en consecuencia el registro de estado y los puntos abiertos. El registro de estado que contiene sigue siendo un snapshot con fecha, no una verdad permanente. Respecto a v0.2, los seis cambios de fondo quedan detallados en el Registro de versiones, al cierre de este documento.

**ESTRUCTURA**

**Índice general**

**PARTE I — QUÉ ES EL SISTEMA** *· redactado*

1 El principio fundacional: si no está documentado, no ha existido

2 Los dos «VRUTAL OS»: el producto y el sistema documental

3 La arquitectura vigente: por qué dieciséis laboratorios

**PARTE II — LAS LEYES DEL SISTEMA** *· redactado*

4 Cada dato existe una sola vez

5 Los estados canónicos de un documento

6 Versionado: nunca una sobrescritura silenciosa

7 Referencias cruzadas: cómo se citan los LABs

8 El ciclo del conocimiento: su hogar operativo

**PARTE III — EL ÍNDICE MAESTRO** *· redactado*

9 Los dieciséis laboratorios: mapa y contenido

10 Registro de estado y versión

11 Orden de construcción vigente

**PARTE IV — GOBERNANZA** *· redactado*

12 Puntos abiertos del sistema

13 Cómo se actualiza este documento

**PARTE I**

**Qué es el sistema**

**Capítulo 1 · El principio fundacional: si no está documentado, no ha existido**

**Si una idea no termina documentada, nunca ha existido para Vrutal.**

Esta frase no es un eslogan: es la ley que da sentido a la existencia misma de un sistema documental. Vrutal no vende horas ni software — construye tres activos: conocimiento, sistemas y organizaciones. Los tres son, en última instancia, documentación: lo aprendido, lo diseñado y lo transformado, todo escrito de forma que sobreviva a quien lo escribió.

De aquí se deriva todo lo demás en este documento. Si el conocimiento no documentado no existe, entonces la organización de esa documentación no es una tarea administrativa — es la infraestructura del activo principal de la empresa. Un fallo corregido en silencio, sin quedar documentado, es memoria organizativa que Vrutal pagó y decidió no conservar. LAB 00 es el documento que impide que eso pase por descuido.

**Capítulo 2 · Los dos «VRUTAL OS»: el producto y el sistema documental**

Existe una única ambigüedad real en todo el vocabulario de Vrutal, y este es su lugar para resolverse de forma permanente. Dos cosas distintas comparten el nombre «VRUTAL OS», y el diccionario de marca ya obliga a no confundirlas:

- **VRUTAL OS (producto).** El sistema operativo que Vrutal instala en la empresa cliente: una instancia dedicada por cliente, con sus especialistas, sus datos y sus integraciones. Su arquitectura técnica vive en LAB 08 · Platform.

- **VRUTAL OS (sistema documental).** El sistema interno de dieciséis laboratorios que organiza el conocimiento de la propia Vrutal. Este documento —LAB 00— es su índice.

La regla operativa que se fija aquí: cualquier documento sobre servidores, despliegue, instancias o infraestructura del producto pertenece a LAB 08, no a LAB 00, por mucho que lleve «Vrutal OS» en el título. LAB 00 no describe ninguna máquina — describe documentos. Confundir los dos es el error que este capítulo existe para prevenir.

Referencia: diccionario de marca, LAB 03 — «VRUTAL OS: no confundir con el sistema documental interno de dieciséis LABs».

**Capítulo 3 · La arquitectura vigente: por qué dieciséis laboratorios**

Durante el desarrollo de Vrutal convivieron tres propuestas de arquitectura documental. Este capítulo fija, sin ambigüedad, cuál rige — porque tener tres estructuras en paralelo es exactamente lo que el sistema no puede permitirse.

| **Propuesta**                              | **Estado**  | **Qué se hizo con ella**                                                       |
|--------------------------------------------|-------------|--------------------------------------------------------------------------------|
| **Sistema de 16 laboratorios (LAB 00–15)** | **Vigente** | Es la estructura viva. Todo este documento la desarrolla.                      |
| Ocho documentos por audiencia              | Absorbida   | Queda mapeada dentro de los 16 LABs. Deja de existir como estructura paralela. |
| Borrador «Documento 00 v1.0»               | Absorbido   | Su contenido pasa a ser material de trabajo de LAB 00 y LAB 01.                |

El borrador «Documento 00 v1.0» tuvo, a su vez, un boceto de trabajo previo —«VRUTAL OS v0.1», con la misma estructura de dieciséis laboratorios ya esbozada— que LAB 01 registra por separado en su propio historial de versiones. No es una cuarta propuesta independiente: es un paso anterior dentro de la misma línea evolutiva, absorbido en LAB 00 y LAB 01 igual que el borrador que lo sucedió.

Por qué dieciséis y no otra cifra: cada laboratorio corresponde a un dominio con un único dueño conceptual, de forma que ningún tema viva en dos sitios a la vez. Esa correspondencia uno-a-uno entre dominio y documento es lo que hace cumplible la ley del Capítulo 4. No es una cifra estética: es el número de dominios que, hoy, no se solapan entre sí.

**PARTE II**

**Las leyes del sistema**

Cinco leyes gobiernan a todos los LABs por igual. No pertenecen a ningún laboratorio concreto: son las reglas del sistema, y por eso viven aquí. Un LAB puede estar en cualquier estado, tratar cualquier dominio y tener cualquier versión — pero ninguno queda exento de estas cinco.

**Capítulo 4 · Cada dato existe una sola vez**

**Cada dato existe una sola vez. Cuando varios documentos necesitan el mismo contenido, todos apuntan al original en lugar de redefinirlo.**

Es la ley más importante del sistema, porque es la que impide que la documentación se contradiga a sí misma con el tiempo. Si un mismo concepto se explica en dos LABs, tarde o temprano uno de los dos se actualiza y el otro no — y a partir de ese momento el sistema miente en al menos un sitio. La única defensa estructural contra eso es que cada cosa tenga un único hogar.

Esta ley es la expresión operativa de la Arquitectura del Conocimiento, fundamentada en LAB 05, Capítulo 10, donde se declara como la regla que gobierna la relación entre LABs. LAB 05 la funda como concepto; LAB 00 la opera como mecánica. En la práctica significa tres cosas: un concepto se define en su LAB dueño y en ningún otro; los demás lo *referencian*, no lo reescriben; y cuando un dato cambia, se cambia en un solo lugar y todas las referencias quedan correctas por construcción.

**Capítulo 5 · Los estados canónicos de un documento**

Todo LAB, en todo momento, está en uno de estos estados. Se fijan aquí para que «pendiente» o «cerrado» signifiquen lo mismo en todo el sistema, escritos por quien los escriba.

| **Estado**        | **Qué significa**                                                                           |
|-------------------|---------------------------------------------------------------------------------------------|
| **Pendiente**     | No existe documento todavía. Solo el nombre y el dominio están reservados en el índice.     |
| **En desarrollo** | Existe un borrador vivo, en versión v0.x, con partes abiertas marcadas como tales.          |
| **Redactado**     | Documento completo en su alcance actual, en v1.0 o superior. No se reescribe: se versiona.  |
| **Ratificado**    | Propio de LAB 02. Un contenido elevado a ley interna de Vrutal, vinculante.                 |
| **Vigente**       | La versión concreta que rige hoy. Marca cuál de varias versiones es la aplicable.           |
| **Absorbido**     | Un documento previo cuyo contenido pasó a vivir dentro de otro LAB. Deja de existir aparte. |
| **Obsoleto**      | Material que ya no rige y no debe usarse, aunque siga existiendo físicamente.               |

El estado «Redactado» queda descrito arriba en función de la versión —v1.0 o superior—; el Capítulo 6 fija cuándo un documento puede cruzar ese umbral. Mientras Vrutal no exista como empresa, ningún LAB alcanza v1.0 ni, por tanto, el estado Redactado, aunque su contenido esté completo en su alcance actual. Esa diferencia entre «contenido cerrado» y «versión 1.0» se hace explícita en la nota de cada fila del Capítulo 10, no en el estado canónico.

Existe además un estado local para conceptos y fichas dentro de un LAB —*cerrado, no se reabre*— que se aplica, por ejemplo, a la definición de Especialista en LAB 07: fijada, y no reabrible salvo por una versión nueva del documento entero.

**Capítulo 6 · Versionado: nunca una sobrescritura silenciosa**

**Cada cambio se registra como una versión nueva, nunca como una sobrescritura silenciosa.**

Un documento que cambia sin dejar rastro de qué cambió es un documento en el que no se puede confiar, porque nadie sabe si lo que lee hoy es lo que decía ayer. El versionado es lo que convierte un texto en un registro. El esquema es simple y común a todo el sistema:

- v0.x — documento en desarrollo, con o sin partes abiertas. Cada incremento refleja un avance sustantivo (LAB 02 va por v0.2; LAB 06 por v0.1; LAB 08, con su alcance actual ya cerrado, por v0.9).

- v1.0 — no marca el cierre de alcance de un documento: marca el nacimiento de Vrutal como empresa operativa. Es un hito del sistema entero, no de un LAB aislado, y ningún documento lo cruza antes de que ese hito ocurra, por completo que esté su contenido actual.

- v1.x / v2.0 — revisiones posteriores sobre un documento ya cerrado, una vez alcanzado v1.0. Un incremento mayor señala un cambio de fondo; uno menor, una corrección o adición.

Un documento puede estar completo en su alcance actual y seguir en v0.x: es la situación de la mayoría de los LABs redactados hoy. La diferencia entre «contenido cerrado, en espera de v1.0» y «contenido todavía abierto» se refleja en la nota de cada fila del Capítulo 10, no en el número de versión ni en el estado canónico.

La disciplina técnica equivalente para infraestructura y conocimiento ya está fijada en LAB 08, Capítulo 20; este capítulo la extiende, con el mismo espíritu, a todos los documentos del sistema. La prueba de que se cumple es que cualquier afirmación de cualquier LAB se puede fechar.

**Capítulo 7 · Referencias cruzadas: cómo se citan los LABs**

Como cada dato vive una sola vez (Capítulo 4), el sistema entero funciona a base de referencias. Para que una referencia sea útil dentro de veinte años, su formato tiene que ser estable. Se fija aquí:

- **A un documento entero:** «LAB 08» o «LAB 08 · Platform».

- **A un capítulo concreto:** «LAB 08, Cap. 15» — la forma preferida, porque apunta al dato exacto y no al documento entero.

- **A un artículo de la Constitución:** «Artículo II de LAB 02», por su numeral romano.

Una referencia rota —a un capítulo que se renumeró, a un LAB que cambió de nombre— es un fallo del sistema, no un detalle. Mantener las referencias vivas es parte de mantener vivo el documento (Capítulo 21 de LAB 08 lo fija para la documentación técnica; el principio es el mismo aquí).

**Capítulo 8 · El ciclo del conocimiento: su hogar operativo**

Toda idea en Vrutal recorre siempre el mismo camino. El ciclo se fundamenta como concepto en LAB 05, Capítulo 9 —el Aprendizaje Continuo—, y su hogar operativo, al que apunta LAB 02, es este documento. Aquí vive el recorrido; en LAB 05 vive su porqué.

Idea → Investigación → Hipótesis → Experimento → Validación →

Documentación → Implementación → Automatización → Mejora continua → Memoria permanente

Diez etapas, no simplemente «iterar». La diferencia está en la última: la memoria permanente es obligatoria, no opcional. Sin ella, cualquier aprendizaje se pierde en la siguiente reorganización y se repite, con distinta gente, como si fuera la primera vez. El ciclo es la forma operativa del principio del Capítulo 1 — es *cómo* una idea llega a estar documentada, y por tanto a existir.

**PARTE III**

**El índice maestro**

**Capítulo 9 · Los dieciséis laboratorios: mapa y contenido**

El mapa completo del sistema. Cada fila es un dominio con un único dueño; ningún tema aparece dos veces. Esta tabla es la referencia canónica de qué contiene cada LAB — cualquier duda sobre dónde vive un tema se resuelve aquí.

| **LAB** | **Nombre**        | **Contiene**                                                                   |
|---------|-------------------|--------------------------------------------------------------------------------|
| 00      | **OS**            | Arquitectura del sistema documental. Índice maestro. Organiza, no estrategiza. |
| 01      | **FOUNDATION**    | Origen, problema, propósito, visión, misión, manifiesto.                       |
| 02      | **CONSTITUTION**  | Filosofía, principios, cultura, leyes internas, decisión, derechos.            |
| 03      | **BRAND**         | Identidad, posicionamiento, arquetipos, voz, naming, storytelling, promesa.    |
| 04      | **DESIGN SYSTEM** | Lenguaje visual: retícula, color, tipografía, componentes, iconografía.        |
| 05      | **PHILOSOPHY**    | Conceptos propios: Empresa Aumentada, Especialistas, Sinapsis, Memoria.        |
| 06      | **RESEARCH**      | Investigación permanente: tendencias, competidores, casos, white papers.       |
| 07      | **AGENTS**        | Ecosistema de IA: especialistas, prompts, flujos, roles, orquestación.         |
| 08      | **PLATFORM**      | Infraestructura técnica: servidores, datos, backups, seguridad.                |
| 09      | **WEBSITE**       | Experiencia digital: arquitectura, UX, SEO, copywriting, conversión.           |
| 10      | **SALES**         | Sistema comercial: ICP, propuestas, pricing, objeciones, contratos, CRM.       |
| 11      | **MARKETING**     | Generación de demanda: contenido, SEO, SEM, eventos, embudos.                  |
| 12      | **OPERATIONS**    | Cómo trabaja Vrutal: procesos, playbooks, QA, onboarding, offboarding.         |
| 13      | **FINANCE**       | Modelo económico: KPIs, previsiones, facturación, tesorería, rentabilidad.     |
| 14      | **LEGAL**         | Contratos, NDA, protección de datos, licencias, propiedad intelectual.         |
| 15      | **ROADMAP**       | Qué se construye, qué se descarta, qué se investiga. Todo pasa por aquí.       |

**Capítulo 10 · Registro de estado y versión**

El corazón vivo de LAB 00. Refleja el estado de cada laboratorio a la fecha de esta versión. Es un snapshot: cambia cada vez que un LAB cambia de estado o de versión (Capítulo 13).

*Snapshot a fecha de LAB 00 v0.3 — septiembre de 2026.*

| **LAB**          | **Estado**         | **Versión** | **Nota**                                                                                                                                                               |
|------------------|--------------------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 00 OS            | En desarrollo      | v0.3        | Este documento. Corrige la autorreferencia rota de v0.2, que indicaba v0.1.                                                                                            |
| 01 FOUNDATION    | En desarrollo      | v0.9        | Documento Fundacional. Alcance cerrado tras su segunda revisión de fondo; en espera de v1.0 al nacer Vrutal.                                                           |
| 02 CONSTITUTION  | Ratificado parcial | v0.2        | 11 artículos rigen (Títulos I–II); III–VII pendientes.                                                                                                                 |
| 03 BRAND         | En desarrollo      | v0.9        | Brand Book (03 + 04). Alcance cerrado; en espera de v1.0 al nacer Vrutal.                                                                                              |
| 04 DESIGN SYSTEM | En desarrollo      | v0.9        | Brand Book (03 + 04). Alcance cerrado; en espera de v1.0 al nacer Vrutal.                                                                                              |
| 05 PHILOSOPHY    | En desarrollo      | v0.9        | Conceptos fundados; 2 en desarrollo. Alcance actual cerrado en lo demás; en espera de v1.0 al nacer Vrutal.                                                            |
| 06 RESEARCH      | En desarrollo      | v0.1        | Método fijado; cuerpo abierto.                                                                                                                                         |
| 07 AGENTS        | En desarrollo      | v0.9        | 12 especialistas documentados. Alcance cerrado; en espera de v1.0 al nacer Vrutal.                                                                                     |
| 08 PLATFORM      | En desarrollo      | v0.9        | Tronco y método de ramas fijados. Orquestador pendiente de actualizar: n8n reemplazado por Activepieces (Cap. 12). Alcance cerrado; en espera de v1.0 al nacer Vrutal. |
| 09 WEBSITE       | En desarrollo      | v0.1        | Brief + mockups cerrados (equivalente a v0.9 en su alcance limitado); el documento LAB en sí no se ha redactado. Corrige el estado «Parcial», que no es canónico.      |
| 10 SALES         | En desarrollo      | v0.3        | 11 capítulos; 3 decisiones abiertas.                                                                                                                                   |
| 11 MARKETING     | En desarrollo      | v0.1        | 6 canales activos; casos de éxito pendientes.                                                                                                                          |
| 12 OPERATIONS    | En desarrollo      | v0.9        | 13 capítulos. Alcance cerrado; en espera de v1.0 al nacer Vrutal.                                                                                                      |
| 13 FINANCE       | Pendiente          | —           | Sin documento. Depende de pricing (LAB 10, Cap. 7).                                                                                                                    |
| 14 LEGAL         | En desarrollo      | v0.1        | Marco fijado; texto contractual y entidad legal pendientes.                                                                                                            |
| 15 ROADMAP       | En desarrollo      | v0.2        | Método y horizonte fijados.                                                                                                                                            |

**Capítulo 11 · Orden de construcción vigente**

LAB 15 delegó aquí el orden de construcción. El orden heredado, fijado en su día, es: LAB 12 cerrado, LAB 10 · Sales a continuación, LAB 11 · Marketing después. Ese orden sigue vigente como *prioridad por defecto*, pero no es una camisa de fuerza: el operador del sistema puede adelantar un LAB de bajo riesgo y alto valor cuando convenga — como ocurrió al redactar LAB 06 y este mismo LAB 00 fuera de turno.

La regla real detrás del orden no es la secuencia, sino la dependencia: un LAB no puede cerrarse mientras dependa de decisiones que viven en otro aún abierto. LAB 13 · Finance no puede cerrar sin el pricing de LAB 10; LAB 02 no puede ratificar sus últimos títulos sin más casos de LAB 12 en producción. El Capítulo 12 recoge esas dependencias como puntos abiertos.

**PARTE IV**

**Gobernanza**

**Capítulo 12 · Puntos abiertos del sistema**

Lo que el sistema, en su conjunto, tiene sin cerrar a fecha de esta versión. No es la lista de tareas de un LAB — es la de todos, vista desde el índice. Cada punto indica de qué depende su cierre.

- **Documentos pendientes.** LAB 13 · Finance no existe todavía; LAB 09 · Website existe solo como brief, no como documento LAB completo. LAB 11 y LAB 14 siguen en desarrollo (v0.1).

- **Tabla de precios.** El pricing concreto por especialista y paquete queda abierto entre LAB 10 (Cap. 7) y LAB 13. Bloquea el cierre de ambos.

- **Constitución incompleta.** Los Títulos III a VII de LAB 02 siguen pendientes, a la espera de más casos operativos de Vrutal-lab y del cierre de LAB 10 y LAB 12.

- **Conceptos en desarrollo.** Sinapsis y Organismo Inteligente (LAB 05) tienen protocolo o representación maduros, pero su lectura conceptual espera más casos reales.

- **Coherencia de plataforma.** El orquestador pasó de n8n a Activepieces, ya reflejado en LAB 08 v0.9 (Cap. 10). La arquitectura de dos planos —control y datos— y la separación catálogo central / base por cliente quedan también fijadas en LAB 08 v0.9. Punto cerrado; se conserva aquí solo como traza del cambio.

- **Vocabulario de método sin alinear.** Las seis etapas de LAB 15 (Audit–Report–Design–Test–Deploy–Evolve) y las cinco fases de LAB 08, Cap. 15, para el nacimiento de un especialista, comparten espíritu pero no vocabulario: Report y Test no tienen hoy paso equivalente explícito en LAB 08. Ninguno de los dos LABs queda bloqueado por esto, pero el desajuste sigue pendiente de resolverse.

- **Umbral de graduación de infraestructura.** LAB 08 v0.9 fija la métrica —concurrencia pico sostenida— por la que un cliente pasa de VPS compartido a dedicado y de un tramo de máquina al siguiente, pero deja el número pendiente de medir con el despliegue piloto de Vrutal-lab. Bloquea el cierre del suelo de precio en LAB 10 y LAB 13.

- **Dominio definitivo.** Conviven vrutal-labs.com y vrutal.ai. Debe cerrarse antes de publicar la web.

- **Entidad legal y fiscal.** Datos para el aviso legal y para poder firmar contratos, pendientes. LAB 14 los marca como su bloqueante principal.

- **Traducción del sistema verbal.** Pendiente a inglés, francés y portugués.

**Capítulo 13 · Cómo se actualiza este documento**

LAB 00 es un documento vivo, como LAB 15. No se revisa en un calendario fijo: cambia cuando el sistema cambia. Su disparador de actualización es concreto:

- Cada vez que un LAB cambia de estado —de pendiente a en desarrollo, de en desarrollo a redactado— se actualiza el registro del Capítulo 10.

- Cada vez que un LAB publica una versión nueva, se actualiza su fila.

- Cada vez que un punto abierto del Capítulo 12 se cierra o aparece uno nuevo, se refleja aquí.

- Cada cambio en una ley del sistema (Parte II) obliga a una versión mayor de este documento, porque afecta a todos los LABs a la vez.

Lo que LAB 00 no hace nunca: contener la estrategia que ya vive en otro LAB. Si este documento empieza a explicar cómo se vende, cómo se diseña o cómo se investiga, ha dejado de ser un índice. Su disciplina es la del Capítulo 4 aplicada a sí mismo — no repetir lo que ya vive en otro sitio.

**Registro de versiones**

| **Versión** | **Cambio**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| v0.1        | Primera redacción. Arquitectura, cinco leyes del sistema y registro inicial de los dieciséis laboratorios.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| v0.2        | Corrección del registro: LAB 11 · Marketing localizado (v0.1); LAB 14 · Legal redactado (v0.1). Puntos abiertos actualizados.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| v0.3        | Corrige la autorreferencia del Capítulo 10 (00 OS indicaba v0.1). Retira la etiqueta «Principio 1» del Capítulo 4 — las cinco leyes de la Parte II quedan sin numerar individualmente. Nueva regla en el Capítulo 6: v1.0 marca el nacimiento de Vrutal como empresa, no el cierre de alcance de un documento. Registro del Capítulo 10 actualizado bajo esa regla — siete LABs pasan de v1.0/Redactado (o Vigente) a v0.9/En desarrollo; LAB 09 corrige su estado inválido «Parcial». Capítulo 12 actualizado: el punto de coherencia de plataforma refleja el paso de n8n a Activepieces; se añade el desajuste de vocabulario entre LAB 15 y LAB 08. Capítulo 3: nota sobre «VRUTAL OS v0.1» como antecedente de «Documento 00 v1.0». |

**Fin de LAB 00 · OS v0.3.**

Trece capítulos fijan qué es el sistema documental de Vrutal, bajo qué cinco leyes se escribe y cuál es el estado real de sus dieciséis laboratorios. La arquitectura y las leyes quedan cerradas; el registro de estado, por definición, no — es un snapshot que caduca con el primer cambio de cualquier LAB, como demuestra esta misma revisión v0.3. Con este documento, el sistema deja de tener un índice implícito repartido entre LAB 01 y LAB 15, y pasa a tener uno propio. Nueve puntos quedan abiertos, cada uno con su dependencia, ninguno disimulado.
