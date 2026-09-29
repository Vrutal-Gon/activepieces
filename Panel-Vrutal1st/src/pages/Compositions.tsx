import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  type TaskSummary,
} from '../lib/types';

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


const EMPTY_SLOT = { position: '1', slot_key: '', kind: 'intake' as BlockKind, versionId: '', optional: false, is_default: false, applies_when: '' };

export function Compositions() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<TaskSummary[]>([]);
  const [task, setTask] = useState<TaskSummary | null>(null);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slots, setSlots] = useState<CompositionSlot[]>([]);
  const [issues, setIssues] = useState<CompositionIssue[] | null>(null);
  const [versionOptions, setVersionOptions] = useState<VersionOption[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newComposition, setNewComposition] = useState({ key: 'pipeline', name: '', pattern: 'WORKFLOW', changelog: '' });
  const [newSlot, setNewSlot] = useState(EMPTY_SLOT);

  const selected = compositions.find((c) => c.id === selectedId) ?? null;
  const editable = selected?.status === 'draft';

  useEffect(() => {
    supabase.rpc('is_superadmin').then(({ data, error }) => {
      if (error) setError(error.message);
      else setIsSuperadmin(!!data);
    });
  }, []);

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('catalog_search_tasks', { p_query: search, p_limit: 20 });
      if (error) setError(error.message);
      else setResults((data ?? []) as TaskSummary[]);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

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
        const variant = Object.keys(b.variant ?? {}).length ? ` ${JSON.stringify(b.variant)}` : '';
        options.push({ id: v.id, label: `${b.name}${variant} · v${v.version} (${v.status})` });
      }
    }
    setVersionOptions(options);
  }, []);

  useEffect(() => {
    if (editable) loadVersionOptions(newSlot.kind);
  }, [editable, newSlot.kind, loadVersionOptions]);

  function selectTask(t: TaskSummary) {
    setTask(t);
    setSearch('');
    setResults([]);
    setSelectedId(null);
    setSlots([]);
    setIssues(null);
    setError(null);
    loadCompositions(t.id);
  }

  function selectComposition(id: string) {
    setSelectedId(id);
    setIssues(null);
    setNewSlot(EMPTY_SLOT);
    loadSlots(id);
  }

  async function createComposition(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    const { data, error } = await supabase.rpc('catalog_create_composition', {
      p_task_id: task.id,
      p_key: newComposition.key.trim(),
      p_name: newComposition.name,
      p_pattern: newComposition.pattern,
      p_changelog: newComposition.changelog,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setNewComposition({ key: 'pipeline', name: '', pattern: 'WORKFLOW', changelog: '' });
    setShowNew(false);
    await loadCompositions(task.id);
    selectComposition(data as string);
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
    if (task) loadCompositions(task.id);
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
    if (task) loadCompositions(task.id);
  }

  async function addSlot(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    let appliesWhen: Record<string, unknown> = {};
    if (newSlot.applies_when.trim()) {
      try {
        const parsed = JSON.parse(newSlot.applies_when);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        appliesWhen = parsed as Record<string, unknown>;
      } catch {
        setError('La condición de aplicación debe ser un objeto JSON, por ejemplo {"mailbox":"imap"}');
        return;
      }
    }
    const { error } = await supabase.rpc('catalog_add_composition_slot', {
      p_composition_id: selected.id,
      p_position: Number(newSlot.position),
      p_slot_key: newSlot.slot_key.trim(),
      p_kind: newSlot.kind,
      p_component_version_id: newSlot.versionId,
      p_optional: newSlot.optional,
      p_applies_when: appliesWhen,
      p_is_default: newSlot.is_default,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setNewSlot({ ...EMPTY_SLOT, kind: newSlot.kind, position: newSlot.position });
    loadSlots(selected.id);
    if (task) loadCompositions(task.id);
  }

  async function removeSlot(slotId: string) {
    const { error } = await supabase.rpc('catalog_remove_composition_slot', { p_slot_id: slotId });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    if (selected) loadSlots(selected.id);
    if (task) loadCompositions(task.id);
  }

  return (
    <div className="panel">
      <h2>Composiciones</h2>
      <p className="task-summary">
        Una composición es una forma concreta de realizar una versión de tarea: una secuencia ordenada de slots. Cada slot admite
        varias opciones (variantes por stack del cliente) con su condición de aplicación. Una composición publicada no se modifica:
        se crea una versión nueva.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="add-task">
        <input type="text" placeholder="Buscar tarea por código o texto…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {results.length > 0 && (
          <ul className="search-results">
            {results.map((t) => (
              <li key={t.id}>
                <span className="task-code">{t.task_code}</span>
                <span className="task-statement">{t.statement}</span>
                <button onClick={() => selectTask(t)}>Seleccionar</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!task ? (
        <p className="empty">Busca y selecciona una tarea para ver o crear sus composiciones.</p>
      ) : (
        <>
          <h3>
            <span className="task-code">{task.task_code}</span> {task.statement}
          </h3>

          <table className="linked-table">
            <thead>
              <tr>
                <th>Clave</th>
                <th>Versión</th>
                <th>Nombre</th>
                <th>Patrón</th>
                <th>Slots</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {compositions.map((c) => (
                <tr key={c.id} className={c.id === selectedId ? 'selected-row' : ''}>
                  <td>{c.key}</td>
                  <td>v{c.version}</td>
                  <td>{c.name}</td>
                  <td>{c.pattern}</td>
                  <td>{c.slot_count}</td>
                  <td>
                    <span className="badge">{c.status}</span>
                  </td>
                  <td className="row-actions">
                    <button className="secondary" onClick={() => selectComposition(c.id)}>
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {compositions.length === 0 && <p className="empty">Esta tarea no tiene composiciones todavía.</p>}

          <div className="toolbar">
            <button className="secondary" onClick={() => setShowNew((v) => !v)}>
              {showNew ? 'Cancelar' : '+ Nueva composición'}
            </button>
          </div>
          {showNew && (
            <form className="new-component-form" onSubmit={createComposition}>
              <input
                type="text"
                placeholder="clave (ej. pipeline, agent). Si ya existe, crea la siguiente versión"
                value={newComposition.key}
                onChange={(e) => setNewComposition({ ...newComposition, key: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="nombre"
                value={newComposition.name}
                onChange={(e) => setNewComposition({ ...newComposition, name: e.target.value })}
                required
              />
              <select value={newComposition.pattern} onChange={(e) => setNewComposition({ ...newComposition, pattern: e.target.value })}>
                {COMPOSITION_PATTERNS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="qué cambia en esta versión"
                value={newComposition.changelog}
                onChange={(e) => setNewComposition({ ...newComposition, changelog: e.target.value })}
                required
              />
              <button type="submit">Crear composición</button>
            </form>
          )}

          {selected && (
            <>
              <h3>
                {selected.name} · {selected.key} v{selected.version} <span className="badge">{selected.status}</span>
              </h3>
              <div className="toolbar">
                <button className="secondary" onClick={() => runCheck(selected.id)}>
                  Comprobar
                </button>
                {NEXT_STATUS[selected.status] && (!NEXT_STATUS[selected.status]!.superOnly || isSuperadmin) && (
                  <button onClick={() => setStatus(selected, NEXT_STATUS[selected.status]!.to)}>{NEXT_STATUS[selected.status]!.label}</button>
                )}
                {isSuperadmin && selected.status === 'draft' && (
                  <button className="remove" onClick={() => deleteComposition(selected)}>
                    Eliminar
                  </button>
                )}
              </div>

              {issues && (
                <ul className="issue-list">
                  {issues.length === 0 && <li className="issue-ok">Sin problemas.</li>}
                  {issues.map((i, n) => (
                    <li key={n} className={i.severity === 'error' ? 'issue-error' : 'issue-warning'}>
                      <strong>{i.severity === 'error' ? 'Error' : 'Aviso'}</strong>
                      {i.slot_key ? ` · ${i.slot_key}` : ''}: {i.message}
                    </li>
                  ))}
                </ul>
              )}

              <table className="linked-table">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Slot</th>
                    <th>Tipo</th>
                    <th>Bloque</th>
                    <th>Aplica cuando</th>
                    <th>Produce</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s.id}>
                      <td>{s.position}</td>
                      <td>
                        {s.slot_key}
                        {s.optional && ' (opcional)'}
                        {s.is_default && ' · por defecto'}
                      </td>
                      <td>{s.kind}</td>
                      <td>
                        {s.component_name}
                        {Object.keys(s.variant ?? {}).length > 0 && ` ${JSON.stringify(s.variant)}`} · v{s.version}{' '}
                        <span className="badge">{s.version_status}</span>
                      </td>
                      <td>{Object.keys(s.applies_when ?? {}).length ? JSON.stringify(s.applies_when) : '—'}</td>
                      <td>{s.output_contract ?? '—'}</td>
                      <td className="row-actions">
                        {editable && (
                          <button className="remove" onClick={() => removeSlot(s.id)}>
                            Quitar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {slots.length === 0 && <p className="empty">Sin slots todavía.</p>}

              {editable ? (
                <form className="new-component-form" onSubmit={addSlot}>
                  <input
                    type="number"
                    placeholder="posición"
                    value={newSlot.position}
                    onChange={(e) => setNewSlot({ ...newSlot, position: e.target.value })}
                    required
                  />
                  <input
                    type="text"
                    placeholder="clave del slot (ej. intake, context.crm)"
                    value={newSlot.slot_key}
                    onChange={(e) => setNewSlot({ ...newSlot, slot_key: e.target.value })}
                    required
                  />
                  <select value={newSlot.kind} onChange={(e) => setNewSlot({ ...newSlot, kind: e.target.value as BlockKind, versionId: '' })}>
                    {BLOCK_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <select value={newSlot.versionId} onChange={(e) => setNewSlot({ ...newSlot, versionId: e.target.value })} required>
                    <option value="">— versión de bloque —</option>
                    {versionOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder='aplica cuando (JSON, ej. {"mailbox":"imap"}); vacío = siempre'
                    value={newSlot.applies_when}
                    onChange={(e) => setNewSlot({ ...newSlot, applies_when: e.target.value })}
                  />
                  <label>
                    <input type="checkbox" checked={newSlot.optional} onChange={(e) => setNewSlot({ ...newSlot, optional: e.target.checked })} />{' '}
                    opcional
                  </label>
                  <label>
                    <input type="checkbox" checked={newSlot.is_default} onChange={(e) => setNewSlot({ ...newSlot, is_default: e.target.checked })} />{' '}
                    por defecto
                  </label>
                  <button type="submit">Añadir al slot</button>
                </form>
              ) : (
                <p className="task-summary">Composición publicada: es de solo lectura. Para cambiarla, crea una versión nueva.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
