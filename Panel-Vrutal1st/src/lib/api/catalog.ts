import type { Domain, Process, TaskDetail, TaskListRow, TaskRoleRow, TaskSummary } from '../types';
import { isArrayOf, isNum, isNumOrNull, isObj, isStr, isStrOrNull, isVoid } from '../guards';
import { rpc } from './client';

export interface RoleKeyEntry {
  key: string;
  name: string;
}

const isRoleKeyEntry = (v: unknown): v is RoleKeyEntry => isObj(v) && isStr(v.key) && isStr(v.name);

/** Catálogo de roles (superadmin/admin en servidor). */
export function listRoleKeys(signal?: AbortSignal) {
  return rpc('catalog_list_job_role_keys', undefined, isArrayOf(isRoleKeyEntry), signal);
}

const isTaskSummary = (v: unknown): v is TaskSummary =>
  isObj(v) && isStr(v.id) && isStr(v.task_code) && isStr(v.statement);

const isTaskListRow = (v: unknown): v is TaskListRow =>
  isObj(v) &&
  isTaskSummary(v) &&
  isStrOrNull(v.process_id) &&
  isStrOrNull(v.process_name) &&
  isStrOrNull(v.primary_pattern) &&
  isNum(v.role_count) &&
  isNum(v.component_count) &&
  isNum(v.composition_count) &&
  isNum(v.total_count);

const isTaskRoleRow = (v: unknown): v is TaskRoleRow =>
  isObj(v) &&
  isStr(v.job_role_id) &&
  isStr(v.key) &&
  isStr(v.name) &&
  isNum(v.version) &&
  isStr(v.status) &&
  isStrOrNull(v.domain_id) &&
  isStrOrNull(v.domain_name) &&
  isStr(v.effect_classification) &&
  isStr(v.criticality);

const isDomain = (v: unknown): v is Domain => isObj(v) && isStr(v.id) && isStr(v.name);

export interface TaskListFilter {
  query: string;
  domainId: string | null;
  processId: string | null;
  pattern: string | null;
  onlyUsed: boolean;
  limit: number;
  offset: number;
}

export function listTasks(f: TaskListFilter, signal?: AbortSignal) {
  return rpc(
    'catalog_list_tasks',
    {
      p_query: f.query,
      p_domain_id: f.domainId,
      p_only_used: f.onlyUsed,
      p_limit: f.limit,
      p_offset: f.offset,
      p_process_id: f.processId,
      p_pattern: f.pattern,
    },
    isArrayOf(isTaskListRow),
    signal,
  );
}

const isTaskDetail = (v: unknown): v is TaskDetail =>
  isObj(v) &&
  isTaskSummary(v) &&
  isStrOrNull(v.process_id) &&
  isStrOrNull(v.process_name) &&
  isStrOrNull(v.primary_pattern) &&
  isStrOrNull(v.risk) &&
  isStr(v.status);

/** La tarea o null si no existe. */
export async function getTask(taskId: string, signal?: AbortSignal): Promise<TaskDetail | null> {
  const rows = await rpc('catalog_get_task', { p_task_id: taskId }, isArrayOf(isTaskDetail), signal);
  return rows[0] ?? null;
}

export function listTaskRoles(taskId: string, signal?: AbortSignal) {
  return rpc('catalog_list_task_roles', { p_task_id: taskId }, isArrayOf(isTaskRoleRow), signal);
}

export function listDomains(signal?: AbortSignal) {
  return rpc('catalog_list_domains', undefined, isArrayOf(isDomain), signal);
}

const isAnyArray = (v: unknown): v is unknown[] => Array.isArray(v);

/** Contadores de las pestañas de la ficha de tarea. */
export async function getTaskCounts(taskId: string, signal?: AbortSignal) {
  const [components, compositions] = await Promise.all([
    rpc('catalog_list_task_components', { p_task_id: taskId }, isAnyArray, signal),
    rpc('catalog_list_compositions', { p_task_id: taskId }, isAnyArray, signal),
  ]);
  return { components: components.length, compositions: compositions.length };
}

const isProcess = (v: unknown): v is Process =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isStr(v.domain_id) && isNumOrNull(v.sequence_ord);

export function listProcesses(signal?: AbortSignal) {
  return rpc('catalog_list_processes', undefined, isArrayOf(isProcess), signal);
}

export interface NewTask {
  statement: string;
  processId: string;
  pattern: string;
  risk: string;
  reversible: boolean;
  requiresApproval: boolean;
  customerFacing: boolean;
  touchesBudget: boolean;
  jobRoleId: string | null;
}

/** Crea una tarea interna en borrador. Devuelve su id. */
export function createTask(t: NewTask) {
  return rpc(
    'catalog_create_task',
    {
      p_statement: t.statement,
      p_process_id: t.processId || null,
      p_primary_pattern: t.pattern || null,
      p_risk: t.risk,
      p_reversible: t.reversible,
      p_requires_approval: t.requiresApproval,
      p_customer_facing: t.customerFacing,
      p_touches_budget: t.touchesBudget,
      p_job_role_id: t.jobRoleId,
    },
    isStr,
  );
}

/** Copia la composición (con sus slots) como versión siguiente en borrador. Devuelve el id nuevo. */
export function duplicateComposition(id: string) {
  return rpc('catalog_duplicate_composition', { p_id: id }, isStr);
}

/** Bloque nuevo del mismo tipo, para otra variante de stack. Devuelve el id nuevo. */
export function duplicateBlock(componentId: string, name: string, variant: Record<string, unknown>) {
  return rpc('catalog_duplicate_block', { p_component_id: componentId, p_name: name, p_variant: variant }, isStr);
}

const isContractRef = (v: unknown): v is { key: string; version: number } =>
  isObj(v) && isStr(v.key) && isNum(v.version);

/** Sin newKey: versión siguiente del mismo contrato. Con newKey: contrato nuevo v1. */
export async function duplicateContract(key: string, version: number, newKey?: string) {
  const rows = await rpc(
    'catalog_duplicate_contract',
    { p_key: key, p_version: version, p_new_key: newKey ?? null },
    isArrayOf(isContractRef),
  );
  return rows[0];
}

export function updateContract(key: string, version: number, description: string, schema: Record<string, unknown>) {
  return rpc(
    'catalog_update_contract',
    { p_key: key, p_version: version, p_description: description, p_json_schema: schema },
    isVoid,
  );
}
