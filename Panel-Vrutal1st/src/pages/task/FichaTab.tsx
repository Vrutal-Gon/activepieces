import { useState, type FormEvent } from 'react';
import { linkTaskRole, updateTask } from '../../lib/api/catalog';
import { ProcessOptions } from '../../components/ProcessOptions';
import { StatusPill } from '../../components/StatusPill';
import { COMPOSITION_PATTERNS } from '../../lib/types';
import { PATTERN_COPY } from '../../lib/catalogCopy';
import type { Criticality, EffectClassification, TaskDetail } from '../../lib/types';

const RIESGOS = ['low', 'medium', 'medium_high', 'high'] as const;
const EFFECT_OPTIONS: EffectClassification[] = ['read_only', 'reversible', 'irreversible'];
const CRITICALITY_OPTIONS: Criticality[] = ['core', 'standard', 'peripheral'];

/** Rol desde el que se llegó (?rol=): su clasificación de esta tarea se edita aquí. */
export interface TaskRoleContext {
  jobRoleId: string;
  roleName: string;
  roleVersion: number;
  effectClassification: EffectClassification;
  criticality: Criticality;
}

const ESTADOS: { value: string; label: string; ayuda: string }[] = [
  { value: 'draft', label: 'Borrador', ayuda: 'Sin revisar. Es el estado de salida de toda tarea.' },
  { value: 'validated', label: 'Validada', ayuda: 'Revisada: su enunciado ya no se edita en sitio.' },
  { value: 'deprecated', label: 'Obsoleta', ayuda: 'Superada. No se usa en roles nuevos.' },
];

interface FichaTabProps {
  task: TaskDetail;
  roleContext: TaskRoleContext | null;
  onChanged: () => void;
}

/**
 * Edición de la ficha de la tarea: lo que hace falta para CURAR el catálogo.
 * Las 1.000 tareas importadas de O*NET y APQC llegaron sin proceso ni patrón, y hasta ahora
 * no había forma de asignárselos desde el panel (no existía `catalog_update_task`).
 *
 * El `task_code` no se edita: es la identidad, opaca e inmutable. Tampoco `source` ni
 * `source_code`, que son la trazabilidad al origen.
 */
export function FichaTab({ task, roleContext, onChanged }: FichaTabProps) {
  const [draft, setDraft] = useState({
    statement: task.statement,
    process_id: task.process_id ?? '',
    primary_pattern: task.primary_pattern ?? '',
    risk: task.risk ?? '',
    status: task.status,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const validada = task.status === 'validated';
  const enunciadoTocado = draft.statement.trim() !== task.statement;
  const sucio =
    enunciadoTocado ||
    draft.process_id !== (task.process_id ?? '') ||
    draft.primary_pattern !== (task.primary_pattern ?? '') ||
    draft.risk !== (task.risk ?? '') ||
    draft.status !== task.status;

  function set<K extends keyof typeof draft>(k: K, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
    setGuardado(false);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateTask({
        taskId: task.id,
        statement: enunciadoTocado ? draft.statement.trim() : null,
        processId: draft.process_id || null,
        primaryPattern: draft.primary_pattern || null,
        risk: draft.risk || null,
        status: draft.status,
      });
      setGuardado(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="catalog-stack">
      {roleContext && <RoleClassification task={task} context={roleContext} onChanged={onChanged} />}

      <section className="table-card">
      <div className="table-card__head">
        <h2 className="table-card__title">Ficha</h2>
        <span className="data-table__secondary">
          <span className="task-code">{task.task_code}</span> · no se edita
        </span>
      </div>

      <form className="catalog-stack" onSubmit={guardar}>
        <label className="inline-field inline-field--block">
          Enunciado
          <textarea
            className="text-input"
            rows={3}
            value={draft.statement}
            disabled={validada}
            onChange={(e) => set('statement', e.target.value)}
          />
        </label>
        {validada && (
          <p className="catalog-note">
            Esta tarea está <StatusPill status="validated" />: su enunciado no se cambia aquí. Cambiarlo es
            una <strong>versión nueva</strong>, para no dejar a los clientes anclados a un texto que ya no
            existe. El resto de campos sí se puede ajustar.
          </p>
        )}

        <div className="inline-form">
          <label className="inline-field">
            Proceso
            <select
              className="text-input"
              value={draft.process_id}
              onChange={(e) => set('process_id', e.target.value)}
            >
              <option value="">Sin proceso</option>
              <ProcessOptions />
            </select>
          </label>

          <label className="inline-field">
            Patrón
            <select
              className="text-input"
              value={draft.primary_pattern}
              onChange={(e) => set('primary_pattern', e.target.value)}
            >
              <option value="">Sin patrón</option>
              {COMPOSITION_PATTERNS.map((p) => (
                <option key={p} value={p} title={PATTERN_COPY[p]}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-field">
            Riesgo
            <select className="text-input" value={draft.risk} onChange={(e) => set('risk', e.target.value)}>
              <option value="">Sin fijar</option>
              {RIESGOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-field">
            Estado
            <select className="text-input" value={draft.status} onChange={(e) => set('status', e.target.value)}>
              {ESTADOS.map((s) => (
                <option key={s.value} value={s.value} title={s.ayuda}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="notice notice--error">{error}</p>}
        {guardado && !sucio && <p className="notice notice--info">Guardado.</p>}

        <div className="inline-form">
          <button type="submit" className="btn btn--primary" disabled={busy || !sucio}>
            {busy ? 'Guardando…' : 'Guardar ficha'}
          </button>
        </div>
      </form>
      </section>
    </div>
  );
}

interface RoleClassificationProps {
  task: TaskDetail;
  context: TaskRoleContext;
  onChanged: () => void;
}

/**
 * Cuánto pesa esta tarea DENTRO de un rol concreto. Vive en `job_role_task`, no en la tarea:
 * la misma tarea puede ser core en un rol y peripheral en otro.
 */
function RoleClassification({ task, context, onChanged }: RoleClassificationProps) {
  const [valor, setValor] = useState({
    effectClassification: context.effectClassification,
    criticality: context.criticality,
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(campo: 'effectClassification' | 'criticality', v: string) {
    const siguiente = { ...valor, [campo]: v } as typeof valor;
    const previo = valor;
    setValor(siguiente);
    setGuardando(true);
    setError(null);
    try {
      await linkTaskRole(context.jobRoleId, task.id, siguiente.effectClassification, siguiente.criticality);
      onChanged();
    } catch (err) {
      setValor(previo);
      setError(err instanceof Error ? err.message : 'No se ha podido guardar la clasificación.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="table-card">
      <div className="table-card__head">
        <h2 className="table-card__title">
          En {context.roleName} v{context.roleVersion}
          {guardando && ' · guardando…'}
        </h2>
        <p className="catalog-note">Se guarda solo para este rol. Otros roles mantienen la suya.</p>
      </div>
      <div className="table-card__foot">
        <label className="inline-field">
          Efecto
          <select
            className="text-input"
            value={valor.effectClassification}
            onChange={(e) => cambiar('effectClassification', e.target.value)}
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
            value={valor.criticality}
            onChange={(e) => cambiar('criticality', e.target.value)}
          >
            {CRITICALITY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
