import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabaseClient';
import { PageHead } from '../components/PageHead';
import { StatusPill } from '../components/StatusPill';
import { TaskTypeFilters } from '../components/TaskTypeFilters';
import '../styles/pages/catalog.css';
import type {
  AvailableTask,
  Criticality,
  Domain,
  EffectClassification,
  JobRoleFull,
  JobRoleVersionSummary,
  JobRoleTaskRow,
  ReadinessStage,
  RoleReadinessRow,
  RiskLevel,
  Seniority,
  TaskSummary,
  TenantForRole,
  TenantSpecialistStatus,
} from '../lib/types';

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

const ROLE_TABS = [
  { key: 'tareas', label: 'Tareas' },
  { key: 'anadir', label: 'Añadir tareas' },
  { key: 'ficha', label: 'Ficha' },
  { key: 'clientes', label: 'Clientes' },
] as const;

type RoleTab = (typeof ROLE_TABS)[number]['key'];

const isRoleTab = (v: string | undefined): v is RoleTab => ROLE_TABS.some((t) => t.key === v);

interface RolePanelProps {
  initialKey: string;
  /** Pestaña de la URL (/roles/:key/:tab); por defecto, Tareas. */
  tab: string | undefined;
}

export function RolePanel({ initialKey, tab }: RolePanelProps) {
  const activeTab: RoleTab = isRoleTab(tab) ? tab : 'tareas';
  const navigate = useNavigate();
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [versions, setVersions] = useState<JobRoleVersionSummary[]>([]);
  // La versión vive en la URL (?v=): un enlace a «el rol en v2» tiene que llevar a v2.
  // Antes era useState, así que compartir la URL mandaba siempre a la última versión.
  const [search, setSearch] = useSearchParams();
  const [versionPedida, setVersionPedida] = useState(search.get('v'));
  if (search.get('v') !== versionPedida) setVersionPedida(search.get('v'));
  const [role, setRole] = useState<JobRoleFull | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [tenants, setTenants] = useState<TenantForRole[]>([]);
  const [tasks, setTasks] = useState<JobRoleTaskRow[]>([]);
  // Qué le falta a cada tarea para estar montada. Es la lista de pendientes del catálogo.
  const [readiness, setReadiness] = useState<RoleReadinessRow[]>([]);
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
  // Los seis filtros viven en la URL. Eran useState, así que recargar, volver atrás o
  // mandarle a alguien «mira las core irreversibles de este rol» no funcionaba.
  const filtro = (key: string) => search.get(key) ?? '';
  const setFiltro = (key: string, value: string | null) =>
    setSearch(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const effectFilter = filtro('efecto');
  const criticalityFilter = filtro('crit');
  const processFilter = search.get('proc');
  const patternFilter = search.get('pat');
  const tenantVersionFilter = filtro('cv');
  const tenantStatusFilter = filtro('ce');

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
  }, []);

  // ?v= manda; si no viene (o apunta a una versión que ya no existe), la última.
  const selectedVersionId =
    versions.find((v) => v.id === versionPedida)?.id ?? versions[0]?.id ?? '';

  const setSelectedVersionId = useCallback(
    (id: string) => {
      setSearch((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('v', id);
        else next.delete('v');
        return next;
      });
    },
    [setSearch],
  );

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

  const loadReadiness = useCallback(async (id: string) => {
    if (!id) return;
    const { data, error } = await supabase.rpc('catalog_role_readiness', { p_job_role_id: id });
    if (error) setError(error.message);
    else setReadiness((data ?? []) as RoleReadinessRow[]);
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
    loadReadiness(selectedVersionId);
      loadReadiness(selectedVersionId);
      setShowForkForm(false);
    }
  }, [selectedVersionId, loadRole, loadTasks, loadReadiness]);

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
    setError(null);
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
    setError(null);
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
    setError(null);
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
    navigate(`/roles/${encodeURIComponent(forkKey.trim())}`);
  }

  async function addTask(task: TaskSummary) {
    if (!selectedVersionId) return;
    setError(null);
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
    loadReadiness(selectedVersionId);
  }

  async function removeTask(taskId: string) {
    setError(null);
    const { error } = await supabase.rpc('catalog_unlink_task_role', {
      p_job_role_id: selectedVersionId,
      p_task_id: taskId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadTasks(selectedVersionId);
    loadReadiness(selectedVersionId);
  }

  function editTenantVersion(tenant: TenantForRole) {
    setError(null);
    const match = versions.find((v) => v.version === tenant.job_role_version);
    if (!match) {
      setError(`No se encontró la versión v${tenant.job_role_version} de este rol.`);
      return;
    }
    navigate(`/roles/${encodeURIComponent(selectedKey)}/ficha?v=${encodeURIComponent(match.id)}`);
  }

  const linkedTaskIds = new Set(tasks.map((t) => t.task_id));

  const filteredTenants = tenants.filter(
    (t) =>
      (!tenantVersionFilter || String(t.job_role_version) === tenantVersionFilter) &&
      (!tenantStatusFilter || t.status === tenantStatusFilter),
  );

  const filteredTasks = tasks.filter(
    (t) =>
      (!processFilter || t.process_id === processFilter) &&
      (!patternFilter || t.primary_pattern === patternFilter) &&
      (!effectFilter || t.effect_classification === effectFilter) &&
      (!criticalityFilter || t.criticality === criticalityFilter),
  );

  const readinessByTask = new Map(readiness.map((r) => [r.task_id, r]));

  const montaje = {
    conComposicion: readiness.filter((r) => r.composition_count > 0).length,
    publicadas: readiness.filter((r) => r.published_count > 0).length,
  };

  const taskSummary = {
    total: tasks.length,
    readOnly: tasks.filter((t) => t.effect_classification === 'read_only').length,
    reversible: tasks.filter((t) => t.effect_classification === 'reversible').length,
    irreversible: tasks.filter((t) => t.effect_classification === 'irreversible').length,
    core: tasks.filter((t) => t.criticality === 'core').length,
    standard: tasks.filter((t) => t.criticality === 'standard').length,
    peripheral: tasks.filter((t) => t.criticality === 'peripheral').length,
  };


  // Con búsqueda activa se muestran sus resultados; si no, las sugeridas del departamento.
  const addableTasks: (TaskSummary & { process_name?: string | null })[] =
    taskSearchResults.length > 0 ? taskSearchResults : availableTasks;

  const tabCount: Record<RoleTab, number | null> = {
    tareas: tasks.length,
    anadir: null,
    ficha: null,
    clientes: tenants.length,
  };

  const domainName = (id: string | null) => domains.find((d) => d.id === id)?.name || id || '—';

  return (
    <section>
      <PageHead
        crumbs={[{ label: 'Construir' }, { label: 'Especialistas', to: '/roles' }]}
        title={
          role ? (
            <>
              {role.name} <StatusPill status={role.status} />
            </>
          ) : (
            selectedKey
          )
        }
      >
        <div className="inline-form">
          <label className="inline-field">
            Versión
            <select
              className="text-input"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} ({v.status})
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--ghost" onClick={createNewVersion}>
            + Nueva versión
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowForkForm((v) => !v)}>
            ⑂ Desdoblar
          </button>
        </div>
      </PageHead>

      <div className="catalog-stack">
        {role && (
          <p className="catalog-note role-summary">
            <span className="mono">{role.key}</span> · v{role.version} · {domainName(role.domain_id)}
            {role.seniority ? ` · ${role.seniority}` : ''} · riesgo {role.risk_level}
            {role.mission ? <span className="role-summary__mission">{role.mission}</span> : null}
          </p>
        )}
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        {showForkForm && role && (
          <section className="table-card">
            <div className="table-card__head">
              <h2 className="table-card__title">Desdoblar a otro departamento</h2>
              <p className="catalog-note">
                Crea un agente independiente (propio key, propia versión desde v1, mismo nombre) para otro departamento.
                Empieza como copia de <strong>{role.name}</strong>: sus reglas y tareas se editan por separado desde ahí.
              </p>
            </div>
            <div className="table-card__foot inline-form">
              <label className="inline-field">
                Departamento destino
                <select className="text-input" value={forkDomainId} onChange={(e) => setForkDomainId(e.target.value)}>
                  <option value="">— elegir —</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-field">
                Key del nuevo agente
                <input
                  className="text-input"
                  placeholder={`${role.key}_...`}
                  value={forkKey}
                  onChange={(e) => setForkKey(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn--primary"
                onClick={forkRole}
                disabled={forking || !forkDomainId || !forkKey.trim()}
              >
                {forking ? 'Creando…' : 'Crear agente'}
              </button>
            </div>
          </section>
        )}

        <nav className="client-tabs" aria-label="Secciones del rol">
          {ROLE_TABS.map((t) => (
            <NavLink
              key={t.key}
              className="client-tabs__tab"
              to={`/roles/${encodeURIComponent(selectedKey)}/${t.key}`}
              aria-current={t.key === activeTab ? 'page' : undefined}
            >
              {t.label}
              {tabCount[t.key] !== null && <span className="client-tabs__count">{tabCount[t.key]}</span>}
            </NavLink>
          ))}
        </nav>
        {activeTab === 'tareas' && (
          <>
            <section className="table-card">
              <div className="table-card__head">
                <h2 className="table-card__title">Tareas de este rol</h2>
                <p className="catalog-note">
                  <strong>{taskSummary.total}</strong> tareas · <strong>{montaje.conComposicion}</strong> con
                  composición · <strong>{montaje.publicadas}</strong> publicadas. El rol no está listo hasta que
                  todas tienen una composición publicada.
                </p>
                <p className="catalog-note">
                  {taskSummary.readOnly} read only, {taskSummary.reversible} reversibles, {taskSummary.irreversible}{' '}
                  irreversibles · {taskSummary.core} core, {taskSummary.standard} standard, {taskSummary.peripheral}{' '}
                  peripheral.
                </p>
              </div>
              <div className="table-card__foot inline-form">
                <TaskTypeFilters
                  processId={processFilter}
                  pattern={patternFilter}
                  onProcess={(v) => setFiltro('proc', v)}
                  onPattern={(v) => setFiltro('pat', v)}
                />
                <label className="inline-field">
                  Efecto
                  <select
                    className="text-input"
                    value={effectFilter}
                    onChange={(e) => setFiltro('efecto', e.target.value || null)}
                  >
                    <option value="">Todos</option>
                    {EFFECT_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-field">
                  Criticidad
                  <select
                    className="text-input"
                    value={criticalityFilter}
                    onChange={(e) => setFiltro('crit', e.target.value || null)}
                  >
                    <option value="">Todas</option>
                    {CRITICALITY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarea</th>
                    <th>Montaje</th>
                    <th>Patrón</th>
                    <th>Efecto</th>
                    <th>Criticidad</th>
                    <th />
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
                            <tr className="data-table__group">
                              <td colSpan={6} className="eyebrow">
                                {processLabel}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td className="data-table__wrap">
                              <Link
                                className="data-table__primary"
                                to={`/tareas/${encodeURIComponent(t.task_id)}/composiciones${role ? `?rol=${encodeURIComponent(role.id)}` : ''}`}
                              >
                                {t.statement}
                              </Link>
                              <span className="data-table__secondary">{t.task_code}</span>
                            </td>
                            <td>
                              <StageCell row={readinessByTask.get(t.task_id)} />
                            </td>
                            <td className="mono">{t.primary_pattern ?? '—'}</td>
                            <td className="mono">{t.effect_classification}</td>
                            <td className="mono">{t.criticality}</td>
                            <td className="data-table__actions">
                              <button type="button" className="btn btn--sm btn--danger" onClick={() => removeTask(t.task_id)}>
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
                      <td colSpan={6} className="data-table__empty">
                        {tasks.length === 0
                          ? 'Este rol no tiene tareas enlazadas todavía.'
                          : 'Ninguna tarea coincide con estos filtros.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
        {activeTab === 'anadir' && (
          <>
            <section className="table-card">
              <div className="table-card__head">
                <h2 className="table-card__title">Añadir tareas</h2>
                <p className="catalog-note">
                  Enlaza una tarea que ya existe o crea una nueva: nacerá en borrador y enlazada a este rol.
                </p>
              </div>
              <div className="table-card__foot inline-form">
                <input
                  className="text-input"
                  type="search"
                  aria-label="Buscar tarea para enlazar"
                  placeholder="Buscar en todo el catálogo por código o texto…"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                />
                {role && (
                  <Link className="btn btn--primary" to={`/tareas/nueva?rol=${encodeURIComponent(role.id)}`}>
                    + Crear tarea nueva
                  </Link>
                )}
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{taskSearchResults.length > 0 ? 'Resultados de la búsqueda' : 'Sugeridas para este departamento'}</th>
                    <th>Proceso</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {addableTasks.map((t) => (
                    <tr key={t.id}>
                      <td className="data-table__wrap">
                        <span className="data-table__primary">{t.statement}</span>
                        <span className="data-table__secondary">{t.task_code}</span>
                      </td>
                      <td>{t.process_name || '—'}</td>
                      <td className="data-table__actions">
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          disabled={linkedTaskIds.has(t.id)}
                          onClick={() => addTask(t)}
                        >
                          {linkedTaskIds.has(t.id) ? 'Ya enlazada' : 'Enlazar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {taskSearchResults.length === 0 && availableTasks.length === 0 && (
                    <tr>
                      <td colSpan={3} className="data-table__empty">
                        {!role?.domain_id
                          ? 'Este rol no tiene departamento asignado: asígnalo para ver tareas sugeridas.'
                          : 'No hay más tareas categorizadas para este departamento. Usa el buscador.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
        {activeTab === 'ficha' && role && (
          <>
              <section className="table-card">
                <div className="table-card__head role-sheet__head">
                  <h2 className="table-card__title">
                    Ficha · {role.key} · v{role.version}
                  </h2>
                  {!editing ? (
                    <button type="button" className="btn btn--sm btn--ghost" onClick={startEditing}>
                      Editar
                    </button>
                  ) : (
                    <span>
                      <button type="button" className="btn btn--sm btn--primary" onClick={saveRole} disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                      </button>{' '}
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditing(false)}>
                        Cancelar
                      </button>
                    </span>
                  )}
                </div>

                {!editing || !form ? (
                  <dl className="fields-grid">
                    <div>
                      <dt>Departamento</dt>
                      <dd>{domainName(role.domain_id)}</dd>
                    </div>
                    <div>
                      <dt>Familia</dt>
                      <dd>{role.family || '—'}</dd>
                    </div>
                    <div>
                      <dt>Seniority</dt>
                      <dd>{role.seniority || '—'}</dd>
                    </div>
                    <div>
                      <dt>Riesgo</dt>
                      <dd>{role.risk_level}</dd>
                    </div>
                    <div>
                      <dt>Model tier</dt>
                      <dd>{role.model_tier || '—'}</dd>
                    </div>
                    <div>
                      <dt>Consulta memoria antes de producir</dt>
                      <dd>{role.consults_memory_before_producing ? 'Sí' : 'No'}</dd>
                    </div>
                    <div className="fields-grid__wide">
                      <dt>Misión</dt>
                      <dd>{role.mission || '—'}</dd>
                    </div>
                    <div className="fields-grid__wide">
                      <dt>Alcance de autonomía</dt>
                      <dd>{role.autonomy_scope}</dd>
                    </div>
                    <div className="fields-grid__wide">
                      <dt>Requiere aprobación en</dt>
                      <dd>{role.requires_approval_scope}</dd>
                    </div>
                    <div className="fields-grid__wide">
                      <dt>Nunca hace</dt>
                      <dd>{role.never_does}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="fields-grid">
                    <label className="inline-field">
                      Nombre
                      <input className="text-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label className="inline-field">
                      Departamento
                      <select
                        className="text-input"
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
                    <label className="inline-field">
                      Familia
                      <input
                        className="text-input"
                        value={form.family || ''}
                        onChange={(e) => setForm({ ...form, family: e.target.value || null })}
                      />
                    </label>
                    <label className="inline-field">
                      Seniority
                      <select
                        className="text-input"
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
                    <label className="inline-field">
                      Riesgo
                      <select
                        className="text-input"
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
                    <label className="inline-field">
                      Model tier
                      <input
                        className="text-input"
                        value={form.model_tier || ''}
                        onChange={(e) => setForm({ ...form, model_tier: e.target.value || null })}
                      />
                    </label>
                    <label className="inline-field">
                      Estado
                      <select
                        className="text-input"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value as JobRoleFull['status'] })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={form.consults_memory_before_producing}
                        onChange={(e) => setForm({ ...form, consults_memory_before_producing: e.target.checked })}
                      />
                      Consulta memoria antes de producir
                    </label>
                    <label className="inline-field fields-grid__wide">
                      Misión
                      <textarea
                        className="text-input"
                        value={form.mission || ''}
                        onChange={(e) => setForm({ ...form, mission: e.target.value || null })}
                      />
                    </label>
                    <label className="inline-field fields-grid__wide">
                      Alcance de autonomía
                      <textarea
                        className="text-input"
                        value={form.autonomy_scope}
                        onChange={(e) => setForm({ ...form, autonomy_scope: e.target.value })}
                      />
                    </label>
                    <label className="inline-field fields-grid__wide">
                      Requiere aprobación en
                      <textarea
                        className="text-input"
                        value={form.requires_approval_scope}
                        onChange={(e) => setForm({ ...form, requires_approval_scope: e.target.value })}
                      />
                    </label>
                    <label className="inline-field fields-grid__wide">
                      Nunca hace
                      <textarea
                        className="text-input"
                        value={form.never_does}
                        onChange={(e) => setForm({ ...form, never_does: e.target.value })}
                      />
                    </label>
                  </div>
                )}
              </section>
          </>
        )}
        {activeTab === 'clientes' && (
          <>
            <section className="table-card">
              <div className="table-card__head">
                <h2 className="table-card__title">Clientes con este rol</h2>
              </div>
              <div className="table-card__foot inline-form">
                <label className="inline-field">
                  Versión
                  <select
                    className="text-input"
                    value={tenantVersionFilter}
                    onChange={(e) => setFiltro('cv', e.target.value || null)}
                  >
                    <option value="">Todas</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.version}>
                        v{v.version}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-field">
                  Estado
                  <select
                    className="text-input"
                    value={tenantStatusFilter}
                    onChange={(e) => setFiltro('ce', e.target.value || null)}
                  >
                    <option value="">Todos</option>
                    {TENANT_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Versión contratada</th>
                    <th>Estado</th>
                    <th>Contratado el</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((t) => (
                    <tr key={t.tenant_id}>
                      <td>
                        <Link className="data-table__primary" to={`/clientes/${encodeURIComponent(t.tenant_id)}`}>
                          {t.tenant_name}
                        </Link>
                      </td>
                      <td className="mono">
                        v{t.job_role_version}
                        {role && t.job_role_version !== role.version && <span className="pill">otra versión</span>}
                      </td>
                      <td className="mono">{t.status}</td>
                      <td className="mono">{new Date(t.contracted_at).toLocaleDateString()}</td>
                      <td className="data-table__actions">
                        <button type="button" className="btn btn--sm btn--ghost" onClick={() => editTenantVersion(t)}>
                          Editar esa versión
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td colSpan={6} className="data-table__empty">
                        {tenants.length === 0
                          ? 'Ningún cliente tiene este rol contratado todavía.'
                          : 'Ningún cliente coincide con estos filtros.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </section>
  );
}

const STAGE_COPY: Record<ReadinessStage, { label: string; tone: string; ayuda: string }> = {
  lista: { label: 'Lista', tone: 'ok', ayuda: 'Tiene una composición publicada.' },
  composicion_borrador: {
    label: 'En borrador',
    tone: 'warn',
    ayuda: 'La composición existe pero no está publicada.',
  },
  sin_composicion: { label: 'Sin montar', tone: 'pending', ayuda: 'Clasificada, pero nadie ha montado su composición.' },
  sin_patron: { label: 'Falta patrón', tone: 'pending', ayuda: 'Sin patrón de automatización no se sabe qué montar.' },
  sin_proceso: { label: 'Falta proceso', tone: 'pending', ayuda: 'Sin proceso no se puede situar en el catálogo.' },
};

/** Qué le falta a esta tarea, en una palabra. Es lo que convierte la lista en cola de trabajo. */
function StageCell({ row }: { row: RoleReadinessRow | undefined }) {
  if (!row) return <span className="data-table__secondary">—</span>;
  const copy = STAGE_COPY[row.stage];
  return (
    <span className={`pill pill--${copy.tone}`} title={copy.ayuda}>
      {copy.label}
      {row.stage === 'composicion_borrador' && row.step_count > 0 && ` · ${row.step_count} pasos`}
    </span>
  );
}
