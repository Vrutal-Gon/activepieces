// Edge Function: las credenciales de la app de cada red social, servidas a la propia
// instancia del cliente. Dos consumidores, los dos de servidor a servidor:
//
//  1. El contenedor de Postiz, AL ARRANCAR (?format=env): devuelve líneas `CLAVE='valor'`
//     que su entrypoint hace `source`. Comprobado en el código de Postiz (2026-10-13):
//     linkedin.provider.ts y linkedin.page.provider.ts leen `process.env.LINKEDIN_CLIENT_ID`
//     en cada llamada (generar URL, canjear código, refrescar) — no hay credenciales por
//     organización ni `customFields` para LinkedIn, así que el entorno es el único camino.
//     Al servirlas aquí, el secreto va del Vault al proceso sin pasar por ningún disco:
//     no hay .env con claves del cliente en la máquina.
//  2. El agente de la instancia (?format=fingerprint): devuelve solo una huella. Si cambia
//     respecto a la última aplicada, reinicia Postiz para que vuelva a pedir el entorno.
//     Así el agente nunca ve una credencial, solo sabe que hay algo nuevo.
//
// Gate con X-AP-Token (secreto de esta instancia), igual que integration-get-key. Nunca
// desde un navegador: sin CORS a propósito, y el formato `env` no se registra en ningún log.
//
// El Admin del cliente las pega en VrutalOS → Integraciones (social-app-save). Vrutal no
// las ve ni las pide por correo: son de la app de LinkedIn Developers del propio cliente.
//
// Secret requerido: SOCIAL_APP_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** provider → los dos nombres de variable que espera Postiz para esa red.
 *
 * Solo las redes que docker-compose.yml de la instancia cablea de verdad: añadir una aquí
 * sin añadirla allí no serviría de nada. `linkedin` cubre las DOS conexiones de LinkedIn
 * (perfil y página de empresa): linkedin.page.provider.ts hereda de linkedin.provider.ts,
 * con los mismos scopes y la misma app — una sola app de LinkedIn Developers para ambas. */
const ENV_VARS: Record<string, readonly [string, string]> = {
  linkedin: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
  x: ['X_API_KEY', 'X_API_SECRET'],
  facebook: ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  threads: ['THREADS_APP_ID', 'THREADS_APP_SECRET'],
  youtube: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
  tiktok: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
  reddit: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
  discord: ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
  slack: ['SLACK_ID', 'SLACK_SECRET'],
};

/** Prefijo del proveedor en `integrations`. Separado del de la conexión (`linkedin-page`,
 * que crea integration-social-notify al conectar un canal): son cosas distintas y no deben
 * pisarse — esto es la app, aquello el canal ya autorizado. */
const APP_PREFIX = 'social-app:';

interface AppRow {
  provider: string;
  validated_at: string | null;
}

function textReply(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function jsonReply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return jsonReply(405, { error: 'Método no permitido' });

  const expected = Deno.env.get('SOCIAL_APP_TOKEN');
  if (!expected) return jsonReply(500, { error: 'Función mal configurada' });
  if (req.headers.get('X-AP-Token') !== expected) return jsonReply(401, { error: 'No autorizado' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return jsonReply(500, { error: 'Función mal configurada' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await admin
    .from('integrations')
    .select('provider, validated_at')
    .like('provider', `${APP_PREFIX}%`)
    .eq('status', 'active')
    .returns<AppRow[]>();
  if (error) return jsonReply(500, { error: 'No se han podido leer las integraciones' });

  const rows = data ?? [];

  // La huella que mira el agente: cambia si se añade, se quita o se sobrescribe una app.
  // No lleva ninguna credencial, solo proveedores y fechas.
  const version = rows
    .map((r) => `${r.provider}@${r.validated_at ?? ''}`)
    .sort()
    .join(',');

  const format = new URL(req.url).searchParams.get('format');

  // Para el agente: texto plano, para no tener que parsear JSON en un script de shell.
  if (format === 'fingerprint') return textReply(200, version);

  if (format !== 'env') {
    return jsonReply(200, { version, providers: rows.map((r) => r.provider.slice(APP_PREFIX.length)).sort() });
  }

  // Formato env, para que el entrypoint de Postiz lo haga `source`.
  const lines: string[] = [];
  for (const row of rows) {
    const network = row.provider.slice(APP_PREFIX.length);
    const names = ENV_VARS[network];
    if (!names) continue; // guardada pero esta instancia no la cablea: se ignora en silencio

    const { data: secret, error: readError } = await admin.rpc('integration_read_secret', {
      p_provider: row.provider,
    });
    if (readError || typeof secret !== 'string' || !secret) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(secret);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) continue;
    const { client_id: id, client_secret: sec } = parsed as Record<string, unknown>;
    // Se vuelve a validar la forma aquí, no solo al guardar: lo que sale va a un `source`,
    // y una comilla simple partiría el fichero y dejaría a Postiz sin arrancar.
    if (typeof id !== 'string' || typeof sec !== 'string') continue;
    if (/[^\x21-\x7E]/.test(id) || /[^\x21-\x7E]/.test(sec)) continue;
    if (id.includes("'") || sec.includes("'")) continue;

    lines.push(`${names[0]}='${id}'`);
    lines.push(`${names[1]}='${sec}'`);
  }

  return textReply(200, lines.length > 0 ? `${lines.join('\n')}\n` : '');
});
