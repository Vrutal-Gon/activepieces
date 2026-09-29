-- =====================================================================
-- VRUTAL 1st · Migración 006 · Convención de la referencia de artefacto
--
--   git:<propietario>/<repo>:<ruta>@<SHA de commit completo, 40 hex>
--   ej. git:Vrutal-Gon/VrutalOS:activepieces/flows/TSK-001222/inbound-imap-trigger.flow.json@<sha>
--
-- El ':' separa repo y ruta (con '/' sola no se distinguen). Sigue sin aceptarse
-- rama ni tag ni SHA corto: son mutables y romperían la inmutabilidad de lo validado.
-- =====================================================================

alter table catalog.component_version drop constraint component_version_artifact_ref_fmt;
alter table catalog.component_version add constraint component_version_artifact_ref_fmt check (
  artifact_ref is null
  or artifact_ref !~ '^git:'
  or artifact_ref ~ '^git:[A-Za-z0-9._-]+/[A-Za-z0-9._-]+:[^@[:space:]]+@[0-9a-f]{40}$');

comment on column catalog.component_version.artifact_ref is
  'Referencia al artefacto. Git: "git:<propietario>/<repo>:<ruta>@<SHA de commit completo, 40 hex>" (nunca rama ni tag). Piece: "piece:@scope/nombre@x.y.z". Obligatoria para publicar.';
