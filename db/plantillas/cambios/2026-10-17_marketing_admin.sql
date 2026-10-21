-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · Rol «Admin de Marketing» y el scope de negocio
--
-- QUÉ RESUELVE. Los flujos de Marketing necesitan información que solo el cliente tiene: su perfil
-- e ICP, su voz de marca, a quién considera competencia, su estrategia, sus productos foco y sus
-- objetivos por canal. Hasta ahora eso vivía en pestañas de Google Sheets escritas por Vrutal.
-- Este cambio crea las tablas que faltaban y el rol que las completa.
--
-- EL ROL (decidido 2026-10-17). `client_manager` se renombra a `client_marketing_admin`.
-- No es un rol nuevo: es el mismo hueco con el nombre honesto. El Manager se creó el 2026-10-06
-- justo «para leer y editar el perfil de empresa que alimenta a los flujos», nunca se usó, no lo
-- nombra ninguna política y **no hay ni una cuenta con ese rol** (comprobado contra la base viva:
-- 1 perfil, `client_admin`). Renombrar hoy no cuesta nada; con cuentas dentro, sí. Y deja sitio a
-- `client_sales_admin` cuando llegue Ventas.
--
-- QUÉ PUEDE HACER:
--   · Completar y mantener el scope de negocio: las seis tablas de abajo.
--   · Ver los entregables y aprobar o rechazar propuestas (keywords, briefs) de los especialistas a
--     los que el Admin le haya dado acceso. Eso ya funciona sin tocar nada: `can_access_specialist()`
--     mira `user_specialist_access`, y `decide_work_items()` se apoya en ella.
--   · NADA de equipo, integraciones, facturación ni consumo: eso sigue siendo solo del Admin.
--
-- VRUTAL ESCRIBE, EL CLIENTE COMPLEMENTA (decidido 2026-10-17). Cada tabla del scope tiene `source`
-- ('vrutal' | 'cliente'). Las filas de Vrutal —lo que sale de la auditoría del panel— son de SOLO
-- LECTURA para el cliente: sus políticas de escritura solo alcanzan `source = 'cliente'`. Así lo que
-- escribe el cliente complementa la auditoría y nunca la machaca. Es la alternativa barata a partir
-- cada tabla en dos (`audit_*` / `client_*`), que era la otra opción del README de `cambios/`.
--
-- LA LISTA CERRADA SIGUE MANDANDO. Perfil, marca y estrategia son campo/valor contra
-- `mkt_input_field`: el cliente rellena valores de campos que define Vrutal, no inventa campos. Un
-- prompt estándar solo puede leer campos estructurados; el texto libre es el nivel «a medida».
--
-- CONTRATO CON LOS FLUJOS: la Edge Function `flow-input-read` sirve estos orígenes:
--   'icp' | 'brand_voice' | 'strategy'  -> [{ field_key, value, position }]
--   'channel_target'                    -> [{ channel, metric, target, period }]
--   'competitor'                        -> [{ name, website, notes }]
--   'focus_product'                     -> [{ name, description, price_note, priority }]
-- Competencia es una ENTRADA (a quién mirar, lo dice el cliente); la ficha observada de cada
-- competidor es una SALIDA de MKT-F5 y vive en `work_item`, no aquí. No confundirlas.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 0. Guarda: si alguien tuviera el rol viejo, este cambio PARA en vez de dejarlo huérfano.
do $$
declare n int;
begin
  select count(*) into n from public.profiles where role = 'client_manager';
  if n > 0 then
    raise exception 'Hay % cuenta(s) con rol client_manager: pásalas a client_marketing_admin antes de aplicar este cambio.', n;
  end if;
end $$;

-- 1. El nombre del rol.
--    OJO: estas dos sentencias son las únicas que exigen DROP CONSTRAINT. Si se aplica por MCP, el
--    permiso automático las bloquea («Modify Shared Resources») y hay que pasarlas por el SQL Editor.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add  constraint profiles_role_check
  check (role = any (array['client_admin'::text, 'client_marketing_admin'::text, 'client_user'::text]));

