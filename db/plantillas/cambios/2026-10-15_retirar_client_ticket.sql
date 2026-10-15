-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Retirar la tabla `client_ticket`
--
-- `client_ticket` es un resto. El 2026-10-08 se decidió (D-20) que un ticket de soporte es
-- una conversación con Vrutal sobre el servicio, no un dato de negocio del cliente, así que
-- **no vive en esta base**: vive centralizado en Vrutal1st (`public.support_ticket` /
-- `support_ticket_message`, migración 023). El README de esta carpeta ya lo dejó escrito:
-- «superado, no se crea `client_ticket` en ningún proyecto de cliente».
--
-- Pero en Vrutal-labs la tabla **seguía creada**, con RLS y dos políticas, de antes de esa
-- decisión. Encontrada el 2026-10-15 al inventariar las tablas: 23 en `public`, cuando la
-- documentación hablaba de 20. Está VACÍA (0 filas, comprobado el mismo día).
--
-- Por qué retirarla y no dejarla ahí: una tabla vacía no molesta a nadie hoy, pero miente
-- mañana. Quien herede esto verá `client_ticket` en la base del cliente y supondrá que los
-- tickets viven ahí, que es justo lo contrario de lo decidido. Y si no se retira, la
-- regeneración de `vrutal_client_project_template.sql` (pendiente) la copiaría a la
-- plantilla y nacería en cada cliente nuevo.
--
-- La guarda de abajo es a propósito: si la tabla tuviera filas en algún proyecto, esta
-- migración **falla en vez de borrar**. Vaciarla o migrar esas filas es una decisión que no
-- toma un script.
--
-- Aplicar en cada proyecto de cliente. Reversible solo en forma, no en datos: ver el bloque
-- final.
-- =====================================================================

do $$
declare
  n bigint;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'client_ticket'
  ) then
    raise notice 'client_ticket no existe en esta base: nada que hacer.';
    return;
  end if;

  execute 'select count(*) from public.client_ticket' into n;

  if n > 0 then
    raise exception
      'client_ticket tiene % filas en esta base. NO se borra. Decide primero que se hace con '
      'ellas (los tickets viven en Vrutal1st, support_ticket, desde D-20) y luego retira esta '
      'tabla a mano.', n;
  end if;

  drop table public.client_ticket;
  raise notice 'client_ticket retirada (estaba vacia).';
end $$;

-- ---------------------------------------------------------------------
-- Para revertir:
--   No se repone. La tabla estaba vacía y su función la cumple Vrutal1st
--   (`support_ticket` / `support_ticket_message`, migración 023), al que esta instancia
--   llega por las Edge Functions `support-ticket-send` / `support-ticket-list` con el
--   `push_token` de la instancia. Si alguna vez hiciera falta una tabla de tickets en la
--   base del cliente, sería una decisión nueva que revierte D-20, no un rollback de esto:
--   habría que escribirla con su RLS, sus GRANT y su razón.
-- ---------------------------------------------------------------------
