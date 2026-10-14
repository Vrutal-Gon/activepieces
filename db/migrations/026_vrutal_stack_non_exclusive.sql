-- =====================================================================
-- Proyecto Supabase: Vrutal 1st — panel de control de staff/clientes (apmhvqlvwjcrwfaixgju).
-- NO lo ejecutes en el proyecto VrutalOS de un cliente: esas tablas no existen ahi.
-- VRUTAL 1st · Migración 026 · Stack/Sistemas: una categoría puede tener varios sistemas
--
-- Corrige un diseño anterior: `tenant_stack_choice` tenía PRIMARY KEY (tenant_id,
-- system_category) — un cliente solo podía tener UN sistema por categoría. Eso es
-- correcto para categorías de verdad excluyentes (p. ej. un solo ERP), pero falso para
-- "llm": el cliente usará Anthropic para unas cosas, DeepSeek/Qwen/OpenAI para otras — no
-- es una elección, son varias a la vez. Mismo fallo de forma que ya se corrigió para redes
-- sociales (`integrations_social`, migración `022`): una categoría no excluyente modelada
-- como si lo fuera. Encontrado por el founder antes de añadir Anthropic al catálogo, no
-- después.
--
-- Comprobado en la base real antes de escribir esto (no se asumió el esquema, no está en
-- ninguna migración trackeada — mismo hueco de documentación que `tenant_specialist` antes
-- de la 024): PK real `tenant_stack_choice_pkey (tenant_id, system_category)`, `insert ...
-- on conflict (tenant_id, system_category)` en `set_tenant_stack_choice`, `delete ... where
-- system_category = ...` en `remove_tenant_stack_choice`.
--
-- Cambia la clave de "una por categoría" a "una por sistema elegido": un cliente puede
-- tener Anthropic Y DeepSeek Y OpenAI al mismo tiempo, cada uno su propia fila. Categorías
-- que sí son excluyentes (ERP, ej.) simplemente no tendrán nunca una segunda fila — no se
-- pierde nada forzando una regla que antes no existía de verdad en ningún lado.
-- =====================================================================

alter table public.tenant_stack_choice drop constraint tenant_stack_choice_pkey;
alter table public.tenant_stack_choice add primary key (tenant_id, system_option_id);

create or replace function public.set_tenant_stack_choice(
  p_tenant_id uuid, p_system_category text, p_system_option_id uuid, p_notes text default null
)
returns void
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  insert into public.tenant_stack_choice (tenant_id, system_category, system_option_id, notes)
  values (p_tenant_id, p_system_category, p_system_option_id, p_notes)
  on conflict (tenant_id, system_option_id) do update set
    system_category = excluded.system_category,
    notes = excluded.notes,
    updated_at = now();
end;
$$;

-- Cambia de parámetro (antes `p_system_category text`, quitaba TODA la categoría; ahora
-- `p_system_option_id uuid`, quita solo ese sistema) — create or replace no permite cambiar
-- la firma, hace falta drop primero. El drop borra los grants: se vuelven a poner debajo.
drop function public.remove_tenant_stack_choice(uuid, text);

create function public.remove_tenant_stack_choice(p_tenant_id uuid, p_system_option_id uuid)
returns void
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  delete from public.tenant_stack_choice
  where tenant_id = p_tenant_id and system_option_id = p_system_option_id;
end;
$$;

revoke execute on function public.remove_tenant_stack_choice(uuid, uuid) from public, anon;
grant execute on function public.remove_tenant_stack_choice(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Para revertir (solo tiene sentido si ninguna categoría llegó a tener 2 filas para el
-- mismo tenant todavía — si no, la vuelta atrás pierde datos):
--   drop function public.remove_tenant_stack_choice(uuid, uuid);
--   create function public.remove_tenant_stack_choice(uuid, text) ... (ver 008/009, forma original)
--   alter table public.tenant_stack_choice drop constraint tenant_stack_choice_pkey;
--   alter table public.tenant_stack_choice add primary key (tenant_id, system_category);
-- ---------------------------------------------------------------------
