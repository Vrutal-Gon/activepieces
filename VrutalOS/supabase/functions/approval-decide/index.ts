// Edge Function: el cliente aprueba o rechaza desde su pantalla Aprobaciones, y eso REANUDA
// el flujo de Activepieces que estaba esperando.
//
// Por qué no lo hace el navegador directamente: el enlace que reanuda el flujo
// (`approval_requests.resume_url`) no tiene permiso de lectura para `authenticated` — igual
// que `integrations.secret_ref`. Si el navegador pudiera leerlo, cualquiera con sesión podría
// reanudar un flujo sin decidir nada, saltándose la aprobación. Por eso el enlace se queda en
// el servidor y es esta función quien lo llama.
//
// Orden deliberado: primero se REGISTRA la decisión (`decide_approval`, que fija `decided_by`
// y `decided_at` en servidor) y solo después se reanuda el flujo. Si se hiciera al revés, un
// fallo al registrar dejaría el flujo andando sin rastro de quién lo autorizó.
//
// Deuda declarada: si la decisión se registra pero la reanudación falla (Activepieces caído,
// pausa ya caducada), se devuelve 502 y el flujo se queda parado. La decisión NO se deshace
// —es el rastro de auditoría y es correcta— pero no hay reintento automático: `decide_approval`
// solo actúa sobre una aprobación `pending`, así que volver a pulsar no reanuda. Hace falta
// relanzar el flujo a mano. Se acepta a propósito: el caso es raro y la alternativa (dejar la
// aprobación pendiente tras haberla decidido) miente sobre lo que pasó.
//
// Quién puede decidir lo decide `decide_approval()` en servidor (admin, aprobación asignada o
// delegación vigente), no esta función.
//
// Secret requerido: APP_ORIGINS.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' }, origin);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: 'Origen no permitido' }, origin);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply(401, { error: 'Sin sesión' }, origin);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Función mal configurada' }, origin);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);

  const { approval_id: approvalId, approve, item_decisions: itemDecisions } = body as Record<string, unknown>;
  if (typeof approvalId !== 'string' || approvalId.trim() === '') {
    return reply(400, { error: 'Falta approval_id' }, origin);
  }
  if (typeof approve !== 'boolean') {
    return reply(400, { error: 'Falta approve' }, origin);
  }

  // 1. Registrar la decisión, evaluada como quien llama: la RPC comprueba el permiso.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: decided, error: decideError } = await caller.rpc('decide_approval', {
    p_id: approvalId,
    p_approve: approve,
    p_item_decisions: itemDecisions ?? null,
  });
  if (decideError) {
    const forbidden = decideError.code === '42501';
    return reply(forbidden ? 403 : 500, {
      error: forbidden ? 'No puedes decidir esta aprobación.' : 'No se ha podido registrar la decisión.',
    }, origin);
  }
  if (decided !== true) {
    // La RPC solo actúa sobre una aprobación `pending`: si no cambió nada, ya estaba decidida.
    return reply(409, { error: 'Esta aprobación ya estaba decidida.' }, origin);
  }

  // 2. Reanudar el flujo. El enlace no sale de aquí ni se registra en ningún log.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: row } = await admin
    .from('approval_requests')
    .select('resume_url')
    .eq('id', approvalId)
    .maybeSingle<{ resume_url: string | null }>();

  if (!row?.resume_url) {
    // Una aprobación creada a mano, o de antes de este cambio: no hay flujo que reanudar.
    // La decisión ya está registrada, así que es un éxito, no un error.
    return reply(200, { decided: true, resumed: false }, origin);
  }

  try {
    const res = await fetch(row.resume_url, { method: 'GET', signal: AbortSignal.timeout(15_000) });
    await res.body?.cancel();
    if (!res.ok) {
      return reply(502, {
        error: 'La decisión se ha guardado, pero el flujo no se ha podido reanudar. Avisa a Vrutal.',
        decided: true,
        resumed: false,
      }, origin);
    }
  } catch {
    return reply(502, {
      error: 'La decisión se ha guardado, pero no se ha podido contactar con el motor de flujos. Avisa a Vrutal.',
      decided: true,
      resumed: false,
    }, origin);
  }

  return reply(200, { decided: true, resumed: true }, origin);
});
