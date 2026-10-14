-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 010 · Endurecimiento (auditoría 2026-09-29)
--
-- 1. Ninguna función de public/catalog ejecutable sin sesión (anon/PUBLIC).
--    Quien ya podía ejecutarla con sesión (authenticated) la conserva.
--    Las funciones de trigger no las ejecuta nadie directamente: se retiran a todos.
-- 2. Lo mismo, automático, para cada función que se cree en el futuro
--    (Postgres concede EXECUTE a PUBLIC por defecto y eso no se puede quitar por esquema).
-- 3. Sin escrituras directas desde el navegador en tablas que se gestionan por RPC
--    o Edge Function: las validaciones viven ahí y no se pueden saltar.
-- 4. RLS automática también para tablas nuevas del esquema catalog.
-- 5. staff_list_platform_roles(): roles de plataforma con sus permisos (para invitar).
--
-- Seguro de re-ejecutar.
-- =====================================================================

-- 1 ------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig,
           p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype) as is_trigger,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_ok
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'catalog') and p.prokind = 'f'
  loop
    if f.is_trigger then
      execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    else
      if f.auth_ok then
        -- Explícito antes de quitar PUBLIC, para que authenticated no pierda lo que tenía.
        execute format('grant execute on function %s to authenticated', f.sig);
      end if;
      execute format('revoke execute on function %s from public, anon', f.sig);
    end if;
  end loop;
end $$;

-- 2 ------------------------------------------------------------------
create or replace function public.revoke_anon_function_exec()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where object_type in ('function', 'procedure')
      and schema_name in ('public', 'catalog')
  loop
    execute format('revoke execute on %s %s from public, anon', cmd.object_type, cmd.object_identity);
  end loop;
end $$;

drop event trigger if exists revoke_anon_function_exec;
create event trigger revoke_anon_function_exec
  on ddl_command_end
  when tag in ('CREATE FUNCTION', 'CREATE PROCEDURE')
  execute function public.revoke_anon_function_exec();

revoke execute on function public.revoke_anon_function_exec() from public, anon, authenticated;

-- Tablas y vistas futuras: nada para anon por defecto (Supabase lo concede por esquema).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema catalog revoke all on tables from anon;

-- 3 ------------------------------------------------------------------
revoke insert, update, delete on
  public.tenants,
  public.tenant_members,
  public.external_references,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_roles,
  public.my_permissions,
  catalog.task,
  catalog.job_role,
  catalog.job_role_task,
  catalog.occupation
from authenticated;

-- 4 ------------------------------------------------------------------
-- Igual que la versión existente, añadiendo 'catalog' a los esquemas protegidos.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public', 'catalog') then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$function$;

-- 5 ------------------------------------------------------------------
create or replace function public.staff_list_platform_roles()
returns table(key text, name text, permission_keys text[])
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_superadmin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return query
  select r.key, r.name,
         array(select pm.key from public.role_permissions rp join public.permissions pm on pm.id = rp.permission_id
               where rp.role_id = r.id order by pm.key)
  from public.roles r
  where r.scope = 'platform' and r.tenant_id is null
  order by r.key;
end $$;

revoke execute on function public.staff_list_platform_roles() from public, anon;
grant execute on function public.staff_list_platform_roles() to authenticated;
