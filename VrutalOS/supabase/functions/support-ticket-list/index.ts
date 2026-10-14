// Edge Function: el Admin ve sus tickets, o el hilo completo de uno.
//
// 1. Comprueba con el JWT de quien llama que es Admin ACTIVO (is_admin()).
// 2. Reenvía a Vrutal1st (ticket-query), autenticado con el token de esta instancia
//    (X-Vrutal-Token) — el ticket vive centralizado en Vrutal1st, no en esta base.
//
// Secrets requeridos: APP_ORIGINS, TENANT_ID, VRUTAL1ST_FUNCTIONS_BASE_URL,
// VRUTAL1ST_PUSH_TOKEN (los mismos que ya usa support-ticket-send/integration-social-notify).
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
  const tenantId = Deno.env.get('TENANT_ID');
  const baseUrl = Deno.env.get('VRUTAL1ST_FUNCTIONS_BASE_URL');
  const pushToken = Deno.env.get('VRUTAL1ST_PUSH_TOKEN');
  if (!url || !anonKey || !tenantId || !baseUrl || !pushToken) {
    return reply(500, { error: 'Función mal configurada' }, origin);
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: permError } = await caller.rpc('is_admin');
  if (permError || isAdmin !== true) {
    return reply(403, { error: 'Solo un administrador puede ver los tickets' }, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);
  const { ticket_id, status, before } = body as Record<string, unknown>;

  let vrutal1stRes: Response;
  try {
    vrutal1stRes = await fetch(`${baseUrl}/ticket-query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vrutal-Token': pushToken },
      body: JSON.stringify({
        tenant_id: tenantId,
        ticket_id: typeof ticket_id === 'string' ? ticket_id : undefined,
        status: typeof status === 'string' ? status : undefined,
        before: typeof before === 'string' ? before : undefined,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return reply(502, { error: 'No se ha podido contactar con Vrutal. Inténtalo de nuevo en un momento.' }, origin);
  }

  const resBody: unknown = await vrutal1stRes.json().catch(() => null);
  if (!vrutal1stRes.ok) {
    const msg = (resBody as Record<string, unknown> | null)?.error;
    return reply(422, { error: typeof msg === 'string' ? msg : 'No se han podido leer los tickets.' }, origin);
  }

  return reply(200, (resBody as Record<string, unknown>) ?? {}, origin);
});
