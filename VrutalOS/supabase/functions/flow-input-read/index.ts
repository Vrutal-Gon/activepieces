// Edge Function: un flujo de Activepieces lee el scope de negocio del cliente.
//
// Sustituye al paso «Lee de la hoja» de Google Sheets. Lo que el flujo leía de las pestañas
// Perfil, Marca y Objetivos ahora son tablas de esta base (cambios 2026-10-16_mkt_entradas y
// 2026-10-17_marketing_admin), que el cliente mantiene desde la pantalla Negocio.
//
// Server-to-server, nunca desde un navegador: gate con X-AP-Token. Se reusa
// AP_INTEGRATION_TOKEN a propósito — el consumidor es el mismo (los flujos de esta
// instancia), igual que en approval-create e integration-get-key.
//
// El flujo manda su `job_role_key`, no un uuid: los uuid de `specialists` son distintos en
// cada cliente y una plantilla de flujo es la misma para todos. Aquí el job_role_key no elige
// qué datos se devuelven —el scope es de la empresa, no de un especialista—, pero sí sirve de
// comprobación: si ese especialista no está dado de alta, el flujo no debería estar corriendo.
//
// La lista de orígenes es CERRADA y estrecha, igual que la de proveedores de
// integration-get-key: un flujo manipulado no puede pedir una tabla cualquiera.
//
// Secrets requeridos: AP_INTEGRATION_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

// origen -> qué se lee. Nada fuera de aquí es alcanzable.
const ORIGENES = {
  icp: { tabla: 'mkt_input_value', campos: 'field_key, value, position', filtro: 'icp' },
  brand_voice: { tabla: 'mkt_input_value', campos: 'field_key, value, position', filtro: 'brand_voice' },
  strategy: { tabla: 'mkt_input_value', campos: 'field_key, value, position', filtro: 'strategy' },
  // Estrategia SEM: objetivo de lista cerrada + vigencia. El nombre del producto que se empuja se
  // resuelve por la clave foránea, para que el flujo no tenga que pedir los productos aparte.
  sem_strategy: {
    tabla: 'mkt_sem_strategy',
    campos:
      'objective, starts_on, ends_on, budget_monthly, currency, geo, landing_url, status, notes, mkt_focus_product(name)',
    filtro: null,
  },
  channel_target: { tabla: 'mkt_channel_target', campos: 'channel, metric, target, period', filtro: null },
  competitor: { tabla: 'mkt_competitor', campos: 'name, website, notes, priority', filtro: null },
  focus_product: { tabla: 'mkt_focus_product', campos: 'name, description, price_note, priority, status', filtro: null },
  work_items: { tabla: 'work_item', campos: 'data, status, created_at', filtro: null },
} as const;

type Origen = keyof typeof ORIGENES;
const esOrigen = (v: unknown): v is Origen => typeof v === 'string' && v in ORIGENES;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const expected = Deno.env.get('AP_INTEGRATION_TOKEN');
  if (!expected) return json({ error: 'Función mal configurada' }, 500);
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

  const { job_role_key: jobRoleKey, source, collection, status } = body as Record<string, unknown>;

  if (typeof jobRoleKey !== 'string' || jobRoleKey.trim() === '') {
    return json({ error: 'Falta job_role_key' }, 400);
  }
  if (!esOrigen(source)) {
    return json({ error: `source no válido. Admitidos: ${Object.keys(ORIGENES).join(', ')}` }, 400);
  }
  if (source === 'work_items' && (typeof collection !== 'string' || collection.trim() === '')) {
    return json({ error: 'Para source=work_items hace falta collection' }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: specialist, error: specialistError } = await admin
    .from('specialists')
    .select('id')
    .eq('job_role_key', jobRoleKey)
    .maybeSingle<{ id: string }>();
  if (specialistError) return json({ error: 'No se ha podido resolver el especialista' }, 500);
  if (!specialist) {
    // Pasa si el especialista está contratado en Vrutal1st pero el sync todavía no ha bajado.
    return json({ error: `El especialista ${jobRoleKey} no está dado de alta en esta cuenta todavía` }, 409);
  }

  const def = ORIGENES[source];

  if (source === 'work_items') {
    // Leer la salida de otro flujo: solo lo ya entregado o aprobado, nunca una propuesta
    // pendiente de decidir. Por defecto, 'approved'.
    const quiere = typeof status === 'string' ? status : 'approved';
    if (!['approved', 'delivered'].includes(quiere)) {
      return json({ error: 'status solo puede ser approved o delivered' }, 400);
    }
    const { data: col, error: colError } = await admin
      .from('work_collection')
      .select('id')
      .eq('specialist_id', specialist.id)
      .eq('collection_key', collection as string)
      .maybeSingle<{ id: string }>();
    if (colError) return json({ error: 'No se ha podido resolver la colección' }, 500);
    if (!col) return json({ error: `La colección ${String(collection)} no existe para ${jobRoleKey}` }, 409);

    const { data, error } = await admin
      .from('work_item')
      .select(def.campos)
      .eq('collection_id', col.id)
      .eq('status', quiere)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) return json({ error: 'No se ha podido leer el trabajo entregado' }, 500);
    const filas = (data ?? []).map((f) => (f as { data: unknown }).data);
    return json({ source, collection, status: quiere, count: filas.length, rows: filas });
  }

  let query = admin.from(def.tabla).select(def.campos);
  if (def.filtro) query = query.eq('input_key', def.filtro).order('position');
  const { data, error } = await query.limit(500);
  if (error) return json({ error: 'No se ha podido leer el scope de negocio' }, 500);

  let rows: unknown[] = data ?? [];
  if (source === 'sem_strategy') {
    // El producto llega anidado («mkt_focus_product: { name }»). Se aplana a `focus_product` para
    // que el prompt lea un nombre, no un objeto, y para no filtrar el nombre de la tabla.
    rows = rows.map((f) => {
      const { mkt_focus_product: producto, ...resto } = f as Record<string, unknown>;
      const nombre = producto && typeof producto === 'object' ? (producto as { name?: unknown }).name : null;
      return { ...resto, focus_product: typeof nombre === 'string' ? nombre : null };
    });
  }
  // Un flujo con entradas vacías debe fallar y no escribir nada: se devuelve el conteo para
  // que el paso siguiente pueda pararlo sin tener que adivinarlo.
  return json({ source, count: rows.length, rows });
});