-- 2. Quién es quién. `is_marketing_admin()` es la que hay que usar en lo nuevo.
create or replace function public.is_marketing_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select coalesce(public.my_role() = 'client_marketing_admin', false)
$f$;

create or replace function public.is_admin_or_marketing()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select coalesce(public.my_role() in ('client_admin', 'client_marketing_admin'), false)
$f$;

-- Envoltorios heredados: `is_manager()` e `is_admin_or_manager()` se quedan con el nombre viejo para
-- no reescribir de golpe nada que las llame, pero ya preguntan por el rol nuevo. No usar en lo nuevo.
create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select public.is_marketing_admin()
$f$;

create or replace function public.is_admin_or_manager()
returns boolean
language sql stable security definer set search_path = public, pg_temp as $f$
  select public.is_admin_or_marketing()
$f$;

revoke all on function public.is_marketing_admin()   from public, anon;
revoke all on function public.is_admin_or_marketing() from public, anon;
grant execute on function public.is_marketing_admin()   to authenticated, service_role;
grant execute on function public.is_admin_or_marketing() to authenticated, service_role;

-- 3. El trigger que crea el perfil tiene que conocer el rol nuevo, o invitar a un Admin de Marketing
--    lo crearía como Usuario normal y en silencio (ese bug ya pasó con el Manager el 2026-10-15).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $f$
declare
  v_role text;
  v_full_name text;
begin
  v_role := new.raw_app_meta_data ->> 'role';
  v_full_name := new.raw_user_meta_data ->> 'full_name';

  insert into public.profiles (id, role, full_name)
    values (
      new.id,
      case when v_role in ('client_admin', 'client_marketing_admin', 'client_user') then v_role else 'client_user' end,
      v_full_name
    );
  return new;
end $f$;

-- 4. Estrategia: otro bloque de campo/valor, con su lista cerrada.
--    OJO: el `drop constraint` de abajo es la otra sentencia que el permiso automático bloquea.
alter table public.mkt_input_field drop constraint mkt_input_field_input_key_check;
alter table public.mkt_input_field add  constraint mkt_input_field_input_key_check
  check (input_key in ('icp', 'brand_voice', 'strategy'));

insert into public.mkt_input_field (input_key, field_key, label, multi, position, help) values
  ('strategy', 'posicionamiento',   'Posicionamiento',            false, 10, 'En una frase: qué somos y para quién'),
  ('strategy', 'propuesta_valor',   'Propuesta de valor',         true,  20, 'Una por fila'),
  ('strategy', 'diferenciador',     'Diferenciadores',            true,  30, 'Frente a la competencia'),
  ('strategy', 'estrategia_precio', 'Estrategia de precio',       false, 40, null),
  ('strategy', 'foco_sem',          'Foco de SEM',                true,  50, 'Dónde se pone el presupuesto de pago'),
  ('strategy', 'canal_prioritario', 'Canales prioritarios',       true,  60, null)
on conflict (input_key, field_key) do nothing;

-- 5. Competencia: a quién mira el cliente. La ficha observada la produce MKT-F5 en work_item.
create table if not exists public.mkt_competitor (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 120),
  website    text check (website is null or website ~* '^https?://'),
  notes      text check (notes is null or length(notes) <= 500),
  priority   int  not null default 0,
  source     text not null default 'vrutal' check (source in ('vrutal', 'cliente')),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) default auth.uid(),
  unique (name)
);

-- 6. Productos foco: qué se empuja y en qué orden.
create table if not exists public.mkt_focus_product (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 120),
  description text check (description is null or length(description) <= 500),
  price_note  text check (price_note is null or length(price_note) <= 120),
  priority    int  not null default 0,
  status      text not null default 'activo' check (status in ('activo', 'pausado')),
  source      text not null default 'vrutal' check (source in ('vrutal', 'cliente')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) default auth.uid(),
  unique (name)
);

