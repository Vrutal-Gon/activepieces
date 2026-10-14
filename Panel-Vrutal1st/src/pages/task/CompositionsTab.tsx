import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabaseClient';
import { duplicateComposition } from '../../lib/api/catalog';
import { errorMessage } from '../../lib/api/client';
import { CATALOG_GLOSSARY, KIND_COPY, PATTERN_COPY, kindLabel } from '../../lib/catalogCopy';
import { StatusPill } from '../../components/StatusPill';
import {
  BLOCK_KINDS,
  COMPOSITION_PATTERNS,
  type Block,
  type BlockKind,
  type ComponentVersion,
  type Composition,
  type CompositionIssue,
  type CompositionSlot,
  type PublishStatus,
  type TaskDetail,
} from '../../lib/types';

interface VersionOption {
  id: string;
  label: string;
}

const NEXT_STATUS: Record<PublishStatus, { to: PublishStatus; label: string; superOnly?: boolean } | null> = {
  draft: { to: 'validated', label: 'Publicar' },
  validated: { to: 'deprecated', label: 'Deprecar' },
  deprecated: { to: 'validated', label: 'Reactivar', superOnly: true },
};

function confirmStatus(what: string, from: PublishStatus, to: PublishStatus): boolean {
  if (to === 'validated' && from === 'draft') {
    return window.confirm(`Publicar ${what} es definitivo: una vez publicado no se puede modificar ni volver a borrador (solo se podrá deprecar). ¿Publicar?`);
  }
  if (to === 'deprecated') {
    return window.confirm(`Deprecar ${what}: dejará de ofrecerse para composiciones nuevas. Un superadmin podrá reactivarlo. ¿Continuar?`);
  }
  return window.confirm(`¿Reactivar ${what}?`);
}

/** Paso nuevo: por defecto va al final; "alt" añade otra variante (por stack) a un paso existente. */
interface StepDraft {
  kind: BlockKind;
  versionId: string;
  placement: 'next' | number;
  slotKey: string;
  condKey: string;
  condValue: string;
  optional: boolean;
  isDefault: boolean;
}

const EMPTY_STEP: StepDraft = {
  kind: 'intake',
  versionId: '',
  placement: 'next',
  slotKey: '',
  condKey: '',
  condValue: '',
  optional: false,
  isDefault: false,
};

interface CompositionsTabProps {
  task: TaskDetail;
  /** Tras crear, publicar o borrar, para refrescar los contadores de la ficha. */
  onChanged: () => void;
}

