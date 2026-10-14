-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 018 · Departamento de Marketing
--
-- Primer departamento que llevamos de extremo a extremo con Vrutal-labs como cliente 0
-- (LAB08 Anexo B). Crea el dominio y sus procesos, en el orden en que fluye el trabajo.
-- Los roles y sus tareas se curan después desde el panel (Construcción · paso 1 y 2).
-- Ids con prefijo mkt_ porque catalog.process.id es único entre departamentos.
-- =====================================================================

insert into catalog.domain(id, name, description)
values ('MARKETING', 'Marketing', 'Investigación, contenido, distribución y medición.')
on conflict (id) do nothing;

insert into catalog.process(id, domain_id, name, sequence_ord, description) values
  ('mkt_investigacion', 'MARKETING', 'Investigación', 1, 'Mercado, competencia, audiencia y palabras clave.'),
  ('mkt_planificacion', 'MARKETING', 'Planificación', 2, 'Calendario, briefs y prioridades.'),
  ('mkt_contenido', 'MARKETING', 'Creación de contenido', 3, 'Textos, piezas y adaptaciones por canal.'),
  ('mkt_distribucion', 'MARKETING', 'Distribución', 4, 'Publicar y programar en cada canal.'),
  ('mkt_medicion', 'MARKETING', 'Medición', 5, 'Recoger métricas y montar informes.'),
  ('mkt_optimizacion', 'MARKETING', 'Optimización', 6, 'Proponer cambios a partir de lo medido.')
on conflict (id) do nothing;
