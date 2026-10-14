-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 023 · Tickets de soporte (centralizados en Vrutal1st)
--
-- El Admin del cliente reporta un ticket desde VrutalOS y sigue su estado; el staff
-- lo gestiona desde Vrutal1st. Decidido con el usuario (2026-10-08): el dato NO vive
-- en la base del cliente (`client_ticket`, nombre reservado y ya descartado — ver
-- VrutalOS/app/src/lib/sections.ts, Panel-Vrutal1st/src/App.tsx, ClientPanel.tsx y
-- db/plantillas/cambios/README.md, pendientes de corregir en esta misma sesión).
-- Razón: un ticket es una conversación con Vrutal sobre el servicio, no un dato de
-- negocio del cliente — no aplica el aislamiento por instancia de CRM/estrategia/
-- contenido. Vive en `public`, junto a `tenant_instance`, no en `deployment.*`
-- (ese schema modela la ejecución de especialistas IA, un concepto distinto).
--
-- Se construye nativo, no con una herramienta externa (osTicket descartado: su API
-- solo crea, no lee estado; Zammad/FreeScout descartados por ahora: infraestructura
-- nueva que el volumen actual no justifica — FreeScout queda anotado para revisar
-- cuando escale el número de clientes).
--
-- Dos caminos de escritura/lectura, ambos ya usados en el proyecto:
--   - staff_*: sesión de Vrutal1st, guardián staff_can_access_tenant (009) y el mismo
--     permiso has_permission('tenants.write', tenant_id) que ya usan staff_upsert_
--     tenant_instance/staff_set_onboarding_step (019/021) — no se inventa un permiso
--     'tickets.write' nuevo.
--   - ticket_*: server-to-server desde la instancia del cliente, autenticadas con
--     tenant_instance.push_token (022) — el mismo secreto que ya existe para avisar
--     del estado de integraciones sociales, ahora reusado como canal autenticado
--     instancia↔Vrutal1st en ambas direcciones (antes solo era un aviso de estado).
-- =====================================================================

create table public.support_ticket (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  subject           text not null,
  status            text not null default 'open'
                    check (status in ('open','in_progress','resolved','closed')),
  priority          text not null default 'normal'
                    check (priority in ('low','normal','high','urgent')),
  created_by_label  text not null,   -- email del Admin cliente: solo un snapshot, Vrutal1st no tiene su profile
  assigned_to       uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  closed_at         timestamptz
);

