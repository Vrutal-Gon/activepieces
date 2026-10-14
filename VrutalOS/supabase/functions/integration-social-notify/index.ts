// Edge Function: avisa a Vrutal1st de que una red social cambió de estado.
//
// La invoca un Database Webhook (se configura en el dashboard del proyecto, no en SQL)
// sobre public.integrations: AFTER INSERT OR UPDATE OF status
// WHEN (integration_type = 'social'). El cliente empuja el estado — Vrutal1st nunca
// guarda ninguna credencial de los proyectos de los clientes (decisión 2026-10-08).
//
// Solo viaja: a qué red (provider), qué estado. NUNCA secret_ref ni config.
//
// Secrets requeridos: WEBHOOK_SHARED_SECRET (cabecera que debe mandar el propio
// Database Webhook, configurada ahí como "Custom header" — sin esto, cualquiera con
// la URL pública de la función podría fabricar un aviso falso); TENANT_ID (el id de
// este cliente en Vrutal1st); VRUTAL1ST_FUNCTIONS_BASE_URL (p. ej.
// https://<ref>.supabase.co/functions/v1 — la misma base que usan support-ticket-send/
// -list) y VRUTAL1ST_PUSH_TOKEN (lo entrega staff_rotate_tenant_push_token en Vrutal1st,
// una vez, al dar de alta la instancia).
const STATUS_MAP: Record<string, string> = { active: 'connected', paused: 'paused', revoked: 'revoked' };

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE';
  table: string;
  record: { integration_type?: string; provider?: string; status?: string };
}

function isWebhookPayload(v: unknown): v is WebhookPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    'record' in v &&
    typeof (v as { record: unknown }).record === 'object' &&
    (v as { record: unknown }).record !== null
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const sharedSecret = Deno.env.get('WEBHOOK_SHARED_SECRET');
  const tenantId = Deno.env.get('TENANT_ID');
  const baseUrl = Deno.env.get('VRUTAL1ST_FUNCTIONS_BASE_URL');
  const pushToken = Deno.env.get('VRUTAL1ST_PUSH_TOKEN');
  if (!sharedSecret || !tenantId || !baseUrl || !pushToken) {
    console.error('integration-social-notify: función mal configurada (falta un secret)');
    return new Response(null, { status: 500 });
  }

  if (req.headers.get('x-webhook-secret') !== sharedSecret) {
    return new Response(null, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!isWebhookPayload(payload)) return new Response(null, { status: 400 });

  const { integration_type, provider, status } = payload.record;
  // Solo nos interesan las redes sociales; cualquier otro tipo se ignora en silencio
  // (el webhook se filtra por WHEN en SQL, pero no cuesta nada ser explícitos aquí).
  if (integration_type !== 'social' || typeof provider !== 'string' || typeof status !== 'string') {
    return new Response(null, { status: 204 });
  }
  const mappedStatus = STATUS_MAP[status];
  if (!mappedStatus) return new Response(null, { status: 204 });

  try {
    const res = await fetch(`${baseUrl}/tenant-integration-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vrutal-Token': pushToken },
      body: JSON.stringify({ tenant_id: tenantId, system: provider, status: mappedStatus }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`integration-social-notify: Vrutal1st respondió ${res.status}`);
      return new Response(null, { status: 502 });
    }
  } catch (err) {
    console.error('integration-social-notify: no se ha podido avisar a Vrutal1st', err);
    return new Response(null, { status: 502 });
  }

  return new Response(null, { status: 204 });
});
