import type {
  FleetRow,
  SystemOption,
  TenantFlow,
  TenantDetail,
  TenantEditable,
  TenantReportingItem,
  TenantSpecialistDetail,
  TenantStackChoice,
} from '../types';
import { isArrayOf, isNum, isNumOrNull, isObj, isStr, isStrOrNull, isVoid } from '../guards';
import { rpc } from './client';

// Ficha de cliente. Toda RPC comprueba en servidor staff_can_access_tenant (cartera).

const isTenantDetail = (v: unknown): v is TenantDetail =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.name) &&
  isStr(v.status) &&
  isNumOrNull(v.size_employees) &&
  isStrOrNull(v.website) &&
  typeof v.is_internal === 'boolean' &&
  isStrOrNull(v.account_manager_profile_id) &&
  isStr(v.created_at) &&
  typeof v.can_edit === 'boolean';

const SPECIALIST_STATUSES: readonly string[] = ['contracted', 'paused', 'cancelled'];

const isSpecialist = (v: unknown): v is TenantSpecialistDetail =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.job_role_key) &&
  isStrOrNull(v.job_role_name) &&
  isNum(v.job_role_version) &&
  isNumOrNull(v.latest_active_version) &&
  isStr(v.status) &&
  SPECIALIST_STATUSES.includes(v.status) &&
  isStr(v.contracted_at) &&
  isNum(v.flows_enabled) &&
  isNum(v.flows_total);

const isReportingItem = (v: unknown): v is TenantReportingItem =>
  isObj(v) &&
  (v.kind === 'report' || v.kind === 'kpi') &&
  isStr(v.job_role_key) &&
  isStr(v.report_key) &&
  isStr(v.item_key) &&
  isStr(v.name) &&
  isStrOrNull(v.description) &&
  isStrOrNull(v.status);

const isStackChoice = (v: unknown): v is TenantStackChoice =>
  isObj(v) && isStr(v.system_category) && isStr(v.system_option_id) && isStr(v.system_name) && isStrOrNull(v.version);

const isSystemOption = (v: unknown): v is SystemOption =>
  isObj(v) && isStr(v.id) && isStr(v.system_category) && isStr(v.name) && isStrOrNull(v.version);

const isFlow = (v: unknown): v is TenantFlow =>
  isObj(v) &&
  isStr(v.specialist_id) &&
  isStr(v.job_role_key) &&
  isStr(v.task_code) &&
  isStr(v.statement) &&
  isNum(v.task_version) &&
  isStr(v.autonomy_level) &&
  isStr(v.status);

const isFleetRow = (v: unknown): v is FleetRow =>
  isObj(v) &&
  isStr(v.tenant_id) &&
  isStr(v.name) &&
  isStr(v.status) &&
  typeof v.is_internal === 'boolean' &&
  isStrOrNull(v.data_plane_status) &&
  isStrOrNull(v.account_manager_profile_id) &&
  isStrOrNull(v.account_manager_name) &&
  isNum(v.specialists_active) &&
  isNum(v.specialists_paused) &&
  isNum(v.specialists_behind) &&
  isNum(v.flows_enabled);

export async function getTenant(tenantId: string, signal?: AbortSignal): Promise<TenantDetail | null> {
  const rows = await rpc('staff_get_tenant', { p_tenant_id: tenantId }, isArrayOf(isTenantDetail), signal);
  return rows[0] ?? null;
}

export function updateTenant(tenantId: string, t: TenantEditable) {
  return rpc(
    'staff_update_tenant',
    {
      p_tenant_id: tenantId,
      p_name: t.name,
      p_legal_name: t.legal_name,
      p_tax_id: t.tax_id,
      p_industry: t.industry,
      p_size_employees: t.size_employees,
      p_email: t.email,
      p_phone: t.phone,
      p_website: t.website,
      p_address_line: t.address_line,
      p_city: t.city,
      p_postal_code: t.postal_code,
      p_region: t.region,
      p_country: t.country,
    },
    isVoid,
  );
}

export function listTenantSpecialists(tenantId: string, signal?: AbortSignal) {
  return rpc('staff_list_tenant_specialists', { p_tenant_id: tenantId }, isArrayOf(isSpecialist), signal);
}

export function listTenantReporting(tenantId: string, signal?: AbortSignal) {
  return rpc('staff_list_tenant_reporting', { p_tenant_id: tenantId }, isArrayOf(isReportingItem), signal);
}

// Stack: RPC existentes (exigen superadmin/admin en servidor).

export function listTenantStack(tenantId: string, signal?: AbortSignal) {
  return rpc('list_tenant_stack', { p_tenant_id: tenantId }, isArrayOf(isStackChoice), signal);
}

export function listSystemOptions(signal?: AbortSignal) {
  return rpc('catalog_list_system_options', undefined, isArrayOf(isSystemOption), signal);
}

export function setTenantStackChoice(tenantId: string, option: SystemOption) {
  return rpc(
    'set_tenant_stack_choice',
    { p_tenant_id: tenantId, p_system_category: option.system_category, p_system_option_id: option.id },
    isVoid,
  );
}

export function removeTenantStackChoice(tenantId: string, category: string) {
  return rpc('remove_tenant_stack_choice', { p_tenant_id: tenantId, p_system_category: category }, isVoid);
}

export function listTenantFlows(tenantId: string, signal?: AbortSignal) {
  return rpc('staff_list_tenant_flows', { p_tenant_id: tenantId }, isArrayOf(isFlow), signal);
}

/** El servidor fuerza "solo mi cartera" a quien no sea superadmin/admin. */
export function getFleetOverview(onlyMine: boolean, signal?: AbortSignal) {
  return rpc('staff_dashboard_overview', { p_only_mine: onlyMine }, isArrayOf(isFleetRow), signal);
}
