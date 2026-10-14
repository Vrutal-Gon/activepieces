import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabaseClient';
import { PageHead } from '../components/PageHead';
import { duplicateBlock, duplicateContract, updateContract } from '../lib/api/catalog';
import { errorMessage } from '../lib/api/client';
import { CATALOG_GLOSSARY, KIND_COPY, kindLabel } from '../lib/catalogCopy';
import { StatusPill } from '../components/StatusPill';
import '../styles/pages/catalog.css';
import { BLOCK_KINDS, type Block, type ComponentVersion, type Contract, type PublishStatus } from '../lib/types';

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


function parseJson(text: string, what: string): { value: Record<string, unknown> | null; error: string | null } {
  if (!text.trim()) return { value: {}, error: null };
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: null, error: `${what} debe ser un objeto JSON` };
    }
    return { value: parsed as Record<string, unknown>, error: null };
  } catch {
    return { value: null, error: `${what} no es JSON válido` };
  }
}

export function BlockLibrary() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [versions, setVersions] = useState<Record<string, ComponentVersion[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { kind: string; variant: string }>>({});
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNewContract, setShowNewContract] = useState(false);
  const [newContract, setNewContract] = useState({ key: '', description: '', schema: '' });
  const [newVersion, setNewVersion] = useState({ changelog: '', artifact_ref: '', artifact_sha256: '', contract: '', consumes: '' });
  const [showNewBlock, setShowNewBlock] = useState(false);
  const EMPTY_BLOCK = { name: '', kind: 'intake', varKey: '', varValue: '', variant: '', comp_type: 'activepieces_flow', owner: 'Vrutal Labs' };
  const [newBlock, setNewBlock] = useState(EMPTY_BLOCK);
  // Duplicar un bloque = otra variante del mismo tipo (p. ej. Gmail en lugar de IMAP).
  const [dupBlock, setDupBlock] = useState<{ id: string; name: string; varKey: string; varValue: string } | null>(null);
  // Contratos: editar un borrador, o duplicar como contrato nuevo con otra clave.
  const [editContract, setEditContract] = useState<{ key: string; version: number; description: string; schema: string } | null>(null);
  const [dupContract, setDupContract] = useState<{ key: string; version: number; newKey: string } | null>(null);

  // ?b=<component_id>: se llega desde un slot de composición; se abre y se resalta ese bloque.
  const [params] = useSearchParams();
  const focusId = params.get('b');
  // Bloques y contratos en vistas separadas (?vista=contratos) para no apilarlo todo.
  const view = params.get('vista') === 'contratos' ? 'contratos' : 'bloques';
  const focusedOnce = useRef(false);

  const loadContracts = useCallback(async () => {
    const { data, error } = await supabase.rpc('catalog_list_contracts');
    if (error) setError(error.message);
    else setContracts((data ?? []) as Contract[]);
  }, []);

  const loadBlocks = useCallback(async () => {
    const { data, error } = await supabase.rpc('catalog_list_blocks');
    if (error) {
      setError(error.message);
      return;
    }
    const list = (data ?? []) as Block[];
    setBlocks(list);
    setEdits(Object.fromEntries(list.map((b) => [b.component_id, { kind: b.kind ?? '', variant: JSON.stringify(b.variant ?? {}) }])));
  }, []);

  const loadVersions = useCallback(async (componentId: string) => {
    const { data, error } = await supabase.rpc('catalog_list_component_versions', { p_component_id: componentId });
    if (error) setError(error.message);
    else setVersions((prev) => ({ ...prev, [componentId]: (data ?? []) as ComponentVersion[] }));
  }, []);

  useEffect(() => {
    loadContracts();
    loadBlocks();
    supabase.rpc('is_superadmin').then(({ data, error }) => {
      if (error) setError(error.message);
      else setIsSuperadmin(!!data);
    });
  }, [loadContracts, loadBlocks]);

  async function createContract(e: FormEvent) {
    e.preventDefault();
    const schema = parseJson(newContract.schema, 'El esquema');
    if (schema.error) {
      setError(schema.error);
      return;
    }
    if (schema.value && ('flows' in schema.value || 'trigger' in schema.value || 'pieces' in schema.value)) {
      setError(
        'Esto parece la exportación de un flujo de Activepieces, no el esquema de unos datos. Un flujo es el artefacto de un bloque: créalo como bloque y pon su referencia en la versión.',
      );
      return;
    }
    const { error } = await supabase.rpc('catalog_create_contract', {
      p_key: newContract.key.trim(),
      p_description: newContract.description,
      p_json_schema: schema.value,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setNewContract({ key: '', description: '', schema: '' });
    setShowNewContract(false);
    loadContracts();
  }

  async function setContractStatus(c: Contract, status: PublishStatus) {
    if (!confirmStatus(`el contrato ${c.key} v${c.version}`, c.status, status)) return;
    const { error } = await supabase.rpc('catalog_set_contract_status', { p_key: c.key, p_version: c.version, p_status: status });
    if (error) setError(error.message);
    else {
      setError(null);
      loadContracts();
    }
  }

  async function createBlock(e: FormEvent) {
    e.preventDefault();
    const variant = newBlock.variant.trim()
      ? parseJson(newBlock.variant, 'La variante')
      : { value: newBlock.varKey.trim() ? { [newBlock.varKey.trim()]: newBlock.varValue.trim() } : {}, error: null };
    if (variant.error) {
      setError(variant.error);
      return;
    }
    const { data, error } = await supabase.rpc('catalog_create_block', {
      p_name: newBlock.name.trim(),
      p_kind: newBlock.kind,
      p_variant: variant.value,
      p_owner: newBlock.owner.trim() || 'Vrutal Labs',
      p_comp_type: newBlock.comp_type,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setNewBlock(EMPTY_BLOCK);
    setShowNewBlock(false);
    await loadBlocks();
    // Siguiente paso natural: su primera versión.
    toggleExpand(data as string);
    setNewVersion((v) => ({ ...v, changelog: 'Primera versión' }));
  }

  async function submitDupBlock(e: FormEvent) {
    e.preventDefault();
    if (!dupBlock) return;
    try {
      const variant = dupBlock.varKey.trim() ? { [dupBlock.varKey.trim()]: dupBlock.varValue.trim() } : {};
      const id = await duplicateBlock(dupBlock.id, dupBlock.name, variant);
      setDupBlock(null);
      setError(null);
      await loadBlocks();
      toggleExpand(id);
      setNewVersion((v) => ({ ...v, changelog: 'Primera versión' }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveContractEdit(e: FormEvent) {
    e.preventDefault();
    if (!editContract) return;
    const schema = parseJson(editContract.schema, 'El esquema');
    if (schema.error || !schema.value) {
      setError(schema.error ?? 'El esquema no es válido');
      return;
    }
    try {
      await updateContract(editContract.key, editContract.version, editContract.description, schema.value);
      setEditContract(null);
      setError(null);
      loadContracts();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function contractNewVersion(c: Contract) {
    try {
      const ref = await duplicateContract(c.key, c.version);
      setError(null);
      await loadContracts();
      if (ref) {
        setEditContract({
          key: ref.key,
          version: ref.version,
          description: c.description,
          schema: JSON.stringify(c.json_schema ?? {}, null, 2),
        });
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitDupContract(e: FormEvent) {
    e.preventDefault();
    if (!dupContract) return;
    try {
      await duplicateContract(dupContract.key, dupContract.version, dupContract.newKey.trim());
      setDupContract(null);
      setError(null);
      loadContracts();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function deleteContract(c: Contract) {
    const { error } = await supabase.rpc('catalog_delete_contract', { p_key: c.key, p_version: c.version });
    if (error) setError(error.message);
    else {
      setError(null);
      loadContracts();
    }
  }

  async function saveBlock(b: Block) {
    const edit = edits[b.component_id];
    const variant = parseJson(edit.variant, 'La variante');
    if (variant.error) {
      setError(variant.error);
      return;
    }
    const { error } = await supabase.rpc('catalog_set_component_block', {
      p_id: b.component_id,
      p_kind: edit.kind,
      p_variant: variant.value,
    });
    if (error) setError(error.message);
    else {
      setError(null);
      loadBlocks();
    }
  }

  function toggleExpand(componentId: string) {
    if (expandedId === componentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(componentId);
    setNewVersion({ changelog: '', artifact_ref: '', artifact_sha256: '', contract: '', consumes: '' });
    loadVersions(componentId);
  }

  useEffect(() => {
    if (!focusId || focusedOnce.current || !blocks.some((b) => b.component_id === focusId)) return;
    focusedOnce.current = true;
    toggleExpand(focusId);
    document.getElementById(`bloque-${focusId}`)?.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, blocks]);

  async function createVersion(e: FormEvent, componentId: string) {
    e.preventDefault();
    const [key, ver] = newVersion.contract ? newVersion.contract.split('@') : ['', ''];
    const { error } = await supabase.rpc('catalog_create_component_version', {
      p_component_id: componentId,
      p_changelog: newVersion.changelog,
      p_artifact_ref: newVersion.artifact_ref.trim() || null,
      p_artifact_sha256: newVersion.artifact_sha256.trim() || null,
      p_output_contract_key: key || null,
      p_output_contract_version: ver ? Number(ver) : null,
      p_consumes: newVersion.consumes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setNewVersion({ changelog: '', artifact_ref: '', artifact_sha256: '', contract: '', consumes: '' });
    loadVersions(componentId);
    loadBlocks();
  }

  async function setVersionStatus(componentId: string, v: ComponentVersion, status: PublishStatus) {
    if (!confirmStatus(`la versión v${v.version}`, v.status, status)) return;
    const { error } = await supabase.rpc('catalog_set_component_version_status', { p_id: v.id, p_status: status });
    if (error) setError(error.message);
    else {
      setError(null);
      loadVersions(componentId);
    }
  }

  async function deleteVersion(componentId: string, v: ComponentVersion) {
    const { error } = await supabase.rpc('catalog_delete_component_version', { p_id: v.id });
    if (error) setError(error.message);
    else {
      setError(null);
      loadVersions(componentId);
      loadBlocks();
    }
  }

  return (
    <section>
      <PageHead crumbs={[{ label: 'Construcción · paso 3' }]} title="Bloques y contratos" />

      <div className="catalog-stack">
        <details className="catalog-help">
          <summary>Bloques y contratos, en dos frases</summary>
          <p>
            <strong>{CATALOG_GLOSSARY.block}</strong> {CATALOG_GLOSSARY.contract}
          </p>
          <p>
            Ejemplo, <em>{CATALOG_GLOSSARY.exampleTask}</em>: el bloque «Recibir email» entrega un{' '}
            <span className="mono">EmailEvent</span> (remitente, asunto, adjuntos). El bloque «Leer factura» lo espera y
            entrega una <span className="mono">Invoice</span>. Si los dos hablan el mismo contrato, encajan.
          </p>
          <ul className="kind-list">
            {Object.entries(KIND_COPY).map(([k, c]) => (
              <li key={k}>
                <strong>{c.verb}</strong> <span className="mono">{k}</span> · {c.line}
              </li>
            ))}
          </ul>
          <p>{CATALOG_GLOSSARY.variant}</p>
          <p>{CATALOG_GLOSSARY.immutable}</p>
        </details>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}

        <nav className="client-tabs" aria-label="Vista">
          <Link className="client-tabs__tab" to={{ search: '' }} aria-current={view === 'bloques' ? 'page' : undefined}>
            Bloques
            <span className="client-tabs__count">{blocks.length}</span>
          </Link>
          <Link
            className="client-tabs__tab"
            to={{ search: '?vista=contratos' }}
            aria-current={view === 'contratos' ? 'page' : undefined}
          >
            Contratos
            <span className="client-tabs__count">{contracts.length}</span>
          </Link>
        </nav>

        {view === 'bloques' && (
          <section className="table-card">
            <div className="table-card__head">
              <h2 className="table-card__title">Bloques</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Tipo de bloque</th>
                  <th>Variante (JSON)</th>
                  <th className="data-table__num">Versiones</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {blocks.map((b) => {
                  const edit = edits[b.component_id] ?? { kind: '', variant: '{}' };
                  const expanded = expandedId === b.component_id;
                  return (
                    <Fragment key={b.component_id}>
                      <tr
                        id={`bloque-${b.component_id}`}
                        aria-selected={b.component_id === focusId}
                      >
                        <td>
                          <span className="data-table__primary">{b.name}</span>
                          <span className="data-table__secondary">{b.comp_type}</span>
                        </td>
                        <td>
                          <select
                            className="text-input"
                            aria-label={`Tipo de bloque de ${b.name}`}
                            value={edit.kind}
                            onChange={(e) => setEdits({ ...edits, [b.component_id]: { ...edit, kind: e.target.value } })}
                          >
                            <option value="">— monolítico (sin tipo) —</option>
                            {BLOCK_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {kindLabel(k)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="text-input"
                            aria-label={`Variante de ${b.name}`}
                            value={edit.variant}
                            onChange={(e) =>
                              setEdits({ ...edits, [b.component_id]: { ...edit, variant: e.target.value } })
                            }
                          />
                        </td>
                        <td className="data-table__num">{b.version_count}</td>
                        <td className="data-table__actions">
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => saveBlock(b)}>
                            Guardar
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            aria-expanded={expanded}
                            onClick={() => toggleExpand(b.component_id)}
                          >
                            {expanded ? 'Ocultar versiones' : 'Versiones'}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => setDupBlock({ id: b.component_id, name: `${b.name} (copia)`, varKey: '', varValue: '' })}
                          >
                            Duplicar
                          </button>
                        </td>
                      </tr>
                      {dupBlock?.id === b.component_id && (
                        <tr className="data-table__group">
                          <td colSpan={5}>
                            <form className="inline-form" onSubmit={submitDupBlock}>
                              <span className="catalog-note">
                                Mismo tipo, otro stack. Nace sin versiones: súbele la suya.
                              </span>
                              <label className="inline-field">
                                Nombre
                                <input
                                  className="text-input"
                                  value={dupBlock.name}
                                  onChange={(e) => setDupBlock({ ...dupBlock, name: e.target.value })}
                                  required
                                />
                              </label>
                              <label className="inline-field">
                                Variante: sistema
                                <input
                                  className="text-input cond-input"
                                  placeholder="mailbox"
                                  value={dupBlock.varKey}
                                  onChange={(e) => setDupBlock({ ...dupBlock, varKey: e.target.value })}
                                />
                              </label>
                              <label className="inline-field">
                                valor
                                <input
                                  className="text-input cond-input"
                                  placeholder="gmail"
                                  value={dupBlock.varValue}
                                  onChange={(e) => setDupBlock({ ...dupBlock, varValue: e.target.value })}
                                />
                              </label>
                              <button type="submit" className="btn btn--sm btn--primary">
                                Crear copia
                              </button>
                              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDupBlock(null)}>
                                Cancelar
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                      {expanded && (
                        <tr className="data-table__group">
                          <td colSpan={5}>
                            <div className="catalog-stack">
                              {b.kind === null && (
                                <p className="notice notice--info">
                                  Asigna un tipo de bloque y guarda antes de usar este componente en una composición.
                                </p>
                              )}
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Versión</th>
                                    <th>Produce</th>
                                    <th>Consume</th>
                                    <th>Artefacto</th>
                                    <th>Cambios</th>
                                    <th />
                                  </tr>
                                </thead>
                                <tbody>
                                  {(versions[b.component_id] ?? []).map((v) => {
                                    const next = NEXT_STATUS[v.status];
                                    return (
                                      <tr key={v.id}>
                                        <td className="mono">
                                          v{v.version} <StatusPill status={v.status} />
                                        </td>
                                        <td className="mono">
                                          {v.output_contract_key ? `${v.output_contract_key}@${v.output_contract_version}` : '—'}
                                        </td>
                                        <td className="mono">{v.consumes.length ? v.consumes.join(', ') : '—'}</td>
                                        <td className="data-table__wrap">
                                          <span className="mono">{v.artifact_ref || '—'}</span>
                                          {v.artifact_sha256 && (
                                            <span className="data-table__secondary" title={v.artifact_sha256}>
                                              sha256 {v.artifact_sha256.slice(0, 12)}…
                                            </span>
                                          )}
                                        </td>
                                        <td className="data-table__wrap">{v.changelog}</td>
                                        <td className="data-table__actions">
                                          {next && (!next.superOnly || isSuperadmin) && (
                                            <button
                                              type="button"
                                              className="btn btn--sm btn--ghost"
                                              onClick={() => setVersionStatus(b.component_id, v, next.to)}
                                            >
                                              {next.label}
                                            </button>
                                          )}
                                          {isSuperadmin && v.status === 'draft' && (
                                            <button
                                              type="button"
                                              className="btn btn--sm btn--danger"
                                              onClick={() => deleteVersion(b.component_id, v)}
                                            >
                                              Eliminar
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {(versions[b.component_id] ?? []).length === 0 && (
                                    <tr>
                                      <td colSpan={6} className="data-table__empty">
                                        Sin versiones todavía.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                              <form className="inline-form" onSubmit={(e) => createVersion(e, b.component_id)}>
                                <input
                                  className="text-input"
                                  placeholder="qué cambia en esta versión"
                                  value={newVersion.changelog}
                                  onChange={(e) => setNewVersion({ ...newVersion, changelog: e.target.value })}
                                  required
                                />
                                <input
                                  className="text-input"
                                  placeholder="artefacto: git:Vrutal-Gon/VrutalOS:<ruta>@<SHA de commit de 40 caracteres>  o  piece:@scope/nombre@1.0.0"
                                  value={newVersion.artifact_ref}
                                  onChange={(e) => setNewVersion({ ...newVersion, artifact_ref: e.target.value })}
                                />
                                <input
                                  className="text-input"
                                  placeholder="sha256 del contenido del artefacto (opcional, 64 caracteres hex)"
                                  value={newVersion.artifact_sha256}
                                  onChange={(e) => setNewVersion({ ...newVersion, artifact_sha256: e.target.value })}
                                />
                                <select
                                  className="text-input"
                                  aria-label="Contrato que produce"
                                  value={newVersion.contract}
                                  onChange={(e) => setNewVersion({ ...newVersion, contract: e.target.value })}
                                >
                                  <option value="">— no produce contrato —</option>
                                  {contracts.map((c) => (
                                    <option key={`${c.key}@${c.version}`} value={`${c.key}@${c.version}`}>
                                      {c.key}@{c.version} ({c.status})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="text-input"
                                  placeholder="contratos que consume, separados por comas (ej. EmailEvent)"
                                  value={newVersion.consumes}
                                  onChange={(e) => setNewVersion({ ...newVersion, consumes: e.target.value })}
                                />
                                <button type="submit" className="btn btn--primary">
                                  Crear versión
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {blocks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="data-table__empty">
                      No hay bloques todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-card__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setShowNewBlock((v) => !v)}>
                {showNewBlock ? 'Cancelar' : '+ Nuevo bloque'}
              </button>
            </div>
            {showNewBlock && (
              <form className="table-card__foot inline-form" onSubmit={createBlock}>
                <label className="inline-field">
                  1 · Qué hace
                  <select
                    className="text-input"
                    value={newBlock.kind}
                    onChange={(e) => setNewBlock({ ...newBlock, kind: e.target.value })}
                  >
                    {BLOCK_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {kindLabel(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-field">
                  2 · Nombre
                  <input
                    className="text-input"
                    placeholder="Recibir email por IMAP"
                    value={newBlock.name}
                    onChange={(e) => setNewBlock({ ...newBlock, name: e.target.value })}
                    required
                  />
                </label>
                <label className="inline-field">
                  3 · Para qué stack (opcional): sistema
                  <input
                    className="text-input cond-input"
                    placeholder="mailbox"
                    value={newBlock.varKey}
                    onChange={(e) => setNewBlock({ ...newBlock, varKey: e.target.value })}
                  />
                </label>
                <label className="inline-field">
                  valor
                  <input
                    className="text-input cond-input"
                    placeholder="imap"
                    value={newBlock.varValue}
                    onChange={(e) => setNewBlock({ ...newBlock, varValue: e.target.value })}
                  />
                </label>
                <button type="submit" className="btn btn--primary">
                  Crear bloque y su versión →
                </button>
                <p className="catalog-note wizard__hint">
                  {KIND_COPY[newBlock.kind as keyof typeof KIND_COPY]?.line} Ejemplo:{' '}
                  {KIND_COPY[newBlock.kind as keyof typeof KIND_COPY]?.example} Sin stack = sirve a cualquier cliente.
                </p>
                <details className="catalog-help wizard__hint">
                  <summary>Avanzado</summary>
                  <div className="inline-form">
                    <label className="inline-field">
                      Variante en JSON (sustituye a sistema/valor)
                      <input
                        className="text-input"
                        placeholder='{"mailbox":"imap"}'
                        value={newBlock.variant}
                        onChange={(e) => setNewBlock({ ...newBlock, variant: e.target.value })}
                      />
                    </label>
                    <label className="inline-field">
                      Cómo está hecho
                      <select
                        className="text-input"
                        value={newBlock.comp_type}
                        onChange={(e) => setNewBlock({ ...newBlock, comp_type: e.target.value })}
                      >
                        <option value="activepieces_flow">Flujo de Activepieces</option>
                        <option value="activepieces_piece">Piece propio</option>
                        <option value="code_step">Paso de código</option>
                      </select>
                    </label>
                    <label className="inline-field">
                      Propietario
                      <input
                        className="text-input"
                        value={newBlock.owner}
                        onChange={(e) => setNewBlock({ ...newBlock, owner: e.target.value })}
                      />
                    </label>
                  </div>
                </details>
              </form>
            )}
          </section>
        )}

        {view === 'contratos' && (
          <section className="table-card">
            <div className="table-card__head">
              <h2 className="table-card__title">Contratos</h2>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const next = NEXT_STATUS[c.status];
                  return (
                    <Fragment key={`${c.key}@${c.version}`}>
                      <tr>
                        <td>
                          <span className="data-table__primary">{c.key}</span>
                          <span className="data-table__secondary">v{c.version}</span>
                        </td>
                        <td className="data-table__wrap">{c.description}</td>
                        <td>
                          <StatusPill status={c.status} />
                        </td>
                        <td className="data-table__actions">
                          {c.status === 'draft' && (
                            <button
                              type="button"
                              className="btn btn--sm btn--ghost"
                              onClick={() =>
                                setEditContract({
                                  key: c.key,
                                  version: c.version,
                                  description: c.description,
                                  schema: JSON.stringify(c.json_schema ?? {}, null, 2),
                                })
                              }
                            >
                              Editar
                            </button>
                          )}
                          {next && (!next.superOnly || isSuperadmin) && (
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setContractStatus(c, next.to)}>
                              {next.label}
                            </button>
                          )}
                          {c.status !== 'draft' && (
                            <button type="button" className="btn btn--sm btn--ghost" onClick={() => contractNewVersion(c)}>
                              Versión nueva
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => setDupContract({ key: c.key, version: c.version, newKey: '' })}
                          >
                            Duplicar
                          </button>
                          {isSuperadmin && c.status === 'draft' && (
                            <button type="button" className="btn btn--sm btn--danger" onClick={() => deleteContract(c)}>
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                      {editContract?.key === c.key && editContract.version === c.version && (
                        <tr className="data-table__group">
                          <td colSpan={4}>
                            <form className="inline-form" onSubmit={saveContractEdit}>
                              <label className="inline-field wizard__wide">
                                Qué dato describe
                                <input
                                  className="text-input"
                                  value={editContract.description}
                                  onChange={(e) => setEditContract({ ...editContract, description: e.target.value })}
                                  required
                                />
                              </label>
                              <label className="inline-field wizard__wide">
                                Forma de los datos (JSON Schema)
                                <textarea
                                  className="text-input schema-input"
                                  value={editContract.schema}
                                  onChange={(e) => setEditContract({ ...editContract, schema: e.target.value })}
                                />
                              </label>
                              <button type="submit" className="btn btn--sm btn--primary">
                                Guardar borrador
                              </button>
                              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setEditContract(null)}>
                                Cancelar
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                      {dupContract?.key === c.key && dupContract.version === c.version && (
                        <tr className="data-table__group">
                          <td colSpan={4}>
                            <form className="inline-form" onSubmit={submitDupContract}>
                              <span className="catalog-note">Copia la forma de los datos a un contrato nuevo (v1, borrador).</span>
                              <label className="inline-field">
                                Clave nueva
                                <input
                                  className="text-input"
                                  placeholder={`${c.key}Extendido`}
                                  value={dupContract.newKey}
                                  onChange={(e) => setDupContract({ ...dupContract, newKey: e.target.value })}
                                  required
                                />
                              </label>
                              <button type="submit" className="btn btn--sm btn--primary">
                                Duplicar
                              </button>
                              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDupContract(null)}>
                                Cancelar
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="data-table__empty">
                      Todavía no hay contratos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="table-card__foot">
              <button type="button" className="btn btn--ghost" onClick={() => setShowNewContract((v) => !v)}>
                {showNewContract ? 'Cancelar' : '+ Nuevo contrato (o nueva versión)'}
              </button>
            </div>
            {showNewContract && (
              <form className="table-card__foot inline-form" onSubmit={createContract}>
                <input
                  className="text-input"
                  placeholder="clave (ej. EmailEvent). Si ya existe, crea la siguiente versión"
                  value={newContract.key}
                  onChange={(e) => setNewContract({ ...newContract, key: e.target.value })}
                  required
                />
                <input
                  className="text-input"
                  placeholder="descripción"
                  value={newContract.description}
                  onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
                  required
                />
                <input
                  className="text-input"
                  placeholder='esquema JSON de los DATOS (opcional, ej. {"type":"object"}). No pegues aquí un flujo'
                  value={newContract.schema}
                  onChange={(e) => setNewContract({ ...newContract, schema: e.target.value })}
                />
                <button type="submit" className="btn btn--primary">
                  Crear contrato
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
