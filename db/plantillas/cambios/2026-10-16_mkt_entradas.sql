-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · ENTRADAS de los flujos de Marketing
--
-- Lo que los flujos LEÍAN de las pestañas de Google Sheets «Perfil», «Marca» y «Objetivos» pasa a
-- tablas de esta base. Son entradas, no entregables: por eso no van en work_item (que es la salida).
--
-- Modelo (decidido 2026-10-16):
--   mkt_input_field    La LISTA CERRADA de campos que existen, por bloque de entrada ('icp', 'brand_voice').
--                      Es a la vez la definición del formulario del Admin y el candado del prompt.
--   mkt_input_value    El valor de cada campo. Un campo `multi` admite varias filas (dolor, miedo, idioma);
--                      los demás, una sola (lo impide un trigger, no la buena voluntad).
--   mkt_channel_target Objetivos por canal: es una tabla de verdad, no campo/valor.
--
-- POR QUÉ LA LISTA CERRADA: un prompt estándar («plantilla») solo puede leer campos estructurados que
-- define Vrutal. Texto libre del cliente alimentando un prompt estándar = nivel «a medida», que es otro
-- producto. La deuda estaba escrita en Activepieces/flows/MKT-F4_keywords/README.md.
--
-- UN ORIGEN O DOS TABLAS: el README de `cambios/` proponía separar en dos tablas lo que empuja Vrutal
-- (auditoría) de lo que añade el cliente, para que la separación fuera estructural. Aquí va en una
-- columna `source` ('vrutal' | 'cliente') porque hoy NADIE del cliente escribe: sin escritura, dos
-- tablas no protegen de nada. Hay que decidirlo antes de abrir la escritura al Manager en el front:
-- o se parte en dos tablas, o su política de escritura se limita a `source = 'cliente'`.
--
-- QUIÉN ESCRIBE: hoy solo service_role (el staff carga el contenido y la Edge Function lo lee).
-- Cuando exista la pantalla del Admin, se abre la escritura con is_admin_or_manager() —para eso se creó
-- el rol Manager— en un cambio aparte, con su propia política de insert/update/delete.
--
-- QUIÉN LEE: cualquier usuario activo del cliente (es el perfil de SU empresa). Y las Edge Functions
-- con service_role. NO se lee nunca el catálogo de Vrutal (catalog_*_ro) desde aquí.
--
-- CONTRATO CON LOS FLUJOS (bloque «Lee de la tabla», sustituye a «Lee de la hoja»):
--   El flujo llama a la Edge Function `flow-input-read` con { job_role_key, source }, donde source es
--   'icp' | 'brand_voice' | 'channel_target'. La función responde:
--     icp / brand_voice   -> [{ field_key, value, position }]  ordenado por (position, field_key)
--     channel_target      -> [{ channel, metric, target, period }]
--   Si no hay filas, la función devuelve una lista vacía y el flujo DEBE fallar sin escribir nada
--   (regla de Activepieces/GUIA_construir_flujos.md: entradas vacías = el flujo para).
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1. Lista cerrada de campos (definición del formulario y candado del prompt).
create table if not exists public.mkt_input_field (
  input_key  text not null check (input_key in ('icp', 'brand_voice')),
  field_key  text not null check (field_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label      text not null,
  multi      boolean not null default false,
  position   int     not null default 0,
  help       text,
  primary key (input_key, field_key)
);

-- 2. Valores. Una fila por dato; los campos `multi` se repiten.
create table if not exists public.mkt_input_value (
  id         uuid primary key default gen_random_uuid(),
  input_key  text not null,
  field_key  text not null,
  value      text not null check (length(btrim(value)) between 1 and 500),
  source     text not null default 'vrutal' check (source in ('vrutal', 'cliente')),
  position   int  not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  foreign key (input_key, field_key) references public.mkt_input_field (input_key, field_key) on delete restrict,
  unique (input_key, field_key, value)
);

create index if not exists mkt_input_value_lookup_idx on public.mkt_input_value (input_key, position, field_key);

-- Un campo que no es `multi` no admite dos valores: si no, el prompt recibe dos «sector» y nadie sabe cuál manda.
create or replace function public.mkt_input_value_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $f$
declare v_multi boolean;
begin
  select multi into v_multi from public.mkt_input_field
   where input_key = new.input_key and field_key = new.field_key;
  if not coalesce(v_multi, false) and exists (
    select 1 from public.mkt_input_value v
     where v.input_key = new.input_key and v.field_key = new.field_key and v.id is distinct from new.id
  ) then
    raise exception 'El campo % de % admite un solo valor: actualiza el que ya existe.', new.field_key, new.input_key
      using errcode = '23505';
  end if;
  new.updated_at := now();
  return new;
end $f$;

-- El trigger se crea solo si no está. Sin `drop ... if exists`: el permiso automático de la base
-- bloquea cualquier DROP, y en una tabla recién creada no hay nada que tirar.
do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'mkt_input_value_guard'
       and tgrelid = 'public.mkt_input_value'::regclass
  ) then
    create trigger mkt_input_value_guard before insert or update on public.mkt_input_value
      for each row execute function public.mkt_input_value_guard();
  end if;
