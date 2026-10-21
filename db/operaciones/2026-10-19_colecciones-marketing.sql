-- =====================================================================
-- PEGAR EN EL SQL EDITOR DE VrutalOS (Vrutal-labs, rgauumxztblwurzebmsa)
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju).
--
-- Las pestañas («colecciones») de los tres especialistas de Marketing: lo que cada uno
-- ENTREGA y cómo se dibuja en la pantalla «Su trabajo». Sustituyen a las pestañas de salida
-- de la hoja de Google (Keywords, Briefs, Métricas, Diagnóstico, Informes).
--
-- Las columnas son los campos del contrato del catálogo más `fecha`, que es lo que ya
-- escriben hoy los bloques «Ordena» de cada flujo. Si un contrato cambia, esta tabla cambia
-- con él: son el mismo dato visto desde los dos lados.
--
-- `approvable`:
--   true  → las filas nacen `proposed` y alguien del cliente las aprueba o rechaza. Se usa
--           donde una fila mala tendría coste si siguiera adelante (keywords que guían el
--           trabajo de meses; briefs que se convierten en contenido público).
--   false → las filas nacen `delivered`. Es una entrega informativa: una foto de métricas o
--           un informe no se «aprueban», se leen.
--
-- Quién las escribe: los flujos, con service_role, vía work_items_add(). Nadie del cliente
-- escribe filas ni columnas. Las colecciones las pone Vrutal al aprovisionar — por ahora a
-- mano con este script; más adelante, sincronizadas desde Vrutal1st como el resto del
-- catálogo.
--
-- No es específico de Vrutal-labs: resuelve el especialista por `job_role_key`, así que vale
-- tal cual para cualquier cliente que contrate estos tres roles.
--
-- Idempotente: `on conflict (specialist_id, collection_key) do nothing`.
-- =====================================================================

insert into public.work_collection (specialist_id, collection_key, label, position, approvable, columns)
select s.id, c.collection_key, c.label, c.position, c.approvable, c.columns
  from (values
    -- ── Especialista SEO/SEM ────────────────────────────────────────────────────────────
    ('search_marketing', 'keywords', 'Keywords', 1, true, '[
      {"key": "fecha",          "label": "Fecha",      "type": "date"},
      {"key": "keyword",        "label": "Keyword",    "type": "text"},
      {"key": "icp_pain",       "label": "Dolor del ICP", "type": "text"},
      {"key": "intent",         "label": "Intención",  "type": "badge"},
      {"key": "monthly_volume", "label": "Volumen",    "type": "number"},
      {"key": "difficulty",     "label": "Dificultad", "type": "number"},
      {"key": "owner",          "label": "Canal",      "type": "badge"},
      {"key": "idioma",         "label": "Idioma",     "type": "badge"}
    ]'::jsonb),

    -- ── Especialista de Contenido y Promoción ───────────────────────────────────────────
    ('content_promotion', 'briefs', 'Briefs', 1, true, '[
      {"key": "fecha",          "label": "Fecha",      "type": "date"},
      {"key": "brief_id",       "label": "Brief",      "type": "text"},
      {"key": "objective",      "label": "Objetivo",   "type": "text"},
      {"key": "audience",       "label": "Público",    "type": "text"},
      {"key": "key_message",    "label": "Mensaje",    "type": "text"},
      {"key": "evidence",       "label": "Prueba",     "type": "text"},
      {"key": "cta",            "label": "CTA",        "type": "text"},
      {"key": "target_keyword", "label": "Keyword",    "type": "text"},
      {"key": "channel",        "label": "Canal",      "type": "badge"},
      {"key": "link_url",       "label": "Enlace",     "type": "url"}
    ]'::jsonb),

    -- ── Analista de Mercado ─────────────────────────────────────────────────────────────
    ('marketing_analyst', 'metricas', 'Métricas', 1, false, '[
      {"key": "fecha",        "label": "Fecha",     "type": "date"},
      {"key": "period_start", "label": "Desde",     "type": "date"},
      {"key": "period_end",   "label": "Hasta",     "type": "date"},
      {"key": "channel",      "label": "Canal",     "type": "badge"},
      {"key": "metric",       "label": "Métrica",   "type": "text"},
      {"key": "value",        "label": "Valor",     "type": "number"},
      {"key": "source",       "label": "Fuente",    "type": "text"}
    ]'::jsonb),
    ('marketing_analyst', 'diagnostico', 'Diagnóstico', 2, false, '[
      {"key": "fecha",        "label": "Fecha",     "type": "date"},
      {"key": "period_start", "label": "Desde",     "type": "date"},
      {"key": "channel",      "label": "Canal",     "type": "badge"},
      {"key": "metric",       "label": "Métrica",   "type": "text"},
      {"key": "value",        "label": "Valor",     "type": "number"},
      {"key": "target",       "label": "Objetivo",  "type": "text"},
      {"key": "status",       "label": "Resultado", "type": "badge"},
      {"key": "note",         "label": "Nota",      "type": "text"}
    ]'::jsonb),
    ('marketing_analyst', 'informes', 'Informes', 3, false, '[
      {"key": "fecha",        "label": "Fecha",       "type": "date"},
      {"key": "period_start", "label": "Semana",      "type": "date"},
      {"key": "rank",         "label": "Orden",       "type": "number"},
      {"key": "channel",      "label": "Canal",       "type": "badge"},
      {"key": "conclusion",   "label": "Conclusión",  "type": "text"},
      {"key": "action",       "label": "Qué hacer",   "type": "text"}
    ]'::jsonb)
  ) as c(job_role_key, collection_key, label, position, approvable, columns)
  join public.specialists s on s.job_role_key = c.job_role_key
on conflict (specialist_id, collection_key) do nothing;

-- Comprobación: 5 colecciones, 3 especialistas, 2 aprobables.
-- select s.job_role_key, c.collection_key, c.approvable, jsonb_array_length(c.columns) as columnas
--   from public.work_collection c join public.specialists s on s.id = c.specialist_id
--  order by s.job_role_key, c.position;

-- ---------------------------------------------------------------------
-- Para revertir (borra también las filas entregadas en esas pestañas):
--   delete from public.work_collection
--    where collection_key in ('keywords', 'briefs', 'metricas', 'diagnostico', 'informes');
-- ---------------------------------------------------------------------
