import { supabase } from '../supabaseClient';
import { isArrayOf, isObj, isStr } from '../guards';
import type { Guard } from '../guards';
import { ApiError } from './client';

interface AccessRow {
  profile_id: string;
  specialist_id: string;
}

const isAccessRow: Guard<AccessRow> = (v): v is AccessRow => isObj(v) && isStr(v.profile_id) && isStr(v.specialist_id);

export const accessKey = (profileId: string, specialistId: string) => `${profileId}:${specialistId}`;

/** Todas las habilitaciones de la empresa, como claves «persona:especialista». Solo un Admin las ve todas. */
export async function listAccess(signal: AbortSignal): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_specialist_access')
    .select('profile_id, specialist_id')
    .abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isAccessRow)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de user_specialist_access');
  return new Set(data.map((r) => accessKey(r.profile_id, r.specialist_id)));
}

const UNIQUE_VIOLATION = '23505';

/**
 * Habilita o quita un especialista a una persona. Devuelve false si el servidor no lo ha aplicado.
 * Un insert que RLS rechaza da error; un borrado que RLS rechaza afecta a 0 filas sin error,
 * así que se pide la fila de vuelta para saber si se hizo.
 */
export async function setAccess(
  profileId: string,
  specialistId: string,
  enabled: boolean,
  enabledBy: string,
): Promise<boolean> {
  if (enabled) {
    const { error } = await supabase
      .from('user_specialist_access')
      .insert({ profile_id: profileId, specialist_id: specialistId, enabled_by: enabledBy });
    // Si ya estaba habilitado (otra pestaña, otro admin), el resultado es el que se pedía.
    if (error && error.code !== UNIQUE_VIOLATION) throw new ApiError(error.code, error.message);
    return true;
  }
  const { data, error } = await supabase
    .from('user_specialist_access')
    .delete()
    .eq('profile_id', profileId)
    .eq('specialist_id', specialistId)
    .select('profile_id');
  if (error) throw new ApiError(error.code, error.message);
  return Array.isArray(data) && data.length === 1;
}