export function CompositionsTab({ task, onChanged }: CompositionsTabProps) {
  const [compositions, setCompositions] = useState<Composition[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slots, setSlots] = useState<CompositionSlot[]>([]);
  const [issues, setIssues] = useState<CompositionIssue[] | null>(null);
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultPattern = task.primary_pattern ?? 'WORKFLOW';
  const [showNew, setShowNew] = useState(false);
  const [newComposition, setNewComposition] = useState({
    name: 'Camino principal',
    pattern: defaultPattern,
    key: '',
    changelog: '',
  });
  const [step, setStep] = useState<StepDraft>(EMPTY_STEP);

  const list = compositions ?? [];
  const selected = list.find((c) => c.id === selectedId) ?? null;
  const editable = selected?.status === 'draft';

  useEffect(() => {
    supabase.rpc('is_superadmin').then(({ data, error }) => {
      if (error) setError(error.message);
      else setIsSuperadmin(!!data);
    });
  }, []);

  const loadCompositions = useCallback(async (taskId: string) => {
    const { data, error } = await supabase.rpc('catalog_list_compositions', { p_task_id: taskId });
    if (error) setError(error.message);
    else setCompositions((data ?? []) as Composition[]);
  }, []);

  const loadSlots = useCallback(async (compositionId: string) => {
    const { data, error } = await supabase.rpc('catalog_list_composition_slots', { p_composition_id: compositionId });
    if (error) setError(error.message);
    else setSlots((data ?? []) as CompositionSlot[]);
  }, []);

  const runCheck = useCallback(async (compositionId: string) => {
    const { data, error } = await supabase.rpc('catalog_check_composition', { p_id: compositionId });
    if (error) setError(error.message);
    else setIssues((data ?? []) as CompositionIssue[]);
  }, []);

  const loadVersionOptions = useCallback(async (kind: BlockKind) => {
    const { data, error } = await supabase.rpc('catalog_list_blocks');
    if (error) {
      setError(error.message);
      return;
    }
    const blocks = ((data ?? []) as Block[]).filter((b) => b.kind === kind && b.version_count > 0);
    const options: VersionOption[] = [];
    for (const b of blocks) {
      const { data: vs, error: vErr } = await supabase.rpc('catalog_list_component_versions', { p_component_id: b.component_id });
      if (vErr) {
        setError(vErr.message);
        return;
      }
      for (const v of (vs ?? []) as ComponentVersion[]) {
        if (v.status === 'deprecated') continue;
        const variant = Object.keys(b.variant ?? {}).length ? ` ${JSON.stringify(b.variant)}` : '';
        options.push({ id: v.id, label: `${b.name}${variant} · v${v.version} (${v.status})` });
      }
    }
    setVersionOptions(options);
  }, []);

  useEffect(() => {
    if (editable) loadVersionOptions(step.kind);
  }, [editable, step.kind, loadVersionOptions]);

  useEffect(() => {
    loadCompositions(task.id);
  }, [task.id, loadCompositions]);

  const selectComposition = useCallback(
    (id: string) => {
      setSelectedId(id);
      setIssues(null);
      setStep(EMPTY_STEP);
      loadSlots(id);
    },
    [loadSlots],
  );

  // Se abre sola la primera composición (la más reciente de su clave): un clic menos.
  useEffect(() => {
    if (compositions && compositions.length > 0 && !selectedId) selectComposition(compositions[0].id);
  }, [compositions, selectedId, selectComposition]);

  async function createComposition(e: FormEvent) {
    e.preventDefault();
    const key = newComposition.key.trim() || newComposition.pattern.toLowerCase();
    const { data, error } = await supabase.rpc('catalog_create_composition', {
      p_task_id: task.id,
      p_key: key,
      p_name: newComposition.name.trim() || 'Camino principal',
      p_pattern: newComposition.pattern,
      p_changelog: newComposition.changelog.trim() || 'Primera versión',
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setShowNew(false);
    await loadCompositions(task.id);
    onChanged();
    selectComposition(data as string);
  }

  async function duplicate(c: Composition) {
    try {
      const id = await duplicateComposition(c.id);
      setError(null);
      await loadCompositions(task.id);
      onChanged();
      selectComposition(id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function setStatus(c: Composition, status: PublishStatus) {
    if (!confirmStatus(`la composición ${c.key} v${c.version}`, c.status, status)) return;
    const { error } = await supabase.rpc('catalog_set_composition_status', { p_id: c.id, p_status: status });
    if (error) {
      setError(error.message);
      if (status === 'validated') runCheck(c.id);
      return;
    }
    setError(null);
    loadCompositions(task.id);
    onChanged();
  }

  async function deleteComposition(c: Composition) {
    const { error } = await supabase.rpc('catalog_delete_composition', { p_id: c.id });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setSelectedId(null);
    setSlots([]);
    loadCompositions(task.id);
    onChanged();
  }

  // Pasos = slots agrupados por posición. Varias filas en una posición = variantes por stack.
  const positions = [...new Set(slots.map((s) => s.position))].sort((a, b) => a - b);
  const nextPosition = (positions.at(-1) ?? 0) + 1;

  async function addStep(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const alt = step.placement !== 'next' ? slots.find((s) => s.position === step.placement) : undefined;
    const position = step.placement === 'next' ? nextPosition : step.placement;
    const appliesWhen = step.condKey.trim() ? { [step.condKey.trim()]: step.condValue.trim() } : {};
    const { error } = await supabase.rpc('catalog_add_composition_slot', {
      p_composition_id: selected.id,
      p_position: position,
      p_slot_key: step.slotKey.trim() || alt?.slot_key || step.kind,
      p_kind: alt?.kind ?? step.kind,
      p_component_version_id: step.versionId,
      p_optional: step.optional,
      p_applies_when: appliesWhen,
      p_is_default: step.isDefault,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setStep({ ...EMPTY_STEP, kind: step.kind });
    loadSlots(selected.id);
    loadCompositions(task.id);
  }

  async function removeSlot(slotId: string) {
    const { error } = await supabase.rpc('catalog_remove_composition_slot', { p_slot_id: slotId });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    if (selected) loadSlots(selected.id);
    loadCompositions(task.id);
  }

  function chooseAlternative(position: number) {
    const s = slots.find((x) => x.position === position);
    if (!s) return;
    setStep({ ...EMPTY_STEP, placement: position, kind: s.kind, slotKey: s.slot_key });
  }

  const next = selected ? NEXT_STATUS[selected.status] : null;

  return (
    <div className="catalog-stack">
      <details className="catalog-help">
        <summary>Cómo se monta una composición</summary>
        <p>{CATALOG_GLOSSARY.composition}</p>
        <p>
          Ejemplo: <strong>{CATALOG_GLOSSARY.exampleTask}</strong>.
        </p>
        <ol className="pipeline pipeline--example">
          {BLOCK_KINDS.map((k) => (
            <li key={k} className="pipeline__step">
              <span className="pipeline__verb">{KIND_COPY[k].verb}</span>
              <span className="pipeline__line">{KIND_COPY[k].example}</span>
            </li>
          ))}
        </ol>
        <p>{CATALOG_GLOSSARY.variant}</p>
        <p>{CATALOG_GLOSSARY.immutable}</p>
      </details>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {compositions !== null && list.length === 0 && !showNew && (
        <div className="empty-state">
          <p className="empty-state__title">Esta tarea aún no tiene composición</p>
          <p className="empty-state__body">
            Monta la secuencia de bloques con la que el especialista la resuelve. Empieza por un borrador; nada llega a
            un cliente hasta que lo publicas.
          </p>
          <p>
            <button type="button" className="btn btn--primary" onClick={() => setShowNew(true)}>
              + Crear la primera composición
            </button>
          </p>
        </div>
      )}

      {list.length > 0 && (
        <div className="inline-form">
          <div className="chip-group" role="group" aria-label="Composiciones">
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                aria-pressed={c.id === selectedId}
                onClick={() => selectComposition(c.id)}
              >
                {c.name} · {c.key} v{c.version} <StatusPill status={c.status} />
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setShowNew((v) => !v)}>
            {showNew ? 'Cancelar' : '+ Nueva composición'}
          </button>
        </div>
      )}

      {showNew && (
        <form className="table-card wizard__step" onSubmit={createComposition}>
          <label className="inline-field">
            Nombre
            <input
              className="text-input"
              value={newComposition.name}
              onChange={(e) => setNewComposition({ ...newComposition, name: e.target.value })}
            />
          </label>
          <label className="inline-field">
            Patrón
            <select
              className="text-input"
              value={newComposition.pattern}
              onChange={(e) => setNewComposition({ ...newComposition, pattern: e.target.value })}
            >
              {COMPOSITION_PATTERNS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <p className="catalog-note wizard__hint">{PATTERN_COPY[newComposition.pattern]}</p>
          <details className="catalog-help wizard__hint">
            <summary>Avanzado</summary>
            <div className="inline-form">
              <label className="inline-field">
                Clave (vacío = {newComposition.pattern.toLowerCase()})
                <input
                  className="text-input"
                  value={newComposition.key}
                  onChange={(e) => setNewComposition({ ...newComposition, key: e.target.value })}
                />
              </label>
              <label className="inline-field">
                Qué cambia (vacío = Primera versión)
                <input
                  className="text-input"
                  value={newComposition.changelog}
                  onChange={(e) => setNewComposition({ ...newComposition, changelog: e.target.value })}
                />
              </label>
            </div>
          </details>
          <button type="submit" className="btn btn--primary">
            Crear borrador
          </button>
        </form>
      )}

      {selected && (
        <section className="table-card">
          <div className="table-card__head role-sheet__head">
            <h2 className="table-card__title">
              {selected.name} · {selected.key} v{selected.version} <StatusPill status={selected.status} />
            </h2>
            <span className="catalog-note">{selected.changelog}</span>
          </div>
          <div className="table-card__foot">
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => runCheck(selected.id)}>
              Comprobar
            </button>
            {next && (!next.superOnly || isSuperadmin) && (
              <button type="button" className="btn btn--sm btn--primary" onClick={() => setStatus(selected, next.to)}>
                {next.label}
              </button>
            )}
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => duplicate(selected)}>
              Duplicar como versión nueva
            </button>
            {isSuperadmin && selected.status === 'draft' && (
              <button type="button" className="btn btn--sm btn--danger" onClick={() => deleteComposition(selected)}>
                Eliminar
              </button>
            )}
          </div>

          {issues && (
            <ul className="issue-list">
              {issues.length === 0 && (
                <li>
                  <span className="pill pill--ok">sin problemas</span>
                </li>
              )}
              {issues.map((i, n) => (
                <li key={n}>
                  <span className={`pill ${i.severity === 'error' ? 'pill--bad' : 'pill--warn'}`}>
                    {i.severity === 'error' ? 'error' : 'aviso'}
                  </span>{' '}
                  {i.slot_key ? <span className="mono">{i.slot_key}: </span> : null}
                  {i.message}
                </li>
              ))}
            </ul>
          )}

          <ol className="pipeline">
            {positions.map((pos) => {
              const options = slots.filter((s) => s.position === pos);
              const kind = options[0].kind;
              return (
                <li key={pos} className="pipeline__step">
                  <span className="pipeline__verb">
                    {pos}. {KIND_COPY[kind]?.verb ?? kind}
                  </span>
                  <span className="pipeline__line mono">
                    {options[0].slot_key}
                    {options.some((o) => o.optional) && ' · opcional'}
                  </span>
                  <ul className="pipeline__options">
                    {options.map((s) => (
                      <li key={s.id}>
                        <Link to={`/bloques?b=${encodeURIComponent(s.component_id)}`}>{s.component_name}</Link>{' '}
                        <span className="mono">v{s.version}</span> <StatusPill status={s.version_status} />
                        {Object.keys(s.applies_when ?? {}).length > 0 && (
                          <span className="pill">
                            si{' '}
                            {Object.entries(s.applies_when)
                              .map(([k, v]) => `${k}=${String(v)}`)
                              .join(', ')}
                          </span>
                        )}
                        {s.is_default && <span className="pill">por defecto</span>}
                        {s.output_contract && <span className="pipeline__contract mono">→ {s.output_contract}</span>}
                        {editable && (
                          <button type="button" className="btn-link pipeline__remove" onClick={() => removeSlot(s.id)}>
                            quitar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {editable && (
                    <button type="button" className="btn-link" onClick={() => chooseAlternative(pos)}>
                      + variante por stack
                    </button>
                  )}
                </li>
              );
            })}
            {positions.length === 0 && (
              <li className="pipeline__empty">Sin pasos todavía. Añade el primero: normalmente, por dónde entra el trabajo.</li>
            )}
          </ol>

          {editable ? (
            <form className="table-card__foot inline-form" onSubmit={addStep}>
              <span className="table-card__title">
                {step.placement === 'next' ? `Paso ${nextPosition}` : `Variante del paso ${step.placement}`}
              </span>
              <label className="inline-field">
                Tipo
                <select
                  className="text-input"
                  value={step.kind}
                  disabled={step.placement !== 'next'}
                  onChange={(e) => setStep({ ...step, kind: e.target.value as BlockKind, versionId: '' })}
                >
                  {BLOCK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {kindLabel(k)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-field">
                Bloque
                <select
                  className="text-input"
                  value={step.versionId}
                  onChange={(e) => setStep({ ...step, versionId: e.target.value })}
                  required
                >
                  <option value="">{versionOptions.length ? '— elegir —' : 'No hay bloques de este tipo'}</option>
                  {versionOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-field">
                Solo si el cliente usa… (opcional)
                <span className="inline-form">
                  <input
                    className="text-input cond-input"
                    placeholder="mailbox"
                    aria-label="Sistema"
                    value={step.condKey}
                    onChange={(e) => setStep({ ...step, condKey: e.target.value })}
                  />
                  <input
                    className="text-input cond-input"
                    placeholder="imap"
                    aria-label="Valor"
                    value={step.condValue}
                    onChange={(e) => setStep({ ...step, condValue: e.target.value })}
                  />
                </span>
              </label>
              <button type="submit" className="btn btn--primary">
                Añadir
              </button>
              {step.placement !== 'next' && (
                <button type="button" className="btn btn--ghost" onClick={() => setStep(EMPTY_STEP)}>
                  Cancelar
                </button>
              )}
              <p className="catalog-note wizard__hint">
                {KIND_COPY[step.kind].line} {versionOptions.length === 0 && (
                  <>
                    Crea uno en <Link to="/bloques">Bloques</Link>.
                  </>
                )}
              </p>
              <details className="catalog-help wizard__hint">
                <summary>Avanzado</summary>
                <div className="inline-form">
                  <label className="inline-field">
                    Clave del paso (vacío = {step.kind})
                    <input
                      className="text-input"
                      value={step.slotKey}
                      onChange={(e) => setStep({ ...step, slotKey: e.target.value })}
                    />
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={step.optional}
                      onChange={(e) => setStep({ ...step, optional: e.target.checked })}
                    />
                    opcional
                  </label>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={step.isDefault}
                      onChange={(e) => setStep({ ...step, isDefault: e.target.checked })}
                    />
                    variante por defecto
                  </label>
                </div>
              </details>
            </form>
          ) : (
            <p className="table-card__foot catalog-note">
              Publicada: no se modifica. Para cambiarla, «Duplicar como versión nueva» y edita el borrador.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