create index if not exists mkt_competitor_priority_idx    on public.mkt_competitor (priority, name);
create index if not exists mkt_focus_product_priority_idx on public.mkt_focus_product (status, priority, name);

-- Quien escriba desde la app queda registrado sin que la pantalla tenga que acordarse.
alter table public.mkt_input_value    alter column updated_by set default auth.uid();
alter table public.mkt_channel_target alter column updated_by set default auth.uid();

alter table public.mkt_competitor    enable row level security;
alter table public.mkt_focus_product enable row level security;

-- 7. Políticas. Leer: cualquier usuario activo (es el negocio de SU empresa).
--    Escribir: solo el Admin de Marketing (o el Admin), y solo filas `source = 'cliente'`.
--    Sin ningún DROP: se crea lo que falte. `active_only` es obligatoria en cada tabla nueva.
do $$
declare
  t text;
begin
  foreach t in array array['mkt_competitor', 'mkt_focus_product'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_select') then
      execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'active_only') then
      execute format('create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active_user())', t);
    end if;
  end loop;

  foreach t in array array['mkt_input_value', 'mkt_channel_target', 'mkt_competitor', 'mkt_focus_product'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_cliente_insert') then
      execute format($q$create policy %I on public.%I for insert to authenticated
                       with check (public.is_admin_or_marketing() and source = 'cliente')$q$, t || '_cliente_insert', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_cliente_update') then
      execute format($q$create policy %I on public.%I for update to authenticated
                       using (public.is_admin_or_marketing() and source = 'cliente')
                       with check (public.is_admin_or_marketing() and source = 'cliente')$q$, t || '_cliente_update', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_cliente_delete') then
      execute format($q$create policy %I on public.%I for delete to authenticated
                       using (public.is_admin_or_marketing() and source = 'cliente')$q$, t || '_cliente_delete', t);
    end if;
  end loop;
end $$;

-- 8. Permisos de tabla. Sin GRANT la política ni se evalúa; y las tablas nuevas nacen con
--    TRUNCATE/REFERENCES/TRIGGER regalados a anon y authenticated: se retiran.
revoke all on public.mkt_competitor, public.mkt_focus_product from anon, authenticated;
grant select on public.mkt_competitor, public.mkt_focus_product to authenticated;
grant insert, update, delete on public.mkt_competitor, public.mkt_focus_product to authenticated;
grant all on public.mkt_competitor, public.mkt_focus_product to service_role;

-- Las dos tablas del cambio anterior pasan de solo lectura a escribibles por el rol nuevo.
-- El filtro por `source` lo hace la política, no el GRANT.
grant insert, update, delete on public.mkt_input_value, public.mkt_channel_target to authenticated;

-- `mkt_input_field` es la lista cerrada: la define Vrutal y el cliente NO la toca. Solo lectura.

-- ---------------------------------------------------------------------
-- Para revertir (en orden inverso):
--   revoke insert, update, delete on public.mkt_input_value, public.mkt_channel_target from authenticated;
--   drop table public.mkt_focus_product;
--   drop table public.mkt_competitor;
--   delete from public.mkt_input_field where input_key = 'strategy';
--   alter table public.mkt_input_field drop constraint mkt_input_field_input_key_check;
--   alter table public.mkt_input_field add  constraint mkt_input_field_input_key_check
--     check (input_key in ('icp', 'brand_voice'));
--   -- is_manager() / is_admin_or_manager() vuelven a mirar 'client_manager'; handle_new_user, igual.
--   drop function public.is_admin_or_marketing();
--   drop function public.is_marketing_admin();
--   alter table public.profiles drop constraint profiles_role_check;
--   alter table public.profiles add  constraint profiles_role_check
--     check (role = any (array['client_admin'::text, 'client_manager'::text, 'client_user'::text]));
-- ---------------------------------------------------------------------
