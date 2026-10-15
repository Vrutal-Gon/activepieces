-- =====================================================================
-- Proyecto Supabase: VrutalOS del CLIENTE — uno por cliente, aplicar en EL SUYO.
-- NO en Vrutal 1st (apmhvqlvwjcrwfaixgju): ese es el panel de control, otro proyecto.
-- PRUEBA EN SECO de 2026-10-15_dominio_correo.sql
-- Pegar entera en el SQL Editor del proyecto de cliente y ejecutar.
-- Prueba el guard YA APLICADO y TERMINA CON UN ERROR A PROPÓSITO, así que Postgres
-- revierte todo: no queda ninguna cuenta de prueba ni ningún dominio añadido.
-- El resultado es el texto del error «RESULTADO DRY-RUN …».
--
-- Requiere `2026-10-15_dominio_correo.sql` ya aplicada.
--
-- Qué se prueba: que bloquea las tres vías (alta, cambio de correo y SOLICITUD de cambio)
-- y que no estorba a un update que no toca el correo.
-- =====================================================================
do $do$
declare
  r text := '';
  v_id uuid;
  v_dominio text;
begin
  select domain into v_dominio from public.allowed_email_domain limit 1;
  if v_dominio is null then
    raise exception 'RESULTADO DRY-RUN: la lista de dominios esta VACIA, asi que no bloquea nada. Poblala primero.';
  end if;
  r := r || format('dominio de prueba: %s | ', v_dominio);

  -- 1. Alta con dominio permitido: pasa
  begin
    insert into auth.users (email) values ('dry-run-ok@' || v_dominio) returning id into v_id;
    r := r || '1) alta con dominio permitido: pasa (esperado pasa) | ';
  exception when others then
    r := r || '1) alta con dominio permitido: BLOQUEADA (MAL) | ';
  end;

  -- 2. Alta con dominio no permitido: bloquea
  begin
    insert into auth.users (email) values ('dry-run@gmail.com');
    r := r || '2) alta con gmail: PASA (MAL) | ';
  exception when insufficient_privilege then
    r := r || '2) alta con gmail: bloqueada (esperado bloqueada) | ';
  end;

  -- 3. Cambio de correo a dominio no permitido: bloquea
  if v_id is not null then
    begin
      update auth.users set email = 'fuga@gmail.com' where id = v_id;
      r := r || '3) cambio a gmail: PASA (MAL) | ';
    exception when insufficient_privilege then
      r := r || '3) cambio a gmail: bloqueado (esperado bloqueado) | ';
    end;

    -- 4. SOLICITUD de cambio (email_change), que es la via real de Supabase
    begin
      update auth.users set email_change = 'fuga@gmail.com' where id = v_id;
      r := r || '4) solicitud de cambio a gmail: PASA (MAL) | ';
    exception when insufficient_privilege then
      r := r || '4) solicitud de cambio a gmail: bloqueada (esperado bloqueada) | ';
    end;

    -- 5. Un update que no toca el correo: no estorba
    begin
      update auth.users set raw_user_meta_data = '{"dry_run":true}'::jsonb where id = v_id;
      r := r || '5) update ajeno al correo: pasa (esperado pasa)';
    exception when others then
      r := r || '5) update ajeno al correo: BLOQUEADO (MAL)';
    end;
  end if;

  raise exception 'RESULTADO DRY-RUN (todo revertido): %', r;
end $do$;
