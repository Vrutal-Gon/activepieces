import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { isArrayOf, isObj, isStr, isStrOrNull } from '../guards';
import type { Guard } from '../guards';
import type { Approval } from '../types';
import { ApiError } from './client';

const COLUMNS = 'id, specialist_id, task_key, payload, status, requested_at, decided_by, decided_at, assigned_to';

const isApproval: Guard<Approval> = (v): v is Approval =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.specialist_id) &&
  isStrOrNull(v.task_key) &&
  (v.status === 'pending' || v.status === 'approved' || v.status === 'rejected') &&
  isStr(v.requested_at) &&
  isStrOrNull(v.decided_by) &&
  isStrOrNull(v.decided_at) &&
  isStrOrNull(v.assigned_to);

/** Las aprobaciones que esta persona puede ver (lo decide el servidor): el Admin, todas; el resto, las suyas o delegadas. */
export async function listApprovals(signal: AbortSignal): Promise<Approval[]> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select(COLUMNS)
    .order('requested_at', { ascending: false })
    .limit(200)
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isApproval)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de approval_requests');
  return data;
}

export async function countPendingApprovals(signal: AbortSignal): Promise<number> {
  const { count, error } = await supabase
    .from('approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  return count ?? 0;
}

export interface DecideResult {
  /** La decisión ha quedado registrada. */
  decided: boolean;
  /** El flujo que esperaba se ha reanudado. `false` si la aprobación no venía de un flujo. */
  resumed: boolean;
  /** Mensaje a enseñar cuando la decisión se guardó pero el flujo no se pudo reanudar. */
  warning?: string;
}

/**
 * Aprueba o rechaza, y reanuda el flujo de Activepieces que estaba esperando.
 *
 * Va por la Edge Function `approval-decide` y no por un UPDATE desde el navegador (como
 * hasta el 2026-10-13) por dos razones: el enlace que reanuda el flujo no es legible para
 * `authenticated` —quien lo leyera reanudaría un flujo sin decidir nada— y así `decided_by`
 * y `decided_at` los fija el servidor, no el cliente, que es la deuda que estaba anotada en
 * `db/plantillas/cambios/README.md`.
 *
 * `decisions` solo hace falta cuando la aprobación lleva varios elementos (p. ej. F14 adapta
 * una pieza a varios canales y se decide canal por canal): es el mapa de qué entra y qué no.
 */
export async function decideApproval(
  id: string,
  approve: boolean,
  decisions?: Record<string, boolean>,
): Promise<DecideResult> {
  const { data, error } = await supabase.functions.invoke('approval-decide', {
    body: { approval_id: id, approve, item_decisions: decisions ?? null },
  });

  if (!error) {
    const ok = isObj(data) && data.decided === true;
    return { decided: ok, resumed: isObj(data) && data.resumed === true };
  }

  let message = 'No se ha podido registrar tu decisión.';
  let decided = false;
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body)) {
      if (isStr(body.error)) message = body.error;
      // 502: la decisión sí quedó guardada, lo que falló fue reanudar el flujo.
      if (body.decided === true) decided = true;
    }
  }
  if (decided) return { decided: true, resumed: false, warning: message };
  throw new ApiError('service_message', message);
}

/** Nombres de las personas del equipo, para «decidida por …». */
export async function listProfileNames(signal: AbortSignal): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('profiles').select('id, full_name').abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  const rows = data ?? [];
  if (!rows.every((r) => isObj(r) && isStr(r.id) && isStrOrNull(r.full_name))) {
    throw new ApiError('bad_shape', 'Respuesta inesperada de profiles');
  }
  return new Map(rows.map((r) => [r.id as string, (r.full_name as string | null) ?? 'Sin nombre']));
}
