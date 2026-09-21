import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import type {
  Component,
  ComponentMaturity,
  ComponentRoleInTask,
  Criticality,
  EffectClassification,
  TaskComponentRow,
  TaskSummary,
} from '../lib/types';

const ROLE_OPTIONS: ComponentRoleInTask[] = ['executor', 'validator', 'enricher', 'fallback'];
const MATURITY_OPTIONS: ComponentMaturity[] = ['prototype', 'tested', 'production'];
const EFFECT_OPTIONS: EffectClassification[] = ['read_only', 'reversible', 'irreversible'];
const CRITICALITY_OPTIONS: Criticality[] = ['core', 'standard', 'peripheral'];

export interface TaskRoleContext {
  jobRoleId: string;
  roleName: string;
  roleVersion: number;
  effectClassification: EffectClassification;
  criticality: Criticality;
}

interface TaskComponentLinkerProps {
  initialTask?: TaskSummary | null;
  roleContext?: TaskRoleContext | null;
  onBack?: () => void;
}

export function TaskComponentLinker({ initialTask, roleContext, onBack }: TaskComponentLinkerProps) {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<TaskSummary[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [catalogComponents, setCatalogComponents] = useState<TaskComponentRow[]>([]);
  const [roleComponents, setRoleComponents] = useState<TaskComponentRow[]>([]);
  const [allComponents, setAllComponents] = useState<Component[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pickComponentId, setPickComponentId] = useState('');
  const [pickRole, setPickRole] = useState<ComponentRoleInTask>('executor');

  const [pickRoleComponentId, setPickRoleComponentId] = useState('');
  const [pickRoleComponentRole, setPickRoleComponentRole] = useState<ComponentRoleInTask>('executor');

  const [classification, setClassification] = useState<TaskRoleContext | null>(null);
  const [savingClassification, setSavingClassification] = useState(false);

  const [showNewComponent, setShowNewComponent] = useState(false);
  const [newComponent, setNewComponent] = useState({
    id: '',
    name: '',
    comp_type: 'activepieces_flow',
    owner: '',
    runtime: 'activepieces',
    repo_ref: '',
    maturity: 'prototype' as ComponentMaturity,
    target_system: '',
  });

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    const { data, error } = await supabase.rpc('catalog_list_components');
    if (error) setError(error.message);
    else setAllComponents((data ?? []) as Component[]);
  }

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('catalog_search_tasks', { p_query: search, p_limit: 20 });
      if (error) setError(error.message);
      else setSearchResults((data ?? []) as TaskSummary[]);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const loadCatalogComponents = useCallback(async (taskId: string) => {
    const { data, error } = await supabase.rpc('catalog_list_task_components', { p_task_id: taskId });
    if (error) setError(error.message);
    else setCatalogComponents((data ?? []) as TaskComponentRow[]);
  }, []);

  const loadRoleComponents = useCallback(async (taskId: string, jobRoleId: string) => {
    const { data, error } = await supabase.rpc('catalog_list_job_role_task_components', {
      p_job_role_id: jobRoleId,
      p_task_id: taskId,
    });
    if (error) setError(error.message);
    else setRoleComponents((data ?? []) as TaskComponentRow[]);
  }, []);

  async function selectTask(task: TaskSummary) {
    setSelectedTask(task);
    setSearch('');
    setSearchResults([]);
    await loadCatalogComponents(task.id);
    if (roleContext) await loadRoleComponents(task.id, roleContext.jobRoleId);
  }

  useEffect(() => {
    if (initialTask) selectTask(initialTask);
    setClassification(roleContext ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTask, roleContext]);

  async function updateClassification(field: 'effectClassification' | 'criticality', value: string) {
    if (!classification || !selectedTask) return;
    const next = { ...classification, [field]: value } as TaskRoleContext;
    setSavingClassification(true);
    const { error } = await supabase.rpc('catalog_link_task_role', {
      p_job_role_id: classification.jobRoleId,
      p_task_id: selectedTask.id,
      p_effect_classification: next.effectClassification,
      p_criticality: next.criticality,
    });
    setSavingClassification(false);
    if (error) {
      setError(error.message);
      return;
    }
    setClassification(next);
  }

  async function linkComponent() {
    if (!selectedTask || !pickComponentId) return;
    const { error } = await supabase.rpc('catalog_link_task_component', {
      p_task_id: selectedTask.id,
      p_component_id: pickComponentId,
      p_role_in_task: pickRole,
      p_is_default: true,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPickComponentId('');
    loadCatalogComponents(selectedTask.id);
  }

  async function unlinkComponent(componentId: string, roleInTask: string) {
    if (!selectedTask) return;
    const { error } = await supabase.rpc('catalog_unlink_task_component', {
      p_task_id: selectedTask.id,
      p_component_id: componentId,
      p_role_in_task: roleInTask,
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadCatalogComponents(selectedTask.id);
  }

  async function linkRoleComponent(componentId: string, roleInTask: ComponentRoleInTask) {
    if (!selectedTask || !roleContext || !componentId) return;
    const { error } = await supabase.rpc('catalog_link_job_role_task_component', {
      p_job_role_id: roleContext.jobRoleId,
      p_task_id: selectedTask.id,
      p_component_id: componentId,
      p_role_in_task: roleInTask,
      p_is_default: true,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPickRoleComponentId('');
    loadRoleComponents(selectedTask.id, roleContext.jobRoleId);
  }

  async function unlinkRoleComponent(componentId: string, roleInTask: string) {
    if (!selectedTask || !roleContext) return;
    const { error } = await supabase.rpc('catalog_unlink_job_role_task_component', {
      p_job_role_id: roleContext.jobRoleId,
      p_task_id: selectedTask.id,
      p_component_id: componentId,
      p_role_in_task: roleInTask,
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadRoleComponents(selectedTask.id, roleContext.jobRoleId);
  }

  async function createComponent(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('catalog_create_component', {
      p_id: newComponent.id,
      p_name: newComponent.name,
      p_comp_type: newComponent.comp_type,
      p_owner: newComponent.owner,
      p_runtime: newComponent.runtime || null,
      p_repo_ref: newComponent.repo_ref || null,
      p_maturity: newComponent.maturity,
      p_target_system: newComponent.target_system || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewComponent({
      id: '',
      name: '',
      comp_type: 'activepieces_flow',
      owner: '',
      runtime: 'activepieces',
      repo_ref: '',
      maturity: 'prototype',
      target_system: '',
    });
    setShowNewComponent(false);
    loadComponents();
  }

  const roleComponentKeys = new Set(roleComponents.map((c) => `${c.component_id}:${c.role_in_task}`));

  return (
    <div className="panel">
      {onBack && (
        <div className="toolbar">
          <button className="secondary" onClick={onBack}>
            ← Volver
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <div className="add-task">
        <input
          type="text"
          placeholder="Buscar tarea por código o texto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map((t) => (
              <li key={t.id}>
                <span className="task-code">{t.task_code}</span>
                <span className="task-statement">{t.statement}</span>
                <button onClick={() => selectTask(t)}>Seleccionar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!selectedTask ? (
        <p className="empty">Busca y selecciona una tarea para ver o enlazar sus componentes.</p>
      ) : (
        <>
          <h2>
            <span className="task-code">{selectedTask.task_code}</span> {selectedTask.statement}
          </h2>

          {classification && (
            <div className="classification-card">
              <span className="classification-title">
                Clasificación en {classification.roleName} v{classification.roleVersion}
                {savingClassification && ' · guardando…'}
              </span>
              <label>
                Efecto
                <select
                  value={classification.effectClassification}
                  onChange={(e) => updateClassification('effectClassification', e.target.value)}
                >
                  {EFFECT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Criticidad
                <select
                  value={classification.criticality}
                  onChange={(e) => updateClassification('criticality', e.target.value)}
                >
                  {CRITICALITY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {roleContext && (
            <>
              <h3>Componentes de {roleContext.roleName}</h3>
              <p className="task-summary">
                Lo que realmente ejecuta esta tarea para este rol. Si está vacío, cae al default del
                catálogo de abajo.
              </p>
              <table className="linked-table">
                <thead>
                  <tr>
                    <th>Componente</th>
                    <th>Tipo</th>
                    <th>Sistema</th>
                    <th>Madurez</th>
                    <th>Rol en la tarea</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {roleComponents.map((c) => (
                    <tr key={`${c.component_id}:${c.role_in_task}`}>
                      <td>{c.component_name}</td>
                      <td>{c.comp_type}</td>
                      <td>{c.target_system || '—'}</td>
                      <td>{c.maturity}</td>
                      <td>{c.role_in_task}</td>
                      <td>
                        <button
                          className="remove"
                          onClick={() => unlinkRoleComponent(c.component_id, c.role_in_task)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {roleComponents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        Sin override para este rol — usa el default del catálogo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="toolbar">
                <label>
                  Componente existente:
                  <select value={pickRoleComponentId} onChange={(e) => setPickRoleComponentId(e.target.value)}>
                    <option value="">— elegir —</option>
                    {allComponents.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.comp_type}, {c.target_system || 'sin sistema'})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Rol:
                  <select
                    value={pickRoleComponentRole}
                    onChange={(e) => setPickRoleComponentRole(e.target.value as ComponentRoleInTask)}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => linkRoleComponent(pickRoleComponentId, pickRoleComponentRole)}
                  disabled={!pickRoleComponentId}
                >
                  Enlazar a este rol
                </button>
              </div>
            </>
          )}

          <h3>Opciones del catálogo (compartidas)</h3>
          <table className="linked-table">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Tipo</th>
                <th>Sistema</th>
                <th>Madurez</th>
                <th>Rol en la tarea</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {catalogComponents.map((c) => (
                <tr key={`${c.component_id}:${c.role_in_task}`}>
                  <td>{c.component_name}</td>
                  <td>{c.comp_type}</td>
                  <td>{c.target_system || '—'}</td>
                  <td>{c.maturity}</td>
                  <td>{c.role_in_task}</td>
                  <td className="row-actions">
                    {roleContext && (
                      <button
                        className="secondary"
                        disabled={roleComponentKeys.has(`${c.component_id}:${c.role_in_task}`)}
                        onClick={() => linkRoleComponent(c.component_id, c.role_in_task)}
                      >
                        Usar en este rol
                      </button>
                    )}
                    <button className="remove" onClick={() => unlinkComponent(c.component_id, c.role_in_task)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              {catalogComponents.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Sin componente todavía — este es uno de los mini-flujos de Activepieces
                    pendientes de programar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="toolbar">
            <label>
              Componente existente:
              <select value={pickComponentId} onChange={(e) => setPickComponentId(e.target.value)}>
                <option value="">— elegir —</option>
                {allComponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.comp_type}, {c.maturity})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rol:
              <select value={pickRole} onChange={(e) => setPickRole(e.target.value as ComponentRoleInTask)}>
                {ROLE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={linkComponent} disabled={!pickComponentId}>
              Enlazar componente
            </button>
            <button className="secondary" onClick={() => setShowNewComponent((v) => !v)}>
              {showNewComponent ? 'Cancelar' : '+ Nuevo componente'}
            </button>
          </div>

          {showNewComponent && (
            <form className="new-component-form" onSubmit={createComponent}>
              <input
                placeholder="id (ej. ap-flow-lead-capture)"
                value={newComponent.id}
                onChange={(e) => setNewComponent({ ...newComponent, id: e.target.value })}
                required
              />
              <input
                placeholder="Nombre"
                value={newComponent.name}
                onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
                required
              />
              <input
                placeholder="comp_type (ej. activepieces_flow)"
                value={newComponent.comp_type}
                onChange={(e) => setNewComponent({ ...newComponent, comp_type: e.target.value })}
                required
              />
              <input
                placeholder="owner"
                value={newComponent.owner}
                onChange={(e) => setNewComponent({ ...newComponent, owner: e.target.value })}
                required
              />
              <input
                placeholder="runtime"
                value={newComponent.runtime}
                onChange={(e) => setNewComponent({ ...newComponent, runtime: e.target.value })}
              />
              <input
                placeholder="repo_ref / URL del flujo"
                value={newComponent.repo_ref}
                onChange={(e) => setNewComponent({ ...newComponent, repo_ref: e.target.value })}
              />
              <input
                placeholder="sistema destino (ej. hubspot, salesforce)"
                value={newComponent.target_system}
                onChange={(e) => setNewComponent({ ...newComponent, target_system: e.target.value })}
              />
              <select
                value={newComponent.maturity}
                onChange={(e) =>
                  setNewComponent({ ...newComponent, maturity: e.target.value as ComponentMaturity })
                }
              >
                {MATURITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button type="submit">Crear componente</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
