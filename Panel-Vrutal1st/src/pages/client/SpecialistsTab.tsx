import { useCallback, useState, type FormEvent } from 'react';
import { listRoleKeys } from '../../lib/api/catalog';
import { contractSpecialist } from '../../lib/api/tenants';
import { errorMessage } from '../../lib/api/client';
import { useAsyncData } from '../../lib/hooks/useAsyncData';
import { formatDate } from '../../lib/format';
import type { TenantSpecialistDetail, TenantSpecialistStatus } from '../../lib/types';

const STATUS_LABEL: Record<TenantSpecialistStatus, string> = {
  contracted: 'activo',
  paused: 'pausado',
  cancelled: 'cancelado',
};

const STATUS_CLASS: Record<TenantSpecialistStatus, string> = {
  contracted: 'pill pill--ok',
  paused: 'pill pill--warn',
  cancelled: 'pill',
};

interface SpecialistsTabProps {
  tenantId: string;
  specialists: TenantSpecialistDetail[];
  canEdit: boolean;
  onOpenRole: (key: string) => void;
  onContracted: () => void;
}

export function SpecialistsTab({ tenantId, specialists, canEdit, onOpenRole, onContracted }: SpecialistsTabProps) {
  return (
    <div>
      {canEdit && <ContractForm tenantId={tenantId} alreadyContracted={specialists} onContracted={onContracted} />}

      {specialists.length === 0 ? (
        <div className="empty-state">
          <h2 className="empty-state__title">Sin especialistas contratados</h2>
          <p className="empty-state__body">Cuando este cliente contrate un rol aparecerá aquí con su versión y sus flujos.</p>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Especialista</th>
                <th>Versión</th>
                <th>Estado</th>
                <th className="data-table__num">Flujos activos</th>
                <th>Contratado</th>
                <th>
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {specialists.map((s) => {
                const behind = s.latest_active_version !== null && s.latest_active_version > s.job_role_version;
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="data-table__primary">{s.job_role_name ?? s.job_role_key}</span>
                      <span className="data-table__secondary">{s.job_role_key}</span>
                    </td>
                    <td>
                      <span className="mono">v{s.job_role_version}</span>
                      {behind && <span className="pill pill--warn">v{s.latest_active_version} disponible</span>}
                    </td>
                    <td>
                      <span className={STATUS_CLASS[s.status]}>{STATUS_LABEL[s.status]}</span>
                    </td>
                    <td className="data-table__num">
                      {s.flows_enabled} / {s.flows_total}
                    </td>
                    <td className="mono">{formatDate(s.contracted_at)}</td>
                    <td className="data-table__actions">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onOpenRole(s.job_role_key)}>
                        Ver rol
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ContractFormProps {
  tenantId: string;
  alreadyContracted: TenantSpecialistDetail[];
  onContracted: () => void;
}

function ContractForm({ tenantId, alreadyContracted, onContracted }: ContractFormProps) {
  const loadRoles = useCallback((signal: AbortSignal) => listRoleKeys(signal), []);
  const { state } = useAsyncData(loadRoles);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (state.status !== 'ready') return null;

  const contractedKeys = new Set(alreadyContracted.filter((s) => s.status === 'contracted').map((s) => s.job_role_key));
  const available = state.data.filter((r) => !contractedKeys.has(r.key));
  if (available.length === 0) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await contractSpecialist(tenantId, selected);
      setSelected('');
      onContracted();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-4)' }}>
      <select className="text-input" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={busy}>
        <option value="">Contratar especialista…</option>
        {available.map((r) => (
          <option key={r.key} value={r.key}>
            {r.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn btn--primary btn--sm" disabled={busy || !selected}>
        {busy ? 'Contratando…' : 'Contratar'}
      </button>
      {error !== null && (
        <p className="notice notice--error" role="alert">
          {errorMessage(error)}
        </p>
      )}
    </form>
  );
}
