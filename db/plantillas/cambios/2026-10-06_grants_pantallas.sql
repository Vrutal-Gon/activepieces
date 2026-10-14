-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Permisos de tabla que faltaban
--
-- Hallazgo (2026-10-06): varias tablas tienen su política de RLS pero NO el permiso de tabla (GRANT) para
-- el rol authenticated. Sin GRANT, la política ni se evalúa: la consulta falla con «permission denied».
--
-- REGLA (decidida 2026-10-06): el catálogo de Vrutal (catalog_flow_ro, catalog_report_ro, catalog_kpi_ro:
-- tareas, descripciones, KPIs) es PROPIEDAD DE VRUTAL. Ningún usuario del cliente puede leerlo, ni por
-- pantalla ni por API: con una sola sesión se podría volcar el listado entero. Por eso aquí NO se concede
-- nada sobre esas tablas, y la política read_all_authenticated que traen no tiene efecto sin GRANT.
-- (Siguen existiendo en la base del cliente por las claves foráneas de approval_requests y run_log, y las
-- lee la sincronización y service_role.) Lo que el cliente ve de su especialista es lo que PRODUCE, no cómo
-- está definido.
--
-- Este script concede SOLO:
--   · user_specialist_access: el Admin lo gestiona (admin_manage) y cada persona lee lo suyo (self_select).
--     No se concede UPDATE: se añade o se quita la fila.
--   · service_role: acceso a todas las tablas, como decía la plantilla (Edge Functions y flujos). Salta RLS,
--     por eso nunca va en el navegador.
--
-- Resto de tablas sin permiso (client_ticket, report_output, user_kpi_selection, user_report_subscription,
-- knowledge_update_request, approval_delegation): se conceden al construir su pantalla, con su revisión.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

grant select, insert, delete on public.user_specialist_access to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Comprobación de la regla del catálogo: las tres deben dar false.
--   select has_table_privilege('authenticated', 'public.catalog_flow_ro', 'select'),
--          has_table_privilege('authenticated', 'public.catalog_report_ro', 'select'),
--          has_table_privilege('authenticated', 'public.catalog_kpi_ro', 'select');

-- ---------------------------------------------------------------------
-- Para revertir:
--   revoke select, insert, delete on public.user_specialist_access from authenticated;
-- ---------------------------------------------------------------------
