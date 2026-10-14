import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { SystemOption } from '../lib/types';
import { Link } from 'react-router';
import { ExternalLink } from '../components/ExternalLink';
import { PageHead } from '../components/PageHead';
import '../styles/pages/catalog.css';

interface TenantForSystemOption {
  tenant_id: string;
  tenant_name: string;
  system_category: string;
}

type EditForm = Pick<SystemOption, 'system_category' | 'name' | 'version' | 'connection_notes' | 'docs_url' | 'provider_key'>;

export function SystemCatalog() {
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
    provider_key: '',
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
      p_provider_key: newOption.provider_key.trim() || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewOption({ system_category: '', name: '', version: '', connection_notes: '', docs_url: '', provider_key: '' });
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
      provider_key: o.provider_key,
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
      p_provider_key: editForm.provider_key?.trim() || null,
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
    const n = tenantsForOption.length;
    return (
      <section className="catalog-stack">
        <PageHead
          crumbs={[{ label: 'Referencias' }, { label: 'Stack / Sistemas' }]}
          title={
            <>
              {selectedOption.name}
              {selectedOption.version ? ` (${selectedOption.version})` : ''}{' '}
              <span className="pill">{selectedOption.system_category}</span>
            </>
          }
        >
          <button type="button" className="btn btn--ghost" onClick={() => setSelectedOption(null)}>
            ← Todos los sistemas
          </button>
        </PageHead>
        {error && (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        )}
        <section className="table-card">
          <div className="table-card__head">
            <h2 className="table-card__title">
              {n} cliente{n === 1 ? '' : 's'} lo tiene{n === 1 ? '' : 'n'} en su stack
            </h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Categoría</th>
              </tr>
            </thead>
            <tbody>
              {tenantsForOption.map((t) => (
                <tr key={t.tenant_id}>
                  <td>
                    <Link className="data-table__primary" to={`/clientes/${encodeURIComponent(t.tenant_id)}/stack`}>
                      {t.tenant_name}
                    </Link>
                  </td>
                  <td className="mono">{t.system_category}</td>
                </tr>
              ))}
              {n === 0 && (
                <tr>
                  <td colSpan={2} className="data-table__empty">
                    Ningún cliente lo tiene en su stack todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    );
  }

  const grouped: Record<string, SystemOption[]> = {};
  for (const o of options) {
    (grouped[o.system_category] ||= []).push(o);
  }

  return (
    <section className="catalog-stack">
      <PageHead crumbs={[{ label: 'Referencias' }]} title="Stack / Sistemas" />
      <p className="catalog-note">
        El catálogo de sistemas que un cliente puede tener en su stack (ERP, CRM, email…). Si el sistema de un cliente
        no está aquí, agrégalo primero: así queda disponible para elegir desde la ficha del cliente.
      </p>
      <p className="catalog-note">
        <strong>Proveedor en VrutalOS</strong> es opcional: solo lo llevan los sistemas donde el Admin del cliente
        pega su propia clave (hoy <code>hubspot</code>, <code>anthropic</code> — el identificador exacto de
        <code>app/src/lib/providers.ts</code> en VrutalOS). Si lo pones, el sync (cada 15 min) habilita ese sistema en
        Integraciones de cada cliente que lo tenga en su Stack — sin tocar SQL. Si lo dejas vacío, el sistema queda
        solo como dato informativo (p. ej. un ERP), igual que hasta ahora.
      </p>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}

      {Object.entries(grouped).map(([category, opts]) => (
        <section key={category} className="table-card">
          <div className="table-card__head">
            <h2 className="table-card__title">{category}</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Versión</th>
                <th>Cómo conectar</th>
                <th>Docs</th>
                <th>Proveedor en VrutalOS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {opts.map((o) =>
                editingId === o.id && editForm ? (
                  <tr key={o.id}>
                    <td>
                      <input
                        className="text-input"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input"
                        value={editForm.version || ''}
                        onChange={(e) => setEditForm({ ...editForm, version: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input"
                        value={editForm.connection_notes || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, connection_notes: e.target.value || null })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="text-input"
                        value={editForm.docs_url || ''}
                        onChange={(e) => setEditForm({ ...editForm, docs_url: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        className="text-input"
                        placeholder="ej. anthropic (vacío = solo informativo)"
                        value={editForm.provider_key || ''}
                        onChange={(e) => setEditForm({ ...editForm, provider_key: e.target.value || null })}
                      />
                    </td>
                    <td className="data-table__actions">
                      <button type="button" className="btn btn--sm btn--primary" onClick={saveEdit}>
                        Guardar
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--ghost"
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
                      <button type="button" className="btn-link" onClick={() => openDetail(o)}>
                        {o.name}
                      </button>
                    </td>
                    <td>{o.version || '—'}</td>
                    <td>{o.connection_notes || '—'}</td>
                    <td>
                      <ExternalLink url={o.docs_url} label="Link" />
                    </td>
                    <td className="mono">{o.provider_key || '—'}</td>
                    <td className="data-table__actions">
                      {isSuperadmin && (
                        <>
                          <button type="button" className="btn btn--sm btn--ghost" onClick={() => startEdit(o)}>
                            Editar
                          </button>
                          <button type="button" className="btn btn--sm btn--danger" onClick={() => deleteOption(o.id)}>
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
        </section>
      ))}

      {options.length === 0 && !error && <p className="catalog-note">No hay sistemas todavía.</p>}

      <div className="inline-form">
        <button type="button" className="btn btn--ghost" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Cancelar' : '+ Nuevo sistema'}
        </button>
      </div>

      {showNew && (
        <form className="inline-form" onSubmit={createOption}>
          <input
            className="text-input"
            placeholder="categoría (ej. erp, crm, email)"
            value={newOption.system_category}
            onChange={(e) => setNewOption({ ...newOption, system_category: e.target.value })}
            required
          />
          <input
            className="text-input"
            placeholder="Nombre (ej. SAP S/4HANA)"
            value={newOption.name}
            onChange={(e) => setNewOption({ ...newOption, name: e.target.value })}
            required
          />
          <input
            className="text-input"
            placeholder="versión (ej. R/3, on-premise 2023)"
            value={newOption.version}
            onChange={(e) => setNewOption({ ...newOption, version: e.target.value })}
          />
          <input
            className="text-input"
            placeholder="cómo conectar / notas"
            value={newOption.connection_notes}
            onChange={(e) => setNewOption({ ...newOption, connection_notes: e.target.value })}
          />
          <input
            className="text-input"
            placeholder="URL de documentación"
            value={newOption.docs_url}
            onChange={(e) => setNewOption({ ...newOption, docs_url: e.target.value })}
          />
          <input
            className="text-input"
            placeholder="proveedor en VrutalOS (ej. anthropic — vacío si es solo informativo)"
            value={newOption.provider_key}
            onChange={(e) => setNewOption({ ...newOption, provider_key: e.target.value })}
          />
          <button type="submit" className="btn btn--primary">
            Crear sistema
          </button>
        </form>
      )}
    </section>
  );
}
