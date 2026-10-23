// Edge Function: copia el tablero de Kaneo al espejo de la base del cliente.
//
// Por qué un espejo y no una consulta en vivo: el navegador habla solo con su Supabase, con
// RLS. Si la pantalla preguntara a Kaneo en cada carga, cada carga dependería de que Kaneo
// esté arriba y habría que llevar una clave por el camino. Aquí la clave se queda en el
// servidor y la pantalla lee `board_card` como lee cualquier otra tabla suya.
//
// Server-to-server, nunca desde un navegador: gate con X-Sync-Token (BOARD_SYNC_TOKEN). Es un
// consumidor distinto del de los flujos, así que lleva su propio secreto y no reutiliza
// AP_INTEGRATION_TOKEN (regla de secretos de la bitácora, §8).
//
// Lo dispara `pg_cron` cada 5 minutos leyendo el token del Vault en cada ejecución (misma
// receta que el sync de catálogo, D-06/D-19). También se puede invocar a mano, y con
// `{"project_id": "<id>"}` sincroniza solo ese proyecto: eso es lo que hace `board-write`
// después de escribir, para que el cliente no espere al cron.
//
// QUÉ SE REFLEJA Y QUÉ NO:
//   · Solo los proyectos dados de alta en `board_project`. Un proyecto de Kaneo que no esté
//     ahí no existe para el cliente, aunque Kaneo lo tenga.
//   · Dentro de ellos, las tarjetas que NO llevan la etiqueta `interno`. Si la etiqueta
//     aparece después, la fila se borra del espejo. Ese es el único freno entre el tablero
//     interno de Vrutal y el del cliente.
//   · De la persona asignada se copia el NOMBRE, nunca el correo: el cliente no recibe el
//     directorio del equipo de Vrutal.
//   · Las archivadas quedan fuera (Kaneo las devuelve aparte, en `archivedTasks`).
//
// `origin` y `created_by` NO van en el upsert a propósito: una tarjeta que pidió el cliente
// desde VrutalOS tiene `origin = 'cliente'`, y un sync posterior no debe borrar ese dato.
//
// Kaneo no tiene un «dame lo que cambió desde»: su respuesta de tablero no trae `updatedAt`
// (comprobado en su esquema, versión 2.46.2). Así que cada ejecución es una foto completa por
// proyecto. A la escala de un tablero de cliente sobra; si algún día no, el filtro tendrá que
// llegar primero a Kaneo.
//
// Secrets requeridos: BOARD_SYNC_TOKEN, KANEO_API_URL (el origen, sin `/api`), KANEO_API_KEY.
// Desplegar con verify_jwt = false: el gate es la cabecera, no una sesión.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

/** Tope de páginas por proyecto: 100 tareas por página, así que 20 son 2.000 tarjetas.
 *  Está para que un tablero disparatado no deje la función colgada, no porque se espere. */
const MAX_PAGINAS = 20;
/** Tope de tarjetas a las que se les piden comentarios en una pasada (una llamada por tarjeta). */
const MAX_TARJETAS_CON_COMENTARIOS = 300;
const MAX_DESCRIPCION = 20000;
const ETIQUETA_INTERNA = 'interno';

interface KaneoColumn {
  slug: string;
  name: string;
  position?: number;
  isFinal?: boolean;
}

interface KaneoLabel {
  name: string;
}

interface KaneoTask {
  id: string;
  number: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeName: string | null;
  startDate: string | null;
  dueDate: string | null;
  position: number | null;
  createdAt: string | null;
  labels?: KaneoLabel[];
}

interface KaneoBoard {
  data?: {
    columns?: Array<KaneoColumn & { tasks?: KaneoTask[] }>;
    plannedTasks?: KaneoTask[];
  };
  pagination?: { totalPages?: number; relatedTotalPages?: number };
}

interface KaneoComment {
  id: string;
  content: string;
  createdAt: string | null;
  user?: { name?: string };
}

/** Las prioridades que admite el `check` del espejo. Una que no conozcamos entra como nula:
 *  mejor una tarjeta sin prioridad que una pasada entera que falla. */
const PRIORIDADES = new Set(['no-priority', 'low', 'medium', 'high', 'urgent']);

