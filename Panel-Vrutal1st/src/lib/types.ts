export type JobRoleStatus = 'draft' | 'active' | 'retired';
export type RiskLevel = 'low' | 'medium' | 'medium_high' | 'high';
export type Seniority = 'operativo' | 'mando' | 'direccion';

export interface JobRoleKeySummary {
  key: string;
  name: string;
  latest_version: number;
  status: JobRoleStatus;
  seniority: Seniority | null;
  domain_id: string | null;
}

export interface JobRoleVersionSummary {
  id: string;
  version: number;
  status: JobRoleStatus;
  updated_at: string;
}

export interface JobRoleFull {
  id: string;
  key: string;
  name: string;
  version: number;
  mission: string | null;
  risk_level: RiskLevel;
  model_tier: string | null;
  autonomy_scope: string;
  requires_approval_scope: string;
  never_does: string;
  consults_memory_before_producing: boolean;
  status: JobRoleStatus;
  domain_id: string | null;
  family: string | null;
  seniority: Seniority | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  name: string;
}

export type TenantSpecialistStatus = 'contracted' | 'paused' | 'cancelled';

export interface TenantForRole {
  tenant_id: string;
  tenant_name: string;
  job_role_version: number;
  status: TenantSpecialistStatus;
  contracted_at: string;
}

export interface TaskSummary {
  id: string;
  task_code: string;
  statement: string;
}

export type EffectClassification = 'read_only' | 'reversible' | 'irreversible';
export type Criticality = 'core' | 'standard' | 'peripheral';
export type ComponentMaturity = 'prototype' | 'tested' | 'production';
export type ComponentRoleInTask = 'executor' | 'validator' | 'enricher' | 'fallback';

export interface JobRoleTaskRow extends TaskSummary {
  task_id: string;
  effect_classification: EffectClassification;
  criticality: Criticality;
  time_weight_pct: number | null;
  process_id: string | null;
  process_name: string | null;
  process_sequence: number | null;
  primary_pattern: string | null;
}

export interface AvailableTask {
  id: string;
  task_code: string;
  statement: string;
  process_name: string | null;
}

export interface Component {
  id: string;
  name: string;
  comp_type: string;
  runtime: string | null;
  repo_ref: string | null;
  owner: string;
  maturity: ComponentMaturity;
  unit_cost_est: number | null;
  target_system: string | null;
}

export interface TaskComponentRow {
  component_id: string;
  component_name: string;
  comp_type: string;
  maturity: ComponentMaturity;
  target_system: string | null;
  role_in_task: ComponentRoleInTask;
  is_default: boolean;
}

export interface TenantDetail {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  status: string;
  industry: string | null;
  size_employees: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line: string | null;
  city: string | null;
  postal_code: string | null;
  region: string | null;
  country: string | null;
  is_internal: boolean;
  data_plane_status: string | null;
  holded_contact_id: string | null;
  supabase_project_ref: string | null;
  supabase_project_name: string | null;
  supabase_project_region: string | null;
  account_manager_profile_id: string | null;
  created_at: string;
  /** Lo calcula el servidor (permiso tenants.write). Solo UX: la RPC de edición lo vuelve a comprobar. */
  can_edit: boolean;
}

/** Campos editables de la ficha (staff_update_tenant). */
export type TenantEditable = Pick<
  TenantDetail,
  | 'name'
  | 'legal_name'
  | 'tax_id'
  | 'industry'
  | 'size_employees'
  | 'email'
  | 'phone'
  | 'website'
  | 'address_line'
  | 'city'
  | 'postal_code'
  | 'region'
  | 'country'
>;

export interface SystemOption {
  id: string;
  system_category: string;
  name: string;
  version: string | null;
  connection_notes: string | null;
  docs_url: string | null;
  /** Coincide con un `provider` de VrutalOS (`providers.ts`): si lo tiene, el sync lo habilita
   * en Integraciones del cliente en cuanto está en su Stack. Si no, es solo informativo. */
  provider_key: string | null;
}

export interface TenantStackChoice {
  system_category: string;
  system_option_id: string;
  system_name: string;
  version: string | null;
  notes: string | null;
  provider_key: string | null;
  /** Estado real en VrutalOS (sync cada 15 min, migración 030) — null si no es un sistema de
   * clave o si el cliente nunca lo configuró. */
  integration_status: 'active' | 'paused' | 'revoked' | null;
  integration_validated_at: string | null;
  integration_last_error: string | null;
}

export interface TenantSpecialistDetail {
  id: string;
  job_role_key: string;
  job_role_name: string | null;
  job_role_version: number;
  /** Última versión 'active' del rol en el catálogo; si es mayor que job_role_version, va atrasado. */
  latest_active_version: number | null;
  status: TenantSpecialistStatus;
  contracted_at: string;
  notes: string | null;
  flows_enabled: number;
  flows_total: number;
}

export interface TenantReportingItem {
  kind: 'report' | 'kpi';
  job_role_key: string;
  report_key: string;
  item_key: string;
  name: string;
  description: string | null;
  /** null = disponible en el catálogo pero no activado para este cliente. */
  status: string | null;
}

