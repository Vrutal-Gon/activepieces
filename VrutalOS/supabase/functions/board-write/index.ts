// Edge Function: el cliente pide una tarea nueva o comenta una del tablero, desde VrutalOS.
//
// Por qué no escribe el navegador: el tablero que ve el cliente es un ESPEJO de Kaneo
// (`board_card`), y `authenticated` solo tiene SELECT sobre él. La fuente es Kaneo, que vive en
// la instancia Docker del cliente y se habla con una API key que es de Vrutal. Esa clave se
// queda aquí: el navegador manda su sesión, esta función comprueba el permiso y escribe.
//
// Orden deliberado: primero se escribe en KANEO (la fuente) y solo después se refleja la fila
// en el espejo. Al revés, un fallo de Kaneo dejaría al cliente viendo una tarjeta que el equipo
// de Vrutal no tiene. Si el reflejo falla pero Kaneo ya lo tiene, la tarjeta aparece en la
// siguiente pasada de `board-sync`: se devuelve 200 con `reflejada: false`.
//
// QUIÉN PUEDE: lo decide `board_authorize(<especialista>)` en el servidor, evaluada con la
// sesión de quien llama — el mismo criterio que ya rige los entregables
// (`can_access_specialist`). Esta función no reimplementa el criterio.
//
// QUÉ NO HACE: mover una tarjeta de columna. El estado del trabajo lo fija Vrutal; el cliente
// propone y comenta. Si algún día se abre, es otra acción con su propia autorización.
//
// ATRIBUCIÓN. Kaneo solo ve un usuario de servicio (el dueño de la API key), así que el
// comentario se le manda con `externalUserName`/`externalSource` para que su interfaz muestre
// quién lo escribió. Pero su ruta de lectura NO devuelve ese dato (comprobado en
// `comment/controllers/get-comments.ts`, 2.46.2): devuelve el nombre del usuario de la clave.
// Por eso el nombre bueno se escribe aquí, en el espejo, y `board-sync` no lo pisa.
//
// Secrets requeridos: APP_ORIGINS, KANEO_API_URL (el origen, sin `/api`), KANEO_API_KEY.
// Desplegar con verify_jwt = true: aquí el gate SÍ es la sesión del cliente.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('APP_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

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

const MAX_TITULO = 300;
const MAX_DESCRIPCION = 20000;
const MAX_COMENTARIO = 10000;

interface KaneoTask {
  id: string;
  number: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  position: number | null;
  createdAt: string | null;
}

