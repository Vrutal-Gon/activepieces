import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { SystemOption } from '../lib/types';

interface TenantForSystemOption {
  tenant_id: string;
  tenant_name: string;
  system_category: string;
}

interface SystemCatalogProps {
  onOpenClient: (tenantId: string) => void;
}

type EditForm = Pick<SystemOption, 'system_category' | 'name' | 'version' | 'connection_notes' | 'docs_url'>;

export function SystemCatalog({ onOpenClient }: SystemCatalogProps) {
  const [options, setOptions] = useState<SystemOption[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newOption, setNewOption] = useState({
    system_category: '',
    name: '',
    version: '',
    connection_notes: '',
    docs_url: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [selectedOption, setSelectedOption] = useState<SystemOption | null>(null);
  const [tenantsForOption, setTenantsForOption] = useState<TenantForSystemOption[]>([]);

  useEffect(() => {
    loadOptions();
    supabase.rpc('is_superadmin').then(({ data, error }) => {
      if (error) setError(error.message);
      else setIsSuperadmin(!!data);
    });
  }, []);

  async function loadOptions() {
    const { data, error } = await supabase.rpc('catalog_list_system_options');
    if (error) setError(error.message);
    else setOptions((data ?? []) as SystemOption[]);
  }

  async function createOption(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('catalog_create_system_option', {
      p_system_category: newOption.system_category.trim().toLowerCase(),
      p_name: newOption.name,
      p_version: newOption.version || null,
      p_connection_notes: newOption.connection_notes || null,
      p_docs_url: newOption.docs_url || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewOption({ system_category: '', name: '', version: '', connection_notes: '', docs_url: '' });
    setShowNew(false);
    loadOptions();
  }

  function startEdit(o: SystemOption) {
    setEditingId(o.id);
    setEditForm({
      system_category: o.system_category,
      name: o.name,
      version: o.version,
      connection_notes: o.connection_notes,
      docs_url: o.docs_url,
    });
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;
    const { error } = await supabase.rpc('catalog_update_system_option', {
      p_id: editingId,
      p_system_category: editForm.system_category.trim().toLowerCase(),
      p_name: editForm.name,
      p_version: editForm.version || null,
      p_connection_notes: editForm.connection_notes || null,
      p_docs_url: editForm.docs_url || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    setEditForm(null);
    loadOptions();
  }

  async function deleteOption(id: string) {
    const { error } = await supabase.rpc('catalog_delete_system_option', { p_id: id });
    if (error) {
      setError(error.message);
      return;
    }
    loadOptions();
  }

  async function openDetail(o: SystemOption) {
    setSelectedOption(o);
    const { data, error } = await supabase.rpc('catalog_list_tenants_for_system_option', {
      p_system_option_id: o.id,
    });
    if (error) setError(error.message);
    else setTenantsForOption((data ?? []) as TenantForSystemOption[]);
  }

  if (selectedOption) {
    return (
      <div className="panel">
        <div className="toolbar">
          <button className="secondary" onClick={() => setSelectedOption(null)}>
            ← Volver a Sistemas
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <h2>
          {selectedOption.name}
          {selectedOption.version ? ` (${selectedOption.version})` : ''}{' '}
          <span className="badge subtle">{selectedOption.system_category}</span>
        </h2>
        <p className="task-summary">
          <strong>{tenantsForOption.length}</strong> cliente{tenantsForOption.length === 1 ? '' : 's'} lo
          tiene{tenantsForOption.length === 1 ? '' : 'n'} definido en su stack.
        </p>
        <table className="linked-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Categoría</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tenantsForOption.map((t) => (
              <tr key={t.tenant_id}>
                <td>{t.tenant_name}</td>
                <td>{t.system_category}</td>
                <td>
                  <button className="secondary" onClick={() => onOpenClient(t.tenant_id)}>
                    Ver cliente
                  </button>
                </td>
              </tr>
            ))}
            {tenantsForOption.length === 0 && (
              <tr>
                <td colSpan={3} className="empty">
                  Ningún cliente lo tiene en su stack todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const grouped: Record<string, SystemOption[]> = {};
  for (const o of options) {
    (grouped[o.system_category] ||= []).push(o);
  }

  return (
    <div className="panel">
      <h2>Sistemas</h2>
      <p className="task-summary">
        El catálogo de sistemas que un cliente puede tener en su stack (ERP, CRM, email…). Si el
        sistema de un cliente no está acá, agrégalo primero — así queda disponible para elegir
        desde la ficha del cliente.
      </p>
      {error && <p className="error">{error}</p>}

      {Object.entries(grouped).map(([category, opts]) => (
        <div key={category} className="role-group">
          <h3>{category}</h3>
          <table className="linked-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Versión</th>
                <th>Cómo conectar</th>
                <th>Docs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {opts.map((o) =>
                editingId === o.id && editForm ? (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.version || ''}
                        onChange={(e) => setEditForm({ ...editForm, version: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.connection_notes || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, connection_notes: e.target.value || null })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.docs_url || ''}
                        onChange={(e) => setEditForm({ ...editForm, docs_url: e.target.value || null })}
                      />
                    </td>
                    <td className="row-actions">
                      <button onClick={saveEdit}>Guardar</button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditingId(null);
                          setEditForm(null);
                        }}
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={o.id}>
                    <td>
                      <button className="link-button" onClick={() => openDetail(o)}>
                        {o.name}
                      </button>
                    </td>
                    <td>{o.version || '—'}</td>
                    <td>{o.connection_notes || '—'}</td>
                    <td>
                      {o.docs_url ? (
                        <a href={o.docs_url} target="_blank" rel="noreferrer">
                          Link
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="row-actions">
                      {isSuperadmin && (
                        <>
                          <button className="secondary" onClick={() => startEdit(o)}>
                            Editar
                          </button>
                          <button className="remove" onClick={() => deleteOption(o.id)}>
                            Eliminar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ))}

      {options.length === 0 && !error && <p className="empty">No hay sistemas todavía.</p>}

      <div className="toolbar">
        <button className="secondary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Cancelar' : '+ Nuevo sistema'}
        </button>
      </div>

      {showNew && (
        <form className="new-component-form" onSubmit={createOption}>
          <input
            type="text"
            placeholder="categoría (ej. erp, crm, email)"
            value={newOption.system_category}
            onChange={(e) => setNewOption({ ...newOption, system_category: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Nombre (ej. SAP S/4HANA)"
            value={newOption.name}
            onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="versión (ej. R/3, on-premise 2023)"
            value={newOption.version}
            onChange={(e) => setNewOption({ ...newOption, version: e.target.value })}
          />
          <input
            type="text"
            placeholder="cómo conectar / notas"
            value={newOption.connection_notes}
            onChange={(e) => setNewOption({ ...newOption, connection_notes: e.target.value })}
          />
          <input
            type="text"
            placeholder="URL de documentación"
            value={newOption.docs_url}
            onChange={(e) => setNewOption({ ...newOption, docs_url: e.target.value })}
          />
          <button type="submit">Crear sistema</button>
        </form>
      )}
    </div>
  );
}
