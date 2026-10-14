VRUTAL OS

**LAB 13 · FINANCE**

El coste detrás del precio

*Fija por qué cada tier cuesta lo que cuesta — no cuánto se vende ni cómo se negocia, eso sigue en LAB 10*

**Documento vivo · v0.1 — modelo de costes cerrado; cifra final sujeta a validación con datos reales del piloto**

*Building Intelligent Companies.*

# Índice general

**PARTE I — MARCO**

1. Por qué existe este documento
2. Qué fija y qué no fija

**PARTE II — MODELO DE COSTES**

3. Las dos rutas de coste de inferencia
4. El tronco compartido: coste fijo que no depende del tier
5. Los cinco tiers: precio, infraestructura real y margen

**PARTE III — RIESGO Y GOBERNANZA DEL PRECIO**

6. Volatilidad de infraestructura: por qué el suelo de coste no es estable
7. Cláusula de revisión
8. Puntos abiertos

**PARTE IV — HERRAMIENTAS DE TERCEROS**

9. Herramientas de terceros no-LLM: filtro de cumplimiento y criterio de absorción

**PARTE I**

**MARCO**

*Dónde empieza y dónde termina este documento*

## Capítulo 1 · Por qué existe este documento

El Documento Fundacional dejó escrito que la tabla de precios concreta correspondía a LAB 13 (Finance) y LAB 10 (Sales), no a él. LAB 10 ya fija cómo se vende: discovery, objeciones, demo, términos de contrato. Lo que LAB 10 no fija — y lo deja explícitamente pendiente en su Capítulo 7 — es por qué cada tier cuesta lo que cuesta. Esa pregunta es la que responde este documento.

LAB 13 no negocia con el cliente ni escribe el contrato. Fija el suelo: qué le cuesta a Vrutal, en infraestructura real, sostener cada tier, y por tanto qué margen queda una vez fijado el precio de venta. Es el documento que evita que un precio se decida por intuición y no se pueda defender seis meses después cuando el coste de un componente cambie.

## Capítulo 2 · Qué fija y qué no fija

**Fija:**

- El modelo de coste de inferencia, en sus dos rutas.
- El coste real de infraestructura del tronco compartido, independiente del tier.
- El coste real estimado de cada uno de los cinco tiers y el margen que resulta.
- El mecanismo de revisión del precio cuando el coste de infraestructura se mueve.

**No fija:**

- El precio final de venta al mercado — eso lo cierra LAB 10 contra la reacción real de los prospectos.
- Los términos contractuales de permanencia mínima o transferencia al fin del contrato — eso vive en LAB 14.
- La cifra exacta de concurrencia que determina cuándo un cliente sube de tramo de máquina — ese número depende del piloto de Vrutal-lab y sigue abierto en LAB 08, Capítulo 22.

**PARTE II**

**MODELO DE COSTES**

*De qué está hecho el número*

## Capítulo 3 · Las dos rutas de coste de inferencia

Conforme a LAB 08, Capítulo 11, el coste del modelo de lenguaje nunca se refactura como token — y las dos rutas tienen una implicación financiera opuesta:

**Ruta frontera (por defecto).** Los especialistas corren contra modelos de proveedores externos a través de una cuenta a nombre del cliente. El cliente paga el consumo directamente en su propia factura. Para Vrutal, el coste marginal de esta ruta es cero — el gasto de tokens no pasa por la cuenta de Vrutal en ningún momento. Esto es lo que hace que los tiers 1 a 4 tengan un margen tan alto: casi todo lo que se cobra es margen sobre infraestructura, no reventa de inferencia.

**Ruta privada (autoalojada).** Para el cliente que no puede o no quiere que su dato salga hacia un proveedor externo, el especialista corre sobre un modelo abierto — tipo DeepSeek — alojado en un servidor de inferencia que opera Vrutal, con GPU propia. Aquí el coste sí es de Vrutal, es real, y es el único punto del catálogo donde el coste de infraestructura escala con la capacidad del modelo y no con el número de llamadas.

Confundir estas dos rutas al calcular un precio es el error que este documento existe para evitar: un tier que factura como si tuviera coste de GPU cuando en realidad corre en frontera está mal defendido, y un tier que asume margen de frontera cuando en realidad requiere GPU dedicada pierde dinero sin que nadie lo note hasta la factura del servidor.

