import { supabase } from '../supabaseClient';
import { isArrayOf, isNum, isObj, isStr } from '../guards';
import type { Guard } from '../guards';
import type { UsageRow } from '../types';
import { ApiError } from './client';

// Postgres devuelve bigint y numeric como número o como texto según el tamaño: se acepta y normaliza ambos.
const num = (v: unknown): number | null => {
  if (isNum(v)) return v;
  if (isStr(v) && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};

type RawRow = { specialist_id: string } & Record<'runs' | 'tokens_in' | 'tokens_out' | 'cost_usd', unknown>;
const isRaw: Guard<RawRow> = (v): v is RawRow =>
  isObj(v) &&
  isStr(v.specialist_id) &&
  num(v.runs) !== null &&
  num(v.tokens_in) !== null &&
  num(v.tokens_out) !== null &&
  num(v.cost_usd) !== null;

/** Consumo por especialista en [from, to). Solo un Admin activo recibe filas (lo decide el servidor). */
export async function getUsage(from: Date, to: Date, signal: AbortSignal): Promise<UsageRow[]> {
  const { data, error } = await supabase
    .rpc('usage_summary', { p_from: from.toISOString(), p_to: to.toISOString() })
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isRaw)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de usage_summary');
  return data.map((r) => ({
    specialist_id: r.specialist_id,
    runs: num(r.runs) ?? 0,
    tokens_in: num(r.tokens_in) ?? 0,
    tokens_out: num(r.tokens_out) ?? 0,
    cost_usd: num(r.cost_usd) ?? 0,
  }));
}
