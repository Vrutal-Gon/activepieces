import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import type { PlatformRole, StaffIdentity, StaffMember, Tenant, TenantOverview, TenantSpecialistRow } from '../types';
import { isArrayOf, isObj, isStr, isStrArray, isStrOrNull, isVoid } from '../guards';
import { ApiError, rpc } from './client';

const isStaffIdentity = (v: unknown): v is StaffIdentity =>
  isObj(v) &&
  isStr(v.profile_id) &&
  isStr(v.email) &&
  isStrOrNull(v.full_name) &&
  isStrArray(v.role_keys) &&
  isStrArray(v.role_names) &&
  isStrArray(v.permission_keys);

const isStaffMember = (v: unknown): v is StaffMember =>
  isObj(v) &&
  isStr(v.profile_id) &&
  isStr(v.email) &&
  isStrOrNull(v.full_name) &&
  isStr(v.status) &&
  isStrArray(v.role_keys) &&
  isStr(v.created_at) &&
  isStrOrNull(v.last_sign_in_at);

const isTenantOverview = (v: unknown): v is TenantOverview =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.name) &&
  isStr(v.status) &&
  isStrOrNull(v.industry) &&
  typeof v.is_internal === 'boolean' &&
  isStrOrNull(v.account_manager_profile_id) &&
  isStrOrNull(v.account_manager_name);

const isTenant = (v: unknown): v is Tenant =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.name) &&
  isStr(v.status) &&
  typeof v.is_internal === 'boolean' &&
  isStrOrNull(v.account_manager_profile_id);

const SPECIALIST_STATUSES: readonly string[] = ['contracted', 'paused', 'cancelled'];

const isTenantSpecialistRow = (v: unknown): v is TenantSpecialistRow =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.job_role_key) &&
  typeof v.job_role_version === 'number' &&
  isStr(v.status) &&
  SPECIALIST_STATUSES.includes(v.status) &&
  isStr(v.contracted_at) &&
  isStrOrNull(v.notes);

const isPlatformRole = (v: unknown): v is PlatformRole =>
  isObj(v) && isStr(v.key) && isStr(v.name) && isStrArray(v.permission_keys);

/** Devuelve null si la sesión no tiene perfil. */
export async function getStaffIdentity(signal?: AbortSignal): Promise<StaffIdentity | null> {
  const rows = await rpc('staff_whoami', undefined, isArrayOf(isStaffIdentity), signal);
  return rows[0] ?? null;
}

export function listStaff(signal?: AbortSignal) {
  return rpc('staff_list', undefined, isArrayOf(isStaffMember), signal);
}

/** El servidor fuerza "solo mi cartera" a quien no sea superadmin/admin. */
export function listTenants(onlyMine: boolean, signal?: AbortSignal) {
  return rpc('staff_list_tenants', { p_only_mine: onlyMine }, isArrayOf(isTenantOverview), signal);
}

export function setTenantAccountManager(tenantId: string, profileId: string | null) {
  return rpc(
    'staff_set_tenant_account_manager',
    { p_tenant_id: tenantId, p_profile_id: profileId },
    isVoid,
  );
}

/** El servidor devuelve 42501 si el cliente no está en la cartera de quien llama. */
export async function getTenant(tenantId: string, signal?: AbortSignal): Promise<Tenant | null> {
  const rows = await rpc('staff_get_tenant', { p_tenant_id: tenantId }, isArrayOf(isTenant), signal);
  return rows[0] ?? null;
}

export function listTenantSpecialists(tenantId: string, signal?: AbortSignal) {
  return rpc('staff_list_tenant_specialists', { p_tenant_id: tenantId }, isArrayOf(isTenantSpecialistRow), signal);
}

export function listPlatformRoles(signal?: AbortSignal) {
  return rpc('staff_list_platform_roles', undefined, isArrayOf(isPlatformRole), signal);
}

export interface StaffInvite {
  email: string;
  fullName: string;
  roleKey: string;
}

/** Edge Function staff-invite: comprueba en servidor que quien llama es superadmin. */
export async function inviteStaff({ email, fullName, roleKey }: StaffInvite): Promise<void> {
  const { error } = await supabase.functions.invoke('staff-invite', {
    body: { email, full_name: fullName, role_key: roleKey },
  });
  if (!error) return;
  let message = 'No se ha podido enviar la invitación.';
  const response: unknown = error instanceof FunctionsHttpError ? error.context : null;
  if (response instanceof Response) {
    const body: unknown = await response.json().catch(() => null);
    if (isObj(body) && isStr(body.error)) message = body.error;
  }
  throw new ApiError('invite_failed', message);
}
