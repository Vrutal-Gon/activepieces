import type {
  BlockUsageRow,
  JobRoleKeySummary,
  CompositionListRow,
  ContractUsageRow,
  GlobalSearchHit,
  Domain,
  Occupation,
  Process,
  TaskDetail,
  TaskFacet,
  TaskListRow,
  TaskRoleRow,
  TaskSummary,
  RoleProgressRow,
  RoleReadinessRow,
} from '../types';
import { isArrayOf, isNum, isNumOrNull, isObj, isStr, isStrArray, isStrOrNull, isVoid } from '../guards';
import { rpc } from './client';

// La RPC devuelve la clave con su última versión, estado, seniority y departamento; el
// guard los comprobaba todos menos los cuatro últimos, así que quien los usaba tenía que
// castear a ciegas.
const isJobRoleKeySummary = (v: unknown): v is JobRoleKeySummary =>
  isObj(v) &&
  isStr(v.key) &&
  isStr(v.name) &&
  isNum(v.latest_version) &&
  isStr(v.status) &&
  isStrOrNull(v.seniority) &&
  isStrOrNull(v.domain_id);

/** Catálogo de roles (superadmin/admin en servidor). */
export function listRoleKeys(signal?: AbortSignal) {
  return rpc('catalog_list_job_role_keys', undefined, isArrayOf(isJobRoleKeySummary), signal);
}

const isTaskSummary = (v: unknown): v is TaskSummary =>
  isObj(v) && isStr(v.id) && isStr(v.task_code) && isStr(v.statement);

const isTaskListRow = (v: unknown): v is TaskListRow =>
  isObj(v) &&
  isTaskSummary(v) &&
  isStr(v.source) &&
  isStrOrNull(v.process_id) &&
  isStrOrNull(v.process_name) &&
  isStrOrNull(v.primary_pattern) &&
  isStrOrNull(v.risk) &&
  isStr(v.status) &&
  isStrOrNull(v.occupation_title) &&
  isStrOrNull(v.apqc_level) &&
  isNum(v.role_count) &&
  isNum(v.step_count) &&
  isNum(v.composition_count) &&
  isNum(v.total_count);

const isTaskFacet = (v: unknown): v is TaskFacet =>
  isObj(v) && isStr(v.facet) && isStrOrNull(v.value) && isStrOrNull(v.label) && isNum(v.n);

const isOccupation = (v: unknown): v is Occupation =>
  isObj(v) && isStr(v.id) && isStr(v.source) && isStr(v.source_code) && isStrOrNull(v.title) && isNum(v.task_count);

const isCompositionListRow = (v: unknown): v is CompositionListRow =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.key) &&
  isNum(v.version) &&
  isStr(v.name) &&
  isStrOrNull(v.pattern) &&
  isStr(v.status) &&
  isNum(v.slot_count) &&
  isNum(v.step_count) &&
  isStr(v.task_id) &&
  isStr(v.task_code) &&
  isStr(v.statement) &&
  isStrOrNull(v.role_names);

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

/**
 * Lo que puede acotar una búsqueda de tareas. `curated` es el corte entre la Biblioteca
 * (tareas que alguien ya ha tocado) y la bandeja de Importaciones; lo decide el servidor
 * en `catalog.v_task_enriched`, para que las dos pantallas no puedan discrepar.
 */
export interface TaskListFilter {
  query: string;
  domainId: string | null;
  processId: string | null;
  pattern: string | null;
  status: string | null;
  source: string[] | null;
  occupationId: string | null;
  risk: string | null;
  apqcLevel: string | null;
  hasComposition: boolean | null;
  curated: boolean | null;
  /** null = todas, true = usadas por algún rol, false = huérfanas. */
  onlyUsed: boolean | null;
}

function filterArgs(f: TaskListFilter) {
  return {
    p_query: f.query,
    p_domain_id: f.domainId,
    p_only_used: f.onlyUsed,
    p_process_id: f.processId,
    p_pattern: f.pattern,
    p_status: f.status,
    p_source: f.source,
    p_occupation_id: f.occupationId,
    p_risk: f.risk,
    p_apqc_level: f.apqcLevel,
    p_has_composition: f.hasComposition,
    p_curated: f.curated,
  };
}

export function browseTasks(f: TaskListFilter, page: { limit: number; offset: number }, signal?: AbortSignal) {
  return rpc(
    'catalog_browse_tasks',
    { ...filterArgs(f), p_limit: page.limit, p_offset: page.offset },
    isArrayOf(isTaskListRow),
    signal,
  );
}

/** Cuántas tareas daría cada opción de cada faceta, con el resto de filtros puestos. */
export function taskFacets(f: TaskListFilter, signal?: AbortSignal) {
  return rpc('catalog_task_facets', filterArgs(f), isArrayOf(isTaskFacet), signal);
}

export function listOccupations(signal?: AbortSignal) {
  return rpc('catalog_list_occupations', undefined, isArrayOf(isOccupation), signal);
}

/** Las composiciones del catálogo entero, no las de una tarea. */
export function listAllCompositions(query: string, status: string | null, signal?: AbortSignal) {
  return rpc(
    'catalog_list_all_compositions',
    { p_query: query, p_status: status },
    isArrayOf(isCompositionListRow),
    signal,
  );
}

export interface TaskUpdate {
  taskId: string;
  statement: string | null;
  processId: string | null;
  primaryPattern: string | null;
  risk: string | null;
  status: string;
}

