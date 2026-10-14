// Edge Function: una instancia de cliente crea un ticket o responde a uno existente.
// Llamada de servidor a servidor — nunca desde un navegador, nunca con la sesión de
// un usuario de Vrutal1st.
//
// Sin ticket_id: alta (ticket_create). Con ticket_id: respuesta del Admin (ticket_add_message).
// Ambas RPC validan X-Vrutal-Token ellas mismas contra tenant_instance.push_token (mismo
// secreto de 022, reusado como canal autenticado instancia↔Vrutal1st) — un solo mensaje de
// error tanto si el token no coincide como si el tenant_id no existe, para no dar pistas.
//
// Secret requerido: ninguno propio — usa SUPABASE_SERVICE_ROLE_KEY (siempre disponible en
// toda Edge Function de Supabase) para llamar a la función, que valida por su cuenta.
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
  const { tenant_id, ticket_id, subject, priority, author_label, body: message } = body as Record<string, unknown>;

  if (typeof tenant_id !== 'string' || !UUID_RE.test(tenant_id)) return reply(400, { error: 'tenant_id no válido' });
  if (typeof author_label !== 'string' || author_label.length === 0 || author_label.length > 254) {
    return reply(400, { error: 'author_label no válido' });
  }
  if (typeof message !== 'string' || message.trim().length === 0 || message.length > 10_000) {
    return reply(400, { error: 'body no válido' });
  }
  if (ticket_id !== undefined && (typeof ticket_id !== 'string' || !UUID_RE.test(ticket_id))) {
    return reply(400, { error: 'ticket_id no válido' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (typeof ticket_id === 'string') {
    const { error } = await admin.rpc('ticket_add_message', {
      p_tenant_id: tenant_id,
      p_token: token,
      p_ticket_id: ticket_id,
      p_author_label: author_label,
      p_body: message,
    });
    if (error) return reply(401, { error: 'No autorizado' });
    return new Response(null, { status: 204 });
  }

  if (typeof subject !== 'string' || subject.trim().length === 0 || subject.length > 254) {
    return reply(400, { error: 'subject no válido' });
  }
  const priorityValue = typeof priority === 'string' ? priority : 'normal';
  if (!['low', 'normal', 'high', 'urgent'].includes(priorityValue)) {
    return reply(400, { error: 'priority no válido' });
  }
  const { data, error } = await admin.rpc('ticket_create', {
    p_tenant_id: tenant_id,
    p_token: token,
    p_subject: subject,
    p_body: message,
    p_priority: priorityValue,
    p_author_label: author_label,
  });
  if (error) return reply(401, { error: 'No autorizado' });

  return reply(201, { id: data });
});
