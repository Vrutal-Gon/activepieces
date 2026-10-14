import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { StatusPill } from '../../components/StatusPill';
import type {
  Component,
  ComponentMaturity,
  ComponentRoleInTask,
  Criticality,
  EffectClassification,
  TaskComponentRow,
  TaskSummary,
} from '../../lib/types';

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

interface ComponentsTabProps {
  task: TaskSummary;
  /** Rol desde el que se llegó (?rol=): activa la clasificación y los overrides de ese rol. */
  roleContext: TaskRoleContext | null;
  /** Tras cambiar enlaces, para refrescar los contadores de la ficha. */
  onChanged: () => void;
}

const EMPTY_COMPONENT = {
  name: '',
  comp_type: 'activepieces_flow',
  owner: '',
  runtime: 'activepieces',
  repo_ref: '',
  maturity: 'prototype' as ComponentMaturity,
  target_system: '',
};

export function ComponentsTab({ task, roleContext, onChanged }: ComponentsTabProps) {
  const [catalogComponents, setCatalogComponents] = useState<TaskComponentRow[]>([]);
  const [roleComponents, setRoleComponents] = useState<TaskComponentRow[]>([]);
  const [allComponents, setAllComponents] = useState<Component[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pickComponentId, setPickComponentId] = useState('');
  const [pickRole, setPickRole] = useState<ComponentRoleInTask>('executor');

  const [pickRoleComponentId, setPickRoleComponentId] = useState('');
  const [pickRoleComponentRole, setPickRoleComponentRole] = useState<ComponentRoleInTask>('executor');

  const [classification, setClassification] = useState<TaskRoleContext | null>(roleContext);
  const [savingClassification, setSavingClassification] = useState(false);

  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editComponentForm, setEditComponentForm] = useState<typeof EMPTY_COMPONENT | null>(null);

  const [showNewComponent, setShowNewComponent] = useState(false);
  const [newComponent, setNewComponent] = useState(EMPTY_COMPONENT);

  const loadComponents = useCallback(async () => {
    const { data, error } = await supabase.rpc('catalog_list_components');
    if (error) setError(error.message);
    else setAllComponents((data ?? []) as Component[]);
  }, []);

  const loadCatalogComponents = useCallback(async () => {
    const { data, error } = await supabase.rpc('catalog_list_task_components', { p_task_id: task.id });
    if (error) setError(error.message);
    else setCatalogComponents((data ?? []) as TaskComponentRow[]);
  }, [task.id]);

  const loadRoleComponents = useCallback(async () => {
    if (!roleContext) return;
    const { data, error } = await supabase.rpc('catalog_list_job_role_task_components', {
      p_job_role_id: roleContext.jobRoleId,
      p_task_id: task.id,
    });
    if (error) setError(error.message);
    else setRoleComponents((data ?? []) as TaskComponentRow[]);
  }, [task.id, roleContext]);

  useEffect(() => {
    loadComponents();
    supabase.rpc('is_superadmin').then(({ data, error }) => {
      if (error) setError(error.message);
      else setIsSuperadmin(!!data);
    });
  }, [loadComponents]);

  useEffect(() => {
    loadCatalogComponents();
    loadRoleComponents();
    setClassification(roleContext);
  }, [loadCatalogComponents, loadRoleComponents, roleContext]);

  async function refreshAfterChange() {
    setError(null);
    await Promise.all([loadCatalogComponents(), loadRoleComponents()]);
    onChanged();
  }

  async function updateClassification(field: 'effectClassification' | 'criticality', value: string) {
    if (!classification) return;
    const next = { ...classification, [field]: value } as TaskRoleContext;
    setSavingClassification(true);
    const { error } = await supabase.rpc('catalog_link_task_role', {
      p_job_role_id: classification.jobRoleId,
      p_task_id: task.id,
      p_effect_classification: next.effectClassification,
      p_criticality: next.criticality,
    });
    setSavingClassification(false);
    if (error) {
      setError(error.message);
      return;
    }
    setClassification(next);
    onChanged();
  }

  async function linkComponent() {
    if (!pickComponentId) return;
    const { error } = await supabase.rpc('catalog_link_task_component', {
      p_task_id: task.id,
      p_component_id: pickComponentId,
      p_role_in_task: pickRole,
      p_is_default: true,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPickComponentId('');
    refreshAfterChange();
  }

  async function unlinkComponent(componentId: string, roleInTask: string) {
    const { error } = await supabase.rpc('catalog_unlink_task_component', {
      p_task_id: task.id,
      p_component_id: componentId,
      p_role_in_task: roleInTask,
    });
    if (error) {
      setError(error.message);
      return;
    }
    refreshAfterChange();
  }

  async function linkRoleComponent(componentId: string, roleInTask: ComponentRoleInTask) {
    if (!roleContext || !componentId) return;
    const { error } = await supabase.rpc('catalog_link_job_role_task_component', {
      p_job_role_id: roleContext.jobRoleId,
      p_task_id: task.id,
      p_component_id: componentId,
      p_role_in_task: roleInTask,
      p_is_default: true,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPickRoleComponentId('');
    refreshAfterChange();
  }

  async function unlinkRoleComponent(componentId: string, roleInTask: string) {
    if (!roleContext) return;
    const { error } = await supabase.rpc('catalog_unlink_job_role_task_component', {
      p_job_role_id: roleContext.jobRoleId,
      p_task_id: task.id,
      p_component_id: componentId,
      p_role_in_task: roleInTask,
    });
    if (error) {
      setError(error.message);
      return;
    }
    refreshAfterChange();
  }

  async function createComponent(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('catalog_create_component', {
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
    setNewComponent(EMPTY_COMPONENT);
    setShowNewComponent(false);
    setError(null);
    loadComponents();
  }

  function startEditComponent(componentId: string) {
    const full = allComponents.find((c) => c.id === componentId);
    if (!full) return;
    setEditingComponentId(componentId);
    setEditComponentForm({
      name: full.name,
      comp_type: full.comp_type,
      owner: full.owner,
      runtime: full.runtime || '',
      repo_ref: full.repo_ref || '',
      maturity: full.maturity,
      target_system: full.target_system || '',
    });
  }

  async function saveComponentEdit() {
    if (!editingComponentId || !editComponentForm) return;
    const { error } = await supabase.rpc('catalog_update_component', {
      p_id: editingComponentId,
      p_name: editComponentForm.name,
      p_comp_type: editComponentForm.comp_type,
      p_owner: editComponentForm.owner,
      p_runtime: editComponentForm.runtime || null,
      p_repo_ref: editComponentForm.repo_ref || null,
      p_maturity: editComponentForm.maturity,
      p_target_system: editComponentForm.target_system || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setEditingComponentId(null);
    setEditComponentForm(null);
    loadComponents();
    refreshAfterChange();
  }

  async function deleteComponentGlobal(componentId: string) {
    const { error } = await supabase.rpc('catalog_delete_component', { p_id: componentId });
    if (error) {
      setError(error.message);
      return;
    }
    loadComponents();
    refreshAfterChange();
  }

  const roleComponentKeys = new Set(roleComponents.map((c) => `${c.component_id}:${c.role_in_task}`));

  return (
    <div className="catalog-stack">
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {classification && (
        <section className="table-card">
          <div className="table-card__head">
            <h2 className="table-card__title">
              Clasificación en {classification.roleName} v{classification.roleVersion}
              {savingClassification && ' · guardando…'}
            </h2>
          </div>
          <div className="table-card__foot">
            <label className="inline-field">
              Efecto
              <select
                className="text-input"
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
            <label className="inline-field">
              Criticidad
              <select
                className="text-input"
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
        </section>
      )}

      {roleContext && (
        <section className="table-card">
          <div className="table-card__head">
            <h2 className="table-card__title">Componentes de {roleContext.roleName}</h2>
            <p className="catalog-note">
              Lo que realmente ejecuta esta tarea para este rol. Si está vacío, cae al default del catálogo de abajo.
            </p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Componente</th>
                <th>Sistema</th>
                <th>Madurez</th>
                <th>Rol en la tarea</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {roleComponents.map((c) => (
                <tr key={`${c.component_id}:${c.role_in_task}`}>
                  <td>
                    <span className="data-table__primary">{c.component_name}</span>
                    <span className="data-table__secondary">{c.comp_type}</span>
                  </td>
                  <td>{c.target_system || '—'}</td>
                  <td>
                    <StatusPill status={c.maturity} />
                  </td>
                  <td className="mono">{c.role_in_task}</td>
                  <td className="data-table__actions">
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => unlinkRoleComponent(c.component_id, c.role_in_task)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              {roleComponents.length === 0 && (
                <tr>
                  <td colSpan={5} className="data-table__empty">
                    Sin override para este rol: usa el default del catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="table-card__foot inline-form">
            <label className="inline-field">
              Componente existente
              <select
                className="text-input"
                value={pickRoleComponentId}
                onChange={(e) => setPickRoleComponentId(e.target.value)}
              >
                <option value="">— elegir —</option>
                {allComponents.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.comp_type}, {c.target_system || 'sin sistema'})
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              Rol en la tarea
              <select
                className="text-input"
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
              type="button"
              className="btn btn--primary"
              onClick={() => linkRoleComponent(pickRoleComponentId, pickRoleComponentRole)}
              disabled={!pickRoleComponentId}
            >
              Enlazar a este rol
            </button>
          </div>
        </section>
      )}

      <section className="table-card">
        <div className="table-card__head">
          <h2 className="table-card__title">Opciones del catálogo (compartidas)</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Componente</th>
              <th>Sistema</th>
              <th>Madurez</th>
              <th>Rol en la tarea</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {catalogComponents.map((c) =>
              editingComponentId === c.component_id && editComponentForm ? (
                <tr key={`${c.component_id}:${c.role_in_task}`}>
                  <td>
                    <input
                      className="text-input"
                      aria-label="Nombre"
                      value={editComponentForm.name}
                      onChange={(e) => setEditComponentForm({ ...editComponentForm, name: e.target.value })}
                    />
                    <input
                      className="text-input"
                      aria-label="Tipo"
                      value={editComponentForm.comp_type}
                      onChange={(e) => setEditComponentForm({ ...editComponentForm, comp_type: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="text-input"
                      aria-label="Sistema"
                      value={editComponentForm.target_system}
                      onChange={(e) => setEditComponentForm({ ...editComponentForm, target_system: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className="text-input"
                      aria-label="Madurez"
                      value={editComponentForm.maturity}
                      onChange={(e) =>
                        setEditComponentForm({ ...editComponentForm, maturity: e.target.value as ComponentMaturity })
                      }
                    >
                      {MATURITY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="mono">{c.role_in_task}</td>
                  <td className="data-table__actions">
                    <button type="button" className="btn btn--sm btn--primary" onClick={saveComponentEdit}>
                      Guardar
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        setEditingComponentId(null);
                        setEditComponentForm(null);
                      }}
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={`${c.component_id}:${c.role_in_task}`}>
                  <td>
                    <span className="data-table__primary">{c.component_name}</span>
                    <span className="data-table__secondary">{c.comp_type}</span>
                  </td>
                  <td>{c.target_system || '—'}</td>
                  <td>
                    <StatusPill status={c.maturity} />
                  </td>
                  <td className="mono">{c.role_in_task}</td>
                  <td className="data-table__actions">
                    {roleContext && (
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
                        disabled={roleComponentKeys.has(`${c.component_id}:${c.role_in_task}`)}
                        onClick={() => linkRoleComponent(c.component_id, c.role_in_task as ComponentRoleInTask)}
                      >
                        Usar en este rol
                      </button>
                    )}
                    {isSuperadmin && (
                      <>
                        <button
                          type="button"
                          className="btn btn--sm btn--ghost"
                          onClick={() => startEditComponent(c.component_id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => deleteComponentGlobal(c.component_id)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => unlinkComponent(c.component_id, c.role_in_task)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ),
            )}
            {catalogComponents.length === 0 && (
              <tr>
                <td colSpan={5} className="data-table__empty">
                  Sin componente todavía: es uno de los mini-flujos de Activepieces pendientes de programar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="table-card__foot inline-form">
          <label className="inline-field">
            Componente existente
            <select className="text-input" value={pickComponentId} onChange={(e) => setPickComponentId(e.target.value)}>
              <option value="">— elegir —</option>
              {allComponents.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.comp_type}, {c.maturity})
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Rol en la tarea
            <select
              className="text-input"
              value={pickRole}
              onChange={(e) => setPickRole(e.target.value as ComponentRoleInTask)}
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--primary" onClick={linkComponent} disabled={!pickComponentId}>
            Enlazar componente
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowNewComponent((v) => !v)}>
            {showNewComponent ? 'Cancelar' : '+ Nuevo componente'}
          </button>
        </div>
        {showNewComponent && (
          <form className="table-card__foot inline-form" onSubmit={createComponent}>
            <input
              className="text-input"
              placeholder="Nombre"
              value={newComponent.name}
              onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
              required
            />
            <input
              className="text-input"
              placeholder="comp_type (ej. activepieces_flow)"
              value={newComponent.comp_type}
              onChange={(e) => setNewComponent({ ...newComponent, comp_type: e.target.value })}
              required
            />
            <input
              className="text-input"
              placeholder="owner"
              value={newComponent.owner}
              onChange={(e) => setNewComponent({ ...newComponent, owner: e.target.value })}
              required
            />
            <input
              className="text-input"
              placeholder="runtime"
              value={newComponent.runtime}
              onChange={(e) => setNewComponent({ ...newComponent, runtime: e.target.value })}
            />
            <input
              className="text-input"
              placeholder="repo_ref / URL del flujo"
              value={newComponent.repo_ref}
              onChange={(e) => setNewComponent({ ...newComponent, repo_ref: e.target.value })}
            />
            <input
              className="text-input"
              placeholder="sistema destino (ej. hubspot, salesforce)"
              value={newComponent.target_system}
              onChange={(e) => setNewComponent({ ...newComponent, target_system: e.target.value })}
            />
            <select
              className="text-input"
              aria-label="Madurez"
              value={newComponent.maturity}
              onChange={(e) => setNewComponent({ ...newComponent, maturity: e.target.value as ComponentMaturity })}
            >
              {MATURITY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--primary">
              Crear componente
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
