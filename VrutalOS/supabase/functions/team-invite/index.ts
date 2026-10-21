// Edge Function: un Admin de la empresa invita a una persona nueva.
//
// 1. Comprueba con el JWT de quien llama que es Admin ACTIVO (is_admin() se evalúa como esa persona).
// 2. Solo entonces usa service_role (vive en Supabase, nunca en el navegador) para:
//    - invitar por email (el trigger handle_new_user crea su perfil como client_user),
//    - si se pidió Manager o Administrador, subir el rol en app_metadata (fuente de verdad) y en profiles.
// 3. Si falla la asignación del rol, borra a la persona invitada: no quedan cuentas a medias.
//
// Secrets requeridos (los fija Vrutal; el cliente no puede cambiarlos):
//   APP_ORIGINS          = orígenes de la app permitidos, separados por coma
//                          (p. ej. "http://localhost:5180,https://acme.vrutal.com").
//   ALLOWED_EMAIL_DOMAINS = dominios de correo invitables, separados por coma (p. ej. "acme.com").
// Además, <origen>/bienvenida debe estar en Auth > URL Configuration > Redirect URLs.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

// Dominios de correo a los que un Admin puede invitar. Lo fija solo Vrutal, por instancia (secret).
// Vacío = no se invita a nadie (falla cerrado). Coincidencia exacta: «acme.com» no admite «mail.acme.com».
// Para crear una cuenta con otro dominio, Vrutal lo hace desde su Control Panel, no desde esta función.
const ALLOWED_EMAIL_DOMAINS = (Deno.env.get('ALLOWED_EMAIL_DOMAINS') ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
  .filter((d) => d.length > 0);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['client_user', 'client_marketing_admin', 'client_admin'];

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
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
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

  // 1. Permiso, evaluado como quien llama. is_admin() ya exige cuenta activa.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isAdmin, error: permError } = await caller.rpc('is_admin');
  if (permError || isAdmin !== true) {
    return reply(403, { error: 'Solo un administrador puede invitar personas' }, origin);
  }

  // Validación de entrada.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);
  const { email, full_name, role } = body as Record<string, unknown>;
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    return reply(400, { error: 'Correo no válido' }, origin);
  }
  if (typeof full_name !== 'string' || full_name.trim().length === 0 || full_name.length > 120) {
    return reply(400, { error: 'Nombre no válido' }, origin);
  }
  const wantedRole = role === undefined ? 'client_user' : role;
  if (typeof wantedRole !== 'string' || !ROLES.includes(wantedRole)) return reply(400, { error: 'Rol no válido' }, origin);

  // Dominio permitido. Se comprueba antes de crear nada y con el correo ya normalizado.
  if (ALLOWED_EMAIL_DOMAINS.length === 0) {
    return reply(403, { error: 'Todavía no se han configurado los dominios de tu empresa. Pídeselo a Vrutal.' }, origin);
  }
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    const list = ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(', ');
    return reply(403, { error: `Solo puedes invitar a correos de ${list}. Para otro dominio, pídeselo a Vrutal.` }, origin);
  }

  // 2. Acciones privilegiadas.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    data: { full_name: full_name.trim() },
    redirectTo: `${origin}/bienvenida`,
  });
  if (inviteError || !invited.user) {
    const exists = inviteError?.code === 'email_exists' || /already/i.test(inviteError?.message ?? '');
    return reply(exists ? 409 : 502, { error: exists ? 'Ese correo ya tiene cuenta' : 'No se ha podido enviar la invitación' }, origin);
  }

  // handle_new_user la crea como client_user. Si se pidió otro rol (Manager o Administrador), se sube aquí.
  if (wantedRole !== 'client_user') {
    const { error: metaError } = await admin.auth.admin.updateUserById(invited.user.id, {
      app_metadata: { role: wantedRole },
    });
    const { error: profileError } = await admin.from('profiles').update({ role: wantedRole }).eq('id', invited.user.id);
    if (metaError || profileError) {
      // 3. Sin el rol pedido no debe quedar cuenta.
      await admin.auth.admin.deleteUser(invited.user.id);
      return reply(500, { error: 'No se ha podido asignar el rol; la invitación se ha anulado' }, origin);
    }
  }

  return reply(200, { profile_id: invited.user.id }, origin);
});
