-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 017 · Limpieza del catálogo de pruebas
--
-- Borra los bloques, versiones, contrato, composición y enlaces de prueba (email IMAP),
-- que estaban publicados y por eso eran inmutables. Decisión del founder
-- (2026-09-30): arrancamos el catálogo de bloques desde cero con Marketing.
--
-- Seguridad:
-- - Una sola transacción. Si el inventario no es exactamente el esperado, aborta sin tocar nada.
-- - Los triggers de inmutabilidad se desactivan solo dentro de esta transacción y se reactivan al final.
-- - No toca tareas, roles, tenants ni flujos contratados.
-- =====================================================================

do $$
declare
  n_comp int; n_ver int; n_compo int; n_slot int; n_tc int; n_jrtc int; n_con int; n_flow_refs int;
begin
  select count(*) into n_comp from catalog.component;
  select count(*) into n_ver from catalog.component_version;
  select count(*) into n_compo from catalog.task_composition;
  select count(*) into n_slot from catalog.task_composition_slot;
  select count(*) into n_tc from catalog.task_component;
  select count(*) into n_jrtc from catalog.job_role_task_component;
  select count(*) into n_con from catalog.contract;
  select count(*) into n_flow_refs from public.tenant_specialist_flow where component_id is not null;

  -- Inventario revisado el 2026-09-30: 3 componentes, 2 versiones, 1 composición (2 slots),
  -- 1 enlace tarea-componente, 1 override por rol, 1 contrato.
  if n_comp <> 3 or n_ver <> 2 or n_compo <> 1 or n_tc <> 1 or n_jrtc <> 1 or n_con <> 1 then
    raise exception 'Inventario distinto del revisado (componentes %, versiones %, composiciones %, enlaces %, overrides %, contratos %): no se borra nada',
      n_comp, n_ver, n_compo, n_tc, n_jrtc, n_con;
  end if;
  if not exists (select 1 from catalog.contract where key = 'EmailEvent' and version = 1) then
    raise exception 'El único contrato no es EmailEvent@1: no se borra nada';
  end if;
  if n_flow_refs > 0 then
    raise exception '% flujos contratados apuntan a un componente: revisar antes de borrar', n_flow_refs;
  end if;
  raise notice 'Limpieza: % componentes, % versiones, % composición, % slots, % enlace, % override, % contrato',
    n_comp, n_ver, n_compo, n_slot, n_tc, n_jrtc, n_con;
end $$;

alter table catalog.task_composition_slot disable trigger task_composition_slot_guard;
alter table catalog.task_composition disable trigger task_composition_immutable;
alter table catalog.component_version disable trigger component_version_immutable;
alter table catalog.contract disable trigger contract_immutable;

delete from catalog.task_composition_slot;
delete from catalog.task_composition;
delete from catalog.task_component;
delete from catalog.job_role_task_component;
delete from catalog.component_version;
delete from catalog.component;
delete from catalog.contract where key = 'EmailEvent' and version = 1;

alter table catalog.task_composition_slot enable trigger task_composition_slot_guard;
alter table catalog.task_composition enable trigger task_composition_immutable;
alter table catalog.component_version enable trigger component_version_immutable;
alter table catalog.contract enable trigger contract_immutable;
