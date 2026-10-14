// Edge Function: una instancia de cliente pide la API key de SU PROPIA instancia de Postiz.
// Llamada de servidor a servidor — nunca desde un navegador, nunca con la sesión de un
// usuario de Vrutal1st. La clave la puso el staff (staff_set_tenant_postiz_key); el cliente
// nunca la pega ni la ve — por eso este camino existe, en vez de que el cliente la gestione
// desde VrutalOS → Integraciones como hace con sus propias claves (HubSpot, Anthropic).
//
// Secret requerido: ninguno propio — usa SUPABASE_SERVICE_ROLE_KEY. social_get_postiz_key
// valida el X-Vrutal-Token él mismo contra tenant_instance.push_token (mismo canal que
// tenant-integration-status/ticket-intake/ticket-query).
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
  const { tenant_id } = body as Record<string, unknown>;
  if (typeof tenant_id !== 'string' || !UUID_RE.test(tenant_id)) {
    return reply(400, { error: 'tenant_id no válido' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: key, error } = await admin.rpc('social_get_postiz_key', { p_tenant_id: tenant_id, p_token: token });
  // Un solo mensaje para "token incorrecto" y "esta instancia no tiene clave todavía": no da pistas.
  if (error) return reply(401, { error: 'No autorizado' });

  return reply(200, { key });
});
