-- =====================================================================
-- Proyecto Supabase: Vrutal 1st (apmhvqlvwjcrwfaixgju) — el panel de control.
-- NO en el VrutalOS de ningún cliente: ese es otro proyecto, uno por cliente.
-- VRUTAL 1st · Migración 038 · Las 3 ocupaciones de Marketing que faltaban (54 tareas Core)
--
-- GENERADA, no escrita a mano:
--   node scripts/onet-tareas-a-sql.mjs --soc 11-2032.00,27-3031.00,41-3011.00
-- El generador se versiona a propósito. La importación original de 1.022 tareas se hizo
-- fuera del repositorio y no dejó ni script ni criterio: esto deja el camino abierto para el
-- siguiente departamento (Ventas, RRHH, IT) con solo cambiar `--soc`.
--
-- EL CRITERIO, descubierto por arqueología el 2026-10-16 y por fin explícito. El import
-- original tomó las tareas con `Task Type = 'Core'`, y en las ocupaciones sin ninguna Core,
-- todas. Verificado contra la base: **21 de 21 ocupaciones cuadran** con su recuento de Core.
-- La única aparente excepción, `13-2051.00` (26 en base, 0 Core), tiene sus 26 tareas con el
-- tipo vacío en el CSV — así que entraron todas, consistente con la regla.
--
-- Eso partió en dos lo que parecía un solo hueco de «87 tareas que faltan»:
--   · 54 Core de las 3 ocupaciones ausentes → el hueco de verdad, lo que hace esta migración
--   · 33 Supplemental (29 de las 4 ocupaciones ya presentes + 4 de estas 3 nuevas) → eso
--     sería un CAMBIO DE CRITERIO, no una reparación. Decidido con el founder el 2026-10-16:
--     **no entran**. Marketing sigue comparable con las otras 21 ocupaciones. Y `catalog.task`
--     no tiene columna `task_type`, así que mezclarlas haría la distinción irrecuperable
--     salvo volviendo al CSV.
--
-- Reparto (del informe del generador, `--informe`):
--   11-2032.00  Public Relations Managers       19 Core de 20  (1 Supplemental fuera)
--   27-3031.00  Public Relations Specialists    15 Core de 18  (3 Supplemental fuera)
--   41-3011.00  Advertising Sales Agents        20 Core de 20  (ninguna Supplemental)
--                                               --
--                                               54
--
-- Huellas md5 de los enunciados, calculadas en JS sobre el texto crudo del CSV. Sirven para
-- verificar la fidelidad por un camino INDEPENDIENTE del escapado (ver el bloque final):
--   11-2032.00  725f934f04e25b60567a793a0ab64a72
--   27-3031.00  d058c8a1b28276599d3ed6e13aa1645e
--   41-3011.00  06f966daabb6abf0446d0d4c806c157d
--
-- ESTADO ANTES DE APLICAR (verificado el 2026-10-16):
--   catalog.task 1.093 · catalog.occupation 21 · max(task_code) TSK-001300
--   source_code O*NET mal formados: 0 · todas las O*NET en language 'en' y version 1
--
-- DÓNDE ENCONTRARLAS DESPUÉS, que es lo que hace que esto sirva de algo: las 54 reciben
-- `task_code` consecutivos desde **TSK-001301**, porque el default de la columna es la
-- secuencia y salen contiguas en un solo insert. En el panel:
--   /tareas?todas=1&est=draft&q=TSK-0013
-- El chip por defecto es «Usadas por roles» y estas 54 no tienen rol, así que **no aparecen**
-- hasta pulsar «Todo el catálogo». Eso es deliberado: la vista por defecto no se ensucia.
--
-- NO se enlazan a ningún `job_role`. Esta migración es importación pura; enlazarlas es una
-- decisión de catálogo que se toma tarea a tarea desde el panel.
--
-- SE PIERDE, a conciencia: `Task Type`, `Incumbents Responding` y `Date` del CSV no tienen
-- columna en `catalog.task`. La trazabilidad es `source_code` (`<SOC>.<TaskID>`); recuperar
-- el tipo es un join contra el CSV.
-- =====================================================================

-- 1 · Las ocupaciones. `title_es` va NULL a propósito: las 21 existentes lo tienen
--     null (0 de 21), y traducir solo unas pocas sería una inconsistencia nueva.
insert into catalog.occupation (source, source_code, title_en, title_es, description)
select 'onet', v.soc, v.title, null, v.descripcion
from (values
  ('11-2032.00', 'Public Relations Managers', 'Plan, direct, or coordinate activities designed to create or maintain a favorable public image or raise issue awareness for their organization or client.'),
  ('27-3031.00', 'Public Relations Specialists', 'Promote or create an intended public image for individuals, groups, or organizations. May write or select material for release to various communications media. May specialize in using social media.'),
  ('41-3011.00', 'Advertising Sales Agents', 'Sell or solicit advertising space, time, or media in publications, signage, TV, radio, or Internet establishments or public spaces.')
) as v(soc, title, descripcion)
where not exists (
  select 1 from catalog.occupation o where o.source = 'onet' and o.source_code = v.soc);

