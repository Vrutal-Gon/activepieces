-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · usage_summary()
--
-- La pantalla Consumo (solo Admin) necesita el consumo agregado por especialista en un periodo.
-- run_log puede tener miles de filas: se agrega en la base, no en el navegador.
-- (PostgREST no agrega por defecto en Supabase, así que hace falta una función.)
--
-- Solo lectura. Un Admin activo ve las cifras; cualquier otra persona recibe 0 filas.
-- Reversible: drop function public.usage_summary(timestamptz, timestamptz);
-- Aplicar en cada proyecto de cliente (ver README de esta carpeta).
-- =====================================================================

create or replace function public.usage_summary(p_from timestamptz, p_to timestamptz)
returns table (
  specialist_id uuid,
  runs bigint,
  tokens_in bigint,
  tokens_out bigint,
  cost_usd numeric
)
language sql stable security definer set search_path = public, pg_temp as $f$
  select r.specialist_id,
         count(*),
         coalesce(sum(r.tokens_in), 0)::bigint,
         coalesce(sum(r.tokens_out), 0)::bigint,
         coalesce(sum(r.cost_usd), 0)
  from public.run_log r
  where public.is_admin()
    and r.created_at >= p_from
    and r.created_at < p_to
  group by r.specialist_id
$f$;

revoke all on function public.usage_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.usage_summary(timestamptz, timestamptz) to authenticated, service_role;
