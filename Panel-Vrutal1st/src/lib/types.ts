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

export interface Tenant {
  id: string;
  name: string;
  legal_name: string | null;
  status: string;
  industry: string | null;
  size_employees: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  country: string | null;
  region: string | null;
  is_internal: boolean;
  data_plane_status: string | null;
  account_manager_profile_id: string | null;
}

export interface SystemOption {
  id: string;
  system_category: string;
  name: string;
  version: string | null;
  connection_notes: string | null;
  docs_url: string | null;
}

export interface TenantStackChoice {
  system_category: string;
  system_option_id: string;
  system_name: string;
  version: string | null;
  notes: string | null;
}

export interface TenantSpecialistRow {
  id: string;
  job_role_key: string;
  job_role_version: number;
  status: TenantSpecialistStatus;
  contracted_at: string;
  notes: string | null;
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
