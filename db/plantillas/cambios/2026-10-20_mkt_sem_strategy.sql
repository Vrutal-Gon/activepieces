-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- VRUTAL OS · Plano de datos del CLIENTE · ESTRATEGIA SEM (lista cerrada + vigencia)
--
-- QUÉ RESUELVE. El 2026-10-17 la estrategia entró como bloque de campo/valor, y «Foco de SEM»
-- (`strategy.foco_sem`, `multi`) quedó como TEXTO LIBRE: una fila por frase. Eso rompe dos cosas:
--   · La regla de la lista cerrada. Un prompt estándar solo puede leer campos estructurados que
--     define Vrutal; una frase libre del cliente alimentando un prompt estándar es nivel «a medida».
--   · La forma del dato. Una estrategia PPC no es una frase: es un OBJETIVO de una lista corta y
--     conocida, VIGENTE entre dos fechas, con un PRESUPUESTO, un MERCADO y un DESTINO. Y si el
--     objetivo es empujar un producto, hay que decir CUÁL — y ese producto ya existe en
--     `mkt_focus_product`, así que se apunta con una clave foránea, no repitiendo su nombre.
--
-- NO HAY MÉTRICA AQUÍ (decidido 2026-10-20). La métrica y el número a batir son `mkt_channel_target`
-- (bloque Objetivos), y ese bloque está EN ESPERA hasta que se opere de verdad: no se inventan
-- objetivos para probar. La estrategia dice QUÉ se persigue y CUÁNDO; el objetivo dirá CUÁNTO.
-- Meter la métrica en esta tabla sería tener dos sitios donde decir lo mismo.
--
-- LOS SEIS OBJETIVOS son los genéricos de PPC, no una taxonomía propia: crecimiento de marca,
-- generar leads, incrementar ROI, incrementar CTR, reducir CAC y empuje de producto. Lista cerrada
-- por `check`: ampliarla es un cambio de esquema, con su fecha y su razón.
--
-- SOLAPARSE ES LEGÍTIMO. Dos estrategias pueden estar vigentes a la vez (marca + leads). Lo único
-- que se impide es la fila repetida: mismo objetivo, misma fecha de inicio y mismo producto.
--
-- `foco_sem` SE RETIRA de `mkt_input_field`. Comprobado contra la base viva de Vrutal-labs el
-- 2026-10-20: el campo existe y tiene **cero valores**, así que la FK `on delete restrict` de
-- `mkt_input_value` no se interpone y no se pierde nada escrito por nadie. La guarda de abajo
-- vuelve a comprobarlo en cada proyecto: si hubiera valores, el cambio PARA en vez de borrarlos.
--
-- CONTRATO CON LOS FLUJOS: `flow-input-read` gana el origen `sem_strategy`, que devuelve
--   [{ objective, starts_on, ends_on, budget_monthly, currency, geo, landing_url, status, notes,
--      focus_product }]  — `focus_product` es el NOMBRE del producto, resuelto por la FK.
-- El origen `strategy` sigue sirviendo los campos de texto que quedan (posicionamiento, propuesta
-- de valor, diferenciadores, precio, canales prioritarios).
--
-- Ningún DROP: el permiso automático de la base los bloquea. Solo `create table if not exists`,
-- políticas condicionales y un `delete` de una fila de catálogo.
-- Aplicar en cada proyecto de cliente. Reversible: ver bloque al final.
-- =====================================================================

-- 0. Guarda: si alguien hubiera escrito un «Foco de SEM» en texto libre, este cambio PARA.
--    Lo escrito se migra a mano a la tabla nueva (o se decide tirarlo) antes de volver a aplicar.
do $$
declare n int;
begin
  select count(*) into n from public.mkt_input_value
   where input_key = 'strategy' and field_key = 'foco_sem';
  if n > 0 then
    raise exception 'Hay % valor(es) en strategy.foco_sem: pasalos a mkt_sem_strategy antes de aplicar este cambio.', n;
  end if;
end $$;