-- 2 · Precondición: las ocupaciones existen antes de colgarles tareas.
do $$
declare n int;
begin
  select count(*) into n from catalog.occupation
   where source = 'onet' and source_code in ('11-2032.00', '27-3031.00', '41-3011.00');
  if n <> 3 then
    raise exception 'Ocupaciones O*NET esperadas: % de 3', n;
  end if;
end $$;

-- 3 · Las tareas. Se emiten TODAS las del criterio, no solo las que faltan: el
--     `not exists` deja fuera las ya presentes, así que el estado final es siempre
--     "las del criterio existen", sea cual sea el estado inicial. Reejecutar: 0 filas.
--
--     `task_code` NO va en la lista de columnas: lo pone el default de la tabla
--     (la secuencia). `process_id` y `primary_pattern` se quedan en null a
--     propósito: la clasificación se hace a mano desde el panel (pestaña Ficha).
insert into catalog.task (source, source_code, statement, language, occupation_id, status, version)
select 'onet', v.soc || '.' || v.task_id, v.enunciado, 'en', o.id, 'draft', 1
from (values
  ('11-2032.00', '21226', 'Assign, supervise, and review the activities of public relations staff.'),
  ('11-2032.00', '21227', 'Confer with labor relations managers to develop internal communications that keep employees informed of company activities.'),
  ('11-2032.00', '21228', 'Design and edit promotional publications, such as brochures.'),
  ('11-2032.00', '21229', 'Develop and maintain the company''s corporate image and identity, which includes the use of logos and signage.'),
  ('11-2032.00', '21230', 'Develop, implement, or maintain crisis communication plans.'),
  ('11-2032.00', '21231', 'Direct activities of external agencies, establishments, or departments that develop and implement communication strategies and information programs.'),
  ('11-2032.00', '21232', 'Draft speeches for company executives and arrange interviews and other forms of contact for them.'),
  ('11-2032.00', '21233', 'Establish and maintain effective working relationships with clients, government officials, and media representatives and use these relationships to develop new business opportunities.'),
  ('11-2032.00', '21234', 'Evaluate advertising and promotion programs for compatibility with public relations efforts.'),
  ('11-2032.00', '21235', 'Facilitate consumer relations or the relationship between parts of the company, such as the managers and employees, or different branch offices.'),
  ('11-2032.00', '21236', 'Formulate policies and procedures related to public information programs, working with public relations executives.'),
  ('11-2032.00', '21237', 'Identify main client groups and audiences, determine the best way to communicate publicity information to them, and develop and implement a communication plan.'),
  ('11-2032.00', '21239', 'Manage communications budgets.'),
  ('11-2032.00', '21240', 'Manage in-house communication courses.'),
  ('11-2032.00', '21241', 'Manage special events, such as sponsorship of races, parties introducing new products, or other activities the firm supports, to gain public attention through the media without advertising directly.'),
  ('11-2032.00', '21242', 'Observe and report on social, economic, and political trends that might affect employers.'),
  ('11-2032.00', '21243', 'Produce films and other video products, regulate their distribution, and operate film library.'),
  ('11-2032.00', '21244', 'Respond to requests for information about employers'' activities or status.'),
  ('11-2032.00', '21245', 'Write interesting and effective press releases, prepare information for media kits, and develop and maintain company internet or intranet web pages.'),
  ('27-3031.00', '1764', 'Respond to requests for information from the media or designate an appropriate spokesperson or information source.'),
  ('27-3031.00', '1765', 'Establish or maintain cooperative relationships with representatives of community, consumer, employee, or public interest groups.'),
  ('27-3031.00', '1767', 'Confer with production or support personnel to produce or coordinate production of advertisements or promotions.'),
  ('27-3031.00', '1768', 'Arrange public appearances, lectures, contests, or exhibits for clients to increase product or service awareness or to promote goodwill.'),
  ('27-3031.00', '1769', 'Study the objectives, promotional policies, or needs of organizations to develop public relations strategies that will influence public opinion or promote ideas, products, or services.'),
  ('27-3031.00', '1770', 'Confer with other managers to identify trends or key group interests or concerns or to provide advice on business decisions.'),
  ('27-3031.00', '1771', 'Consult with advertising agencies or staff to arrange promotional campaigns in all types of media for products, organizations, or individuals.'),
  ('27-3031.00', '1772', 'Coach client representatives in effective communication with the public or with employees.'),
  ('27-3031.00', '1773', 'Prepare or deliver speeches to further public relations objectives.'),
  ('27-3031.00', '1775', 'Plan or conduct market or public opinion research to test products or determine potential for product success, communicating results to client or management.'),
  ('27-3031.00', '19811', 'Develop plans or materials to communicate organizational activities that are beneficial to the environment, public safety, or other important social issues.'),
  ('27-3031.00', '20554', 'Write press releases or other media communications to promote clients.'),
  ('27-3031.00', '20555', 'Plan or direct development or communication of programs to maintain favorable public or stockholder perceptions of an organization''s accomplishments, agenda, or environmental responsibility.'),
  ('27-3031.00', '20557', 'Prepare or edit organizational publications, such as employee newsletters or stockholders'' reports, for internal or external audiences.'),
  ('27-3031.00', '23951', 'Post and update content on the company''s Web site and social media outlets.'),
  ('41-3011.00', '4579', 'Prepare and deliver sales presentations to new and existing customers to sell new advertising programs and to protect and increase existing advertising.'),
  ('41-3011.00', '4580', 'Explain to customers how specific types of advertising will help promote their products or services in the most effective way possible.'),
  ('41-3011.00', '4581', 'Maintain assigned account bases while developing new accounts.'),
  ('41-3011.00', '4582', 'Process all correspondence and paperwork related to accounts.'),
  ('41-3011.00', '4583', 'Deliver advertising or illustration proofs to customers for approval.'),
  ('41-3011.00', '4584', 'Draw up contracts for advertising work, and collect payments due.'),
  ('41-3011.00', '4585', 'Locate and contact potential clients to offer advertising services.'),
  ('41-3011.00', '4586', 'Provide clients with estimates of the costs of advertising products or services.'),
  ('41-3011.00', '4587', 'Recommend appropriate sizes and formats for advertising, depending on medium used.'),
  ('41-3011.00', '4588', 'Inform customers of available options for advertisement artwork, and provide samples.'),
  ('41-3011.00', '4589', 'Obtain and study information about clients'' products, needs, problems, advertising history, and business practices to offer effective sales presentations and appropriate product assistance.'),
  ('41-3011.00', '4590', 'Determine advertising medium to be used, and prepare sample advertisements within the selected medium for presentation to customers.'),
  ('41-3011.00', '4591', 'Consult with company officials, sales departments, and advertising agencies to develop promotional plans.'),
  ('41-3011.00', '4592', 'Prepare promotional plans, sales literature, media kits, and sales contracts, using computer.'),
  ('41-3011.00', '4593', 'Identify new advertising markets, and propose products to serve them.'),
  ('41-3011.00', '4594', 'Write copy as part of layout.'),
  ('41-3011.00', '4595', 'Attend sales meetings, industry trade shows, and training seminars to gather information, promote products, expand network of contacts, and increase knowledge.'),
  ('41-3011.00', '4596', 'Gather all relevant material for bid processes, and coordinate bidding and contract approval.'),
  ('41-3011.00', '4597', 'Arrange for commercial taping sessions, and accompany clients to sessions.'),
  ('41-3011.00', '4598', 'Write sales outlines for use by staff.')
) as v(soc, task_id, enunciado)
join catalog.occupation o on o.source = 'onet' and o.source_code = v.soc
where not exists (
  select 1 from catalog.task t
   where t.source = 'onet' and t.source_code = v.soc || '.' || v.task_id);

