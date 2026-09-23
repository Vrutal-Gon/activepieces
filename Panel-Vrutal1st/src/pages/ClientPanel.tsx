import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { SystemOption, Tenant, TenantSpecialistRow, TenantStackChoice } from '../lib/types';

interface ClientPanelProps {
  tenantId: string;
  onBack: () => void;
  onOpenRole: (key: string) => void;
}

export function ClientPanel({ tenantId, onBack, onOpenRole }: ClientPanelProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stack, setStack] = useState<TenantStackChoice[]>([]);
  const [systemOptions, setSystemOptions] = useState<SystemOption[]>([]);
  const [specialists, setSpecialists] = useState<TenantSpecialistRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [pickCategory, setPickCategory] = useState('');
  const [pickSystemOptionId, setPickSystemOptionId] = useState('');

  const loadTenant = useCallback(async () => {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
    if (error) setError(error.message);
    else setTenant(data as Tenant);
  }, [tenantId]);

  const loadStack = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_tenant_stack', { p_tenant_id: tenantId });
    if (error) setError(error.message);
    else setStack((data ?? []) as TenantStackChoice[]);
  }, [tenantId]);

  useEffect(() => {
    supabase.rpc('catalog_list_system_options').then(({ data, error }) => {
      if (error) setError(error.message);
      else setSystemOptions((data ?? []) as SystemOption[]);
    });
  }, []);

  const loadSpecialists = useCallback(async () => {
    const { data, error } = await supabase
      .from('tenant_specialist')
      .select('id, job_role_key, job_role_version, status, contracted_at, notes')
      .eq('tenant_id', tenantId)
      .order('contracted_at', { ascending: false });
    if (error) setError(error.message);
    else setSpecialists((data ?? []) as TenantSpecialistRow[]);
  }, [tenantId]);

  useEffect(() => {
    loadTenant();
    loadStack();
    loadSpecialists();
  }, [loadTenant, loadStack, loadSpecialists]);

  async function addStackChoice() {
    const option = systemOptions.find((o) => o.id === pickSystemOptionId);
    if (!option) return;
    const { error } = await supabase.rpc('set_tenant_stack_choice', {
      p_tenant_id: tenantId,
      p_system_category: option.system_category,
      p_system_option_id: option.id,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setPickSystemOptionId('');
    loadStack();
  }

  async function removeStackChoice(category: string) {
    const { error } = await supabase.rpc('remove_tenant_stack_choice', {
      p_tenant_id: tenantId,
      p_system_category: category,
    });
    if (error) {
      setError(error.message);
      return;
    }
    loadStack();
  }

  const categories = Array.from(new Set(systemOptions.map((o) => o.system_category))).sort();
  const filteredOptions = pickCategory
    ? systemOptions.filter((o) => o.system_category === pickCategory)
    : systemOptions;

  if (!tenant) {
    return <div className="panel">{error ? <p className="error">{error}</p> : <p>Cargando…</p>}</div>;
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <button className="secondary" onClick={onBack}>
          ← Volver a Clientes
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="role-card">
        <div className="role-card-header">
          <h2>
            {tenant.name} <span className="badge">{tenant.status}</span>
          </h2>
        </div>
        <div className="role-fields">
          <div className="field">
            <span className="field-label">Razón social</span>
            <span className="field-value">{tenant.legal_name || '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">Industria</span>
            <span className="field-value">{tenant.industry || '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">Tamaño</span>
            <span className="field-value">{tenant.size_employees ?? '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">Email</span>
            <span className="field-value">{tenant.email || '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">Teléfono</span>
            <span className="field-value">{tenant.phone || '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">Website</span>
            <span className="field-value">{tenant.website || '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">País</span>
            <span className="field-value">{tenant.country || '—'}</span>
          </div>
          <div className="field">
            <span className="field-label">Estado data plane</span>
            <span className="field-value">{tenant.data_plane_status || '—'}</span>
          </div>
        </div>
      </div>

      <h3>Stack del cliente</h3>
      <p className="task-summary">
        Qué sistema usa este cliente en cada categoría, elegido del catálogo de{' '}
        <strong>Sistemas</strong>. Esto es lo que va a determinar qué componente se despliega para
        cada tarea de sus agentes. Si el sistema del cliente no aparece en el selector, agrégalo
        primero en la pestaña Sistemas.
      </p>
      <table className="linked-table">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Sistema</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stack.map((s) => (
            <tr key={s.system_category}>
              <td>{s.system_category}</td>
              <td>
                {s.system_name}
                {s.version ? ` (${s.version})` : ''}
              </td>
              <td>
                <button className="remove" onClick={() => removeStackChoice(s.system_category)}>
                  Quitar
                </button>
              </td>
            </tr>
          ))}
          {stack.length === 0 && (
            <tr>
              <td colSpan={3} className="empty">
                Sin stack definido todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="toolbar">
        <label>
          Categoría:
          <select
            value={pickCategory}
            onChange={(e) => {
              setPickCategory(e.target.value);
              setPickSystemOptionId('');
            }}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sistema:
          <select value={pickSystemOptionId} onChange={(e) => setPickSystemOptionId(e.target.value)}>
            <option value="">— elegir —</option>
            {filteredOptions.map((o) => (
              <option key={o.id} value={o.id}>
                [{o.system_category}] {o.name}
                {o.version ? ` (${o.version})` : ''}
              </option>
            ))}
          </select>
        </label>
        <button onClick={addStackChoice} disabled={!pickSystemOptionId}>
          Agregar
        </button>
      </div>

      <h3>Agentes contratados</h3>
      <table className="linked-table">
        <thead>
          <tr>
            <th>Agente</th>
            <th>Versión</th>
            <th>Estado</th>
            <th>Contratado el</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {specialists.map((s) => (
            <tr key={s.id}>
              <td className="task-code">{s.job_role_key}</td>
              <td>v{s.job_role_version}</td>
              <td>{s.status}</td>
              <td>{new Date(s.contracted_at).toLocaleDateString()}</td>
              <td>
                <button className="secondary" onClick={() => onOpenRole(s.job_role_key)}>
                  Ver rol
                </button>
              </td>
            </tr>
          ))}
          {specialists.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                Sin agentes contratados todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