## Capítulo 4 · El tronco compartido: coste fijo que no depende del tier

Antes de calcular el coste de un tier concreto, existe un suelo de coste que Vrutal paga independientemente de cuántos clientes tenga en cada nivel:

| Componente | Función | Coste estimado/mes |
|---|---|---|
| Activepieces (orquestador) | Exige 2 vCPU / 4 GB dedicados según su propia documentación; trae su propio PostgreSQL y Redis | ~10-15€ |
| Traefik | Punto de entrada único, corre en la misma máquina | Marginal |
| Backups automatizados | ~20% del coste de instancia, según política de Hetzner | ~2-3€ por instancia |
| Monitorización mínima | Condición de graduación de LAB 08, Cap. 7 | ~5-10€ |
| Certificados SSL | Let's Encrypt, renovación automática | 0€ |

Este bloque —entre 20€ y 30€ al mes— es el coste de tener el sistema encendido, exista o no un solo cliente contratado. Con pocos clientes, este coste pesa proporcionalmente mucho; con la cartera creciendo, se diluye. Es la razón por la que el margen real de los primeros clientes es menor de lo que sugiere la tabla del Capítulo 5 — ese capítulo calcula el coste marginal de añadir un rol, no el coste de sostener la plataforma que lo hace posible.

## Capítulo 5 · Los cinco tiers: precio, infraestructura real y margen

Los tiers se ordenan por nivel de riesgo, conforme al diccionario ya fijado en LAB 08, Capítulo 11 — no por prestigio del modelo. A mayor riesgo, mayor capacidad exigida y, en los tramos superiores, mayor probabilidad de necesitar máquina dedicada.

| Tier | Precio/mes | Riesgo (LAB 08) | Dónde corre | Infraestructura real | Margen bruto aprox. |
|---|---|---|---|---|---|
| 1 · Simple | 150€ | Bajo | VPS compartido — fracción de un CPX22 | 8-12€ | ~92% |
| 2 · Medio-bajo | 200-250€ | Bajo-medio | VPS compartido, más consultas a Qdrant/PostgreSQL | 15-20€ | ~90% |
| 3 · Medio | 450-500€ | Medio | VPS dedicado CPX32, repartido entre 2-3 roles del cliente | 40-60€ | ~87% |
| 4 · Alto | 700-800€ | Alto | VPS dedicado CPX42, alta concurrencia conversacional | 70-140€ | ~82% |
| 5 · Seller | 1.200€ | Alto — ruta privada | Modelo autoalojado (DeepSeek) en GPU de Vrutal | 150-250€ si GPU compartida entre clientes / 500-1.500€ si dedicada | 60-87% variable |

**Lectura por tier:**

Los tiers 1 y 2 viven casi enteramente de la ruta frontera: el token lo paga el cliente, y el coste de Vrutal es la fracción de un servidor compartido. El margen aquí no financia la inferencia — financia el tronco del Capítulo 4 y el resto de la operación.

El tier 3 es el punto de inflexión: la concurrencia y el volumen de contexto empiezan a justificar salir del compartido a una máquina dedicada al cliente, aunque varios roles se la repartan.

El tier 4 exige el tramo de máquina superior por concurrencia sostenida — el criterio que LAB 08 fija explícitamente como "no es el número de especialistas contratados".

El tier 5 es el único que depende de una decisión binaria de ocupación. Si la GPU autoalojada sirve a varios clientes de tier 5 a la vez, el coste real por cliente se queda en el entorno de 150-250€ y el margen se mantiene sano. Si un cliente exige GPU dedicada en exclusiva, el coste real puede llegar a comerse la mayor parte del precio de venta — que es exactamente por lo que LAB 08 califica este producto como premium con suelo de contratación: sin compromiso de permanencia y volumen, ese escenario no es rentable.

**PARTE III**

**RIESGO Y GOBERNANZA DEL PRECIO**

*Por qué este número no puede tratarse como fijo*

## Capítulo 6 · Volatilidad de infraestructura: por qué el suelo de coste no es estable

Las cifras del Capítulo 5 no son una constante — son una fotografía de 2026. Dos movimientos de mercado ya han demostrado lo rápido que puede subir el suelo:

