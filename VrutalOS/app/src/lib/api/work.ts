import { supabase } from '../supabaseClient';
import { isArrayOf, isNum, isObj, isStr, isStrOrNull } from '../guards';
import type { Guard } from '../guards';
import type { WorkCollection, WorkColumn, WorkColumnType, WorkItem, WorkStatus } from '../types';
import { ApiError } from './client';

const COLUMN_TYPES: WorkColumnType[] = ['text', 'number', 'date', 'badge', 'url'];
const STATUSES: WorkStatus[] = ['proposed', 'approved', 'rejected', 'delivered'];

// Postgres devuelve los conteos (bigint) como número o como texto según el tamaño.
const num = (v: unknown): number | null => {
  if (isNum(v)) return v;
  if (isStr(v) && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

/** Una columna mal descrita no tumba la pestaña: se ignora y se enseñan las demás. */
function toColumns(v: unknown): WorkColumn[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((c): WorkColumn[] => {
    if (!isObj(c) || !isStr(c.key) || !isStr(c.label)) return [];
    const type = COLUMN_TYPES.find((t) => t === c.type) ?? 'text';
    return [{ key: c.key, label: c.label, type }];
  });
}

function toCollection(v: unknown): WorkCollection | null {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.specialist_id) || !isStr(v.collection_key) || !isStr(v.label)) return null;
  const proposed = num(v.proposed);
  const approved = num(v.approved);
  const rejected = num(v.rejected);
  const delivered = num(v.delivered);
  if (proposed === null || approved === null || rejected === null || delivered === null) return null;
  return {
    id: v.id,
    specialist_id: v.specialist_id,
    collection_key: v.collection_key,
    label: v.label,
    approvable: v.approvable === true,
    columns: toColumns(v.columns),
    proposed,
    approved,
    rejected,
    delivered,
  };
}

const isItem: Guard<WorkItem> = (v): v is WorkItem =>
  isObj(v) &&
  isStr(v.id) &&
  isObj(v.data) &&
  STATUSES.some((s) => s === v.status) &&
  isStr(v.created_at) &&
  isStrOrNull(v.decided_at);

/** Las pestañas de un especialista (lo decide el servidor: solo las de especialistas a los que se tiene acceso). */
export async function listCollections(specialistId: string, signal: AbortSignal): Promise<WorkCollection[]> {
  const { data, error } = await supabase
    .from('work_collection_overview')
    .select('id, specialist_id, collection_key, label, position, approvable, columns, proposed, approved, rejected, delivered')
    .eq('specialist_id', specialistId)
    .order('position')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  const rows = (data ?? []).map(toCollection);
  if (rows.some((r) => r === null)) throw new ApiError('bad_shape', 'Respuesta inesperada de work_collection_overview');
  return rows as WorkCollection[];
}

/** Las `limit` filas más recientes de una pestaña en un estado. Se pide una de más para saber si hay más. */
export async function listItems(
  collectionId: string,
  status: WorkStatus,
  limit: number,
  signal: AbortSignal,
): Promise<{ items: WorkItem[]; hasMore: boolean }> {
  const { data, error } = await supabase
    .from('work_item')
    .select('id, data, status, created_at, decided_at')
    .eq('collection_id', collectionId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .order('id')
    .limit(limit + 1)
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isItem)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de work_item');
  return { items: data.slice(0, limit), hasMore: data.length > limit };
}

const DECIDE_BATCH = 200; // el servidor admite como máximo 200 filas por llamada

/** Aprueba o rechaza propuestas. Devuelve cuántas filas cambió de verdad el servidor (ignora las ya decididas). */
export async function decideItems(ids: string[], decision: 'approved' | 'rejected'): Promise<number> {
  let changed = 0;
  for (let i = 0; i < ids.length; i += DECIDE_BATCH) {
    const { data, error } = await supabase.rpc('decide_work_items', {
      p_ids: ids.slice(i, i + DECIDE_BATCH),
      p_decision: decision,
    });
    if (error) throw new ApiError(error.code, error.message);
    const n = num(data);
    if (n === null) throw new ApiError('bad_shape', 'Respuesta inesperada de decide_work_items');
    changed += n;
  }
  return changed;
}
