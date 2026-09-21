import { Fragment, useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type {
  AvailableTask,
  Criticality,
  Domain,
  EffectClassification,
  JobRoleFull,
  JobRoleVersionSummary,
  JobRoleTaskRow,
  RiskLevel,
  Seniority,
  TaskSummary,
  TenantForRole,
  TenantSpecialistStatus,
} from '../lib/types';
import type { TaskRoleContext } from './TaskComponentLinker';

const EFFECT_OPTIONS: EffectClassification[] = ['read_only', 'reversible', 'irreversible'];
const CRITICALITY_OPTIONS: Criticality[] = ['core', 'standard', 'peripheral'];
const RISK_OPTIONS: RiskLevel[] = ['low', 'medium', 'medium_high', 'high'];
const SENIORITY_OPTIONS: Seniority[] = ['operativo', 'mando', 'direccion'];
const STATUS_OPTIONS: JobRoleFull['status'][] = ['draft', 'active', 'retired'];
const TENANT_STATUS_OPTIONS: TenantSpecialistStatus[] = ['contracted', 'paused', 'cancelled'];

type EditableFields = Pick<
  JobRoleFull,
  | 'name'
  | 'mission'
  | 'risk_level'
  | 'model_tier'
  | 'autonomy_scope'
  | 'requires_approval_scope'
  | 'never_does'
  | 'consults_memory_before_producing'
  | 'status'
  | 'domain_id'
  | 'family'
  | 'seniority'
>;

function toEditableFields(role: JobRoleFull): EditableFields {
  return {
    name: role.name,
    mission: role.mission,
    risk_level: role.risk_level,
    model_tier: role.model_tier,
    autonomy_scope: role.autonomy_scope,
    requires_approval_scope: role.requires_approval_scope,
    never_does: role.never_does,
    consults_memory_before_producing: role.consults_memory_before_producing,
    status: role.status,
    domain_id: role.domain_id,
    family: role.family,
    seniority: role.seniority,
  };
}

interface RolePanelProps {
  initialKey: string;
  onBack: () => void;
  onOpenComponents: (task: TaskSummary, roleContext: TaskRoleContext) => void;
}

export function RolePanel({ initialKey, onBack, onOpenComponents }: RolePanelProps) {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [versions, setVersions] = useState<JobRoleVersionSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [role, setRole] = useState<JobRoleFull | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tenants, setTenants] = useState<TenantForRole[]>([]);
  const [tasks, setTasks] = useState<JobRoleTaskRow[]>([]);
  const [availableTasks, setAvailableTasks] = useState<AvailableTask[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);

  const [showForkForm, setShowForkForm] = useState(false);
  const [forkDomainId, setForkDomainId] = useState('');
  const [forkKey, setForkKey] = useState('');
  const [forking, setForking] = useState(false);

  const [taskSearch, setTaskSearch] = useState('');
  const [taskSearchResults, setTaskSearchResults] = useState<TaskSummary[]>([]);
  const [effectFilter, setEffectFilter] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('');

  const [tenantVersionFilter, setTenantVersionFilter] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState('');

  useEffect(() => {
    supabase.rpc('catalog_list_domains').then(({ data, error }) => {
      if (error) setError(error.message);
      else setDomains((data ?? []) as Domain[]);
    });
  }, []);

  useEffect(() => {
    setSelectedKey(initialKey);
  }, [initialKey]);

  const loadVersions = useCallback(async (key: string) => {
    if (!key) return;
    const { data, error } = await supabase.rpc('catalog_list_job_role_versions', { p_key: key });
    if (error) {
      setError(error.message);
      return;
    }
    const rows = (data ?? []) as JobRoleVersionSummary[];
    setVersions(rows);
    setSelectedVersionId(rows[0]?.id || '');
  }, []);

  const loadTenants = useCallback(async (key: string) => {
    if (!key) return;
    const { data, error } = await supabase.rpc('catalog_list_tenants_for_job_role', { p_key: key });
    if (error) setError(error.message);
    else setTenants((data ?? []) as TenantForRole[]);
  }, []);

  useEffect(() => {
    if (selectedKey) {
      loadVersions(selectedKey);
      loadTenants(selectedKey);
      setTenantVersionFilter('');
      setTenantStatusFilter('');
    }
  }, [selectedKey, loadVersions, loadTenants]);

  const loadRole = useCallback(async (id: string) => {
    if (!id) return;
    const { data, error } = await supabase.rpc('catalog_get_job_role', { p_id: id });
    if (error) {
      setError(error.message);
      return;
    }
    const row = ((data ?? [])[0] ?? null) as JobRoleFull | null;
    setRole(row);
    setEditing(false);
  }, []);

  const loadTasks = useCallback(async (id: string) => {
    if (!id) return;
    const { data, error } = await supabase.rpc('catalog_list_job_role_tasks', { p_job_role_id: id });
    if (error) setError(error.message);
    else setTasks((data ?? []) as JobRoleTaskRow[]);
  }, []);

  useEffect(() => {
    if (selectedVersionId) {
      loadRole(selectedVersionId);
      loadTasks(selectedVersionId);
      setEffectFilter('');
      setCriticalityFilter('');
      setShowForkForm(false);
    }
  }, [selectedVersionId, loadRole, loadTasks]);

  useEffect(() => {
    if (!selectedVersionId) return;
    supabase
      .rpc('catalog_list_available_tasks_for_domains', {
        p_domain_ids: role?.domain_id ? [role.domain_id] : [],
        p_exclude_job_role_id: selectedVersionId,
      })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setAvailableTasks((data ?? []) as AvailableTask[]);
      });
  }, [role?.domain_id, selectedVersionId]);

  useEffect(() => {
    if (taskSearch.trim().length < 2) {
      setTaskSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('catalog_search_tasks', { p_query: taskSearch, p_limit: 20 });
      if (error) setError(error.message);
      else setTaskSearchResults((data ?? []) as TaskSummary[]);
    }, 300);
    return () => clearTimeout(handle);
  }, [taskSearch]);

  function startEditing() {
    if (!role) return;
    setForm(toEditableFields(role));
    setEditing(true);
  }

  async function saveRole() {
    if (!role || !form) return;
    setSaving(true);
    const { error } = await supabase.rpc('catalog_update_job_role', {
      p_id: role.id,
      p_name: form.name,
      p_mission: form.mission,
      p_risk_level: form.risk_level,
      p_model_tier: form.model_tier,
      p_autonomy_scope: form.autonomy_scope,
      p_requires_approval_scope: form.requires_approval_scope,
      p_never_does: form.never_does,
      p_consults_memory_before_producing: form.consults_memory_before_producing,
      p_status: form.status,
      p_domain_id: form.domain_id,
      p_family: form.family,
      p_seniority: form.seniority,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    loadRole(role.id);
    loadVersions(selectedKey);
  }

  async function createNewVersion() {
    if (!role) return;
    const { data, error } = await supabase.rpc('catalog_create_job_role_version', { p_source_id: role.id });
    if (error) {
      setError(error.message);
      return;
    }
    await loadVersions(selectedKey);
    setSelectedVersionId(data as string);
  }

  async function forkRole() {
    if (!role || !forkDomainId || !forkKey.trim()) return;
    setForking(true);
    const { error } = await supabase.rpc('catalog_fork_job_role', {
      p_source_id: role.id,
      p_new_key: forkKey.trim(),
      p_domain_id: forkDomainId,
    });
    setForking(false);
    if (error) {
      setError(error.message);
      return;
    }
    setShowForkForm(false);
    setForkKey('');
    setForkDomainId('');
    setSelectedKey(forkKey.trim());
  }

  async function addTask(task: TaskSummary) {
    if (!selectedVersionId) return;
    const { error } = await supabase.rpc('catalog_link_task_role', {
      p_job_role_id: selectedVersionId,
      p_task_id: task.id,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setTaskSearch('');
    setTaskSearchResults([]);
    loadTasks(selectedVersionId);
  }

  async function removeTask(taskId: string) {
    const { error } = await supabase.rpc('catalog_unlink_task_role', {
      p_job_role_id: selectedVersionId,
      p_task_id: taskId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadTasks(selectedVersionId);
  }

  function editTenantVersion(tenant: TenantForRole) {
    const match = versions.find((v) => v.version === tenant.job_role_version);
    if (!match) {
      setError(`No se encontró la versión v${tenant.job_role_version} de este rol.`);
      return;
    }
    setSelectedVersionId(match.id);
  }

  function openTaskDetail(task: JobRoleTaskRow) {
    if (!role) return;
    onOpenComponents(
      { id: task.task_id, task_code: task.task_code, statement: task.statement },
      {
        jobRoleId: role.id,
        roleName: role.name,
        roleVersion: role.version,
        effectClassification: task.effect_classification,
        criticality: task.criticality,
      },
    );
  }

  const linkedTaskIds = new Set(tasks.map((t) => t.task_id));

  const filteredTenants = tenants.filter(
    (t) =>
      (!tenantVersionFilter || String(t.job_role_version) === tenantVersionFilter) &&
      (!tenantStatusFilter || t.status === tenantStatusFilter),
  );

  const filteredTasks = tasks.filter(
    (t) =>
      (!effectFilter || t.effect_classification === effectFilter) &&
      (!criticalityFilter || t.criticality === criticalityFilter),
  );

  const taskSummary = {
    total: tasks.length,
    readOnly: tasks.filter((t) => t.effect_classification === 'read_only').length,
    reversible: tasks.filter((t) => t.effect_classification === 'reversible').length,
    irreversible: tasks.filter((t) => t.effect_classification === 'irreversible').length,
    core: tasks.filter((t) => t.criticality === 'core').length,
    standard: tasks.filter((t) => t.criticality === 'standard').length,
    peripheral: tasks.filter((t) => t.criticality === 'peripheral').length,
  };

  return (
    <div className="panel">
      <div className="toolbar">
        <button className="secondary" onClick={onBack}>
          ← Volver a Roles
        </button>
        <label>
          Versión:
          <select value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} ({v.status})
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" onClick={createNewVersion}>
          + Nueva versión
        </button>
        <button className="secondary" onClick={() => setShowForkForm((v) => !v)}>
          ⑂ Desdoblar a otro departamento
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {showForkForm && role && (
        <div className="fork-form">
          <p className="fork-form-note">
            Crea un agente independiente (propio key, propia versión desde v1, mismo nombre) para otro
            departamento. Empieza como copia de <strong>{role.name}</strong> — sus reglas y tareas se
            editan por separado desde ahí en adelante.
          </p>
          <label>
            Departamento destino
            <select value={forkDomainId} onChange={(e) => setForkDomainId(e.target.value)}>
              <option value="">— elegir —</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Key del nuevo agente
            <input
              placeholder={`${role.key}_...`}
              value={forkKey}
              onChange={(e) => setForkKey(e.target.value)}
            />
          </label>
          <button onClick={forkRole} disabled={forking || !forkDomainId || !forkKey.trim()}>
            {forking ? 'Creando…' : 'Crear agente'}
          </button>
        </div>
      )}

      {role && (
        <div className="role-card">
          <div className="role-card-header">
            <h2>
              {role.name} <span className="badge">v{role.version}</span>{' '}
              <span className={`badge status-${role.status}`}>{role.status}</span>
            </h2>
            {!editing ? (
              <button onClick={startEditing}>Editar</button>
            ) : (
              <div className="role-card-actions">
                <button onClick={saveRole} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button className="secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <p className="role-key">{role.key}</p>

          {!editing || !form ? (
            <div className="role-fields">
              <div className="field">
                <span className="field-label">Departamento</span>
                <span className="field-value">
                  {domains.find((d) => d.id === role.domain_id)?.name || role.domain_id || '—'}
                </span>
              </div>
              <div className="field">
                <span className="field-label">Familia</span>
                <span className="field-value">{role.family || '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">Seniority</span>
                <span className="field-value">{role.seniority || '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">Riesgo</span>
                <span className="field-value">{role.risk_level}</span>
              </div>
              <div className="field">
                <span className="field-label">Model tier</span>
                <span className="field-value">{role.model_tier || '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">Consulta memoria antes de producir</span>
                <span className="field-value">{role.consults_memory_before_producing ? 'Sí' : 'No'}</span>
              </div>
              <div className="field full-width">
                <span className="field-label">Misión</span>
                <span className="field-value">{role.mission || '—'}</span>
              </div>
              <div className="field full-width">
                <span className="field-label">Alcance de autonomía</span>
                <span className="field-value">{role.autonomy_scope}</span>
              </div>
              <div className="field full-width">
                <span className="field-label">Requiere aprobación en</span>
                <span className="field-value">{role.requires_approval_scope}</span>
              </div>
              <div className="field full-width">
                <span className="field-label">Nunca hace</span>
                <span className="field-value">{role.never_does}</span>
              </div>
            </div>
          ) : (
            <div className="role-fields-edit">
              <label>
                Nombre
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                Departamento
                <select
                  value={form.domain_id || ''}
                  onChange={(e) => setForm({ ...form, domain_id: e.target.value || null })}
                >
                  <option value="">—</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Familia
                <input
                  value={form.family || ''}
                  onChange={(e) => setForm({ ...form, family: e.target.value || null })}
                />
              </label>
              <label>
                Seniority
                <select
                  value={form.seniority || ''}
                  onChange={(e) => setForm({ ...form, seniority: (e.target.value || null) as Seniority | null })}
                >
                  <option value="">—</option>
                  {SENIORITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Riesgo
                <select
                  value={form.risk_level}
                  onChange={(e) => setForm({ ...form, risk_level: e.target.value as RiskLevel })}
                >
                  {RISK_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Model tier
                <input
                  value={form.model_tier || ''}
                  onChange={(e) => setForm({ ...form, model_tier: e.target.value || null })}
                />
              </label>
              <label>
                Estado
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as JobRoleFull['status'] })}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.consults_memory_before_producing}
                  onChange={(e) => setForm({ ...form, consults_memory_before_producing: e.target.checked })}
                />
                Consulta memoria antes de producir
              </label>
              <label className="full-width">
                Misión
                <textarea
                  value={form.mission || ''}
                  onChange={(e) => setForm({ ...form, mission: e.target.value || null })}
                />
              </label>
              <label className="full-width">
                Alcance de autonomía
                <textarea
                  value={form.autonomy_scope}
                  onChange={(e) => setForm({ ...form, autonomy_scope: e.target.value })}
                />
              </label>
              <label className="full-width">
                Requiere aprobación en
                <textarea
                  value={form.requires_approval_scope}
                  onChange={(e) => setForm({ ...form, requires_approval_scope: e.target.value })}
                />
              </label>
              <label className="full-width">
                Nunca hace
                <textarea
                  value={form.never_does}
                  onChange={(e) => setForm({ ...form, never_does: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <h3>Clientes con este rol</h3>
      <div className="toolbar">
        <label>
          Versión:
          <select value={tenantVersionFilter} onChange={(e) => setTenantVersionFilter(e.target.value)}>
            <option value="">Todas</option>
            {versions.map((v) => (
              <option key={v.id} value={v.version}>
                v{v.version}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado:
          <select value={tenantStatusFilter} onChange={(e) => setTenantStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {TENANT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="linked-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Versión contratada</th>
            <th>Estado</th>
            <th>Contratado el</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filteredTenants.map((t) => (
            <tr key={t.tenant_id}>
              <td>{t.tenant_name}</td>
              <td>
                v{t.job_role_version}
                {role && t.job_role_version !== role.version && (
                  <span className="badge subtle"> otra versión</span>
                )}
              </td>
              <td>{t.status}</td>
              <td>{new Date(t.contracted_at).toLocaleDateString()}</td>
              <td>
                <button className="secondary" onClick={() => editTenantVersion(t)}>
                  Editar esa versión
                </button>
              </td>
            </tr>
          ))}
          {filteredTenants.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                {tenants.length === 0
                  ? 'Ningún cliente tiene este rol contratado todavía.'
                  : 'Ningún cliente coincide con estos filtros.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Tareas de este rol</h3>
      <p className="task-summary">
        <strong>{taskSummary.total}</strong> tareas habilitadas — {taskSummary.readOnly} read only,{' '}
        {taskSummary.reversible} reversibles, {taskSummary.irreversible} irreversibles ·{' '}
        {taskSummary.core} core, {taskSummary.standard} standard, {taskSummary.peripheral} peripheral
      </p>

      <div className="add-task">
        <input
          type="text"
          placeholder="Buscar tarea por código o texto para enlazar…"
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
        />
        {taskSearchResults.length > 0 && (
          <ul className="search-results">
            {taskSearchResults.map((t) => (
              <li key={t.id}>
                <span className="task-code">{t.task_code}</span>
                <span className="task-statement">{t.statement}</span>
                <button disabled={linkedTaskIds.has(t.id)} onClick={() => addTask(t)}>
                  {linkedTaskIds.has(t.id) ? 'Ya enlazada' : 'Enlazar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="toolbar">
        <label>
          Efecto:
          <select value={effectFilter} onChange={(e) => setEffectFilter(e.target.value)}>
            <option value="">Todos</option>
            {EFFECT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          Criticidad:
          <select value={criticalityFilter} onChange={(e) => setCriticalityFilter(e.target.value)}>
            <option value="">Todas</option>
            {CRITICALITY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>

      <table className="linked-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Tarea</th>
            <th>Efecto</th>
            <th>Criticidad</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            let lastProcess: string | null = '__unset__';
            return filteredTasks.map((t) => {
              const processLabel = t.process_name || 'Sin categorizar';
              const showHeader = processLabel !== lastProcess;
              lastProcess = processLabel;
              return (
                <Fragment key={t.task_id}>
                  {showHeader && (
                    <tr className="process-header-row">
                      <td colSpan={6}>{processLabel}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="task-code">{t.task_code}</td>
                    <td>{t.statement}</td>
                    <td>
                      <span className="badge">{t.effect_classification}</span>
                    </td>
                    <td>
                      <span className="badge">{t.criticality}</span>
                    </td>
                    <td>
                      <button className="secondary" onClick={() => openTaskDetail(t)}>
                        Ver
                      </button>
                    </td>
                    <td>
                      <button className="remove" onClick={() => removeTask(t.task_id)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                </Fragment>
              );
            });
          })()}
          {filteredTasks.length === 0 && (
            <tr>
              <td colSpan={6} className="empty">
                {tasks.length === 0
                  ? 'Este rol no tiene tareas enlazadas todavía.'
                  : 'Ninguna tarea coincide con estos filtros.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Tareas disponibles en este departamento</h3>
      <table className="linked-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Tarea</th>
            <th>Proceso</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {availableTasks.map((t) => (
            <tr key={t.id}>
              <td className="task-code">{t.task_code}</td>
              <td>{t.statement}</td>
              <td>{t.process_name || '—'}</td>
              <td>
                <button onClick={() => addTask(t)}>Agregar</button>
              </td>
            </tr>
          ))}
          {availableTasks.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">
                {!role?.domain_id
                  ? 'Este rol no tiene departamento asignado — asígnalo para ver tareas sugeridas.'
                  : 'No hay más tareas categorizadas para este departamento todavía.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
