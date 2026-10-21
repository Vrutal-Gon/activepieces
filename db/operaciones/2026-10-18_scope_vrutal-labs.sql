-- =====================================================================
-- PEGAR EN EL SQL EDITOR DE VrutalOS (Vrutal-labs, rgauumxztblwurzebmsa)
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju).
--
-- Rellena el scope de negocio del cliente 0 con lo que ya está escrito en los LAB. Nada de
-- esto es inventado: cada fila tiene su origen citado en el comentario de su bloque.
--
--   Marca            → LAB 03/04 · Brand (los cinco rasgos, el diccionario, los don'ts)
--   Estrategia       → LAB 03 (posicionamiento), LAB 10 cap. 7 (precios), LAB 11 (canales y SEM)
--   Competencia      → LAB 03 (contra qué competimos) y LAB 06 cap. 9 (mapa, aún sin nombres)
--   Productos foco   → BRIEF §5.2 y el catálogo de roles; LAB 10 cap. 8 (auditoría inicial)
--   Objetivos        → NO se rellenan. Ver el porqué al final.
--
-- `source = 'cliente'`: lo escribe el cliente (que aquí es Vrutal-lab, su propio cliente 0),
-- así que es editable desde la pantalla Negocio. El ICP ya cargado va como 'vrutal' y queda
-- bloqueado: entre los dos se ve en pantalla la diferencia entre lo que trae la auditoría y
-- lo que pone el cliente.
--
-- Idempotente: `on conflict do nothing` en todo.
-- =====================================================================

-- ── 1 · Marca · LAB 03/04 Brand, «Los cinco rasgos», «Diccionario» y «Do's y Don'ts» ──────
insert into public.mkt_input_value (input_key, field_key, value, source, position) values
  ('brand_voice', 'voz', 'Claridad brutal: una frase, una idea. Si hay que releerla, está mal escrita; antes la palabra corta y concreta que la abstracta y prestigiosa.', 'cliente', 11),
  ('brand_voice', 'voz', 'Autoridad con evidencia: se afirma con datos y se cita la fuente en la propia página. Si no tenemos el dato, se dice; no se rellena con adjetivos.', 'cliente', 12),
  ('brand_voice', 'voz', 'Ambición sin arrogancia: prometemos cambio de escala, no superioridad moral. La ambición está en lo que construimos, no en cómo hablamos de nosotros.', 'cliente', 13),
  ('brand_voice', 'voz', 'Filo rebelde: nombramos lo que el sector suaviza, incluido el desplazamiento de empleo que provoca la IA. Filo, nunca cinismo ni ataque a competidores.', 'cliente', 14),
  ('brand_voice', 'voz', 'Economía de palabras: si se puede quitar una palabra sin perder sentido, sobraba.', 'cliente', 15),
  ('brand_voice', 'diccionario', 'Especialista: agente de IA con un rol definido, un alcance de decisión y un lugar en la operación del cliente. No es un bot, ni un asistente, ni una herramienta.', 'cliente', 21),
  ('brand_voice', 'diccionario', 'Capa agéntica: la estructura paralela completa que diseñamos, no un agente suelto. No es «automatización».', 'cliente', 22),
  ('brand_voice', 'diccionario', 'Segundo organigrama: metáfora comercial de la capa agéntica, de uso externo. No es el organigrama humano, que no se toca.', 'cliente', 23),
  ('brand_voice', 'diccionario', 'Empresa aumentada: organización donde personas y especialistas trabajan coordinados. No es una «empresa automatizada».', 'cliente', 24),
  ('brand_voice', 'diccionario', 'Memoria organizativa: conocimiento que vive en el sistema y sobrevive a las personas. No es una base de datos ni documentación.', 'cliente', 25),
  ('brand_voice', 'diccionario', 'VRUTAL OS: el sistema operativo que instalamos en la empresa cliente. No confundir con los dieciséis LAB, que son el sistema documental interno.', 'cliente', 26),
  ('brand_voice', 'prohibidos', 'bot, asistente, herramienta: nunca para nombrar a un especialista.', 'cliente', 31),
  ('brand_voice', 'prohibidos', 'automatización: no sustituye a «capa agéntica»; automatizar es una parte, no el producto.', 'cliente', 32),
  ('brand_voice', 'prohibidos', 'Cifras sin fuente, del tipo «hasta un 90% de ahorro».', 'cliente', 33),
  ('brand_voice', 'prohibidos', 'Jerga de consultora: «soluciones innovadoras», «sinergias operativas», «viaje de transformación digital», «amplia gama de servicios».', 'cliente', 34),
  ('brand_voice', 'prohibidos', 'Hablar de «implementar IA» como proyecto de innovación: ese prospecto no encaja con el ICP (LAB 10 cap. 2).', 'cliente', 35)
on conflict (input_key, field_key, value) do nothing;

-- ── 2 · Competencia · LAB 03 «Contra qué competimos» y LAB 06 cap. 9 ─────────────────────
-- Son CATEGORÍAS, no empresas: el mapa con nombres es trabajo de LAB 06 y todavía no existe.
-- Cuando lo haya, cada nombre entra como una fila más, con su web, y MKT-F5 podrá ficharla.
insert into public.mkt_competitor (name, website, notes, priority, source) values
  ('La inercia', null, 'El competidor real según LAB 03: la idea de que una empresa pequeña tiene que resignarse a competir con menos capacidad que una grande. No se vence con comparativas, se vence con casos propios.', 1, 'cliente'),
  ('Agencias', null, 'Venden proyectos y entregables. Hueco que cubrimos: estructura permanente que queda en la empresa.', 2, 'cliente'),
  ('Consultoras', null, 'Venden diagnóstico y recomendación. Hueco: nosotros diseñamos la capa agéntica y la ponemos a operar.', 3, 'cliente'),
  ('Software houses', null, 'Venden producto a medida. Hueco: no vendemos entregables, sino un especialista con alcance de decisión.', 4, 'cliente'),
  ('Empresas de automatización', null, 'Venden flujos sueltos. Hueco: un agente suelto no es una capa agéntica; el valor está en qué decide cada uno y cómo se coordinan.', 5, 'cliente')
on conflict (name) do nothing;

-- ── 3 · Productos foco · BRIEF §5.2, catálogo de roles y LAB 10 cap. 8 ───────────────────
-- El precio por rol no está fijado en ningún LAB: los cinco tiers de LAB 13 van de 150 € a
-- 1.200 €/mes según riesgo, y asignar tier a cada rol es decisión pendiente. No se inventa.
insert into public.mkt_focus_product (name, description, price_note, priority, status, source) values
  ('Especialista de Contenido y Promoción', 'Mantiene el calendario, redacta briefs y borradores, adapta cada pieza por canal y revisa la voz. Todo contenido nuevo de cara al público pasa por aprobación humana.', 'Tier por asignar (150-1.200 €/mes)', 1, 'activo', 'cliente'),
  ('Especialista SEO/SEM', 'Investiga keywords por el dolor operativo del ICP, audita el sitio y prepara briefs. En SEM ajusta pujas dentro de un techo que aprueba una persona.', 'Tier por asignar; SEM es de los roles de mayor riesgo', 2, 'activo', 'cliente'),
  ('Analista de Mercado', 'Consolida las métricas de todos los canales, diagnostica cada canal frente a su objetivo y redacta el informe semanal.', 'Tier por asignar (150-1.200 €/mes)', 3, 'activo', 'cliente'),
  ('Auditoría inicial', 'Kickoff, auditoría y diseño antes de que exista cuota. Se cobra siempre, firme o no el prospecto.', 'Coste fijo; si firma, se devuelve como 8,3% de descuento mensual durante el año 2', 4, 'activo', 'cliente'),
  ('Sales Development Representative', 'Investiga la cuenta y redacta el informe previo para el vendedor. En segundo plano desde el pivote a Marketing del 2026-10-01.', 'Tier por asignar (150-1.200 €/mes)', 5, 'pausado', 'cliente'),
  ('Data Entry Clerk', 'Introduce, valida y normaliza información en los sistemas del cliente. Pausado desde el 2026-09-23.', 'Tier por asignar (150-1.200 €/mes)', 6, 'pausado', 'cliente')
on conflict (name) do nothing;

-- ── 4 · Estrategia · LAB 03 (posicionamiento), LAB 10 cap. 7 (precio), LAB 11 (canales) ──
-- REQUIERE las tres sentencias pendientes de 2026-10-17_marketing_admin.sql: mientras el
-- CHECK de mkt_input_field.input_key no admita 'strategy', este insert falla con 23514.
insert into public.mkt_input_value (input_key, field_key, value, source, position) values
  ('strategy', 'posicionamiento', 'Para fundadores y directores de empresas B2B de menos de 50 empleados y menos de 40 M€ que necesitan crecer más rápido de lo que su estructura permite, Vrutal Labs diseña la capa agéntica de la organización: un segundo organigrama de agentes que trabaja en paralelo al equipo humano.', 'cliente', 10),
  ('strategy', 'propuesta_valor', 'Capacidad que antes solo tenían las grandes, por suscripción: roles que una pyme no puede justificar como contratación.', 'cliente', 21),
  ('strategy', 'propuesta_valor', 'Estructura permanente, no entregables: lo que construimos se queda en la empresa y evoluciona con ella.', 'cliente', 22),
  ('strategy', 'propuesta_valor', 'La velocidad de decisión de una empresa diez veces mayor, con el equipo que ya tienes.', 'cliente', 23),
  ('strategy', 'diferenciador', 'No vendemos herramientas: definimos qué decide cada agente, con qué datos y cómo se coordina con las personas.', 'cliente', 31),
  ('strategy', 'diferenciador', 'Competimos contra la inercia, no contra agencias ni consultoras. Nada de benchmarking cosmético (LAB 06, Artículo VI).', 'cliente', 32),
  ('strategy', 'diferenciador', 'Cada especialista se justifica contra el coste del puesto que cubre, no contra el de una licencia de software.', 'cliente', 33),
  ('strategy', 'diferenciador', 'Método antes que moda: se mide qué decide un agente sin supervisión y solo se escala lo que funciona con evidencia.', 'cliente', 34),
  ('strategy', 'diferenciador', 'El caso propio primero: Vrutal-lab es el cliente 0 y vive dentro de la arquitectura antes de venderla.', 'cliente', 35),
  ('strategy', 'estrategia_precio', 'Cinco tiers por especialista, de 150 € a 1.200 €/mes según riesgo e infraestructura (LAB 13). El precio del tier es el precio final: no hay línea de infraestructura ni admin fee. Vrutal no factura tokens: las cuentas de los modelos van a nombre del cliente.', 'cliente', 40),
  -- `foco_sem` RETIRADO el 2026-10-20 (cambio 2026-10-20_mkt_sem_strategy.sql). Era texto libre y
  -- la estrategia SEM pasa a `mkt_sem_strategy`: objetivo de lista cerrada + vigencia. Estas tres
  -- frases NUNCA llegaron a la base viva (comprobado el 2026-10-20: el campo existía con 0 valores),
  -- así que no hay nada que migrar. Y Vrutal-labs tampoco estrena fila en la tabla nueva:
  --   · «Bloqueado: sin entidad legal ni cuenta bancaria no se puede abrir una cuenta publicitaria
  --     (LAB 14 cap. 8). Se diseña, no se activa.» → sin cuenta no hay fecha de inicio, y una fila
  --     de `mkt_sem_strategy` exige `starts_on`. Inventar una fecha es inventar un dato. Queda dicho
  --     en `canal_prioritario` («SEM: bloqueado hasta tener entidad legal y cuenta bancaria»).
  --   · «El techo de presupuesto lo aprueba una persona; el especialista solo reparte pujas dentro
  --     de ese techo.» → es una regla de AUTONOMÍA, no scope de negocio: su sitio es el techo por
  --     tarea (deuda anotada en plantillas/cambios/README.md), no una columna de esta tabla.
  --   · «Métrica: CAC y ROAS. Nunca volumen de clics.» → es MÉTRICA: su sitio es
  --     `mkt_channel_target`, que sigue vacío a propósito (ver bloque 5). En la estrategia SEM no
  --     hay métrica por diseño: dice qué se persigue y cuándo, no cuánto.
  ('strategy', 'canal_prioritario', 'Contenido: hoy el único canal activo, solo contenido corporativo en LinkedIn. Es la materia prima de los otros cinco.', 'cliente', 61),
  ('strategy', 'canal_prioritario', 'SEO: bloqueado hasta resolver el dominio y el aviso legal. Métrica: posición de keyword y conversión, no visitas.', 'cliente', 62),
  ('strategy', 'canal_prioritario', 'SEM: bloqueado hasta tener entidad legal y cuenta bancaria.', 'cliente', 63),
  ('strategy', 'canal_prioritario', 'Eventos: sesión corta sobre un problema operativo real, nunca conferencia de marca. Tarea del Manager de Adquisición, sin rol dedicado.', 'cliente', 64),
  ('strategy', 'canal_prioritario', 'Automatizaciones: nutrición del lead hasta MQL, ejecutada en Activepieces, nunca en una herramienta paralela.', 'cliente', 65)
on conflict (input_key, field_key, value) do nothing;

-- ── 5 · Objetivos por canal: VACÍO A PROPÓSITO ───────────────────────────────────────────
-- LAB 11 fija la MÉTRICA de cada canal (SEO: posición y conversión; SEM: CAC y ROAS), pero
-- ningún LAB fija una cifra objetivo, y dos de los tres canales medibles están bloqueados.
-- Decisión ya tomada: no hay objetivos por canal hasta que se opere de verdad. Poner un
-- número inventado haría que MKT-F7 diagnosticara contra una meta falsa, que es peor que no
-- diagnosticar. Esta tabla se rellena cuando haya historia real que comparar.
