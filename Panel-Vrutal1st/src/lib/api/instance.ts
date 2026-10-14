import type { OnboardingStep, TenantInstance, TenantInstanceEditable } from '../types';
import { isArrayOf, isNum, isObj, isStr, isStrOrNull, isVoid } from '../guards';
import { rpc } from './client';

// Instancia del cliente y checklist de alta (LAB12 cap. 3 bis). Lectura: cartera; escritura: 'tenants.write'.

const isInstance = (v: unknown): v is TenantInstance =>
  isObj(v) &&
  isStrOrNull(v.host) &&
  isStrOrNull(v.public_url) &&
  isStrOrNull(v.template_version) &&
  isStrOrNull(v.ap_version) &&
  isStrOrNull(v.app_version) &&
  isStrOrNull(v.notes) &&
  isStr(v.updated_at) &&
  isStrOrNull(v.updated_by_name) &&
  typeof v.postiz_key_set === 'boolean';

const isStep = (v: unknown): v is OnboardingStep =>
  isObj(v) &&
  isStr(v.step_key) &&
  isNum(v.ord) &&
  isStrOrNull(v.done_at) &&
  isStrOrNull(v.done_by_name) &&
  isStrOrNull(v.evidence) &&
  typeof v.can_complete === 'boolean' &&
  typeof v.can_reopen === 'boolean';

/** La instancia registrada, o null si aún no hay ninguna. */
export async function getTenantInstance(tenantId: string, signal?: AbortSignal) {
  const rows = await rpc('staff_get_tenant_instance', { p_tenant_id: tenantId }, isArrayOf(isInstance), signal);
  return rows[0] ?? null;
}

export function saveTenantInstance(tenantId: string, i: TenantInstanceEditable) {
  return rpc(
    'staff_upsert_tenant_instance',
    {
      p_tenant_id: tenantId,
      p_host: i.host,
      p_public_url: i.public_url,
      p_template_version: i.template_version,
      p_ap_version: i.ap_version,
      p_app_version: i.app_version,
      p_notes: i.notes,
    },
    isVoid,
  );
}

/** Postiz: el staff pone/sobrescribe la clave; nunca se vuelve a leer en claro (igual que integrations.secret_ref). */
export function setTenantPostizKey(tenantId: string, key: string) {
  return rpc('staff_set_tenant_postiz_key', { p_tenant_id: tenantId, p_key: key }, isVoid);
}

export function listOnboardingSteps(tenantId: string, signal?: AbortSignal) {
  return rpc('staff_list_onboarding_steps', { p_tenant_id: tenantId }, isArrayOf(isStep), signal);
}

export function setOnboardingStep(tenantId: string, stepKey: string, done: boolean, evidence: string | null) {
  return rpc(
    'staff_set_onboarding_step',
    { p_tenant_id: tenantId, p_step_key: stepKey, p_done: done, p_evidence: evidence },
    isVoid,
  );
}
