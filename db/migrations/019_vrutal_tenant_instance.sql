-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 019 · Instancia del cliente y checklist de alta
--
-- Un cliente = una instancia Docker (LAB08 Anexo B). Vrutal1st registra qué instancia
-- tiene cada cliente y en qué punto está su alta, en el orden fijo de LAB12 cap. 3 bis.
-- Sin secretos: aquí no se guarda ni una clave; los secretos viven en la instancia.
--
-- - tenant_instance: host, URL, versiones. Una por cliente.
-- - tenant_onboarding_step: 7 pasos. Ninguno se marca sin evidencia ni sin el anterior;
--   ninguno se reabre si el siguiente ya está hecho.
-- Lectura: staff_can_access_tenant. Escritura: además, permiso 'tenants.write'.
-- =====================================================================

create table if not exists public.tenant_instance (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  host text,
  public_url text,
  template_version text,
  ap_version text,
  app_version text,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.tenant_onboarding_step (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  step_key text not null check (step_key in
    ('machine', 'fleet_template', 'secrets', 'database', 'monitoring', 'backups', 'vps_entry')),
  done_at timestamptz,
  done_by uuid references public.profiles(id),
  evidence text,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, step_key)
);

alter table public.tenant_instance enable row level security;
alter table public.tenant_onboarding_step enable row level security;

-- Orden fijo de LAB12 cap. 3 bis.
create or replace function public._onboarding_steps()
returns table(step_key text, ord int)
language sql immutable set search_path = public, pg_temp as $$
  values ('machine', 1), ('fleet_template', 2), ('secrets', 3), ('database', 4),
         ('monitoring', 5), ('backups', 6), ('vps_entry', 7)
$$;

create or replace function public.staff_get_tenant_instance(p_tenant_id uuid)
returns table(host text, public_url text, template_version text, ap_version text, app_version text,
              notes text, updated_at timestamptz, updated_by_name text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select i.host, i.public_url, i.template_version, i.ap_version, i.app_version, i.notes, i.updated_at,
         coalesce(p.full_name, u.email::text)
  from public.tenant_instance i
  left join public.profiles p on p.id = i.updated_by
  left join auth.users u on u.id = i.updated_by
  where i.tenant_id = p_tenant_id;
end $$;

create or replace function public.staff_upsert_tenant_instance(
  p_tenant_id uuid, p_host text, p_public_url text, p_template_version text,
  p_ap_version text, p_app_version text, p_notes text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not staff_can_access_tenant(p_tenant_id) or not has_permission('tenants.write', p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if nullif(trim(p_public_url), '') is not null and p_public_url !~ '^https://' then
    raise exception 'La URL del cliente debe empezar por https://' using errcode = '23514';
  end if;
  insert into public.tenant_instance(tenant_id, host, public_url, template_version, ap_version, app_version,
                                     notes, updated_at, updated_by)
  values (p_tenant_id, nullif(trim(p_host), ''), nullif(trim(p_public_url), ''), nullif(trim(p_template_version), ''),
          nullif(trim(p_ap_version), ''), nullif(trim(p_app_version), ''), nullif(trim(p_notes), ''), now(), auth.uid())
  on conflict (tenant_id) do update set
    host = excluded.host, public_url = excluded.public_url, template_version = excluded.template_version,
    ap_version = excluded.ap_version, app_version = excluded.app_version, notes = excluded.notes,
    updated_at = now(), updated_by = auth.uid();
end $$;

create or replace function public.staff_list_onboarding_steps(p_tenant_id uuid)
returns table(step_key text, ord int, done_at timestamptz, done_by_name text, evidence text,
              can_complete boolean, can_reopen boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_write boolean;
begin
  if not staff_can_access_tenant(p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  v_write := has_permission('tenants.write', p_tenant_id);
  return query
  with s as (
    select o.step_key, o.ord, st.done_at, st.done_by, st.evidence
    from public._onboarding_steps() o
    left join public.tenant_onboarding_step st on st.tenant_id = p_tenant_id and st.step_key = o.step_key
  )
  select s.step_key, s.ord, s.done_at, coalesce(p.full_name, u.email::text), s.evidence,
         v_write and s.done_at is null
           and coalesce((select prev.done_at is not null from s prev where prev.ord = s.ord - 1), true),
         v_write and s.done_at is not null
           and coalesce((select nxt.done_at is null from s nxt where nxt.ord = s.ord + 1), true)
  from s
  left join public.profiles p on p.id = s.done_by
  left join auth.users u on u.id = s.done_by
  order by s.ord;
end $$;

create or replace function public.staff_set_onboarding_step(
  p_tenant_id uuid, p_step_key text, p_done boolean, p_evidence text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_pos int; v_prev_done boolean; v_next_done boolean;
begin
  if not staff_can_access_tenant(p_tenant_id) or not has_permission('tenants.write', p_tenant_id) then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select o.ord into v_pos from public._onboarding_steps() o where o.step_key = p_step_key;
  if v_pos is null then
    raise exception 'Paso desconocido: %', p_step_key using errcode = '23514';
  end if;

  if p_done then
    if length(trim(coalesce(p_evidence, ''))) < 3 then
      raise exception 'Un paso no se marca sin evidencia (un enlace o una nota)' using errcode = '23514';
    end if;
    select coalesce(bool_and(st.done_at is not null), false) into v_prev_done
    from public._onboarding_steps() o
    left join public.tenant_onboarding_step st on st.tenant_id = p_tenant_id and st.step_key = o.step_key
    where o.ord = v_pos - 1;
    if v_pos > 1 and not v_prev_done then
      raise exception 'Primero hay que completar el paso anterior' using errcode = '23514';
    end if;
    insert into public.tenant_onboarding_step(tenant_id, step_key, done_at, done_by, evidence, updated_at)
    values (p_tenant_id, p_step_key, now(), auth.uid(), trim(p_evidence), now())
    on conflict (tenant_id, step_key) do update set
      done_at = now(), done_by = auth.uid(), evidence = trim(p_evidence), updated_at = now();
  else
    select exists (
      select 1 from public.tenant_onboarding_step st
      join public._onboarding_steps() o on o.step_key = st.step_key
      where st.tenant_id = p_tenant_id and o.ord = v_pos + 1 and st.done_at is not null
    ) into v_next_done;
    if v_next_done then
      raise exception 'No se reabre un paso si el siguiente ya está hecho' using errcode = '23514';
    end if;
    update public.tenant_onboarding_step set done_at = null, done_by = null, updated_at = now()
     where tenant_id = p_tenant_id and step_key = p_step_key;
  end if;
end $$;

revoke execute on function public._onboarding_steps() from public, anon;
revoke execute on function public.staff_get_tenant_instance(uuid) from public, anon;
revoke execute on function public.staff_upsert_tenant_instance(uuid, text, text, text, text, text, text) from public, anon;
revoke execute on function public.staff_list_onboarding_steps(uuid) from public, anon;
revoke execute on function public.staff_set_onboarding_step(uuid, text, boolean, text) from public, anon;
grant execute on function public.staff_get_tenant_instance(uuid) to authenticated;
grant execute on function public.staff_upsert_tenant_instance(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.staff_list_onboarding_steps(uuid) to authenticated;
grant execute on function public.staff_set_onboarding_step(uuid, text, boolean, text) to authenticated;
