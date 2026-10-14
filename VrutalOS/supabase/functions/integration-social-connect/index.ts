// Edge Function: el Admin pulsa "Conectar" en una red social (Postiz hace de motor).
//
// 1. Comprueba con el JWT de quien llama que es Admin ACTIVO (is_admin()).
// 2. Lee la API key de Postiz de esta instancia — vive en el Vault de VRUTAL1ST, no en el
//    de este cliente (migración 025: Postiz es infraestructura que Vrutal provisiona, el
//    cliente nunca la pega ni la ve). Se pide por servidor a servidor con el token de esta
//    instancia, mismo canal que integration-social-notify/support-ticket-*.
// 3. Pide a Postiz la URL real de autorización del proveedor (GET /public/v1/social/:id).
// 4. Devuelve esa URL. El navegador la abre en una pestaña nueva: el cliente autoriza
//    en el proveedor real (LinkedIn, Discord...) y, al terminar, Postiz enseña un aviso
//    genérico de éxito — nunca su propia interfaz. Validado en el spike (2026-10-08).
//
// Secrets requeridos: APP_ORIGINS, POSTIZ_BASE_URL (de esta instancia, p. ej.
// http://postiz:5000 en Docker o https://<slug>-social.vrutal-labs.com), y TENANT_ID,
// VRUTAL1ST_FUNCTIONS_BASE_URL, VRUTAL1ST_PUSH_TOKEN (los mismos que integration-social-notify).
//
// Nunca registra la API key de Postiz ni la URL de autorización (lleva el `state` de
// la sesión OAuth) en ningún sitio: viajan una vez, por TLS, directas al navegador.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

// Identificadores reales de Postiz (comprobados en su código, no en el nombre del archivo:
// p. ej. dev.to.provider.ts registra 'devto', farcaster.provider.ts registra 'wrapcast').
const ALLOWED_PROVIDERS = new Set([
  'bluesky', 'devto', 'discord', 'dribbble', 'facebook', 'wrapcast', 'gmb', 'hashnode',
  'instagram', 'instagram-standalone', 'kick', 'lemmy', 'linkedin', 'linkedin-page',
  'listmonk', 'mastodon', 'mastodon-custom', 'medium', 'mewe', 'moltbook', 'nostr',
  'pinterest', 'reddit', 'skool', 'slack', 'telegram', 'threads', 'tiktok',
  'tiktok-business', 'tumblr', 'twitch', 'vk', 'whop', 'wordpress', 'x', 'youtube',
]);

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
  const postizBaseUrl = Deno.env.get('POSTIZ_BASE_URL');
  const tenantId = Deno.env.get('TENANT_ID');
  const vrutal1stBaseUrl = Deno.env.get('VRUTAL1ST_FUNCTIONS_BASE_URL');
  const pushToken = Deno.env.get('VRUTAL1ST_PUSH_TOKEN');
  if (!url || !anonKey || !postizBaseUrl || !tenantId || !vrutal1stBaseUrl || !pushToken) {
    return reply(500, { error: 'Función mal configurada' }, origin);
  }

  // 1. Permiso, evaluado como quien llama.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: permError } = await caller.rpc('is_admin');
  if (permError || isAdmin !== true) {
    return reply(403, { error: 'Solo un administrador puede conectar redes sociales' }, origin);
  }

  // Validación de entrada.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);
  const { provider } = body as Record<string, unknown>;
  if (typeof provider !== 'string' || !ALLOWED_PROVIDERS.has(provider)) {
    return reply(400, { error: 'Red no soportada' }, origin);
  }

  // 2. Leer la API key de Postiz — vive en Vrutal1st, nunca pasa por el navegador.
  let keyRes: Response;
  try {
    keyRes = await fetch(`${vrutal1stBaseUrl}/tenant-postiz-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vrutal-Token': pushToken },
      body: JSON.stringify({ tenant_id: tenantId }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return reply(502, { error: 'No se ha podido contactar con Vrutal. Inténtalo de nuevo en un momento.' }, origin);
  }
  const keyBody: unknown = await keyRes.json().catch(() => null);
  const postizKey = (keyBody as Record<string, unknown> | null)?.key;
  if (!keyRes.ok || typeof postizKey !== 'string' || !postizKey) {
    return reply(409, { error: 'Postiz no está configurado para esta instancia todavía' }, origin);
  }

  // 3. Pedir a Postiz la URL real de autorización.
  let postizRes: Response;
  try {
    postizRes = await fetch(`${postizBaseUrl}/api/public/v1/social/${provider}`, {
      headers: { Authorization: postizKey },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return reply(502, { error: 'No se ha podido contactar con Postiz. Inténtalo de nuevo en un momento.' }, origin);
  }

  const postizBody: unknown = await postizRes.json().catch(() => null);
  if (!postizRes.ok || typeof postizBody !== 'object' || postizBody === null || !('url' in postizBody)) {
    const msg = (postizBody as Record<string, unknown> | null)?.msg;
    return reply(422, { error: typeof msg === 'string' ? msg : 'Postiz no ha podido generar el enlace de autorización.' }, origin);
  }

  return reply(200, { url: (postizBody as { url: string }).url }, origin);
});
