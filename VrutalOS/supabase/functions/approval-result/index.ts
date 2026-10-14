// Edge Function: el flujo, al reanudarse, pregunta qué decidió el cliente.
//
// Hace falta porque el enlace que reanuda un flujo de Activepieces es un GET sin cuerpo: al
// despertar, el flujo no sabe si lo aprobaron ni, cuando la aprobación lleva varios elementos
// (F14 adapta una pieza a varios canales), cuáles de ellos pasaron. Lo lee de aquí.
//
// Server-to-server, gate con X-AP-Token, igual que approval-create e integration-get-key.
// Deliberadamente estrecha: solo devuelve el estado y las decisiones, nunca `resume_url` ni
// el `payload` (el flujo ya tiene el payload: lo mandó él).
//
// Secret requerido: AP_INTEGRATION_TOKEN.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

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

  const { approval_id: approvalId } = body as Record<string, unknown>;
  if (typeof approvalId !== 'string' || approvalId.trim() === '') {
    return json({ error: 'Falta approval_id' }, 400);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: row, error } = await admin
    .from('approval_requests')
    .select('status, item_decisions, decided_at')
    .eq('id', approvalId)
    .maybeSingle<{ status: string; item_decisions: unknown; decided_at: string | null }>();

  if (error) return json({ error: 'No se ha podido leer la aprobación' }, 500);
  if (!row) return json({ error: 'Esa aprobación no existe' }, 404);

  // Fail-closed: si sigue pendiente, el flujo NO debe seguir. Puede pasar si alguien llama a
  // la URL de reanudación por su cuenta en vez de decidir en la pantalla.
  if (row.status === 'pending') {
    return json({ error: 'Esta aprobación sigue pendiente de decisión' }, 409);
  }

  return json({
    status: row.status,
    approved: row.status === 'approved',
    item_decisions: row.item_decisions ?? null,
    decided_at: row.decided_at,
  });
});