-- 1. La tabla. Una fila = una estrategia SEM vigente entre dos fechas.
create table if not exists public.mkt_sem_strategy (
  id               uuid primary key default gen_random_uuid(),
  objective        text not null check (objective in (
                     'crecimiento_marca',   -- notoriedad: que te conozcan
                     'generar_leads',       -- volumen de contactos cualificados
                     'incrementar_roi',     -- rentabilidad de lo que ya se gasta
                     'incrementar_ctr',     -- relevancia del anuncio
                     'reducir_cac',         -- bajar el coste de captar un cliente
                     'empuje_producto'      -- empujar un producto concreto
                   )),
  -- Vigencia. `ends_on` nulo = abierta, sin fecha de fin decidida.
  starts_on        date not null,
  ends_on          date,
  -- Presupuesto mensual. Sin presupuesto una estrategia PPC no se ejecuta ni se evalua, pero se
  -- admite nulo: el cliente puede fijar el rumbo antes que la cifra.
  budget_monthly   numeric(12,2) check (budget_monthly is null or budget_monthly > 0),
  currency         text not null default 'EUR' check (currency in ('EUR', 'USD', 'GBP')),
  -- Que producto se empuja. Apunta a `mkt_focus_product`: el nombre vive en un solo sitio.
  -- `on delete restrict`: borrar un producto empujado por una estrategia vigente falla a proposito.
  focus_product_id uuid references public.mkt_focus_product(id) on delete restrict,
  -- Mercado al que se sirve el anuncio, en el idioma del cliente: «España», «ES, PT, MX».
  geo              text check (geo is null or length(btrim(geo)) between 1 and 120),
  landing_url      text check (landing_url is null or landing_url ~* '^https?://'),
  status           text not null default 'planificada'
                     check (status in ('planificada', 'activa', 'pausada')),
  notes            text check (notes is null or length(notes) <= 500),
  source           text not null default 'vrutal' check (source in ('vrutal', 'cliente')),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) default auth.uid(),
  -- El rango va hacia delante: una estrategia no termina antes de empezar.
  constraint mkt_sem_strategy_rango_ok
    check (ends_on is null or ends_on >= starts_on),
  -- «Empuje de producto» sin producto no dice nada. Al reves si se permite: una estrategia de
  -- leads puede estar centrada en un producto sin dejar de ser de leads.
  constraint mkt_sem_strategy_producto_ok
    check (objective <> 'empuje_producto' or focus_product_id is not null)
);

-- Fila repetida, no. Solaparse en el tiempo, si (marca y leads a la vez es normal).
-- `coalesce` porque `focus_product_id` admite NULL y NULL nunca choca con NULL en un indice unico.
create unique index if not exists mkt_sem_strategy_unica_idx
  on public.mkt_sem_strategy (
    objective, starts_on, coalesce(focus_product_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- Lo que se lee siempre: las vigentes primero, y dentro de ellas las que empiezan antes.
create index if not exists mkt_sem_strategy_vigencia_idx
  on public.mkt_sem_strategy (status, starts_on desc, ends_on);

-- `updated_at` lo pone el servidor, no la pantalla.
create or replace function public.mkt_sem_strategy_touch()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $f$
begin
  new.updated_at := now();
  return new;
end $f$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'mkt_sem_strategy_touch'
       and tgrelid = 'public.mkt_sem_strategy'::regclass
  ) then
    create trigger mkt_sem_strategy_touch before insert or update on public.mkt_sem_strategy
      for each row execute function public.mkt_sem_strategy_touch();
  end if;
end $$;

revoke all on function public.mkt_sem_strategy_touch() from public, anon, authenticated;

-- 2. Seguridad por fila. Leer: cualquier usuario activo (es el negocio de SU empresa).
--    Escribir: solo el Admin de Marketing (o el Admin), y solo filas `source = 'cliente'`.
--    `active_only` es obligatoria en cada tabla nueva (regla 5 del README).
alter table public.mkt_sem_strategy enable row level security;

do $$
declare t text := 'mkt_sem_strategy';
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_select') then
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_user())', t || '_select', t);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'active_only') then
    execute format('create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active_user())', t);
  end if;
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
end $$;

-- 3. Permisos de tabla. Sin GRANT la politica ni se evalua; y una tabla nueva nace con
--    TRUNCATE/REFERENCES/TRIGGER/MAINTAIN regalados a anon y authenticated: se retiran.
revoke all on public.mkt_sem_strategy from anon, authenticated;
grant select, insert, update, delete on public.mkt_sem_strategy to authenticated;
grant all on public.mkt_sem_strategy to service_role;

-- 4. Se retira el campo de texto libre que esta tabla sustituye.
--    `delete`, no `drop`: es una fila de catalogo. La guarda del paso 0 ya aseguro que no tiene valores.
delete from public.mkt_input_field where input_key = 'strategy' and field_key = 'foco_sem';

-- ---------------------------------------------------------------------
-- Para revertir (en orden inverso):
--   insert into public.mkt_input_field (input_key, field_key, label, multi, position, help) values
--     ('strategy', 'foco_sem', 'Foco de SEM', true, 50, 'Donde se pone el presupuesto de pago')
--   on conflict (input_key, field_key) do nothing;
--   drop table public.mkt_sem_strategy;        -- se lleva sus indices, politicas y trigger
--   drop function public.mkt_sem_strategy_touch();
-- ---------------------------------------------------------------------
