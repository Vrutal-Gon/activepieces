// Edge Function: una instancia de cliente lee sus tickets o el hilo de uno.
// Llamada de servidor a servidor — nunca desde un navegador, nunca con la sesión de
// un usuario de Vrutal1st. Mismo token X-Vrutal-Token que ticket-intake.
//
// Con ticket_id: hilo completo (ticket_get_messages). Sin ticket_id: lista paginada
// por cursor (ticket_list) — los tickets de ESE tenant_id solamente, nunca de otro.
//
// Secret requerido: ninguno propio — usa SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'jsr:@supabase/supabase-js@2';

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' });

  const token = req.headers.get('X-Vrutal-Token');
  if (!token) return reply(401, { error: 'Sin token' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return reply(500, { error: 'Función mal configurada' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' });
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' });
  const { tenant_id, ticket_id, status, before } = body as Record<string, unknown>;

  if (typeof tenant_id !== 'string' || !UUID_RE.test(tenant_id)) return reply(400, { error: 'tenant_id no válido' });
  if (ticket_id !== undefined && (typeof ticket_id !== 'string' || !UUID_RE.test(ticket_id))) {
    return reply(400, { error: 'ticket_id no válido' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (typeof ticket_id === 'string') {
    const { data, error } = await admin.rpc('ticket_get_messages', {
      p_tenant_id: tenant_id,
      p_token: token,
      p_ticket_id: ticket_id,
    });
    if (error) return reply(401, { error: 'No autorizado' });
    return reply(200, { messages: data });
  }

  if (status !== undefined && !['open', 'in_progress', 'resolved', 'closed'].includes(status as string)) {
    return reply(400, { error: 'status no válido' });
  }
  if (before !== undefined && (typeof before !== 'string' || Number.isNaN(Date.parse(before)))) {
    return reply(400, { error: 'before no válido' });
  }

  const { data, error } = await admin.rpc('ticket_list', {
    p_tenant_id: tenant_id,
    p_token: token,
    p_status: typeof status === 'string' ? status : null,
    p_before: typeof before === 'string' ? before : null,
  });
  if (error) return reply(401, { error: 'No autorizado' });

  return reply(200, { tickets: data });
});
