// Edge Function: invitar a un miembro del equipo Vrutal (solo superadmin).
//
// 1. Comprueba con el JWT de quien llama que es superadmin (se evalúa como esa persona).
// 2. Solo entonces usa service_role (vive en Supabase, nunca en el navegador) para:
//    - invitar por email (el trigger handle_new_user crea su perfil),
//    - asignarle un rol de plataforma (guard_user_roles valida scope y tenant_id NULL).
// 3. Si falla la asignación de rol, borra el usuario invitado: no quedan cuentas sin rol.
//
// Secret requerido: PANEL_ORIGINS = orígenes permitidos separados por coma
//   (p. ej. "http://localhost:5199,http://localhost:5173,https://panel.vrutal.com").
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('PANEL_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // 1. Permiso, evaluado como quien llama.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isSuperadmin, error: permError } = await caller.rpc('is_superadmin');
  if (permError || isSuperadmin !== true) {
    return reply(403, { error: 'Solo un superadmin puede invitar al equipo' }, origin);
  }

  // Validación de entrada.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);
  const { email, full_name, role_key } = body as Record<string, unknown>;
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    return reply(400, { error: 'Correo no válido' }, origin);
  }
  if (typeof full_name !== 'string' || full_name.trim().length === 0 || full_name.length > 120) {
    return reply(400, { error: 'Nombre no válido' }, origin);
  }
  if (typeof role_key !== 'string') return reply(400, { error: 'Rol no válido' }, origin);

  // 2. Acciones privilegiadas.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: role, error: roleLookupError } = await admin
    .from('roles')
    .select('id')
    .eq('key', role_key)
    .eq('scope', 'platform')
    .is('tenant_id', null)
    .maybeSingle();
  if (roleLookupError || !role) return reply(400, { error: 'Rol no válido' }, origin);

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    data: { full_name: full_name.trim() },
    redirectTo: `${origin}/bienvenida`,
  });
  if (inviteError || !invited.user) {
    const exists = inviteError?.code === 'email_exists' || /already/i.test(inviteError?.message ?? '');
    return reply(exists ? 409 : 502, { error: exists ? 'Ese correo ya tiene cuenta' : 'No se ha podido enviar la invitación' }, origin);
  }

  const { error: grantError } = await admin
    .from('user_roles')
    .insert({ profile_id: invited.user.id, role_id: role.id, tenant_id: null });
  if (grantError) {
    // 3. Sin rol no debe quedar cuenta.
    await admin.auth.admin.deleteUser(invited.user.id);
    return reply(500, { error: 'No se ha podido asignar el rol; la invitación se ha anulado' }, origin);
  }

  return reply(200, { profile_id: invited.user.id }, origin);
});