interface KaneoActivity {
  id: string;
  content: string | null;
  createdAt: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'Método no permitido' }, origin);
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return reply(403, { error: 'Origen no permitido' }, origin);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply(401, { error: 'Sin sesión' }, origin);

  // `trim` en los secretos: pegados en un panel se llevan un salto o un espacio con facilidad, y
  // una URL con un espacio detrás falla con un «Invalid URL» que no dice de dónde viene. Pasó el
  // 2026-10-23 con los tres secretos del tablero.
  const kaneoBase = (Deno.env.get('KANEO_API_URL') ?? '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
  const kaneoKey = (Deno.env.get('KANEO_API_KEY') ?? '').trim();
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!kaneoBase || !kaneoKey || !url || !anonKey || !serviceKey) {
    return reply(500, { error: 'Función mal configurada' }, origin);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'Cuerpo no válido' }, origin);
  }
  if (typeof body !== 'object' || body === null) return reply(400, { error: 'Cuerpo no válido' }, origin);
  const { action } = body as Record<string, unknown>;
  if (action !== 'create_card' && action !== 'add_comment') {
    return reply(400, { error: 'action tiene que ser create_card o add_comment' }, origin);
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData?.user) return reply(401, { error: 'Sin sesión' }, origin);
  const userId = userData.user.id;

  const { data: perfil } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle<{ full_name: string | null }>();
  const autor = (perfil?.full_name ?? '').trim() || 'Alguien del equipo';

  async function kaneoPost<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${kaneoBase}${path}`, {
      method: 'POST',
      headers: { 'x-api-key': kaneoKey as string, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Kaneo respondió ${res.status} a ${path}`);
    return (await res.json()) as T;
  }

  /** El permiso se evalúa en el servidor, con la sesión de quien llama. */
  async function autorizado(specialistId: string): Promise<boolean> {
    const { data, error } = await caller.rpc('board_authorize', { p_specialist: specialistId });
    if (error) return false;
    return data === true;
  }

  // ─────────────────────────── Tarea nueva ───────────────────────────
  if (action === 'create_card') {
    const { specialist_id: specialistId, title, description } = body as Record<string, unknown>;
    if (typeof specialistId !== 'string' || specialistId.trim() === '') {
      return reply(400, { error: 'Falta specialist_id' }, origin);
    }
    const titulo = typeof title === 'string' ? title.trim() : '';
    if (titulo === '') return reply(400, { error: 'La tarea necesita un título' }, origin);
    if (titulo.length > MAX_TITULO) return reply(400, { error: `El título no puede pasar de ${MAX_TITULO} caracteres` }, origin);
    const detalle = typeof description === 'string' ? description.trim().slice(0, MAX_DESCRIPCION) : '';

    if (!(await autorizado(specialistId))) {
      return reply(403, { error: 'No tienes acceso al tablero de este especialista' }, origin);
    }

    // El proyecto del especialista y su primera columna: ahí nace la tarea.
    const { data: proyecto } = await admin
      .from('board_project')
      .select('id')
      .eq('specialist_id', specialistId)
      .order('position')
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (!proyecto) return reply(409, { error: 'Este especialista todavía no tiene tablero' }, origin);

    const { data: columna } = await admin
      .from('board_column')
      .select('slug')
      .eq('project_id', proyecto.id)
      .order('position')
      .limit(1)
      .maybeSingle<{ slug: string }>();
    if (!columna) return reply(409, { error: 'El tablero de este especialista todavía no tiene columnas' }, origin);

    // Quién la pidió va también en la descripción: en Kaneo la tarjeta la ve el equipo de
    // Vrutal, y tiene que saber de quién viene sin salir de su herramienta.
    const cuerpo = detalle === '' ? `Pedido por ${autor} desde VrutalOS.` : `${detalle}\n\n—\nPedido por ${autor} desde VrutalOS.`;

    let tarea: KaneoTask;
    try {
      tarea = await kaneoPost<KaneoTask>(`/api/task/${proyecto.id}`, {
        title: titulo,
        description: cuerpo,
        status: columna.slug,
        priority: 'no-priority',
      });
    } catch {
      return reply(502, { error: 'No se ha podido crear la tarea. Inténtalo en un momento.' }, origin);
    }

    // Reflejo inmediato: así la tarjeta aparece en pantalla sin esperar al cron de 5 minutos.
    const { error: errorEspejo } = await admin.from('board_card').insert({
      id: tarea.id,
      project_id: proyecto.id,
      specialist_id: specialistId,
      number: tarea.number ?? null,
      title: titulo,
      description: cuerpo,
      status: tarea.status ?? columna.slug,
      priority: 'no-priority',
      position: typeof tarea.position === 'number' ? tarea.position : null,
      origin: 'cliente',
      created_by: userId,
      kaneo_created_at: tarea.createdAt ?? new Date().toISOString(),
    });

    return reply(200, { card_id: tarea.id, reflejada: !errorEspejo }, origin);
  }

  // ─────────────────────────── Comentario ───────────────────────────
  const { card_id: cardId, body: texto } = body as Record<string, unknown>;
  if (typeof cardId !== 'string' || cardId.trim() === '') return reply(400, { error: 'Falta card_id' }, origin);
  const comentario = typeof texto === 'string' ? texto.trim() : '';
  if (comentario === '') return reply(400, { error: 'El comentario está vacío' }, origin);
  if (comentario.length > MAX_COMENTARIO) {
    return reply(400, { error: `El comentario no puede pasar de ${MAX_COMENTARIO} caracteres` }, origin);
  }

  const { data: tarjeta } = await admin
    .from('board_card')
    .select('id, specialist_id')
    .eq('id', cardId)
    .maybeSingle<{ id: string; specialist_id: string }>();
  if (!tarjeta) return reply(404, { error: 'Esa tarea no está en tu tablero' }, origin);

  if (!(await autorizado(tarjeta.specialist_id))) {
    return reply(403, { error: 'No tienes acceso al tablero de este especialista' }, origin);
  }

  let actividad: KaneoActivity;
  try {
    actividad = await kaneoPost<KaneoActivity>(`/api/comment/${cardId}`, {
      content: comentario,
      // Para que la interfaz de Kaneo no atribuya el comentario al usuario de servicio.
      externalUserName: autor.slice(0, 120),
      externalSource: 'kaneo',
    });
  } catch {
    return reply(502, { error: 'No se ha podido enviar el comentario. Inténtalo en un momento.' }, origin);
  }

  const { error: errorEspejo } = await admin.from('board_comment').insert({
    id: actividad.id,
    card_id: cardId,
    specialist_id: tarjeta.specialist_id,
    author_name: autor.slice(0, 120),
    author_profile_id: userId,
    body: comentario,
    kaneo_created_at: actividad.createdAt ?? new Date().toISOString(),
  });

  return reply(200, { comment_id: actividad.id, reflejada: !errorEspejo }, origin);
});
