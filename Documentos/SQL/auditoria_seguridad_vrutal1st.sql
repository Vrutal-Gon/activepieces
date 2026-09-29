-- Auditoría de seguridad de Vrutal1st (solo lectura: no modifica nada).
-- Devuelve un único JSON. Ejecutar en Supabase → SQL Editor y copiar la celda resultado.
with fn as (
  select n.nspname as sch, p.proname as name, p.oid,
         pg_get_function_arguments(p.oid) as args, p.prosecdef as definer, p.prosrc as src,
         p.proconfig as config
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'catalog') and p.prokind = 'f'
),
rel as (
  select n.nspname as sch, c.relname as name, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.reloptions
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('public', 'catalog') and c.relkind in ('r', 'p', 'v', 'm')
)
select json_build_object(
  -- Qué comprueba cada función y quién puede ejecutarla
  'function_audit', (
    select json_agg(json_build_object(
      'fn', sch || '.' || name,
      'args', args,
      'definer', definer,
      'search_path_fixed', coalesce(array_to_string(config, ',') ilike '%search_path%', false),
      'anon_exec', has_function_privilege('anon', oid, 'execute'),
      'auth_exec', has_function_privilege('authenticated', oid, 'execute'),
      'checks', array_remove(array[
        case when src ilike '%is_superadmin(%' then 'superadmin' end,
        case when src ilike '%is_platform_admin(%' then 'platform_admin' end,
        case when src ilike '%has_platform_role(%' then 'platform_role' end,
        case when src ilike '%has_permission(%' then 'permission' end,
        case when src ilike '%auth.uid()%' then 'uid' end,
        case when src ilike '%current_user%' or src ilike '%session_user%' or src ilike '%auth.role()%' then 'db_role' end
      ], null)
    ) order by sch, name)
    from fn
  ),
  -- Código completo de helpers de permisos, triggers de auth y funciones que tocan clientes/secretos
  'defs', (
    select json_object_agg(sch || '.' || name || '(' || args || ')', pg_get_functiondef(oid))
    from fn
    where name in ('handle_new_user', 'guard_user_roles', 'ensure_superadmin_remains', 'seed_grant',
                   'has_platform_role', 'is_platform_admin', 'is_superadmin', 'has_permission',
                   'shares_tenant', 'user_tenant_ids', 'rls_auto_enable')
       or args ilike '%tenant%'
       or name ilike '%tenant%'
       or name ilike '%credential%'
       or name ilike '%sync%'
  ),
  -- RLS y privilegios de anon/authenticated por tabla y vista
  'relations', (
    select json_agg(json_build_object(
      't', sch || '.' || name,
      'kind', relkind,
      'rls', relrowsecurity,
      'force_rls', relforcerowsecurity,
      'options', reloptions,
      'anon', array_remove(array[
        case when has_table_privilege('anon', oid, 'select') then 'S' end,
        case when has_table_privilege('anon', oid, 'insert') then 'I' end,
        case when has_table_privilege('anon', oid, 'update') then 'U' end,
        case when has_table_privilege('anon', oid, 'delete') then 'D' end
      ], null),
      'auth', array_remove(array[
        case when has_table_privilege('authenticated', oid, 'select') then 'S' end,
        case when has_table_privilege('authenticated', oid, 'insert') then 'I' end,
        case when has_table_privilege('authenticated', oid, 'update') then 'U' end,
        case when has_table_privilege('authenticated', oid, 'delete') then 'D' end
      ], null)
    ) order by sch, name)
    from rel
  ),
  'policies', (
    select json_agg(json_build_object(
      't', schemaname || '.' || tablename, 'name', policyname, 'cmd', cmd,
      'roles', roles, 'using', qual, 'check', with_check
    ) order by schemaname, tablename, policyname)
    from pg_policies
    where schemaname in ('public', 'catalog')
  ),
  'triggers', (
    select json_agg(json_build_object('trigger', t.tgname, 'table', t.tgrelid::regclass::text, 'function', p.proname))
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and t.tgrelid::regclass::text not like 'pg_%'
  )
) as security_audit;