const soloFecha = (v: string | null | undefined): string | null =>
  typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  // `trim` en los dos lados: un secreto pegado en un panel se lleva un salto de línea o un
  // espacio con una facilidad asombrosa, y sin esto la comparación falla en silencio — el cron
  // se pasaría días devolviendo 401 sin que nada lo cuente.
  const expected = (Deno.env.get('BOARD_SYNC_TOKEN') ?? '').trim();
  if (!expected) return json({ error: 'Función mal configurada' }, 500);
  if ((req.headers.get('X-Sync-Token') ?? '').trim() !== expected) {
    return json({ error: 'No autorizado' }, 401);
  }

  const kaneoBase = (Deno.env.get('KANEO_API_URL') ?? '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
  const kaneoKey = (Deno.env.get('KANEO_API_KEY') ?? '').trim();
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!kaneoBase || !kaneoKey || !url || !serviceKey) return json({ error: 'Función mal configurada' }, 500);

  // Un cuerpo vacío es lo normal (lo manda el cron). `project_id` limita la pasada a un proyecto.
  let soloProyecto: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).project_id === 'string') {
      soloProyecto = (body as Record<string, string>).project_id;
    }
  } catch {
    // sin cuerpo: se sincroniza todo
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function kaneo<T>(path: string): Promise<T> {
    const res = await fetch(`${kaneoBase}${path}`, {
      headers: { 'x-api-key': kaneoKey as string, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Kaneo respondió ${res.status} a ${path}`);
    return (await res.json()) as T;
  }

  let proyectos = admin.from('board_project').select('id, specialist_id');
  if (soloProyecto) proyectos = proyectos.eq('id', soloProyecto);
  const { data: filas, error: errorProyectos } = await proyectos;
  if (errorProyectos) return json({ error: 'No se han podido leer los proyectos del tablero' }, 500);
  if (!filas || filas.length === 0) {
    // Ningún proyecto dado de alta no es un error: este cliente todavía no tiene tablero.
    return json({ proyectos: 0, detalle: [] });
  }

  const detalle: Array<Record<string, unknown>> = [];

  for (const proyecto of filas as Array<{ id: string; specialist_id: string }>) {
    try {
      await sincronizarProyecto(admin, kaneo, proyecto, detalle);
    } catch (e) {
      // Un proyecto roto no tumba a los demás: se anota y se sigue.
      detalle.push({ project_id: proyecto.id, error: e instanceof Error ? e.message : 'fallo desconocido' });
    }
  }

  const conError = detalle.filter((d) => 'error' in d).length;
  return json({ proyectos: filas.length, con_error: conError, detalle }, conError > 0 ? 207 : 200);
});

async function sincronizarProyecto(
  admin: SupabaseClient,
  kaneo: <T>(path: string) => Promise<T>,
  proyecto: { id: string; specialist_id: string },
  detalle: Array<Record<string, unknown>>,
): Promise<void> {
  const { id: projectId, specialist_id: specialistId } = proyecto;

  // 1. Las columnas, que son las que dibujan el tablero.
  const columnas = await kaneo<KaneoColumn[]>(`/api/column/${projectId}`);
  if (columnas.length > 0) {
    const { error } = await admin.from('board_column').upsert(
      columnas.map((c, i) => ({
        project_id: projectId,
        slug: c.slug,
        name: c.name,
        position: typeof c.position === 'number' ? c.position : i,
        is_final: c.isFinal === true,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'project_id,slug' },
    );
    if (error) throw new Error(`columnas: ${error.message}`);
  }
  await borrarSobrantes(admin, 'board_column', 'slug', projectId, columnas.map((c) => c.slug), 'project_id');

  // 2. Las tarjetas. Kaneo pagina las tareas y, aparte, los registros relacionados (etiquetas):
  //    por eso se recorren las dos paginaciones y se van uniendo las etiquetas de cada tarea.
  const tareas = new Map<string, KaneoTask & { etiquetas: Set<string> }>();
  let pagina = 1;
  let paginasTotales = 1;
  do {
    let relacionadas = 1;
    for (let rp = 1; rp <= relacionadas; rp++) {
      const board = await kaneo<KaneoBoard>(
        `/api/task/tasks/${projectId}?page=${pagina}&limit=100&relatedPage=${rp}`,
      );
      paginasTotales = board.pagination?.totalPages ?? 1;
      relacionadas = board.pagination?.relatedTotalPages ?? 1;
      const lote = [
        ...(board.data?.columns ?? []).flatMap((c) => c.tasks ?? []),
        ...(board.data?.plannedTasks ?? []),
      ];
      for (const t of lote) {
        const previa = tareas.get(t.id);
        const etiquetas = previa?.etiquetas ?? new Set<string>();
        for (const l of t.labels ?? []) if (l?.name) etiquetas.add(l.name);
        // La descripción puede venir omitida en una página y presente en otra: se queda la que haya.
        tareas.set(t.id, { ...(previa ?? t), ...t, description: t.description ?? previa?.description ?? null, etiquetas });
      }
    }
    pagina++;
  } while (pagina <= paginasTotales && pagina <= MAX_PAGINAS);

  const visibles = [...tareas.values()].filter(
    (t) => ![...t.etiquetas].some((l) => l.trim().toLowerCase() === ETIQUETA_INTERNA),
  );

  if (visibles.length > 0) {
    const { error } = await admin.from('board_card').upsert(
      visibles.map((t) => ({
        id: t.id,
        project_id: projectId,
        specialist_id: specialistId,
        number: t.number,
        title: (t.title ?? '').slice(0, 300) || 'Sin título',
        description: typeof t.description === 'string' ? t.description.slice(0, MAX_DESCRIPCION) : null,
        status: t.status,
        priority: t.priority && PRIORIDADES.has(t.priority) ? t.priority : null,
        assignee_name: t.assigneeName ? t.assigneeName.slice(0, 120) : null,
        labels: [...t.etiquetas],
        start_date: soloFecha(t.startDate),
        due_date: soloFecha(t.dueDate),
        position: typeof t.position === 'number' ? t.position : null,
        kaneo_created_at: t.createdAt,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'id' },
    );
    if (error) throw new Error(`tarjetas: ${error.message}`);
  }
  await borrarSobrantes(admin, 'board_card', 'id', projectId, visibles.map((t) => t.id), 'project_id');

  // 3. La conversación de cada tarjeta. Kaneo no da «los comentarios del proyecto» de una vez,
  //    así que es una llamada por tarjeta: de ahí el tope.
  let comentarios = 0;
  for (const t of visibles.slice(0, MAX_TARJETAS_CON_COMENTARIOS)) {
    const hilo = await kaneo<KaneoComment[]>(`/api/comment/${t.id}`);
    if (hilo.length > 0) {
      // `ignoreDuplicates`: el primero que escribe gana. Es deliberado — un comentario que
      // mandó el cliente ya está en el espejo con SU nombre y su `author_profile_id`, y la
      // ruta de lectura de Kaneo devuelve en su lugar el nombre del usuario de la API key
      // (comprobado en `comment/controllers/get-comments.ts`, 2.46.2). Pisarlo convertiría
      // «Gonzalo» en «VrutalOS» en cada pasada.
      // El precio: un comentario EDITADO en Kaneo no se actualiza aquí. Se acepta — el hilo
      // de una tarjeta es una conversación, no un documento que se reescribe.
      const { error } = await admin.from('board_comment').upsert(
        hilo.map((c) => ({
          id: c.id,
          card_id: t.id,
          specialist_id: specialistId,
          author_name: (c.user?.name ?? 'Equipo Vrutal').slice(0, 120),
          body: (c.content ?? '').slice(0, 10000),
          kaneo_created_at: c.createdAt,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: 'id', ignoreDuplicates: true },
      );
      if (error) throw new Error(`comentarios: ${error.message}`);
    }
    await borrarSobrantes(admin, 'board_comment', 'id', t.id, hilo.map((c) => c.id), 'card_id');
    comentarios += hilo.length;
  }

  detalle.push({
    project_id: projectId,
    columnas: columnas.length,
    tarjetas: visibles.length,
    ocultas_por_interno: tareas.size - visibles.length,
    comentarios,
  });
}

/** Borra del espejo lo que Kaneo ya no devuelve. Se leen primero los ids presentes y se borra
 *  la diferencia: un `not in (...)` con ids de texto es justo donde se cuela un escape mal
 *  hecho, y aquí un borrado de más se lleva el tablero del cliente. */
async function borrarSobrantes(
  admin: SupabaseClient,
  tabla: string,
  clave: string,
  padreValor: string,
  vivos: string[],
  padreColumna: string,
): Promise<void> {
  const { data, error } = await admin.from(tabla).select(clave).eq(padreColumna, padreValor);
  if (error) throw new Error(`${tabla}: ${error.message}`);
  const presentes = (data ?? []).map((r) => (r as Record<string, string>)[clave]);
  const sobran = presentes.filter((v) => !vivos.includes(v));
  if (sobran.length === 0) return;
  const { error: errorBorrado } = await admin.from(tabla).delete().eq(padreColumna, padreValor).in(clave, sobran);
  if (errorBorrado) throw new Error(`${tabla} (borrado): ${errorBorrado.message}`);
}
