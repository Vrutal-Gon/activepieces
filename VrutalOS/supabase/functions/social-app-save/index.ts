// Edge Function: el Admin de la empresa guarda las credenciales de SU app de red social
// (p. ej. la app de LinkedIn Developers de su empresa: Client ID + Client Secret).
//
// Por qué existe, en vez de reusar integration-save-key: esto no es "una clave" sino un par
// (id + secreto) que identifica una app OAuth, y no se puede probar contra el proveedor con
// una llamada de lectura — la prueba real es la propia autorización OAuth, que el cliente
// hace después con el botón "Conectar". Por eso aquí NO se valida contra LinkedIn: se guarda
// la forma, y el error, si lo hay, sale al conectar. Deuda declarada a propósito, igual que
// se hizo con los proveedores sin pieza de prueba propia en integration-save-key.
//
// Las dos van juntas como un único secreto JSON en el Vault de ESTE cliente (una sola
// entrada, un solo `integration_store_secret`, sin SQL nuevo). Se guardan bajo el proveedor
// `social-app:<red>`, separado del proveedor de la CONEXIÓN ya autorizada (`linkedin-page`),
// que es otra cosa y la crea integration-social-notify.
//
// `linkedin` cubre las dos conexiones de LinkedIn (perfil y página de empresa): comprobado
// en el código de Postiz — linkedin.page.provider.ts hereda de linkedin.provider.ts, con los
// mismos scopes y la misma app. El cliente crea UNA app, no dos.
//
// Quien las consume es el propio contenedor de Postiz al arrancar (social-app-env). Guardar
// aquí no basta: hay que reiniciar Postiz para que las lea, y de eso se encarga el agente de
// la instancia. Por eso la respuesta dice `pending: true` — la pantalla avisa de la espera.
//
// El secreto solo existe en memoria durante esta llamada: no se registra ni se devuelve.
//
// Secret requerido: APP_ORIGINS.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

/** Las redes cuyas credenciales de app sirve social-app-env, que a su vez son las que
 * docker-compose.yml de la instancia cablea. Debe cuadrar con ENV_VARS de esa función. */
const ALLOWED_NETWORKS = new Set([
  'linkedin', 'x', 'facebook', 'threads', 'youtube', 'tiktok', 'reddit', 'discord', 'slack',
]);

const APP_PREFIX = 'social-app:';

// ASCII imprimible, sin espacios y sin comilla simple: un Client ID/Secret real lo cumple,
// y así el valor no puede partir el fichero de entorno que Postiz hace `source`.
const isValid = (v: string) => /^[\x21-\x7E]{8,512}$/.test(v) && !v.includes("'");

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
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Función mal configurada' }, origin);

  // Permiso, evaluado como quien llama. is_admin() ya exige cuenta activa.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: permError } = await caller.rpc('is_admin');
  if (permError || isAdmin !== true) {
    return reply(403, { error: 'Solo un administrador puede configurar redes sociales' }, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);

  const { network, client_id: rawId, client_secret: rawSecret } = body as Record<string, unknown>;
  if (typeof network !== 'string' || !ALLOWED_NETWORKS.has(network)) {
    return reply(400, { error: 'Red no soportada' }, origin);
  }
  const clientId = typeof rawId === 'string' ? rawId.trim() : '';
  const clientSecret = typeof rawSecret === 'string' ? rawSecret.trim() : '';
  if (!isValid(clientId)) {
    return reply(400, { error: 'El Client ID no tiene el formato esperado. Cópialo completo, sin espacios.' }, origin);
  }
  if (!isValid(clientSecret)) {
    return reply(400, { error: 'El Client Secret no tiene el formato esperado. Cópialo completo, sin espacios.' }, origin);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: integrationId, error: storeError } = await admin.rpc('integration_store_secret', {
    p_provider: `${APP_PREFIX}${network}`,
    p_type: 'social_app',
    p_secret: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  if (storeError) return reply(500, { error: 'No se han podido guardar las credenciales. Inténtalo de nuevo.' }, origin);

  // Rastro: quién y cuándo, nunca las credenciales.
  const { data: userData } = await caller.auth.getUser();
  const { error: auditError } = await admin.from('audit_log').insert({
    actor_type: 'client_user',
    actor_label: userData.user?.email ?? userData.user?.id ?? null,
    action: 'social_app.credentials_saved',
    target_table: 'integrations',
    target_id: String(integrationId),
    reason: network,
  });
  if (auditError) console.error('audit_log: no se pudo registrar social_app.credentials_saved');

  return reply(200, { network, pending: true }, origin);
});
