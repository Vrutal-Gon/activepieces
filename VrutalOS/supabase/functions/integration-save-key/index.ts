// Edge Function: el Admin de la empresa conecta (o sobrescribe) la clave de un sistema suyo.
//
// 1. Comprueba con el JWT de quien llama que es Admin ACTIVO (is_admin() se evalúa como esa persona).
// 2. Comprueba que el Stack de este cliente en Vrutal1st habilitó este proveedor (sync cada
//    15 min en integration_provider_ro) — defensa en profundidad, la pantalla ya filtra esto.
//    Dos caminos desde aquí (migración 030 en Vrutal1st, 2026-10-11): si el proveedor tiene
//    código a medida en PROVIDERS, se PRUEBA de verdad contra su API antes de guardar. Si
//    no — un proveedor de LLM nuevo que solo existe como fila del Stack, sin pieza de prueba
//    propia escrita todavía — se guarda sin probar (deuda declarada, igual que se hizo con
//    HubSpot/Anthropic en su momento antes de escribirles la suya).
// 3. Solo si (se prueba y) funciona, la guarda cifrada en el Vault vía integration_store_secret().
// 4. Deja constancia en audit_log: quién y cuándo. Nunca la clave.
//
// La clave solo existe en memoria durante esta llamada: no se registra, no se devuelve y no se escribe
// en ninguna tabla. Quien la pega no puede volver a verla; solo sobrescribirla.
//
// Secret requerido (lo fija Vrutal): APP_ORIGINS = orígenes de la app permitidos, separados por coma.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

type TestResult = { ok: true } | { ok: false; message: string };

interface Provider {
  label: string;
  type: string;
  /** Llamada de solo lectura, a una URL fija nuestra: la clave solo viaja en una cabecera. */
  test: (key: string, signal: AbortSignal) => Promise<Response>;
}

// Para añadir un sistema: una entrada aquí y otra en app/src/lib/providers.ts. Solo claves
// que el propio cliente paga/controla — Postiz no va aquí (migración 025, ver providers.ts).
const PROVIDERS: Record<string, Provider> = {
  hubspot: {
    label: 'HubSpot',
    type: 'crm',
    test: (key, signal) =>
      fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: { Authorization: `Bearer ${key}` },
        signal,
      }),
  },
  anthropic: {
    label: 'Anthropic',
    type: 'llm',
    test: (key, signal) =>
      fetch('https://api.anthropic.com/v1/models?limit=1', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        signal,
      }),
  },
};

async function testKey(provider: Provider, key: string): Promise<TestResult> {
  let res: Response;
  try {
    res = await provider.test(key, AbortSignal.timeout(10_000));
  } catch {
    return { ok: false, message: `No se ha podido contactar con ${provider.label}. Inténtalo de nuevo en un momento.` };
  }
  // Se descarta el cuerpo: no hace falta y podría contener datos del cliente.
  await res.body?.cancel();
  if (res.ok) return { ok: true };
  if (res.status === 401) return { ok: false, message: `${provider.label} ha rechazado la clave (401). Comprueba que está completa y vigente.` };
  if (res.status === 403) return { ok: false, message: `La clave es de ${provider.label}, pero no tiene permisos suficientes (403).` };
  if (res.status === 429) return { ok: false, message: `${provider.label} limita las peticiones ahora mismo. Inténtalo en un minuto.` };
  return { ok: false, message: `${provider.label} no ha respondido como se esperaba (código ${res.status}).` };
}

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

// Solo ASCII imprimible y sin espacios: una clave real lo cumple, y así no hay inyección de cabeceras.
const KEY_RE = /^[\x21-\x7E]{8,512}$/;

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

  // 1. Permiso, evaluado como quien llama. is_admin() ya exige cuenta activa.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: permError } = await caller.rpc('is_admin');
  if (permError || isAdmin !== true) {
    return reply(403, { error: 'Solo un administrador puede conectar sistemas' }, origin);
  }

  // Validación de entrada.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);
  const { provider: providerKey, key: rawKey } = body as Record<string, unknown>;
  if (typeof providerKey !== 'string') {
    return reply(400, { error: 'Sistema no soportado' }, origin);
  }
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';
  if (!KEY_RE.test(key)) {
    return reply(400, { error: 'La clave no tiene el formato esperado. Cópiala completa, sin espacios.' }, origin);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 2. ¿Está habilitado? Primero el Stack sincronizado (da label/categoría para lo genérico);
  // si no está ahí, una integración ya existente de antes tampoco se bloquea.
  const { data: syncedRow } = await admin
    .from('integration_provider_ro')
    .select('provider_key, system_name, system_category')
    .eq('provider_key', providerKey)
    .maybeSingle<{ provider_key: string; system_name: string; system_category: string }>();

  const bespoke = Object.hasOwn(PROVIDERS, providerKey) ? PROVIDERS[providerKey] : null;
  const label = bespoke?.label ?? syncedRow?.system_name ?? providerKey;
  const type = bespoke?.type ?? syncedRow?.system_category ?? 'other';

  if (!bespoke && !syncedRow) {
    const { count } = await admin
      .from('integrations')
      .select('id', { count: 'exact', head: true })
      .eq('provider', providerKey);
    if (!count) {
      return reply(409, { error: `${label} no está habilitado en el Stack de tu cuenta todavía.` }, origin);
    }
  }

  // 3. Probar contra el proveedor, solo si hay código a medida para hacerlo de verdad.
  if (bespoke) {
    const test = await testKey(bespoke, key);
    if (!test.ok) {
      // Si ya había una integración, se anota el fallo para que la pantalla lo enseñe.
      await admin.from('integrations').update({ last_error: test.message }).eq('provider', providerKey);
      return reply(422, { error: test.message }, origin);
    }
  }

  // 4. Guardar cifrada en el Vault.
  const { data: integrationId, error: storeError } = await admin.rpc('integration_store_secret', {
    p_provider: providerKey,
    p_type: type,
    p_secret: key,
  });
  if (storeError) return reply(500, { error: 'No se ha podido guardar la clave. Inténtalo de nuevo.' }, origin);

  // 5. Rastro: quién y cuándo, nunca la clave. Si falla, no se tumba la operación pero queda en el log de la función.
  const { data: userData } = await caller.auth.getUser();
  const { error: auditError } = await admin.from('audit_log').insert({
    actor_type: 'client_user',
    actor_label: userData.user?.email ?? userData.user?.id ?? null,
    action: 'integration.key_saved',
    target_table: 'integrations',
    target_id: String(integrationId),
    reason: label,
  });
  if (auditError) console.error('audit_log: no se pudo registrar integration.key_saved');

  return reply(200, { provider: providerKey, validated: true }, origin);
});
