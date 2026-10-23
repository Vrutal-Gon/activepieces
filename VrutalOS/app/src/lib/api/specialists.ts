import { supabase } from '../supabaseClient';
import { isObj, isStr } from '../guards';
import type { Profile, Specialist } from '../types';
import { ApiError } from './client';

// El catálogo de tareas de Vrutal (catalog_flow_ro…) NO se lee desde la app: es propiedad de Vrutal y el
// servidor no concede permiso de lectura al cliente. Lo que se enseña de un especialista es lo que produce.
const SPECIALIST_COLUMNS = 'id, display_name, job_role_key, phase, autonomy_level, status';

function toSpecialist(v: unknown): Specialist | null {
  if (!isObj(v)) return null;
  if (
    !isStr(v.id) ||
    !isStr(v.display_name) ||
    !isStr(v.job_role_key) ||
    !isStr(v.phase) ||
    !isStr(v.autonomy_level) ||
    !isStr(v.status)
  ) {
    return null;
  }
  return {
    id: v.id,
    display_name: v.display_name,
    job_role_key: v.job_role_key,
    phase: v.phase,
    autonomy_level: v.autonomy_level,
    status: v.status,
  };
}

export async function listSpecialists(signal: AbortSignal): Promise<Specialist[]> {
  const { data, error } = await supabase
    .from('specialists')
    .select(SPECIALIST_COLUMNS)
    .order('display_name')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  const rows = (data ?? []).map(toSpecialist);
  if (rows.some((r) => r === null)) throw new ApiError('bad_shape', 'Respuesta inesperada de specialists');
  return rows as Specialist[];
}

export async function getSpecialist(id: string, signal: AbortSignal): Promise<Specialist | null> {
  const { data, error } = await supabase
    .from('specialists')
    .select(SPECIALIST_COLUMNS)
    .eq('id', id)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw new ApiError(error.code, error.message);
  if (data === null) return null;
  const row = toSpecialist(data);
  if (row === null) throw new ApiError('bad_shape', 'Respuesta inesperada de specialists');
  return row;
}

/** Especialistas que el Admin ha habilitado para esta persona. */
export async function listMySpecialistIds(userId: string, signal: AbortSignal): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_specialist_access')
    .select('specialist_id')
    .eq('profile_id', userId)
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  const rows = data ?? [];
  if (!rows.every((r) => isObj(r) && isStr(r.specialist_id))) {
    throw new ApiError('bad_shape', 'Respuesta inesperada de user_specialist_access');
  }
  return rows.map((r) => r.specialist_id as string);
}

/**
 * Los especialistas que esta persona puede usar: el Admin ve todos; el resto, los que se le
 * han habilitado. Solo UX — el servidor deja leer todos los especialistas, esto filtra lo que
 * se muestra. Lo comparten la lista de Especialistas y el Tablero.
 */
export async function listVisibleSpecialists(profile: Profile, signal: AbortSignal): Promise<Specialist[]> {
  const [all, mine] = await Promise.all([
    listSpecialists(signal),
    profile.role === 'client_admin' ? Promise.resolve(null) : listMySpecialistIds(profile.id, signal),
  ]);
  return mine === null ? all : all.filter((s) => mine.includes(s.id));
}