create table public.support_ticket_message (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid not null references public.support_ticket(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,  -- denormalizado: evita el join para el guardián
  author_kind       text not null check (author_kind in ('client_admin','staff')),
  author_profile_id uuid references public.profiles(id),   -- solo si author_kind = 'staff'
  author_label      text not null,   -- email (client_admin) o nombre del staff; sin JOIN cross-instancia
  body              text not null,
  created_at        timestamptz not null default now(),
  constraint support_ticket_message_author_check check (
    (author_kind = 'staff' and author_profile_id is not null) or
    (author_kind = 'client_admin' and author_profile_id is null))
);

create index support_ticket_tenant_idx on public.support_ticket (tenant_id, created_at desc);
create index support_ticket_open_idx on public.support_ticket (status) where status in ('open', 'in_progress');
create index support_ticket_message_idx on public.support_ticket_message (ticket_id, created_at);

-- RLS sin política: bloqueo total por PostgREST, igual que tenant_instance/tenant_onboarding_step (019).
-- Todo pasa por funciones security definer.
alter table public.support_ticket enable row level security;
alter table public.support_ticket_message enable row level security;

-- ---------------------------------------------------------------------
-- Funciones staff (sesión de Vrutal1st)
-- ---------------------------------------------------------------------

create or replace function public.staff_list_tickets(p_tenant_id uuid default null, p_status text default null)
returns table(id uuid, tenant_id uuid, tenant_name text, subject text, status text, priority text,
              created_by_label text, assigned_to uuid, assigned_to_name text,
              created_at timestamptz, updated_at timestamptz, closed_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_sees_all boolean := has_platform_role(array['platform_superadmin', 'platform_admin']);
begin
  if p_tenant_id is not null then
    if not staff_can_access_tenant(p_tenant_id) then
      raise exception 'unauthorized' using errcode = '42501';
    end if;
  elsif not v_sees_all and not has_platform_role(array['platform_ops']) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select s.id, s.tenant_id, t.name, s.subject, s.status, s.priority, s.created_by_label,
         s.assigned_to, coalesce(p.full_name, u.email::text),
         s.created_at, s.updated_at, s.closed_at
  from public.support_ticket s
  join public.tenants t on t.id = s.tenant_id and t.deleted_at is null
  left join public.profiles p on p.id = s.assigned_to
  left join auth.users u on u.id = s.assigned_to
  where (p_tenant_id is null or s.tenant_id = p_tenant_id)
    and (p_status is null or s.status = p_status)
    and (p_tenant_id is not null or v_sees_all or t.account_manager_profile_id = auth.uid())
  order by s.created_at desc;
end $$;

create or replace function public.staff_get_ticket(p_ticket_id uuid)
returns table(id uuid, tenant_id uuid, tenant_name text, subject text, status text, priority text,
              created_by_label text, assigned_to uuid, created_at timestamptz, updated_at timestamptz,
              closed_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  select s.tenant_id into v_tenant from public.support_ticket s where s.id = p_ticket_id;
  if v_tenant is null or not staff_can_access_tenant(v_tenant) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select s.id, s.tenant_id, t.name, s.subject, s.status, s.priority, s.created_by_label,
         s.assigned_to, s.created_at, s.updated_at, s.closed_at
  from public.support_ticket s
  join public.tenants t on t.id = s.tenant_id
  where s.id = p_ticket_id;
end $$;

create or replace function public.staff_list_ticket_messages(p_ticket_id uuid)
returns table(id uuid, author_kind text, author_label text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  select s.tenant_id into v_tenant from public.support_ticket s where s.id = p_ticket_id;
  if v_tenant is null or not staff_can_access_tenant(v_tenant) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select m.id, m.author_kind, m.author_label, m.body, m.created_at
  from public.support_ticket_message m
  where m.ticket_id = p_ticket_id
  order by m.created_at;
end $$;

create or replace function public.staff_reply_ticket(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid; v_id uuid; v_label text;
begin
  select s.tenant_id into v_tenant from public.support_ticket s where s.id = p_ticket_id for update;
  if v_tenant is null or not staff_can_access_tenant(v_tenant) or not has_permission('tenants.write', v_tenant) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_body), '') = '' then
    raise exception 'La respuesta no puede estar vacía' using errcode = '22023';
  end if;

  select coalesce(full_name, '') into v_label from public.profiles where id = auth.uid();
  if coalesce(v_label, '') = '' then
    select email::text into v_label from auth.users where id = auth.uid();
  end if;

  insert into public.support_ticket_message (ticket_id, tenant_id, author_kind, author_profile_id, author_label, body)
  values (p_ticket_id, v_tenant, 'staff', auth.uid(), v_label, trim(p_body))
  returning id into v_id;

  update public.support_ticket
     set status = case when status = 'open' then 'in_progress' else status end, updated_at = now()
   where id = p_ticket_id;

  return v_id;
end $$;

create or replace function public.staff_set_ticket_status(p_ticket_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_tenant uuid;
begin
  if p_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'Estado no válido' using errcode = '22023';
  end if;
  select s.tenant_id into v_tenant from public.support_ticket s where s.id = p_ticket_id for update;
  if v_tenant is null or not staff_can_access_tenant(v_tenant) or not has_permission('tenants.write', v_tenant) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  update public.support_ticket
     set status = p_status, updated_at = now(),
         closed_at = case when p_status in ('resolved', 'closed') then now() else null end
   where id = p_ticket_id;
end $$;

-- ---------------------------------------------------------------------
-- Canal autenticado instancia→Vrutal1st (service_role, valida el token él mismo)
-- ---------------------------------------------------------------------

create or replace function public._tenant_token_ok(p_tenant_id uuid, p_token text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.tenant_instance i
    where i.tenant_id = p_tenant_id and i.push_token is not null and i.push_token = p_token);
$$;

create or replace function public.ticket_create(
  p_tenant_id uuid, p_token text, p_subject text, p_body text, p_priority text, p_author_label text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not public._tenant_token_ok(p_tenant_id, p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_subject), '') = '' or coalesce(trim(p_body), '') = '' or coalesce(trim(p_author_label), '') = '' then
    raise exception 'Faltan datos del ticket' using errcode = '22023';
  end if;

  insert into public.support_ticket (tenant_id, subject, priority, created_by_label)
  values (p_tenant_id, trim(p_subject), coalesce(nullif(trim(p_priority), ''), 'normal'), trim(p_author_label))
  returning id into v_id;

  insert into public.support_ticket_message (ticket_id, tenant_id, author_kind, author_label, body)
  values (v_id, p_tenant_id, 'client_admin', trim(p_author_label), trim(p_body));

  return v_id;
end $$;

create or replace function public.ticket_add_message(
  p_tenant_id uuid, p_token text, p_ticket_id uuid, p_author_label text, p_body text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid;
begin
  if not public._tenant_token_ok(p_tenant_id, p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select tenant_id into v_owner from public.support_ticket where id = p_ticket_id for update;
  if v_owner is null or v_owner != p_tenant_id then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_body), '') = '' or coalesce(trim(p_author_label), '') = '' then
    raise exception 'Faltan datos del mensaje' using errcode = '22023';
  end if;

  insert into public.support_ticket_message (ticket_id, tenant_id, author_kind, author_label, body)
  values (p_ticket_id, p_tenant_id, 'client_admin', trim(p_author_label), trim(p_body));

  update public.support_ticket
     set status = case when status in ('resolved', 'closed') then 'in_progress' else status end,
         updated_at = now()
   where id = p_ticket_id;
end $$;

create or replace function public.ticket_list(
  p_tenant_id uuid, p_token text, p_status text default null, p_limit int default 50, p_before timestamptz default null)
returns table(id uuid, subject text, status text, priority text, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public._tenant_token_ok(p_tenant_id, p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select s.id, s.subject, s.status, s.priority, s.created_at, s.updated_at
  from public.support_ticket s
  where s.tenant_id = p_tenant_id
    and (p_status is null or s.status = p_status)
    and (p_before is null or s.created_at < p_before)
  order by s.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end $$;

create or replace function public.ticket_get_messages(p_tenant_id uuid, p_token text, p_ticket_id uuid)
returns table(id uuid, author_kind text, author_label text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_owner uuid;
begin
  if not public._tenant_token_ok(p_tenant_id, p_token) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select tenant_id into v_owner from public.support_ticket where id = p_ticket_id;
  if v_owner is null or v_owner != p_tenant_id then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select m.id, m.author_kind, m.author_label, m.body, m.created_at
  from public.support_ticket_message m
  where m.ticket_id = p_ticket_id
  order by m.created_at;
end $$;

-- ---------------------------------------------------------------------
revoke execute on function public.staff_list_tickets(uuid, text) from public, anon, authenticated;
revoke execute on function public.staff_get_ticket(uuid) from public, anon, authenticated;
revoke execute on function public.staff_list_ticket_messages(uuid) from public, anon, authenticated;
revoke execute on function public.staff_reply_ticket(uuid, text) from public, anon, authenticated;
revoke execute on function public.staff_set_ticket_status(uuid, text) from public, anon, authenticated;
grant execute on function public.staff_list_tickets(uuid, text) to authenticated;
grant execute on function public.staff_get_ticket(uuid) to authenticated;
grant execute on function public.staff_list_ticket_messages(uuid) to authenticated;
grant execute on function public.staff_reply_ticket(uuid, text) to authenticated;
grant execute on function public.staff_set_ticket_status(uuid, text) to authenticated;

-- _tenant_token_ok es un helper interno: nadie lo llama directamente (igual que _onboarding_steps en 019).
revoke execute on function public._tenant_token_ok(uuid, text) from public, anon, authenticated;
revoke execute on function public.ticket_create(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.ticket_add_message(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.ticket_list(uuid, text, text, int, timestamptz) from public, anon, authenticated;
revoke execute on function public.ticket_get_messages(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.ticket_create(uuid, text, text, text, text, text) to service_role;
grant execute on function public.ticket_add_message(uuid, text, uuid, text, text) to service_role;
grant execute on function public.ticket_list(uuid, text, text, int, timestamptz) to service_role;
grant execute on function public.ticket_get_messages(uuid, text, uuid) to service_role;

comment on column public.tenant_instance.push_token is
  'Secreto compartido por instancia, canal autenticado instancia→Vrutal1st: aviso de '
  'estado de integraciones sociales (022) y tickets de soporte (023, crear/listar/responder).';

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop function public.ticket_get_messages(uuid, text, uuid);
--   drop function public.ticket_list(uuid, text, text, int, timestamptz);
--   drop function public.ticket_add_message(uuid, text, uuid, text, text);
--   drop function public.ticket_create(uuid, text, text, text, text, text);
--   drop function public._tenant_token_ok(uuid, text);
--   drop function public.staff_set_ticket_status(uuid, text);
--   drop function public.staff_reply_ticket(uuid, text);
--   drop function public.staff_list_ticket_messages(uuid);
--   drop function public.staff_get_ticket(uuid);
--   drop function public.staff_list_tickets(uuid, text);
--   drop table public.support_ticket_message;
--   drop table public.support_ticket;
-- ---------------------------------------------------------------------
