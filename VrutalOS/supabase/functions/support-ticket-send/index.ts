// Edge Function: el Admin reporta un ticket nuevo o responde a uno existente.
//
// 1. Comprueba con el JWT de quien llama que es Admin ACTIVO (is_admin()).
// 2. Reenvía a Vrutal1st (ticket-intake), autenticado con el token de esta instancia
//    (X-Vrutal-Token) — el ticket vive centralizado en Vrutal1st, no en esta base
//    (decisión 2026-10-08: es una conversación con Vrutal sobre el servicio, no un
//    dato de negocio del cliente, no aplica el aislamiento por instancia).
// 3. El email de quien llama viaja como author_label — solo eso, nunca su JWT ni su id.
//
// Secrets requeridos: APP_ORIGINS, TENANT_ID, VRUTAL1ST_FUNCTIONS_BASE_URL,
// VRUTAL1ST_PUSH_TOKEN (los mismos tres últimos que ya usa integration-social-notify).
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
    return reply(403, { error: 'Solo un administrador puede reportar tickets' }, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);
  const { ticket_id, subject, body: message, priority } = body as Record<string, unknown>;
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 10_000) {
    return reply(400, { error: 'El mensaje no puede estar vacío' }, origin);
  }
  if (ticket_id === undefined && (typeof subject !== 'string' || subject.trim().length === 0 || subject.length > 254)) {
    return reply(400, { error: 'El asunto no puede estar vacío' }, origin);
  }

  const { data: userData } = await caller.auth.getUser();
  const authorLabel = userData.user?.email ?? userData.user?.id;
  if (!authorLabel) return reply(401, { error: 'Sin sesión' }, origin);

  let vrutal1stRes: Response;
  try {
    vrutal1stRes = await fetch(`${baseUrl}/ticket-intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vrutal-Token': pushToken },
      body: JSON.stringify({
        tenant_id: tenantId,
        ticket_id: typeof ticket_id === 'string' ? ticket_id : undefined,
        subject: typeof subject === 'string' ? subject : undefined,
        priority: typeof priority === 'string' ? priority : undefined,
        author_label: authorLabel,
        body: message,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return reply(502, { error: 'No se ha podido contactar con Vrutal. Inténtalo de nuevo en un momento.' }, origin);
  }

  const resBody: unknown = await vrutal1stRes.json().catch(() => null);
  if (!vrutal1stRes.ok) {
    const msg = (resBody as Record<string, unknown> | null)?.error;
    return reply(422, { error: typeof msg === 'string' ? msg : 'No se ha podido enviar el ticket.' }, origin);
  }

  return reply(vrutal1stRes.status === 204 ? 200 : 201, (resBody as Record<string, unknown>) ?? {}, origin);
});
