import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  const [newBlock, setNewBlock] = useState({ name: '', kind: 'intake', variant: '', comp_type: 'activepieces_flow', owner: 'Vrutal Labs' });

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
    const variant = parseJson(newBlock.variant, 'La variante');
    if (variant.error) {
      setError(variant.error);
      return;
    }
    const { error } = await supabase.rpc('catalog_create_block', {
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
    setNewBlock({ name: '', kind: 'intake', variant: '', comp_type: 'activepieces_flow', owner: 'Vrutal Labs' });
    setShowNewBlock(false);
    loadBlocks();
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
    <div className="panel">
      <h2>Bloques y contratos</h2>
      <p className="task-summary">
        <strong>Bloque</strong>: una pieza reutilizable de un flujo (intake, normalizar, contexto, decidir, gate, salida, auditoría).
        Cada versión de bloque apunta a su <em>artefacto</em> (el flujo exportado o el piece) y declara qué contrato produce y consume.
        Una vez publicada es inmutable. Las variantes por stack (IMAP frente a Gmail) son bloques distintos con el mismo tipo y contrato.
      </p>
      <p className="task-summary">
        <strong>Contrato</strong>: solo la forma de los <em>datos</em> que un bloque entrega a otro (por ejemplo EmailEvent: remitente,
        asunto, prioridad…). No es un flujo ni un artefacto.
      </p>
      {error && <p className="error">{error}</p>}

      <h3>Contratos</h3>
      <table className="linked-table">
        <thead>
          <tr>
            <th>Contrato</th>
            <th>Versión</th>
            <th>Descripción</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => {
            const next = NEXT_STATUS[c.status];
            return (
              <tr key={`${c.key}@${c.version}`}>
                <td>{c.key}</td>
                <td>v{c.version}</td>
                <td>{c.description}</td>
                <td>
                  <span className="badge">{c.status}</span>
                </td>
                <td className="row-actions">
                  {next && (!next.superOnly || isSuperadmin) && (
                    <button className="secondary" onClick={() => setContractStatus(c, next.to)}>
                      {next.label}
                    </button>
                  )}
                  {isSuperadmin && c.status === 'draft' && (
                    <button className="remove" onClick={() => deleteContract(c)}>
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {contracts.length === 0 && <p className="empty">Todavía no hay contratos.</p>}

      <div className="toolbar">
        <button className="secondary" onClick={() => setShowNewContract((v) => !v)}>
          {showNewContract ? 'Cancelar' : '+ Nuevo contrato (o nueva versión)'}
        </button>
      </div>
      {showNewContract && (
        <form className="new-component-form" onSubmit={createContract}>
          <input
            type="text"
            placeholder="clave (ej. EmailEvent). Si ya existe, crea la siguiente versión"
            value={newContract.key}
            onChange={(e) => setNewContract({ ...newContract, key: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="descripción"
            value={newContract.description}
            onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder='esquema JSON de los DATOS (opcional, ej. {"type":"object"}). No pegues aquí un flujo'
            value={newContract.schema}
            onChange={(e) => setNewContract({ ...newContract, schema: e.target.value })}
          />
          <button type="submit">Crear contrato</button>
        </form>
      )}

      <h3>Bloques</h3>
      <div className="toolbar">
        <button className="secondary" onClick={() => setShowNewBlock((v) => !v)}>
          {showNewBlock ? 'Cancelar' : '+ Nuevo bloque'}
        </button>
      </div>
      {showNewBlock && (
        <form className="new-component-form" onSubmit={createBlock}>
          <input
            type="text"
            placeholder="nombre (ej. Inbound IMAP trigger)"
            value={newBlock.name}
            onChange={(e) => setNewBlock({ ...newBlock, name: e.target.value })}
            required
          />
          <select value={newBlock.kind} onChange={(e) => setNewBlock({ ...newBlock, kind: e.target.value })}>
            {BLOCK_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder='variante por stack (JSON, ej. {"mailbox":"imap"}); vacío = agnóstico'
            value={newBlock.variant}
            onChange={(e) => setNewBlock({ ...newBlock, variant: e.target.value })}
          />
          <select value={newBlock.comp_type} onChange={(e) => setNewBlock({ ...newBlock, comp_type: e.target.value })}>
            <option value="activepieces_flow">activepieces_flow (plantilla de flujo)</option>
            <option value="activepieces_piece">activepieces_piece (piece propio)</option>
            <option value="code_step">code_step (paso Code)</option>
          </select>
          <input type="text" placeholder="propietario" value={newBlock.owner} onChange={(e) => setNewBlock({ ...newBlock, owner: e.target.value })} />
          <button type="submit">Crear bloque</button>
        </form>
      )}
      <table className="linked-table">
        <thead>
          <tr>
            <th>Componente</th>
            <th>Tipo de bloque</th>
            <th>Variante (JSON)</th>
            <th>Versiones</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => {
            const edit = edits[b.component_id] ?? { kind: '', variant: '{}' };
            return (
              <Fragment key={b.component_id}>
                <tr>
                  <td>{b.name}</td>
                  <td>
                    <select
                      value={edit.kind}
                      onChange={(e) => setEdits({ ...edits, [b.component_id]: { ...edit, kind: e.target.value } })}
                    >
                      <option value="">— monolítico (sin tipo) —</option>
                      {BLOCK_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={edit.variant}
                      onChange={(e) => setEdits({ ...edits, [b.component_id]: { ...edit, variant: e.target.value } })}
                    />
                  </td>
                  <td>{b.version_count}</td>
                  <td className="row-actions">
                    <button onClick={() => saveBlock(b)}>Guardar</button>
                    <button className="secondary" onClick={() => toggleExpand(b.component_id)}>
                      {expandedId === b.component_id ? 'Ocultar versiones' : 'Versiones'}
                    </button>
                  </td>
                </tr>
                {expandedId === b.component_id && (
                  <tr>
                    <td colSpan={5}>
                      {b.kind === null && (
                        <p className="empty">Asigna un tipo de bloque y guarda antes de usar este componente en una composición.</p>
                      )}
                      <table className="linked-table">
                        <thead>
                          <tr>
                            <th>Versión</th>
                            <th>Estado</th>
                            <th>Produce</th>
                            <th>Consume</th>
                            <th>Artefacto</th>
                            <th>Cambios</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(versions[b.component_id] ?? []).map((v) => {
                            const next = NEXT_STATUS[v.status];
                            return (
                              <tr key={v.id}>
                                <td>v{v.version}</td>
                                <td>
                                  <span className="badge">{v.status}</span>
                                </td>
                                <td>{v.output_contract_key ? `${v.output_contract_key}@${v.output_contract_version}` : '—'}</td>
                                <td>{v.consumes.length ? v.consumes.join(', ') : '—'}</td>
                                <td>
                                  {v.artifact_ref || '—'}
                                  {v.artifact_sha256 && <div title={v.artifact_sha256}>sha256 {v.artifact_sha256.slice(0, 12)}…</div>}
                                </td>
                                <td>{v.changelog}</td>
                                <td className="row-actions">
                                  {next && (!next.superOnly || isSuperadmin) && (
                                    <button className="secondary" onClick={() => setVersionStatus(b.component_id, v, next.to)}>
                                      {next.label}
                                    </button>
                                  )}
                                  {isSuperadmin && v.status === 'draft' && (
                                    <button className="remove" onClick={() => deleteVersion(b.component_id, v)}>
                                      Eliminar
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <form className="new-component-form" onSubmit={(e) => createVersion(e, b.component_id)}>
                        <input
                          type="text"
                          placeholder="qué cambia en esta versión"
                          value={newVersion.changelog}
                          onChange={(e) => setNewVersion({ ...newVersion, changelog: e.target.value })}
                          required
                        />
                        <input
                          type="text"
                          placeholder="artefacto: git:Vrutal-Gon/VrutalOS:<ruta>@<SHA de commit de 40 caracteres>  o  piece:@scope/nombre@1.0.0"
                          value={newVersion.artifact_ref}
                          onChange={(e) => setNewVersion({ ...newVersion, artifact_ref: e.target.value })}
                        />
                        <input
                          type="text"
                          placeholder="sha256 del contenido del artefacto (opcional, 64 caracteres hex)"
                          value={newVersion.artifact_sha256}
                          onChange={(e) => setNewVersion({ ...newVersion, artifact_sha256: e.target.value })}
                        />
                        <select value={newVersion.contract} onChange={(e) => setNewVersion({ ...newVersion, contract: e.target.value })}>
                          <option value="">— no produce contrato —</option>
                          {contracts.map((c) => (
                            <option key={`${c.key}@${c.version}`} value={`${c.key}@${c.version}`}>
                              {c.key}@{c.version} ({c.status})
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="contratos que consume, separados por comas (ej. EmailEvent)"
                          value={newVersion.consumes}
                          onChange={(e) => setNewVersion({ ...newVersion, consumes: e.target.value })}
                        />
                        <button type="submit">Crear versión</button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {blocks.length === 0 && <p className="empty">No hay componentes todavía. Créalos en la pestaña Componentes.</p>}
    </div>
  );
}
