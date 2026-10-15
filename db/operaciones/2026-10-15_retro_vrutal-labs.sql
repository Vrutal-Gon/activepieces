-- =====================================================================
-- PEGAR EN EL SQL EDITOR DE VrutalOS (Vrutal-labs, rgauumxztblwurzebmsa)
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju).
--
-- Hace lo mismo que `scripts/aplicar-cambios-cliente.sh --apply --retro`, pero sin
-- necesitar la contraseña de la base: crea la tabla de control y anota los 13 cambios que
-- YA están aplicados a mano. No ejecuta ninguno de ellos.
--
-- Los hashes son SHA-256 del fichero normalizado a LF (sin \r), calculados el 2026-10-15
-- igual que los calcula el script. Así, cuando luego uses el script, reconocerá estas filas
-- como válidas y se saltará esos cambios.
--
-- Los dos cambios del 2026-10-15 (quitar_permisos_regalados y retirar_client_ticket) NO se
-- anotan a propósito: esos SÍ están pendientes de aplicar de verdad.
--
-- Es idempotente: se puede ejecutar dos veces sin estropear nada.
-- =====================================================================

-- 1 · La tabla de control (copia de 2026-10-14_schema_change_log.sql)
create table if not exists public.schema_change_log (
  filename    text        primary key,
  sha256      text        not null,
  applied_at  timestamptz not null default now(),
  applied_by  text        not null,
  source      text        not null default 'script'
              check (source in ('script', 'retro', 'manual')),
  notes       text
);

comment on table public.schema_change_log is
  'Rastro de los cambios de db/plantillas/cambios/ aplicados en ESTA base. Lo escribe '
  'scripts/aplicar-cambios-cliente.sh. Operacion de Vrutal: el cliente no lo lee.';

alter table public.schema_change_log enable row level security;

revoke all on public.schema_change_log from anon, authenticated;
grant all on public.schema_change_log to service_role;

-- 2 · Anotar lo que ya está aplicado
insert into public.schema_change_log (filename, sha256, applied_by, source, notes)
select v.filename, v.sha256,
       'retro manual por SQL Editor (2026-10-15)',
       'retro',
       'Marcado sin ejecutar: ya estaba aplicado a mano. El hash es el del fichero de hoy, no el de lo que se ejecuto. Objetos verificados uno a uno contra esta base el 2026-10-14: los 18 existen, uno cada uno.'
from (values
  ('2026-10-05_is_active_solo_admin.sql',       'e99b8158135a7a740ae5bad5f5febfba31d030d7eb90650e2700189fb8789570'),
  ('2026-10-05_team_members_rpc.sql',           '7388dbd0f4207aa961519d3569bc06471ab6aa8e691d6624e01a14112661ef8a'),
  ('2026-10-06_client_manager_role.sql',        'bb4a7ee64f6da353b81570ab502467d5f50624106ce007162d7ac0e910c9ed23'),
  ('2026-10-06_grants_pantallas.sql',           'ddbfca0707468f17d44087634635c8a3f50ba24826e89c9545a37720963a1260'),
  ('2026-10-06_integrations_vault.sql',         '45dcf3b5ad52020a3ab96dd73a23c725fdc26f5908f1395298a9cbde0b69e93d'),
  ('2026-10-06_usage_summary_rpc.sql',          '0633a9c6021d5844361c17a6d8107b0848e26b08f8266933345f72286547832b'),
  ('2026-10-06_work_items.sql',                 '214f74d0f689fe505b95f901922b62108fca7d2d7f206c01f125fe6f3a0d3db3'),
  ('2026-10-08_integrations_social.sql',        '9a86feae558460da78be2662e648c202f584cda65d3481e5d7403dbb0354a013'),
  ('2026-10-11_integration_provider_sync.sql',  'bd2b5e556805725884929cae821f7e2d0a8cb114f4cf3bce9098a27e7b1e82a0'),
  ('2026-10-13_approval_delegation_fix.sql',    '7f9123670c3d60d2ec373a1c45533668bf733524add23c99b82d0023efa72da4'),
  ('2026-10-13_approval_resume.sql',            '157c7be330c728e5f19e7c4707acd30a28a3afc5639a8b45cfa2f966c68e80f3'),
  ('2026-10-13_sync_specialists_grant.sql',     '36644d1007c718aa00fa364264a539d70a21c3eae81c14d5f0906794e71f2e50'),
  ('2026-10-14_schema_change_log.sql',          '316d42b539fd51aeb2b6a8dc9951274365ba5793f75638745854d08b4f35931a')
) as v(filename, sha256)
on conflict (filename) do nothing;

-- 3 · Comprobar. Tiene que dar 13 filas, todas 'retro', y la tabla cerrada al cliente.
select count(*) as filas,
       count(*) filter (where source = 'retro') as retro,
       has_table_privilege('authenticated', 'public.schema_change_log', 'select') as lo_lee_el_cliente
from public.schema_change_log;
