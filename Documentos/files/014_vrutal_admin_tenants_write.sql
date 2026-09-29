-- =====================================================================
-- VRUTAL 1st · Migración 014 · platform_admin puede editar la ficha de cliente
--
-- Decisión 2026-09-29: el Admin de Vrutal recibe 'tenants.write'
-- (antes solo superadmin y ops). Idempotente.
-- =====================================================================

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'platform_admin' and r.scope = 'platform' and r.tenant_id is null
  and p.key = 'tenants.write'
  and not exists (
    select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission_id = p.id
  );

-- Comprobación: debe devolver platform_admin, platform_ops y platform_superadmin.
select r.key
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
join public.permissions p on p.id = rp.permission_id
where p.key = 'tenants.write'
order by r.key;
