-- =====================================================================
-- VRUTAL 1st · Migración 005 · Integridad del artefacto de una versión de bloque
--
-- Decisión: Git es la fuente de verdad del artefacto (flujo exportado o piece);
-- Vrutal 1st guarda solo la referencia. Para que "validated" siga siendo
-- inmutable, una referencia git: debe apuntar a un SHA de commit completo
-- (nunca rama ni tag, que son mutables) y se puede guardar el sha256 del contenido.
-- =====================================================================

alter table catalog.component_version
  add column artifact_sha256 text check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint component_version_artifact_ref_fmt check (
    artifact_ref is null or artifact_ref !~ '^git:' or artifact_ref ~ '^git:[^@[:space:]]+@[0-9a-f]{40}$');

comment on column catalog.component_version.artifact_ref is
  'Referencia al artefacto. Git: "git:<repo>/<ruta>@<sha de commit completo, 40 hex>". Piece: "piece:@scope/nombre@x.y.z". Obligatoria para publicar.';
comment on column catalog.component_version.artifact_sha256 is
  'sha256 (hex) del contenido del artefacto, para verificar que no ha cambiado.';

-- RPC: cambian de firma, se recrean ------------------------------------------------------
drop function if exists public.catalog_list_component_versions(uuid);
drop function if exists public.catalog_create_component_version(uuid, text, text, text, integer, text[]);
drop function if exists public.catalog_update_component_version(uuid, text, text, text, integer, text[]);

create function public.catalog_list_component_versions(p_component_id uuid)
returns table(id uuid, version int, status text, artifact_ref text, output_contract_key text, output_contract_version int,
              consumes text[], changelog text, created_at timestamptz, artifact_sha256 text)
language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  return query select v.id, v.version, v.status, v.artifact_ref, v.output_contract_key, v.output_contract_version,
                      v.consumes, v.changelog, v.created_at, v.artifact_sha256
                 from catalog.component_version v where v.component_id = p_component_id order by v.version desc;
end $$;

create function public.catalog_create_component_version(
  p_component_id uuid, p_changelog text, p_artifact_ref text default null,
  p_output_contract_key text default null, p_output_contract_version int default null, p_consumes text[] default '{}',
  p_artifact_sha256 text default null)
returns uuid language plpgsql security definer set search_path = public, catalog, pg_temp as $$
declare v_id uuid; v int;
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  select coalesce(max(x.version), 0) + 1 into v from catalog.component_version x where x.component_id = p_component_id;
  insert into catalog.component_version(component_id, version, changelog, artifact_ref, artifact_sha256,
                                        output_contract_key, output_contract_version, consumes)
  values (p_component_id, v, p_changelog, nullif(p_artifact_ref, ''), nullif(lower(p_artifact_sha256), ''),
          nullif(p_output_contract_key, ''),
          case when nullif(p_output_contract_key, '') is null then null else p_output_contract_version end,
          coalesce(p_consumes, '{}'))
  returning id into v_id;
  return v_id;
end $$;

create function public.catalog_update_component_version(
  p_id uuid, p_changelog text, p_artifact_ref text, p_output_contract_key text, p_output_contract_version int,
  p_consumes text[], p_artifact_sha256 text default null)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  update catalog.component_version
     set changelog = p_changelog, artifact_ref = nullif(p_artifact_ref, ''), artifact_sha256 = nullif(lower(p_artifact_sha256), ''),
         output_contract_key = nullif(p_output_contract_key, ''),
         output_contract_version = case when nullif(p_output_contract_key, '') is null then null else p_output_contract_version end,
         consumes = coalesce(p_consumes, '{}')
   where id = p_id;
end $$;

-- Publicar exige artefacto.
create or replace function public.catalog_set_component_version_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public, catalog, pg_temp as $$
begin
  if not is_platform_admin() then raise exception 'unauthorized' using errcode = '42501'; end if;
  if p_status = 'validated' and exists (select 1 from catalog.component_version v where v.id = p_id and v.artifact_ref is null) then
    raise exception 'Una versión sin artefacto no se puede publicar: indica su referencia' using errcode = '23514';
  end if;
  update catalog.component_version set status = p_status where id = p_id;
end $$;

revoke all on function public.catalog_list_component_versions(uuid) from public, anon;
revoke all on function public.catalog_create_component_version(uuid, text, text, text, integer, text[], text) from public, anon;
revoke all on function public.catalog_update_component_version(uuid, text, text, text, integer, text[], text) from public, anon;
grant execute on function public.catalog_list_component_versions(uuid) to authenticated, service_role;
grant execute on function public.catalog_create_component_version(uuid, text, text, text, integer, text[], text) to authenticated, service_role;
grant execute on function public.catalog_update_component_version(uuid, text, text, text, integer, text[], text) to authenticated, service_role;