**Precio de VPS.** La familia CPX de Hetzner, la instancia recomendada en LAB 08, subió entre 2,4 y 2,75 veces su precio mensual en el ajuste de junio de 2026.

**Precio de memoria.** Los contratos de DRAM para servidor subieron entre un 88% y un 93% solo en el primer trimestre de 2026, y varias casas de análisis proyectan que los módulos DDR5 de servidor podrían llegar a duplicar su precio hacia el cierre del año. La causa es estructural, no coyuntural: los fabricantes están desviando capacidad de producción hacia memoria de alto ancho de banda para centros de datos de IA, y esa presión no se espera que se corrija antes de 2027-2028.

Estos dos movimientos explican directamente por qué el coste de un CPX32 o un CPX42 hoy no es el mismo que hace seis meses, y por qué no hay ninguna garantía de que se mantenga estable durante la vida de un contrato firmado hoy. Un precio de tier calculado sobre un coste de infraestructura que puede subir un 90% no es un precio prudente si no lleva incorporado un mecanismo de revisión.

## Capítulo 7 · Cláusula de revisión

Los cinco tiers se revisan con esta regla, no de forma discrecional:

- **Revisión programada:** cada trimestre natural, contra el coste real de infraestructura de ese momento.
- **Revisión disparada:** en cualquier momento en que el coste de VPS, GPU o memoria suba más de un 15-20% respecto a la última revisión — sin esperar al cierre de trimestre.
- **Qué se ajusta:** el precio de catálogo para contratos nuevos. Si el ajuste alcanza a contratos ya firmados es una decisión contractual, no financiera, y se remite a LAB 14.

Esta cláusula es lo que convierte la advertencia de "esto puede cambiar" en un procedimiento escrito con dueño y disparador, en lugar de una nota a pie de página que nadie ejecuta cuando realmente toca.

## Capítulo 8 · Puntos abiertos

Este documento cierra el método de cálculo. No cierra la cifra definitiva:

- **Concurrencia real.** El umbral que determina cuándo un cliente pasa de compartido a dedicado, y de CPX32 a CPX42, sigue pendiente de medirse con el despliegue piloto de Vrutal-lab, conforme a LAB 08, Capítulo 22. Hasta que ese número exista, los costes de infraestructura de este documento son una estimación razonada, no una medición.
- **Suelo de contratación del tier 5.** La permanencia mínima y las condiciones de salida cuando un cliente con GPU dedicada deja de serlo se remiten a LAB 14.
- **Cierre de LAB 10.** LAB 00 marca la tabla de precios como punto que bloquea el cierre simultáneo de LAB 10 y LAB 13. Este documento resuelve la parte de coste; LAB 10 sigue abierto en la parte de reacción real del mercado al precio de venta.

**PARTE IV**

**HERRAMIENTAS DE TERCEROS**

*Lo que no es un modelo de lenguaje, pero también cuesta dinero real*

## Capítulo 9 · Herramientas de terceros no-LLM: filtro de cumplimiento y criterio de absorción

El Capítulo 3 resuelve el coste de inferencia. No resuelve un segundo tipo de coste que aparece según el rol del especialista: APIs de pago que no son un modelo de lenguaje — enriquecimiento de datos B2B, scraping, agentes especializados alojados en Hugging Face, herramientas de automatización con coste por uso. Un especialista SDR es el primer caso real: necesita una fuente de datos de contactos para hacer su trabajo, y esa fuente tiene un coste que ninguno de los capítulos anteriores contempla.

**Paso 0 — el filtro de cumplimiento, antes de hablar de precio**

Ninguna herramienta que opere violando los términos de servicio de un tercero entra en un especialista de Vrutal, sea quien sea quien pague por ella. Esto no es una decisión de coste ni de margen — precede a esa decisión y la bloquea si no se supera.

