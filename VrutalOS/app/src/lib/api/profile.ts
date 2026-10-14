import { supabase } from '../supabaseClient';
import { isBool, isObj, isStr, isStrOrNull } from '../guards';
import type { Guard } from '../guards';
import type { Profile } from '../types';
import { ApiError } from './client';

const isProfile: Guard<Profile> = (v): v is Profile =>
  isObj(v) &&
  isStr(v.id) &&
  isStrOrNull(v.full_name) &&
  (v.role === 'client_admin' || v.role === 'client_manager' || v.role === 'client_user') &&
  isBool(v.is_active);

/** Perfil de la persona que ha iniciado sesión. Null si no existe fila (no debería pasar: la crea un trigger). */
export async function getMyProfile(userId: string, signal?: AbortSignal): Promise<Profile | null> {
  const query = supabase.from('profiles').select('id, full_name, role, is_active').eq('id', userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  if (error) throw new ApiError(error.code, error.message);
  if (data === null) return null;
  if (!isProfile(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de profiles');
  return data;
}
