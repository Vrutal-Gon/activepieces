import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Provider } from '../lib/types';
import { ExternalLink } from '../components/ExternalLink';

type EditForm = Pick<Provider, 'name' | 'category' | 'pricing_model' | 'unit_cost_est' | 'notes' | 'docs_url'>;

export function ProviderCatalog() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newProvider, setNewProvider] = useState({
    name: '',
    category: '',
    pricing_model: '',
    unit_cost_est: '',
    notes: '',
    docs_url: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  useEffect(() => {
    loadProviders();
    supabase.rpc('is_superadmin').then(({ data, error }) => {
      if (error) setError(error.message);
      else setIsSuperadmin(!!data);
    });
  }, []);

  async function loadProviders() {
    const { data, error } = await supabase.rpc('catalog_list_providers');
    if (error) setError(error.message);
    else setProviders((data ?? []) as Provider[]);
  }

  async function createProvider(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc('catalog_create_provider', {
      p_name: newProvider.name,
      p_category: newProvider.category.trim().toLowerCase(),
      p_pricing_model: newProvider.pricing_model || null,
      p_unit_cost_est: newProvider.unit_cost_est ? Number(newProvider.unit_cost_est) : null,
      p_notes: newProvider.notes || null,
      p_docs_url: newProvider.docs_url || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNewProvider({ name: '', category: '', pricing_model: '', unit_cost_est: '', notes: '', docs_url: '' });
    setShowNew(false);
    loadProviders();
  }

  function startEdit(p: Provider) {
    setEditingId(p.id);
    setEditForm({
      name: p.name,
      category: p.category,
      pricing_model: p.pricing_model,
      unit_cost_est: p.unit_cost_est,
      notes: p.notes,
      docs_url: p.docs_url,
    });
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;
    const { error } = await supabase.rpc('catalog_update_provider', {
      p_id: editingId,
      p_name: editForm.name,
      p_category: editForm.category.trim().toLowerCase(),
      p_pricing_model: editForm.pricing_model || null,
      p_unit_cost_est: editForm.unit_cost_est,
      p_notes: editForm.notes || null,
      p_docs_url: editForm.docs_url || null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    setEditForm(null);
    loadProviders();
  }

  async function deleteProvider(id: string) {
    const { error } = await supabase.rpc('catalog_delete_provider', { p_id: id });
    if (error) {
      setError(error.message);
      return;
    }
    loadProviders();
  }

  const grouped: Record<string, Provider[]> = {};
  for (const p of providers) {
    (grouped[p.category] ||= []).push(p);
  }

  return (
    <div className="panel">
      <h2>Proveedores</h2>
      <p className="task-summary">
        APIs y servicios que Vrutal paga y usa internamente para que los agentes funcionen bien
        (Apollo.io, Clay, Apify, Hugging Face…). Es gasto operativo de Vrutal — no aparece en el
        stack ni en la ficha del cliente.
      </p>
      {error && <p className="error">{error}</p>}

      {Object.entries(grouped).map(([category, opts]) => (
        <div key={category} className="role-group">
          <h3>{category}</h3>
          <table className="linked-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Modelo de precio</th>
                <th>Costo unitario est.</th>
                <th>Notas</th>
                <th>Docs</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {opts.map((p) =>
                editingId === p.id && editForm ? (
                  <tr key={p.id}>
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
                        value={editForm.pricing_model || ''}
                        onChange={(e) => setEditForm({ ...editForm, pricing_model: e.target.value || null })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.unit_cost_est ?? ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            unit_cost_est: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value || null })}
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
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.pricing_model || '—'}</td>
                    <td>{p.unit_cost_est ?? '—'}</td>
                    <td>{p.notes || '—'}</td>
                    <td>
                      <ExternalLink url={p.docs_url} label="Link" />
                    </td>
                    <td className="row-actions">
                      {isSuperadmin && (
                        <>
                          <button className="secondary" onClick={() => startEdit(p)}>
                            Editar
                          </button>
                          <button className="remove" onClick={() => deleteProvider(p.id)}>
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

      {providers.length === 0 && !error && <p className="empty">No hay proveedores todavía.</p>}

      <div className="toolbar">
        <button className="secondary" onClick={() => setShowNew((v) => !v)}>
          {showNew ? 'Cancelar' : '+ Nuevo proveedor'}
        </button>
      </div>

      {showNew && (
        <form className="new-component-form" onSubmit={createProvider}>
          <input
            type="text"
            placeholder="Nombre (ej. Apollo.io)"
            value={newProvider.name}
            onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="categoría (ej. enrichment, scraping, ai_inference)"
            value={newProvider.category}
            onChange={(e) => setNewProvider({ ...newProvider, category: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="modelo de precio (ej. per_credit, subscription)"
            value={newProvider.pricing_model}
            onChange={(e) => setNewProvider({ ...newProvider, pricing_model: e.target.value })}
          />
          <input
            type="text"
            placeholder="costo unitario estimado"
            value={newProvider.unit_cost_est}
            onChange={(e) => setNewProvider({ ...newProvider, unit_cost_est: e.target.value })}
          />
          <input
            type="text"
            placeholder="notas"
            value={newProvider.notes}
            onChange={(e) => setNewProvider({ ...newProvider, notes: e.target.value })}
          />
          <input
            type="text"
            placeholder="URL de documentación"
            value={newProvider.docs_url}
            onChange={(e) => setNewProvider({ ...newProvider, docs_url: e.target.value })}
          />
          <button type="submit">Crear proveedor</button>
        </form>
      )}
    </div>
  );
}