El caso de Proxycurl fija el listón, no como advertencia teórica sino como precedente medible: una empresa con 10 millones de dólares de ingreso recurrente anual, sin financiación de capital riesgo, operando bajo el argumento de que solo accedía a datos públicos, fue demandada por LinkedIn y Microsoft en enero de 2025 por operar cientos de miles de cuentas falsas que simulaban sesiones autenticadas para extraer datos de perfiles. La demanda no pedía solo una indemnización: pedía la destrucción de todo dato "inferido, agregado o sintetizado" derivado de ese scraping, el borrado del código y la notificación a los clientes de Proxycurl. La empresa no tuvo reservas para sostener el litigio contra un adversario con presupuesto ilimitado, llegó a un acuerdo en términos no revelados, y cerró. Apify LinkedIn Profile Scraper depende del mismo tipo de acceso — sesión autenticada rotando IPs para no ser bloqueada — y por tanto queda descartado por este filtro, no evaluado por precio.

La implicación para un cliente de Vrutal no es abstracta: si un especialista corre sobre una herramienta que un proveedor como LinkedIn decide perseguir, el cliente no solo pierde la herramienta — puede verse obligado a destruir los datos que esa herramienta generó y a notificarlo a sus propios contactos. Ese riesgo no lo asume Vrutal en nombre de ningún cliente, bajo ninguna condición comercial.

Las herramientas que exportan solo lo que el propio usuario ve en una sesión que él mismo tiene abierta y logueada — extensiones de navegador de uso puntual — reducen el riesgo frente al scraping a escala con cuentas falsas, pero no lo eliminan: siguen dependiendo de una plataforma cuyas condiciones pueden cambiar sin aviso. Se tratan como riesgo medio, sujetas a revisión caso por caso, nunca como alternativa "segura por defecto".

*Nota: esto describe el riesgo tal como lo documentan las fuentes públicas del caso LinkedIn/Microsoft contra Proxycurl (demanda de enero de 2025 y su cierre posterior); no es asesoría legal. Cualquier proveedor de datos que se incorpore al catálogo pasa antes por una revisión de sus términos de servicio, y ante la duda, por la firma de un abogado.*

**Paso 1 — para las herramientas que sí superan el filtro: ¿imprescindible u opcional?**

Superado el filtro de cumplimiento, el coste de la herramienta se trata según el tipo de necesidad, no según su precio:

- **Imprescindible para que el rol cumpla su función.** El especialista no puede hacer su trabajo sin ella — para un SDR, una fuente de datos de contactos es esta categoría. Se absorbe en el margen del tier, con el mismo tratamiento que el tronco compartido del Capítulo 4: el cliente no ve una línea aparte, y el coste se revisa junto con el resto de la infraestructura en la cláusula del Capítulo 7.
- **Opcional o bajo demanda del cliente.** El especialista funciona sin ella, y el cliente la pide como ampliación de alcance. Se repasa como línea aparte con margen de gestión, con el mismo tratamiento que la ruta privada autoalojada del Capítulo 3: el coste real más un margen de gestión de Vrutal, nunca de reventa.

**Aplicación al caso SDR**

Descartado Apify por el filtro de cumplimiento, la fuente de datos de contactos para un especialista SDR se cubre con un proveedor que construye su propia base de datos sobre registros públicos, datos con consentimiento y metodología de origen documentada — no sobre sesiones autenticadas de LinkedIn simuladas a escala. Es una categoría imprescindible: se absorbe en el precio del tier del especialista SDR, y su coste real entra en el mismo mecanismo de revisión trimestral o disparada del Capítulo 7 si el proveedor sube precio.

**Gobernanza**

Toda herramienta de terceros nueva que se proponga para un especialista pasa, en este orden: primero el filtro de cumplimiento de este capítulo, después el criterio de imprescindible/opcional, y solo entonces se refleja en el precio de venta que fija LAB 10 — el mismo orden que ya rige para los números de infraestructura, fijado en el Capítulo 1.

*Punto abierto: la lista concreta de proveedores de datos B2B aprobados por el filtro de cumplimiento (candidatos evaluados: Apollo.io, People Data Labs) queda pendiente de decisión — este capítulo fija el criterio, no el proveedor final.*

*Actualizado el 22 de septiembre de 2026 — se añade el Capítulo 9 (herramientas de terceros no-LLM), a partir de una decisión tomada para el caso del especialista SDR y generalizada como regla permanente.*

*Fin de LAB 13 v0.1. Se actualiza cuando el piloto de Vrutal-lab entregue el dato de concurrencia real, cuando se ejecute la cláusula de revisión del Capítulo 7, o cuando se cierre la lista de proveedores del Capítulo 9.*