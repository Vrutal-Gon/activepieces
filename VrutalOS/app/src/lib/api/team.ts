import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { isArrayOf, isBool, isObj, isStr, isStrOrNull } from '../guards';
import type { Guard } from '../guards';
import type { ProfileRole, TeamMember } from '../types';
import { ApiError } from './client';

const isTeamMember: Guard<TeamMember> = (v): v is TeamMember =>
  isObj(v) &&
  isStr(v.id) &&
  isStrOrNull(v.full_name) &&
  isStrOrNull(v.email) &&
  (v.role === 'client_admin' || v.role === 'client_manager' || v.role === 'client_user') &&
  isBool(v.is_active) &&
  isStr(v.created_at) &&
  isStrOrNull(v.last_sign_in_at);

/** Equipo de la empresa. Solo devuelve filas a un Admin activo (lo decide el servidor). */
export async function listTeam(signal: AbortSignal): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('team_members').abortSignal(signal);
  if (error) throw new ApiError(error.code, error.message);
  if (!isArrayOf(isTeamMember)(data)) throw new ApiError('bad_shape', 'Respuesta inesperada de team_members');
  return data;
}

/**
 * Las políticas de RLS bloquean en silencio (0 filas, sin error). Por eso se pide la fila de vuelta:
 * si no llega, el cambio no se ha hecho y hay que decirlo.
 */
async function updateProfile(id: string, change: { role: ProfileRole } | { is_active: boolean }): Promise<boolean> {
  const { data, error } = await supabase.from('profiles').update(change).eq('id', id).select('id');
  if (error) throw new ApiError(error.code, error.message);
  return Array.isArray(data) && data.length === 1;
}

export interface MemberInvite {
  email: string;
  fullName: string;
  role: ProfileRole;
}

/** Edge Function team-invite: comprueba en servidor que quien llama es Admin activo. */
export async function inviteMember({ email, fullName, role }: MemberInvite): Promise<void> {
  const { error } = await supabase.functions.invoke('team-invite', {
    body: { email, full_name: fullName, role },
  });
  if (!error) return;
  // Los mensajes de la función son nuestros y están en español: se pueden enseñar tal cual.
  let message = 'No se ha podido enviar la invitación.';
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body) && isStr(body.error)) message = body.error;
  }
  throw new ApiError('service_message', message);
}

export const setMemberRole = (id: string, role: ProfileRole) => updateProfile(id, { role });
export const setMemberActive = (id: string, isActive: boolean) => updateProfile(id, { is_active: isActive });
