-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 022 · Redes sociales (Postiz) en Integraciones
--
-- El Admin del cliente conecta las redes sociales desde VrutalOS (Postiz detrás,
-- nunca visible). El cliente empuja el estado hacia aquí — Vrutal1st no guarda
-- ninguna credencial de los proyectos de los clientes (decisión 2026-10-08).
--
-- - category gana 'social'; status gana 'paused' (espejo de integrations.status
--   en el proyecto del cliente: active/paused/revoked -> connected/paused/revoked).
-- - tenant_instance.push_token: secreto compartido por instancia para firmar el aviso.
--   Se genera una vez (staff_rotate_tenant_push_token), se copia a los secretos de la
--   Edge Function del cliente (VRUTAL1ST_PUSH_TOKEN) y no se vuelve a enseñar.
-- - social_integration_report(): único camino de escritura, valida el token él mismo.
--   Lo llama tenant-integration-status (Edge Function, service_role) con el token que
--   envía la instancia del cliente — nunca con la sesión de un usuario de Vrutal1st.
-- =====================================================================

alter table deployment.tenant_integration drop constraint if exists tenant_integration_category_check;
alter table deployment.tenant_integration add constraint tenant_integration_category_check
  check (category in ('crm','erp','ecommerce','ads','email','helpdesk','analytics','social','other'));

alter table deployment.tenant_integration drop constraint if exists tenant_integration_status_check;
alter table deployment.tenant_integration add constraint tenant_integration_status_check
  check (status in ('connected','paused','error','revoked'));

alter table public.tenant_instance add column if not exists push_token text;

comment on column public.tenant_instance.push_token is
  'Secreto compartido para que la instancia del cliente avise del estado de sus integraciones '
  '(hoy: redes sociales). No es una credencial de un sistema externo: es solo para esta llamada.';

-- Genera (o rota) el token. Lo devuelve una vez; quien lo llama debe copiarlo a la
-- Edge Function del cliente antes de que se pierda — igual que cualquier secreto real.
create or replace function public.staff_rotate_tenant_push_token(p_tenant_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_token text;
begin
  if not staff_can_access_tenant(p_tenant_id) or not has_permission('tenants.write', p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.tenant_instance (tenant_id, push_token, updated_at, updated_by)
  values (p_tenant_id, v_token, now(), auth.uid())
  on conflict (tenant_id) do update set
    push_token = excluded.push_token, updated_at = now(), updated_by = auth.uid();

  return v_token;
end $$;

-- Único camino de escritura para el estado de una integración social del cliente.
-- Valida el token él mismo: quien llama (la Edge Function) no necesita saber cómo.
create or replace function public.social_integration_report(
  p_tenant_id uuid, p_token text, p_system text, p_status text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ok boolean;
begin
  select (i.push_token is not null and i.push_token = p_token) into v_ok
  from public.tenant_instance i where i.tenant_id = p_tenant_id;

  if coalesce(v_ok, false) is not true then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_system), '') = '' or p_status not in ('connected', 'paused', 'revoked') then
    raise exception 'Datos de integración no válidos' using errcode = '22023';
  end if;

  insert into deployment.tenant_integration (tenant_id, system, category, status, connected_at)
  values (p_tenant_id, p_system, 'social', p_status, now())
  on conflict (tenant_id, system) do update set
    status = excluded.status,
    connected_at = case when deployment.tenant_integration.status = 'revoked' and excluded.status != 'revoked'
                        then now() else deployment.tenant_integration.connected_at end,
    deleted_at = null;
end $$;

revoke execute on function public.staff_rotate_tenant_push_token(uuid) from public, anon, authenticated;
grant execute on function public.staff_rotate_tenant_push_token(uuid) to authenticated;
revoke execute on function public.social_integration_report(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.social_integration_report(uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.social_integration_report(uuid, text, text, text);
--   drop function public.staff_rotate_tenant_push_token(uuid);
--   alter table public.tenant_instance drop column push_token;
--   alter table deployment.tenant_integration drop constraint tenant_integration_status_check;
--   alter table deployment.tenant_integration add constraint tenant_integration_status_check
--     check (status in ('connected','error','revoked'));
--   alter table deployment.tenant_integration drop constraint tenant_integration_category_check;
--   alter table deployment.tenant_integration add constraint tenant_integration_category_check
--     check (category in ('crm','erp','ecommerce','ads','email','helpdesk','analytics','other'));
-- ---------------------------------------------------------------------
