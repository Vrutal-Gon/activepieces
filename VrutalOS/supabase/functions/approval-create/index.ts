// Edge Function: un flujo de Activepieces de esta instancia pide permiso al cliente.
//
// Decidido el 2026-10-13: el paso «Pide permiso» de los flujos se aprueba en la pantalla
// Aprobaciones de VrutalOS, no con enlaces de correo. La pantalla y `approval_requests` ya
// existían; lo que faltaba era el puente.
//
// Cómo encaja con Activepieces: un paso CODE no puede pausar un flujo (pausar es capacidad
// de pieza), así que el flujo sigue usando `@activepieces/piece-approval` para pausarse. La
// diferencia es que sus enlaces de aprobar/rechazar no se le mandan a nadie: se guardan aquí
// en `resume_url` y los dispara el servidor cuando el cliente pulsa el botón de su panel
// (approval-decide). El cliente nunca ve un enlace.
//
// Server-to-server, nunca desde un navegador: gate con X-AP-Token, igual que
// integration-get-key. Se reusa `AP_INTEGRATION_TOKEN` a propósito — el consumidor es el
// mismo (los flujos de Activepieces de esta instancia), al contrario que SOCIAL_APP_TOKEN,
// que tiene otro consumidor y por eso lleva su propio secreto.
//
// El flujo manda su `job_role_key`, no un uuid: los uuid de `specialists` son distintos en
// cada cliente, y una plantilla de flujo es la misma para todos.
//
// Secrets requeridos: AP_INTEGRATION_TOKEN, AP_RESUME_URL_PREFIX.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const expected = Deno.env.get('AP_INTEGRATION_TOKEN');
  const resumePrefix = Deno.env.get('AP_RESUME_URL_PREFIX');
  if (!expected || !resumePrefix) return json({ error: 'Función mal configurada' }, 500);
  if (req.headers.get('X-AP-Token') !== expected) return json({ error: 'No autorizado' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Función mal configurada' }, 500);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Cuerpo no válido' }, 400);
  }
  if (typeof body !== 'object' || body === null) return json({ error: 'Cuerpo no válido' }, 400);

  const { job_role_key: jobRoleKey, task_key: taskKey, payload, resume_url: resumeUrl } =
    body as Record<string, unknown>;

  if (typeof jobRoleKey !== 'string' || jobRoleKey.trim() === '') {
    return json({ error: 'Falta job_role_key' }, 400);
  }
  if (typeof taskKey !== 'string' || taskKey.trim() === '') {
    return json({ error: 'Falta task_key' }, 400);
  }
  if (payload === undefined || payload === null) {
    return json({ error: 'Falta payload: sin él la pantalla no tiene nada que enseñar' }, 400);
  }
  // El `resume_url` se va a llamar DESDE EL SERVIDOR más adelante, así que se exige que
  // apunte a la instancia de Activepieces de este cliente: si no se comprobara, un flujo
  // manipulado podría hacer que Vrutal llame a cualquier URL (SSRF).
  if (typeof resumeUrl !== 'string' || !resumeUrl.startsWith(resumePrefix)) {
    return json({ error: 'resume_url no apunta a la instancia esperada' }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: specialist, error: specialistError } = await admin
    .from('specialists')
    .select('id')
    .eq('job_role_key', jobRoleKey)
    .maybeSingle<{ id: string }>();
  if (specialistError) return json({ error: 'No se ha podido resolver el especialista' }, 500);
  if (!specialist) {
    // Pasa si el especialista está contratado en Vrutal1st pero el sync todavía no ha
    // bajado (máx. 15 min). Mejor un 409 claro que una aprobación sin dueño.
    return json({ error: `El especialista ${jobRoleKey} no está dado de alta en esta cuenta todavía` }, 409);
  }

  const { data: created, error: insertError } = await admin
    .from('approval_requests')
    .insert({
      specialist_id: specialist.id,
      task_key: taskKey,
      payload,
      status: 'pending',
      resume_url: resumeUrl,
    })
    .select('id')
    .single<{ id: string }>();
  if (insertError || !created) return json({ error: 'No se ha podido crear la aprobación' }, 500);

  return json({ approval_id: created.id });
});