export interface Provider {
  id: string;
  name: string;
  category: string;
  pricing_model: string | null;
  unit_cost_est: number | null;
  notes: string | null;
  docs_url: string | null;
}

export type PublishStatus = 'draft' | 'validated' | 'deprecated';
export const BLOCK_KINDS = ['intake', 'normalize', 'context', 'decide', 'gate', 'act', 'audit'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export const COMPOSITION_PATTERNS = ['WORKFLOW', 'AGENT', 'MULTI_AGENT', 'RULES', 'SCRIPT', 'API', 'LLM', 'RAG', 'ML', 'PROMPT', 'HUMAN'] as const;

export interface Contract {
  key: string;
  version: number;
  description: string;
  json_schema: unknown;
  status: PublishStatus;
}

export interface Block {
  component_id: string;
  name: string;
  comp_type: string;
  maturity: string;
  kind: BlockKind | null;
  variant: Record<string, unknown>;
  version_count: number;
  latest_version: number | null;
}

export interface ComponentVersion {
  id: string;
  version: number;
  status: PublishStatus;
  artifact_ref: string | null;
  artifact_sha256: string | null;
  output_contract_key: string | null;
  output_contract_version: number | null;
  consumes: string[];
  changelog: string;
  created_at: string;
}

export interface Composition {
  id: string;
  key: string;
  version: number;
  name: string;
  pattern: string;
  status: PublishStatus;
  task_version: number;
  changelog: string;
  slot_count: number;
}

export interface CompositionSlot {
  id: string;
  position: number;
  slot_key: string;
  kind: BlockKind;
  optional: boolean;
  is_default: boolean;
  applies_when: Record<string, unknown>;
  component_version_id: string;
  component_id: string;
  component_name: string;
  variant: Record<string, unknown>;
  version: number;
  version_status: PublishStatus;
  output_contract: string | null;
}

export interface CompositionIssue {
  severity: 'error' | 'warning';
  slot_key: string | null;
  message: string;
}

export interface StaffIdentity {
  profile_id: string;
  email: string;
  full_name: string | null;
  role_keys: string[];
  role_names: string[];
  permission_keys: string[];
}

export interface StaffMember {
  profile_id: string;
  email: string;
  full_name: string | null;
  status: string;
  role_keys: string[];
  created_at: string;
  last_sign_in_at: string | null;
}

export interface TenantOverview {
  id: string;
  name: string;
  legal_name: string | null;
  status: string;
  industry: string | null;
  is_internal: boolean;
  data_plane_status: string | null;
  account_manager_profile_id: string | null;
  account_manager_name: string | null;
}

export interface PlatformRole {
  key: string;
  name: string;
  permission_keys: string[];
}

export interface TenantFlow {
  specialist_id: string;
  job_role_key: string;
  task_code: string;
  statement: string;
  task_version: number;
  autonomy_level: string;
  status: string;
}

/** Fila del dashboard: lo que el plano de control ya sabe de cada cliente. */
export interface FleetRow {
  tenant_id: string;
  name: string;
  status: string;
  is_internal: boolean;
  data_plane_status: string | null;
  account_manager_profile_id: string | null;
  account_manager_name: string | null;
  specialists_active: number;
  specialists_paused: number;
  specialists_behind: number;
  flows_enabled: number;
}

export interface TaskListRow extends TaskSummary {
  process_id: string | null;
  process_name: string | null;
  primary_pattern: string | null;
  role_count: number;
  component_count: number;
  composition_count: number;
  total_count: number;
}

export interface TaskRoleRow {
  job_role_id: string;
  key: string;
  name: string;
  version: number;
  status: string;
  domain_id: string | null;
  domain_name: string | null;
  effect_classification: EffectClassification;
  criticality: Criticality;
}

export interface TaskDetail extends TaskSummary {
  process_id: string | null;
  process_name: string | null;
  primary_pattern: string | null;
  risk: string | null;
  status: string;
}

export interface Process {
  id: string;
  name: string;
  domain_id: string;
  sequence_ord: number | null;
}

/** Instancia Docker del cliente (sin secretos). */
export interface TenantInstance {
  host: string | null;
  public_url: string | null;
  template_version: string | null;
  ap_version: string | null;
  app_version: string | null;
  notes: string | null;
  updated_at: string;
  updated_by_name: string | null;
  postiz_key_set: boolean;
}

export type TenantInstanceEditable = Omit<TenantInstance, 'updated_at' | 'updated_by_name' | 'postiz_key_set'>;

export interface OnboardingStep {
  step_key: string;
  ord: number;
  done_at: string | null;
  done_by_name: string | null;
  evidence: string | null;
  can_complete: boolean;
  can_reopen: boolean;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface StaffTicketRow {
  id: string;
  tenant_id: string;
  tenant_name: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_by_label: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface StaffTicketMessage {
  id: string;
  author_kind: 'client_admin' | 'staff';
  author_label: string;
  body: string;
  created_at: string;
}
