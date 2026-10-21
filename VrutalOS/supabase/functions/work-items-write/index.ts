// Edge Function: un flujo de Activepieces entrega filas de trabajo.
//
// Sustituye al paso «Escribir en la hoja» de Google Sheets: lo que el flujo escribía en una
// pestaña (Keywords, Briefs, Diagnóstico, Informes) ahora entra en `work_item`, que es lo que
// el cliente ve en «Su trabajo» y donde aprueba o rechaza las propuestas.
//
// No inserta directamente: llama a `work_items_add()`, que ya existía (cambio
// 2026-10-06_work_items), solo tiene permiso `service_role` y decide el estado inicial según
// `work_collection.approvable` — proposed si hay que aprobarlo, delivered si es informativo.
// Esta función es el puente, no una segunda implementación de la regla.
//
// Server-to-server, nunca desde un navegador: gate con X-AP-Token (AP_INTEGRATION_TOKEN),
// el mismo consumidor que approval-create.
//
// El flujo manda `job_role_key`, no un uuid: los uuid de `specialists` cambian por cliente.
//
// Secrets requeridos: AP_INTEGRATION_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const MAX_FILAS = 500; // el mismo techo que impone work_items_add()

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const expected = Deno.env.get('AP_INTEGRATION_TOKEN');
  if (!expected) return json({ error: 'Función mal configurada' }, 500);
  if (req.headers.get('X-AP-Token') !== expected) return json({ error: 'No autorizado' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Función mal configurada' }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo no válido' }, 400);
  }
  if (typeof body !== 'object' || body === null) return json({ error: 'Cuerpo no válido' }, 400);

  const { job_role_key: jobRoleKey, collection, rows, run_ref: runRef } = body as Record<string, unknown>;

  if (typeof jobRoleKey !== 'string' || jobRoleKey.trim() === '') {
    return json({ error: 'Falta job_role_key' }, 400);
  }
  if (typeof collection !== 'string' || collection.trim() === '') {
    return json({ error: 'Falta collection' }, 400);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    // Entregar cero filas no es un éxito silencioso: el flujo tenía que haber fallado antes.
    return json({ error: 'rows tiene que ser una lista con al menos una fila' }, 400);
  }
  if (rows.length > MAX_FILAS) {
    return json({ error: `Máximo ${MAX_FILAS} filas por llamada` }, 400);
  }
  if (rows.some((r) => typeof r !== 'object' || r === null || Array.isArray(r))) {
    return json({ error: 'Cada fila tiene que ser un objeto' }, 400);
  }
  if (runRef !== undefined && runRef !== null && typeof runRef !== 'string') {
    return json({ error: 'run_ref tiene que ser texto' }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: specialist, error: specialistError } = await admin
    .from('specialists')
    .select('id')
    .eq('job_role_key', jobRoleKey)
    .maybeSingle<{ id: string }>();
  if (specialistError) return json({ error: 'No se ha podido resolver el especialista' }, 500);
  if (!specialist) {
    return json({ error: `El especialista ${jobRoleKey} no está dado de alta en esta cuenta todavía` }, 409);
  }

  // Se valida contra las columnas declaradas de la colección: una fila con una clave que la
  // pestaña no dibuja se escribiría y no la vería nadie. Mejor decirlo que entregar a ciegas.
  const { data: col, error: colError } = await admin
    .from('work_collection')
    .select('columns')
    .eq('specialist_id', specialist.id)
    .eq('collection_key', collection)
    .maybeSingle<{ columns: Array<{ key: string }> }>();
  if (colError) return json({ error: 'No se ha podido resolver la colección' }, 500);
  if (!col) return json({ error: `La colección ${collection} no existe para ${jobRoleKey}` }, 409);

  const declaradas = new Set((col.columns ?? []).map((c) => c.key));
  const sobran = new Set<string>();
  for (const fila of rows as Array<Record<string, unknown>>) {
    for (const k of Object.keys(fila)) if (!declaradas.has(k)) sobran.add(k);
  }
  if (sobran.size > 0) {
    return json(
      { error: `Columnas que la colección ${collection} no declara: ${[...sobran].join(', ')}` },
      400,
    );
  }

  const { data: escritas, error: rpcError } = await admin.rpc('work_items_add', {
    p_specialist: specialist.id,
    p_collection: collection,
    p_rows: rows,
    p_run_ref: typeof runRef === 'string' ? runRef : null,
  });
  if (rpcError) return json({ error: 'No se ha podido entregar el trabajo' }, 500);

  return json({ collection, written: typeof escritas === 'number' ? escritas : Number(escritas) });
});
