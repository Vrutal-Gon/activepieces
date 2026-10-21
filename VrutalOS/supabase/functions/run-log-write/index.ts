// Edge Function: un flujo de Activepieces deja rastro de su ejecución.
//
// Sustituye al paso «Deja rastro», que escribía una fila en la pestaña Rastro de Google
// Sheets (contrato RunRecord: fecha · flujo · tarea · resultado · detalle). Ahora entra en
// `run_log`, que ya existía para el consumo y que el cambio 2026-10-16_run_log_rastro amplió
// con flow_key, outcome, detail y run_ref.
//
// Lo que NO se guarda aquí: el contenido de entradas o salidas. El rastro dice qué pasó y
// dónde mirar, no repite el trabajo. `detail` está limitado a 300 caracteres en la base.
//
// Hay una clave foránea (specialist_id, task_key) -> catalog_flow_ro: si el flujo no está
// contratado para ese especialista, el insert falla. Es deliberado: no se registra trabajo
// que nadie contrató. Por eso un 409 con el motivo en vez de un 500 opaco.
//
// 2026-10-19: acepta tokens y coste. Llegó con el cambio de F4, que dejó de usar la pieza de
// Claude y llama a la API por HTTP: esa respuesta sí trae `usage`, así que la pantalla Consumo
// puede enseñar gasto real en vez de ceros. Un flujo que no pase por un LLM los deja vacíos.
//
// Secrets requeridos: AP_INTEGRATION_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const RESULTADOS = ['ok', 'error', 'rejected'];
const MAX_DETALLE = 300; // el mismo techo que el CHECK de la tabla

// Un número que llega como texto desde una plantilla de flujo sigue siendo un número; una
// cadena vacía o algo que no lo sea se guarda como NULL, no como 0: 0 sería mentir.
const numero = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

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

  const {
    job_role_key: jobRoleKey,
    task_key: taskKey,
    flow_key: flowKey,
    outcome,
    detail,
    provider,
    model_name: modelName,
    run_ref: runRef,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
  } = body as Record<string, unknown>;

  if (typeof jobRoleKey !== 'string' || jobRoleKey.trim() === '') return json({ error: 'Falta job_role_key' }, 400);
  if (typeof taskKey !== 'string' || taskKey.trim() === '') return json({ error: 'Falta task_key' }, 400);
  if (typeof outcome !== 'string' || !RESULTADOS.includes(outcome)) {
    return json({ error: `outcome tiene que ser uno de: ${RESULTADOS.join(', ')}` }, 400);
  }
  if (flowKey !== undefined && flowKey !== null && typeof flowKey !== 'string') {
    return json({ error: 'flow_key tiene que ser texto' }, 400);
  }
  if (detail !== undefined && detail !== null && typeof detail !== 'string') {
    return json({ error: 'detail tiene que ser texto' }, 400);
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

  const { error: insertError } = await admin.from('run_log').insert({
    specialist_id: specialist.id,
    task_key: taskKey,
    flow_key: typeof flowKey === 'string' ? flowKey : null,
    outcome,
    detail: typeof detail === 'string' ? detail.slice(0, MAX_DETALLE) : null,
    provider: typeof provider === 'string' ? provider : null,
    model_name: typeof modelName === 'string' ? modelName : null,
    run_ref: typeof runRef === 'string' ? runRef : null,
    tokens_in: numero(tokensIn),
    tokens_out: numero(tokensOut),
    cost_usd: numero(costUsd),
  });

  if (insertError) {
    // 23503 = la pareja (especialista, tarea) no está en catalog_flow_ro: el flujo corre sin
    // estar contratado, o el sync todavía no ha bajado el cambio.
    if (insertError.code === '23503') {
      return json({ error: `La tarea ${taskKey} no está contratada para ${jobRoleKey} en esta cuenta` }, 409);
    }
    return json({ error: 'No se ha podido dejar rastro' }, 500);
  }

  return json({ ok: true });
});