end $$;

-- 3. Objetivos por canal (pestaña «Objetivos»: canal · metrica · objetivo).
create table if not exists public.mkt_channel_target (
  id         uuid primary key default gen_random_uuid(),
  channel    text not null check (channel in ('seo', 'sem', 'email', 'linkedin', 'social', 'web', 'other')),
  metric     text not null check (length(btrim(metric)) between 1 and 80),
  target     text not null check (length(btrim(target)) between 1 and 80),
  period     text check (period in ('semanal', 'mensual', 'trimestral')),
  source     text not null default 'vrutal' check (source in ('vrutal', 'cliente')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

-- Un objetivo por canal, métrica y periodo. El índice usa coalesce porque period admite NULL.
create unique index if not exists mkt_channel_target_unico_idx
  on public.mkt_channel_target (channel, metric, coalesce(period, ''));

-- 4. Seguridad por fila y permisos.
alter table public.mkt_input_field   enable row level security;
alter table public.mkt_input_value   enable row level security;
alter table public.mkt_channel_target enable row level security;

-- Las políticas se crean solo si no están, por lo mismo que el trigger: aquí no se ejecuta ningún DROP.
-- `active_only` es obligatoria en cada tabla nueva (regla 5 del README): las tablas no la heredan.
do $$
declare
  t text;
begin
  foreach t in array array['mkt_input_field', 'mkt_input_value', 'mkt_channel_target'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_select') then
      execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'active_only') then
      execute format('create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active_user())', t);
    end if;
  end loop;
end $$;

-- Sin GRANT la política ni se evalúa. Y las tablas nuevas nacen con TRUNCATE/REFERENCES/TRIGGER
-- regalados a anon y authenticated por los privilegios por defecto de Supabase: se retiran aquí.
revoke all on public.mkt_input_field, public.mkt_input_value, public.mkt_channel_target from anon, authenticated;
grant select on public.mkt_input_field, public.mkt_input_value, public.mkt_channel_target to authenticated;
grant all    on public.mkt_input_field, public.mkt_input_value, public.mkt_channel_target to service_role;

revoke all on function public.mkt_input_value_guard() from public, anon, authenticated;

-- 5. Los campos que existen (la lista cerrada). Idempotente.
insert into public.mkt_input_field (input_key, field_key, label, multi, position, help) values
  ('icp', 'tipo_empresa',   'Tipo de empresa',              false, 10, 'Brief §4.2'),
  ('icp', 'tamano_empresa', 'Tamaño de empresa',            false, 20, null),
  ('icp', 'facturacion',    'Facturación',                  false, 30, null),
  ('icp', 'sector',         'Sector',                       false, 40, null),
  ('icp', 'rol_comprador',  'Rol de quien compra',          false, 50, null),
  ('icp', 'idioma',         'Idiomas',                      true,  60, 'es, en'),
  ('icp', 'dolor',          'Dolores',                      true,  70, 'Cada dolor genera keywords en cada idioma'),
  ('icp', 'miedo',          'Miedos',                       true,  80, 'La IA solo entra como miedo o riesgo (LAB 10 cap. 2)'),
  ('icp', 'no_encaja',      'A quién no servimos',          true,  90, null),
  ('brand_voice', 'voz',         'Voz de marca',            true,  10, null),
  ('brand_voice', 'diccionario', 'Diccionario: cómo decimos', true, 20, 'Una entrada por fila'),
  ('brand_voice', 'prohibidos',  'Palabras prohibidas',     true,  30, 'Nada de «bots» ni la IA como compra')
on conflict (input_key, field_key) do nothing;

-- 6. El contenido actual de la pestaña «Perfil» (ICP asumido de build-up: se afina al crecer).
insert into public.mkt_input_value (input_key, field_key, value, source, position) values
  ('icp', 'tipo_empresa',   'Empresa B2B', 'vrutal', 10),
  ('icp', 'tamano_empresa', 'Menos de 50 empleados', 'vrutal', 20),
  ('icp', 'facturacion',    'Menos de 40 M€ anuales', 'vrutal', 30),
  ('icp', 'sector',         'Todos: el problema es estructural, no sectorial', 'vrutal', 40),
  ('icp', 'rol_comprador',  'CEO, propietario o fundador, no técnico y sin tiempo', 'vrutal', 50),
  ('icp', 'idioma',         'es', 'vrutal', 61),
  ('icp', 'idioma',         'en', 'vrutal', 62),
  ('icp', 'dolor',          'Mal clima laboral y rotación de personas', 'vrutal', 71),
  ('icp', 'dolor',          'Estrés y agotamiento del equipo por la carga de trabajo', 'vrutal', 72),
  ('icp', 'dolor',          'Tareas repetitivas que consumen horas de personas caras de reemplazar', 'vrutal', 73),
  ('icp', 'dolor',          'Burocracia y papeleo interno que frena a la empresa', 'vrutal', 74),
  ('icp', 'dolor',          'Baja productividad: el equipo no llega a todo', 'vrutal', 75),
  ('icp', 'miedo',          'Miedo a que la IA sustituya a las personas del equipo', 'vrutal', 81),
  ('icp', 'miedo',          'Riesgos de la IA: seguridad, privacidad de datos y errores', 'vrutal', 82),
  ('icp', 'miedo',          'Miedo a gastar en tecnología que luego no funciona', 'vrutal', 83),
  ('icp', 'no_encaja',      'Quien quiere implementar IA como proyecto de innovación sin un problema operativo detrás', 'vrutal', 90)
on conflict (input_key, field_key, value) do nothing;

-- 7. PENDIENTE DE CARGA (no se inventa el contenido de una pestaña: lo pega el staff tal cual está hoy
--    en la hoja «Vrutal-labs · Marketing», pestañas «Marca» y «Objetivos», antes de migrar F13, F7 y F1).
--
--    insert into public.mkt_input_value (input_key, field_key, value, source, position) values
--      ('brand_voice', 'voz',         '<una fila por rasgo de voz>',      'vrutal', 11),
--      ('brand_voice', 'diccionario', '<decimos X, no Y>',                'vrutal', 21),
--      ('brand_voice', 'prohibidos',  '<palabra>',                        'vrutal', 31)
--    on conflict (input_key, field_key, value) do nothing;
--
--    insert into public.mkt_channel_target (channel, metric, target, period, source) values
--      ('seo', '<metrica>', '<objetivo>', 'mensual', 'vrutal')
--    on conflict do nothing;

-- ---------------------------------------------------------------------
-- Para revertir (en orden inverso de dependencias):
--   drop table public.mkt_channel_target;
--   drop trigger if exists mkt_input_value_guard on public.mkt_input_value;
--   drop table public.mkt_input_value;
--   drop table public.mkt_input_field;
--   drop function public.mkt_input_value_guard();
-- ---------------------------------------------------------------------
