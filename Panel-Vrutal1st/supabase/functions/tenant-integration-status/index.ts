// Edge Function: una instancia de cliente avisa del estado de una de sus integraciones
// sociales (Postiz). Llamada de servidor a servidor — nunca desde un navegador, nunca
// con la sesión de un usuario de Vrutal1st.
//
// 1. Exige la cabecera X-Vrutal-Token (el secreto por instancia, lo entrega
//    staff_rotate_tenant_push_token una sola vez, al dar de alta la instancia).
// 2. social_integration_report() valida ese token él mismo contra tenant_instance
//    y, solo si coincide, hace el upsert en deployment.tenant_integration.
// 3. No se guarda nunca ninguna credencial del proyecto del cliente — solo el estado
//    (system, status). Si el token no coincide, falla igual para cualquier tenant_id
//    (no se distingue "tenant no existe" de "token incorrecto": no da pistas).
//
// Secret requerido: ninguno propio — usa SUPABASE_SERVICE_ROLE_KEY (siempre disponible
// en toda Edge Function de Supabase) para llamar a la función, que valida por su cuenta.
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
  const { tenant_id, system, status } = body as Record<string, unknown>;
  if (typeof tenant_id !== 'string' || !UUID_RE.test(tenant_id)) {
    return reply(400, { error: 'tenant_id no válido' });
  }
  if (typeof system !== 'string' || system.length === 0 || system.length > 64) {
    return reply(400, { error: 'system no válido' });
  }
  if (status !== 'connected' && status !== 'paused' && status !== 'revoked') {
    return reply(400, { error: 'status no válido' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.rpc('social_integration_report', {
    p_tenant_id: tenant_id,
    p_token: token,
    p_system: system,
    p_status: status,
  });
  // Un solo mensaje para "token incorrecto" y "tenant_id no existe": no da pistas.
  if (error) return reply(401, { error: 'No autorizado' });

  return new Response(null, { status: 204 });
});