/** Edita la ficha de una tarea. `task_code`, `source` y `source_code` NO se tocan. */
export function updateTask(u: TaskUpdate) {
  return rpc(
    'catalog_update_task',
    {
      p_task_id: u.taskId,
      p_statement: u.statement,
      p_process_id: u.processId,
      p_primary_pattern: u.primaryPattern,
      p_risk: u.risk,
      p_status: u.status,
    },
    isVoid,
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

/** Enlaza la tarea al rol, o reclasifica el enlace que ya existe. Es un upsert. */
export function linkTaskRole(jobRoleId: string, taskId: string, effect: string, criticality: string) {
  return rpc(
    'catalog_link_task_role',
    {
      p_job_role_id: jobRoleId,
      p_task_id: taskId,
      p_effect_classification: effect,
      p_criticality: criticality,
    },
    isVoid,
  );
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

// --- Dónde se usa -----------------------------------------------------------
// El catálogo es un árbol y hasta ahora solo se podía bajar por él: de un bloque no había
// forma de saber qué composiciones lo montan, ni de un contrato quién lo produce.

const isBlockUsageRow = (v: unknown): v is BlockUsageRow =>
  isObj(v) &&
  isStr(v.composition_id) &&
  isStr(v.composition_name) &&
  isStr(v.composition_status) &&
  isStr(v.slot_key) &&
  isNum(v.slot_position) &&
  isNum(v.component_version) &&
  isStr(v.version_status) &&
  isStr(v.task_id) &&
  isStr(v.task_code) &&
  isStr(v.statement) &&
  isStrOrNull(v.role_names);

export function blockUsage(componentId: string, signal?: AbortSignal) {
  return rpc('catalog_block_usage', { p_component_id: componentId }, isArrayOf(isBlockUsageRow), signal);
}

const isContractUsageRow = (v: unknown): v is ContractUsageRow =>
  isObj(v) &&
  (v.relation === 'produce' || v.relation === 'consume') &&
  isStr(v.component_id) &&
  isStr(v.component_name) &&
  isStr(v.comp_type) &&
  isNum(v.version) &&
  isStr(v.version_status);

export function contractUsage(key: string, version: number | null, signal?: AbortSignal) {
  return rpc(
    'catalog_contract_usage',
    { p_key: key, p_version: version },
    isArrayOf(isContractUsageRow),
    signal,
  );
}

// --- Búsqueda global --------------------------------------------------------

const isGlobalSearchHit = (v: unknown): v is GlobalSearchHit =>
  isObj(v) && isStr(v.kind) && isStr(v.label) && isStrOrNull(v.detail) && isStr(v.href);

export function globalSearchCatalog(query: string, limit: number, signal?: AbortSignal) {
  return rpc(
    'catalog_global_search',
    { p_query: query, p_limit: limit },
    isArrayOf(isGlobalSearchHit),
    signal,
  );
}

// --- Montaje por rol --------------------------------------------------------

const READINESS_STAGES = ['lista', 'composicion_borrador', 'sin_composicion', 'sin_patron', 'sin_proceso'];

const isRoleReadinessRow = (v: unknown): v is RoleReadinessRow =>
  isObj(v) &&
  isStr(v.task_id) &&
  isStr(v.task_code) &&
  isStr(v.statement) &&
  isStrOrNull(v.process_name) &&
  isStrOrNull(v.primary_pattern) &&
  isStr(v.effect_classification) &&
  isStr(v.criticality) &&
  isNum(v.composition_count) &&
  isNum(v.step_count) &&
  isNum(v.published_count) &&
  isStr(v.stage) &&
  READINESS_STAGES.includes(v.stage);

export function roleReadiness(jobRoleId: string, signal?: AbortSignal) {
  return rpc('catalog_role_readiness', { p_job_role_id: jobRoleId }, isArrayOf(isRoleReadinessRow), signal);
}

const isRoleProgressRow = (v: unknown): v is RoleProgressRow =>
  isObj(v) && isStr(v.role_key) && isNum(v.tasks) && isNum(v.with_composition) && isNum(v.published);

export function roleProgress(signal?: AbortSignal) {
  return rpc('catalog_role_progress', undefined, isArrayOf(isRoleProgressRow), signal);
}

// --- Versiones de bloque en lote -------------------------------------------

export interface ComponentVersionRow {
  id: string;
  component_id: string;
  version: number;
  status: string;
  artifact_ref: string | null;
  output_contract_key: string | null;
  output_contract_version: number | null;
  consumes: string[] | null;
  changelog: string | null;
}

const isComponentVersionRow = (v: unknown): v is ComponentVersionRow =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.component_id) &&
  isNum(v.version) &&
  isStr(v.status) &&
  isStrOrNull(v.artifact_ref) &&
  isStrOrNull(v.output_contract_key) &&
  isNumOrNull(v.output_contract_version) &&
  (v.consumes === null || isStrArray(v.consumes)) &&
  isStrOrNull(v.changelog);

/** Todas las versiones de varios bloques en una llamada, en vez de una por bloque. */
export function listComponentVersionsBulk(componentIds: string[], signal?: AbortSignal) {
  return rpc(
    'catalog_list_component_versions_bulk',
    { p_component_ids: componentIds },
    isArrayOf(isComponentVersionRow),
    signal,
  );
}
