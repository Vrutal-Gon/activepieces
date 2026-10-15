-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · El dominio de correo se cierra en la base
--
-- Paga la deuda «cerrar el dominio de correo de verdad (antes del primer cliente)» del README
-- de esta carpeta.
--
-- Hasta hoy la regla «solo dominios que fija Vrutal» vivía SOLO en la Edge Function
-- `team-invite`, con la lista en el secret `ALLOWED_EMAIL_DOMAINS`. Eso cubre la invitación,
-- pero no el después: un usuario ya dentro podía **cambiarse el correo** a otro dominio desde
-- Auth y seguir con su sesión y sus permisos. La regla tiene que estar donde está el dato.
--
-- POR QUÉ NO SE EXIME A VRUTAL CON `auth.uid() is null`, aunque sea el patrón que usan
-- `guard_profile_is_active` y `guard_integration_status`: aquí no funcionaría. Un cambio de
-- correo lo ejecuta **GoTrue** (el servidor de Auth de Supabase) con su propia conexión, como
-- `supabase_auth_admin` y SIN claims de JWT, así que `auth.uid()` es NULL justo en el caso que
-- queremos bloquear. Un exento por sesión dejaría pasar precisamente el agujero. Se aplica
-- siempre, a todo el mundo, y eso además es lo correcto: las cuentas que crea Vrutal también
-- deben estar en un dominio permitido.
--
-- TABLA VACÍA = SE PERMITE TODO, a propósito. Es la escapatoria de arranque: un proyecto
-- recién creado no tiene dominios configurados todavía y hay que poder crear su primer Admin.
-- La contrapartida es que «olvidarse de configurarla» equivale a no tener protección, así que
-- poblarla es parte del alta (ver el README y la comprobación final del script).
--
-- SE COMPRUEBAN `email` Y `email_change`. Supabase no cambia el correo de golpe: guarda el
-- nuevo en `email_change` y lo pasa a `email` cuando el usuario confirma. Mirar solo `email`
-- dejaría aceptar la solicitud y fallar al confirmarla, con el usuario ya avisado de que
-- funcionó. Se rechaza en la solicitud.
--
-- EFECTO VISIBLE: al bloquear, la excepción sale desde dentro del flujo de Auth, así que el
-- usuario ve un error genérico, no «ese dominio no está permitido». Decidido con el founder el
-- 2026-10-15: se prefiere cerrarlo de verdad y dar un mensaje pobre antes que dejar la puerta
-- abierta con buen mensaje.
--
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 1 · La lista. La fija Vrutal; el cliente no la lee ni la toca.
create table if not exists public.allowed_email_domain (
  domain    text primary key,
  added_at  timestamptz not null default now(),
  note      text,
  constraint allowed_email_domain_formato check (
    domain = lower(domain) and domain not like '%@%' and position('.' in domain) > 1
  )
);

comment on table public.allowed_email_domain is
  'Dominios de correo permitidos en esta instancia. La fija Vrutal. VACIA = se permite todo '
  '(escapatoria de arranque): poblarla es parte del alta del cliente.';

alter table public.allowed_email_domain enable row level security;
revoke all on public.allowed_email_domain from anon, authenticated;
grant all on public.allowed_email_domain to service_role;

-- 2 · La comprobación, en un solo sitio.
create or replace function public.email_domain_allowed(p_email text)
 returns boolean language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    -- Sin lista configurada, no se bloquea nada (arranque).
    not exists (select 1 from public.allowed_email_domain)
    or exists (
      select 1 from public.allowed_email_domain d
       where d.domain = lower(split_part(coalesce(p_email, ''), '@', 2))
    )
$function$;

-- 3 · El guard sobre auth.users.
create or replace function public.guard_email_domain()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if tg_op = 'INSERT' then
    if not public.email_domain_allowed(new.email) then
      raise exception 'Dominio de correo no permitido: %', split_part(coalesce(new.email,''), '@', 2)
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- El correo ya confirmado.
  if new.email is distinct from old.email
     and not public.email_domain_allowed(new.email) then
    raise exception 'Dominio de correo no permitido: %', split_part(coalesce(new.email,''), '@', 2)
      using errcode = '42501';
  end if;

  -- La solicitud de cambio, antes de confirmarse.
  if new.email_change is distinct from old.email_change
     and coalesce(new.email_change, '') <> ''
     and not public.email_domain_allowed(new.email_change) then
    raise exception 'Dominio de correo no permitido: %', split_part(new.email_change, '@', 2)
      using errcode = '42501';
  end if;

  return new;
end $function$;

drop trigger if exists trg_guard_email_domain on auth.users;
create trigger trg_guard_email_domain
  before insert or update on auth.users
  for each row execute function public.guard_email_domain();

-- 4 · Avisar si ya hay cuentas que no cumplen.
-- Este cambio NO expulsa a nadie: solo impide cambios futuros. Si un cliente ya tiene una
-- cuenta en un dominio que no está en la lista, sigue entrando. Hay que verlo, no suponerlo.
do $$
declare
  v_malas text;
begin
  if not exists (select 1 from public.allowed_email_domain) then
    raise notice 'Lista de dominios VACIA: no se bloquea nada todavia. Poblarla es parte del alta.';
    return;
  end if;

  select string_agg(u.email, ', ')
    into v_malas
  from auth.users u
  where not public.email_domain_allowed(u.email);

  if v_malas is null then
    raise notice 'Todas las cuentas existentes cumplen la lista de dominios.';
  else
    raise warning 'CUENTAS QUE NO CUMPLEN (siguen entrando, este cambio no expulsa a nadie): %', v_malas;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- QUÉ HAY QUE HACER DESPUÉS, EN CADA CLIENTE
--   insert into public.allowed_email_domain (domain, note)
--   values ('empresadelcliente.com', 'Dominio corporativo del cliente');
--
-- Y retirar la lista del secret `ALLOWED_EMAIL_DOMAINS` de `team-invite` cuando la función
-- pase a leer esta tabla, para no tener dos fuentes de verdad.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- Para revertir:
--   drop trigger if exists trg_guard_email_domain on auth.users;
--   drop function if exists public.guard_email_domain();
--   drop function if exists public.email_domain_allowed(text);
--   drop table if exists public.allowed_email_domain;
--   (volvería a dejar que un usuario ya dentro se cambie el correo a cualquier dominio)
-- ---------------------------------------------------------------------
