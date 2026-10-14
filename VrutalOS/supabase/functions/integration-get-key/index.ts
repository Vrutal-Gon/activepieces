// Edge Function: un flujo de Activepieces de esta misma instancia lee la clave de una
// integración — de dos sitios distintos según de quién es la clave:
//  - `hubspot`: clave que el Admin pegó en VrutalOS → Integraciones, vive en el Vault de
//    ESTE cliente (integration_read_secret, local).
//  - `postiz`: infraestructura que Vrutal provisiona, el cliente nunca la pega ni la ve
//    (migración 025) — vive en el Vault de VRUTAL1ST, se pide por servidor a servidor con
//    el token de esta instancia (mismo canal que integration-social-notify/support-ticket-*).
//
// Server-to-server, nunca desde un navegador: gate con X-AP-Token (secreto de esta
// instancia, distinto del token del webhook de cada flujo), no con sesión de usuario.
//
// Deliberadamente estrecha: solo deja leer los proveedores de la lista — nunca "cualquier
// integración guardada".
//
// Secrets requeridos: AP_INTEGRATION_TOKEN (cabecera X-AP-Token del paso HTTP que llama);
// para `postiz` además TENANT_ID, VRUTAL1ST_FUNCTIONS_BASE_URL, VRUTAL1ST_PUSH_TOKEN
// (los mismos que ya usa integration-social-notify).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const LOCAL_VAULT_PROVIDERS = new Set(['hubspot']);
const VRUTAL1ST_PROVIDERS = new Set(['postiz']);

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' });

  const token = req.headers.get('X-AP-Token');
  const expected = Deno.env.get('AP_INTEGRATION_TOKEN');
  if (!expected) return reply(500, { error: 'Función mal configurada' });
  if (!token || token !== expected) return reply(401, { error: 'No autorizado' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' });
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' });
  const { provider } = body as Record<string, unknown>;
  if (typeof provider !== 'string') return reply(400, { error: 'Proveedor no soportado' });

  if (LOCAL_VAULT_PROVIDERS.has(provider)) {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return reply(500, { error: 'Función mal configurada' });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: key, error } = await admin.rpc('integration_read_secret', { p_provider: provider });
    if (error) return reply(500, { error: 'No se ha podido leer la clave' });
    if (!key) return reply(404, { error: `${provider} no está conectado todavía (VrutalOS → Integraciones)` });
    return reply(200, { key });
  }

  if (VRUTAL1ST_PROVIDERS.has(provider)) {
    const tenantId = Deno.env.get('TENANT_ID');
    const baseUrl = Deno.env.get('VRUTAL1ST_FUNCTIONS_BASE_URL');
    const pushToken = Deno.env.get('VRUTAL1ST_PUSH_TOKEN');
    if (!tenantId || !baseUrl || !pushToken) return reply(500, { error: 'Función mal configurada' });

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/tenant-postiz-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vrutal-Token': pushToken },
        body: JSON.stringify({ tenant_id: tenantId }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return reply(502, { error: 'No se ha podido contactar con Vrutal. Inténtalo de nuevo en un momento.' });
    }
    const resBody: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return reply(404, { error: `${provider} no está configurado para esta instancia todavía` });
    }
    return reply(200, { key: (resBody as Record<string, unknown>)?.key });
  }

  return reply(400, { error: 'Proveedor no soportado' });
});