-- 4 · Asertos. Esta es la seguridad real, no el escapado: cualquier fallo silencioso
--     (doble inserción, tareas descartadas por el join, source_code mal formado)
--     se convierte en rollback en vez de en un dato raro que nadie ve.
--     Los `raise notice` NO se ven por apply_migration: todo va como exception.
do $$
declare n_total int; n_sin_occ int; n_idioma int;
begin
  select count(*) into n_total from catalog.task
   where source = 'onet' and left(source_code, 10) in ('11-2032.00', '27-3031.00', '41-3011.00');
  if n_total <> 54 then
    raise exception 'Tareas de estos SOC: % (esperadas 54)', n_total;
  end if;

  select count(*) into n_sin_occ from catalog.task
   where source = 'onet' and left(source_code, 10) in ('11-2032.00', '27-3031.00', '41-3011.00') and occupation_id is null;
  if n_sin_occ <> 0 then raise exception '% tareas sin occupation_id', n_sin_occ; end if;

  select count(*) into n_idioma from catalog.task
   where source = 'onet' and left(source_code, 10) in ('11-2032.00', '27-3031.00', '41-3011.00') and language <> 'en';
  if n_idioma <> 0 then raise exception '% tareas con language distinto de en', n_idioma; end if;
end $$;

-- ---------------------------------------------------------------------
-- Verificación de fidelidad, por un camino distinto al del escapado.
-- Compara con las huellas md5 de la cabecera. `collate "C"` NO es opcional: el orden ICU
-- puede ignorar los puntos y guiones, y entonces el md5 de SQL y el de JS divergen sin que
-- nada esté mal.
--
--   select left(source_code,10) as soc, count(*),
--          md5(string_agg(statement, chr(10) order by source_code collate "C")) as huella
--     from catalog.task
--    where source='onet' and left(source_code,10) in ('11-2032.00','27-3031.00','41-3011.00')
--    group by 1 order by 1;
--
-- Para revertir (solo tiene sentido si no se ha clasificado ninguna a mano):
--   delete from catalog.task
--    where source='onet' and left(source_code,10) in ('11-2032.00','27-3031.00','41-3011.00');
--   delete from catalog.occupation
--    where source='onet' and source_code in ('11-2032.00','27-3031.00','41-3011.00');
--   (en ese orden, por la clave foránea. Y comprobando antes que ninguna cuelga de un
--    job_role_task ni la referencia una approval_requests de algún cliente)
-- ---------------------------------------------------------------------
