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
